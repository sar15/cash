import { inngest } from '@/lib/inngest/client'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { runScenarioForecastEngine } from '@/lib/engine/scenarios/engine'
import type { AccountInput } from '@/lib/engine'
import { buildForecastMonthLabels } from '@/lib/forecast-periods'
import { upsertForecastResult, markForecastCalculating } from '@/lib/db/queries/forecast-results'
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types'
import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types'

// Inngest v4: createFunction takes (options, handler) — trigger is inside options
export const recomputeForecast = inngest.createFunction(
  {
    id: 'recompute-forecast',
    name: 'Recompute Forecast on Config Change',
    triggers: [{ event: 'forecast/config.updated' }],
    debounce: { period: '5s', key: 'event.data.companyId' },
  },
  async ({ event, step }) => {
    const { companyId } = (event as unknown as { data: { companyId: string } }).data

    const [accounts, actuals, valueRules, timingProfiles, complianceConfig, company] =
      await step.run('load-company-data', async () => {
        return Promise.all([
          db.query.accounts.findMany({ where: eq(schema.accounts.companyId, companyId) }),
          db.query.monthlyActuals.findMany({
            where: eq(schema.monthlyActuals.companyId, companyId),
            orderBy: (a, { asc }) => [asc(a.period)],
          }),
          db.query.valueRules.findMany({ where: eq(schema.valueRules.companyId, companyId) }),
          db.query.timingProfiles.findMany({ where: eq(schema.timingProfiles.companyId, companyId) }),
          db.query.complianceConfig.findFirst({ where: eq(schema.complianceConfig.companyId, companyId) }),
          db.query.companies.findFirst({ where: eq(schema.companies.id, companyId) }),
        ])
      })

    if (!accounts || accounts.length === 0) return { skipped: true, reason: 'no accounts' }

    // Mark as calculating so the UI can show a spinner and block PDF export
    await step.run('mark-calculating', async () => {
      return markForecastCalculating(companyId, null)
    })

    const historicalMonths: string[] = [
      ...new Set((actuals as Array<{ period: string }>).map(a => a.period))
    ].sort()

    const forecastMonths = buildForecastMonthLabels({
      fyStartMonth: (company as { fyStartMonth?: number } | null)?.fyStartMonth ?? 4,
      historicalPeriods: historicalMonths,
    })

    const accountInputs: AccountInput[] = (accounts as Array<{
      id: string; name: string; accountType: string; standardMapping?: string | null
    }>).map(acc => {
      const accountActuals = (actuals as Array<{ accountId: string; period: string; amount: number }>)
        .filter(a => a.accountId === acc.id)
      const historicalValues = historicalMonths.map(period => {
        const match = accountActuals.find(a => a.period === period)
        return match?.amount ?? 0
      })

      let category: AccountInput['category']
      if (acc.accountType === 'revenue') category = 'Revenue'
      else if (acc.accountType === 'expense' && acc.standardMapping?.startsWith('cogs')) category = 'COGS'
      else if (acc.accountType === 'expense') category = 'Operating Expenses'
      else if (acc.accountType === 'asset') category = 'Assets'
      else if (acc.accountType === 'liability') category = 'Liabilities'
      else category = 'Equity'

      return { id: acc.id, name: acc.name, category, historicalValues }
    })

    const valueRulesMap: Record<string, AnyValueRuleConfig> = {}
    for (const rule of (valueRules as Array<{ accountId: string; ruleType: string; config: string }>)) {
      try {
        const config = typeof rule.config === 'string' ? JSON.parse(rule.config) : rule.config
        valueRulesMap[rule.accountId] = {
          type: rule.ruleType as AnyValueRuleConfig['type'],
          accountId: rule.accountId,
          ...config,
        } as AnyValueRuleConfig
      } catch { /* skip malformed */ }
    }

    // Auto-generate baseline rules for accounts with no configured rule.
    // This ensures a zero-touch forecast is always available after import —
    // the user never sees a blank forecast just because they haven't configured rules.
    for (const acc of accountInputs) {
      if (valueRulesMap[acc.id]) continue // already has a rule
      if (['Assets', 'Liabilities', 'Equity'].includes(acc.category)) continue // BS accounts don't need rules
      const nonZeroHistory = acc.historicalValues.filter(v => v !== 0)
      if (nonZeroHistory.length === 0) continue // no history to base a forecast on
      // Use same_last_year if we have 12+ months, otherwise 3-month rolling average
      valueRulesMap[acc.id] = nonZeroHistory.length >= 12
        ? { type: 'same_last_year', accountId: acc.id }
        : { type: 'rolling_avg', accountId: acc.id, lookbackMonths: Math.min(3, nonZeroHistory.length) }
    }

    const timingProfilesMap: Record<string, AnyTimingProfileConfig> = {}
    for (const profile of (timingProfiles as Array<{ profileType: string; config: string; name: string }>)) {
      try {
        const config = typeof profile.config === 'string' ? JSON.parse(profile.config) : profile.config
        const accountId = (config as Record<string, unknown>).accountId ?? profile.name
        if (accountId && typeof accountId === 'string') {
          timingProfilesMap[accountId] = {
            type: profile.profileType as AnyTimingProfileConfig['type'],
            accountId,
            ...config,
          } as AnyTimingProfileConfig
        }
      } catch { /* skip malformed */ }
    }

    const result = await step.run('run-engine', async () => {
      return runScenarioForecastEngine({
        accounts: accountInputs,
        forecastMonthLabels: forecastMonths,
        scenario: null,
        valueRules: valueRulesMap,
        timingProfiles: timingProfilesMap,
        microForecastItems: [],
        complianceConfig: complianceConfig ? {
          gstRatePct: (complianceConfig as { gstRate?: number }).gstRate ?? 18,
          inputTaxCreditPct: (complianceConfig as { itcPct?: number }).itcPct ?? 85,
          advanceTaxRatePct: (complianceConfig as { taxRate?: number }).taxRate ?? 25.17,
          supplyType: ((complianceConfig as { supplyType?: string }).supplyType ?? 'intra-state') as 'intra-state' | 'inter-state',
        } : undefined,
      })
    })

    await step.run('save-result', async () => {
      const raw = result.rawIntegrationResults
      const lastMonth = raw[raw.length - 1]
      return upsertForecastResult(companyId, {
        scenarioId: null,
        plData: JSON.stringify({ accountForecasts: result.accountForecasts }),
        bsData: JSON.stringify({ months: raw.map(m => m?.bs) }),
        cfData: JSON.stringify({ months: raw.map(m => m?.cf) }),
        compliance: JSON.stringify(result.compliance),
        metrics: JSON.stringify({
          closingCash: lastMonth?.bs?.cash ?? 0,
          totalRevenue: raw.reduce((s, m) => s + (m?.pl?.revenue ?? 0), 0),
          totalNetIncome: raw.reduce((s, m) => s + (m?.pl?.netIncome ?? 0), 0),
          forecastMonths: result.forecastMonths,
        }),
      })
    })

    return { companyId, forecastMonths: forecastMonths.length, accounts: accounts.length }
  }
)
