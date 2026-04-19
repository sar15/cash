import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { scenarioNotes } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { jsonOk, jsonError, resolveAuthedCompany, isErrorResponse } from '@/lib/api/helpers'
import { buildAutoSummary } from '@/lib/reports/auto-summary'
import { aggregateAnnual } from '@/lib/reports/annual-aggregator'
import { getForecastResult } from '@/lib/db/queries/forecast-results'
import type { EngineResult } from '@/lib/engine'

/**
 * POST /api/notes/generate-summary
 *
 * Generate auto-summary bullets for a financial statement using the
 * cached forecast result from the database.
 *
 * Body:
 * - companyId (required — also sent as x-company-id header or query param)
 * - scenarioId (optional, null = base case)
 * - statementType (required: 'PL' | 'BS' | 'CF')
 * - periodKey (required: e.g. "FY25-26")
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    // Viewers are blocked by resolveAuthedCompany for mutations, but double-check
    if (ctx.role === 'viewer' && !ctx.isOwner) {
      return jsonError('Forbidden: Viewers cannot generate summaries', 403)
    }

    const body = await request.json()
    const { scenarioId, statementType, periodKey } = body

    if (!statementType || !periodKey) {
      return jsonError('Missing required fields: statementType, periodKey', 400)
    }

    // Fetch cached forecast result to build real annual statement
    const cachedResult = await getForecastResult(ctx.companyId, scenarioId ?? null)

    let autoSummary: string[] = []

    if (cachedResult && cachedResult.status === 'ready') {
      try {
        // Parse the cached integration results
        const bsData = JSON.parse(cachedResult.bsData) as { months?: Record<string, unknown>[] }
        const cfData = JSON.parse(cachedResult.cfData) as { months?: Record<string, unknown>[] }
        const plData = JSON.parse(cachedResult.plData) as { accountForecasts?: Record<string, number[]> }
        const metricsData = JSON.parse(cachedResult.metrics) as { forecastMonths?: string[] }

        const forecastMonths = metricsData.forecastMonths ?? []
        const bsMonths = bsData.months ?? []
        const cfMonths = cfData.months ?? []
        const accountForecasts = plData.accountForecasts ?? {}

        if (forecastMonths.length > 0) {
          // Reconstruct rawIntegrationResults from cached data
          const rawMonths = forecastMonths.map((_: string, i: number) => ({
            pl: {
              revenueFromOps: 0,
              otherIncome: 0,
              totalRevenue: 0,
              cogs: 0,
              employeeBenefits: 0,
              financeCosts: 0,
              depreciation: 0,
              amortisation: 0,
              otherExpenses: 0,
              totalExpenses: 0,
              profitBeforeExceptional: 0,
              exceptionalItems: 0,
              profitBeforeTax: 0,
              taxExpense: 0,
              profitAfterTax: 0,
              revenue: 0,
              expense: 0,
              netIncome: 0,
            },
            bs: (bsMonths[i] ?? {}) as Record<string, number>,
            cf: (cfMonths[i] ?? {}) as Record<string, number>,
          }))

          // Compute P&L totals from accountForecasts
          Object.entries(accountForecasts).forEach(([, vals]) => {
            vals.forEach((v: number, i: number) => {
              if (rawMonths[i]) {
                rawMonths[i].pl.revenue += v
              }
            })
          })
          rawMonths.forEach(m => {
            m.pl.revenueFromOps = m.pl.revenue
            m.pl.totalRevenue = m.pl.revenue
            m.pl.profitAfterTax = (m.bs as Record<string, number>).retainedEarnings ?? 0
          })

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const annual = aggregateAnnual(rawMonths as any)
          autoSummary = buildAutoSummary(statementType as 'PL' | 'BS' | 'CF', annual, null)
        }
      } catch (err) {
        console.error('[generate-summary] Failed to parse cached forecast:', err)
        // Fall through to empty summary
      }
    }

    // If we couldn't build from cache, return a helpful placeholder
    if (autoSummary.length === 0) {
      autoSummary = [
        'Open the Forecast page to generate a forecast, then click Generate again for real metrics.',
      ]
    }

    const generatedAt = new Date().toISOString()

    // Upsert notes with auto-summary (never overwrites userNotes)
    await db
      .insert(scenarioNotes)
      .values({
        companyId: ctx.companyId,
        scenarioId: scenarioId || null,
        statementType,
        periodKey,
        autoSummary: JSON.stringify(autoSummary),
        autoSummaryGeneratedAt: generatedAt,
        updatedAt: generatedAt,
        updatedBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [
          scenarioNotes.companyId,
          scenarioNotes.scenarioId,
          scenarioNotes.statementType,
          scenarioNotes.periodKey,
        ],
        set: {
          autoSummary: JSON.stringify(autoSummary),
          autoSummaryGeneratedAt: generatedAt,
          updatedAt: generatedAt,
          updatedBy: ctx.userId,
        },
      })

    return jsonOk({ autoSummary, generatedAt })
  } catch (error) {
    console.error('POST /api/notes/generate-summary error:', error)
    return jsonError('Failed to generate summary', 500)
  }
}
