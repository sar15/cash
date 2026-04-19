import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonError } from '@/lib/api/helpers'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getForecastResult } from '@/lib/db/queries/forecast-results'
import { aggregateAnnual } from '@/lib/reports/annual-aggregator'
import { resolvePriorYear } from '@/lib/reports/prior-year-resolver'
import { generateAnnualPDFReport } from '@/lib/reports/annual-pdf-generator'
import { generatePeriodKey } from '@/lib/utils/date-utils'
import { handleRouteError, parseJsonBody } from '@/lib/server/api'
import { parseMonthLabel } from '@/lib/forecast-periods'
import type { ThreeWayMonth } from '@/lib/engine/three-way/builder'
import { z } from 'zod'

const schema = z.object({
  scenarioId: z.string().nullable().optional(),
  notes: z.object({
    pl: z.string().optional(),
    bs: z.string().optional(),
    cf: z.string().optional(),
  }).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await parseJsonBody(request, schema)
    const { scenarioId, notes } = body

    // Fetch company details
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, ctx.companyId),
    })
    if (!company) return jsonError('Company not found', 404)

    // Fetch cached forecast result
    const cached = await getForecastResult(ctx.companyId, scenarioId ?? null)
    if (!cached || cached.status === 'calculating') {
      return jsonError('No forecast data found. Open the Forecast page first.', 422)
    }

    // Parse cached data
    const metricsData = JSON.parse(cached.metrics) as { forecastMonths?: string[] }
    const bsData = JSON.parse(cached.bsData) as { months?: Record<string, unknown>[] }
    const cfData = JSON.parse(cached.cfData) as { months?: Record<string, unknown>[] }
    const plData = JSON.parse(cached.plData) as { accountForecasts?: Record<string, number[]> }

    const forecastMonths = metricsData.forecastMonths ?? []
    if (forecastMonths.length === 0) {
      return jsonError('Forecast contains no data. Open the Forecast page first.', 422)
    }

    // Reconstruct rawIntegrationResults from cached data
    // The cached BS/CF months have full Schedule III fields from the engine
    // P&L Schedule III fields must be reconstructed from accountForecasts + accounts
    const bsMonths = bsData.months ?? []
    const cfMonths = cfData.months ?? []
    const accountForecasts = plData.accountForecasts ?? {}

    // Fetch accounts to classify by standard mapping
    const { getAccountsForCompany } = await import('@/lib/db/queries/accounts')
    const { isCOGSAccount } = await import('@/lib/standards/account-classifier')
    const companyAccounts = await getAccountsForCompany(ctx.companyId)

    const rawMonths = forecastMonths.map((_: string, i: number) => ({
      pl: {
        revenueFromOps: 0, otherIncome: 0, totalRevenue: 0,
        cogs: 0, employeeBenefits: 0, financeCosts: 0,
        depreciation: 0, amortisation: 0, otherExpenses: 0,
        totalExpenses: 0, profitBeforeExceptional: 0, exceptionalItems: 0,
        profitBeforeTax: 0, taxExpense: 0, profitAfterTax: 0,
        revenue: 0, grossProfit: 0, expense: 0, netIncome: 0,
      },
      bs: (bsMonths[i] ?? {}) as Record<string, number>,
      cf: (cfMonths[i] ?? {}) as Record<string, number>,
    }))

    // Populate P&L from accountForecasts using standard mappings
    companyAccounts.forEach(acc => {
      const vals = accountForecasts[acc.id] ?? []
      vals.forEach((v: number, i: number) => {
        if (!rawMonths[i]) return
        const pl = rawMonths[i].pl
        const sm = acc.standardMapping ?? ''
        if (acc.accountType === 'revenue') {
          if (sm.includes('OTHER_INCOME') || sm.includes('INTEREST') || sm.includes('DIVIDEND')) {
            pl.otherIncome += v
          } else {
            pl.revenueFromOps += v
          }
          pl.revenue += v
        } else if (acc.accountType === 'expense') {
          if (isCOGSAccount(acc)) {
            pl.cogs += v
          } else if (sm.includes('EMPLOYEE') || sm.includes('SALARY')) {
            pl.employeeBenefits += v
          } else if (sm.includes('FINANCE') || sm.includes('INTEREST_EXP')) {
            pl.financeCosts += v
          } else if (sm.includes('DEPRECIATION')) {
            pl.depreciation += v
          } else if (sm.includes('AMORTISATION') || sm.includes('AMORTIZATION')) {
            pl.amortisation += v
          } else {
            pl.otherExpenses += v
          }
          pl.expense += v
        }
      })
    })

    // Compute derived P&L fields per month
    rawMonths.forEach(m => {
      const pl = m.pl
      pl.totalRevenue = pl.revenueFromOps + pl.otherIncome
      pl.totalExpenses = pl.cogs + pl.employeeBenefits + pl.financeCosts +
        pl.depreciation + pl.amortisation + pl.otherExpenses
      pl.profitBeforeExceptional = pl.totalRevenue - pl.totalExpenses
      pl.profitBeforeTax = pl.profitBeforeExceptional
      // Use BS taxExpense if available (from compliance engine overlay)
      const bsM = m.bs as Record<string, number>
      pl.taxExpense = bsM.taxExpense ?? 0
      pl.profitAfterTax = pl.profitBeforeTax - pl.taxExpense
      pl.grossProfit = pl.revenueFromOps - pl.cogs
      pl.netIncome = pl.profitAfterTax
    })

    // Aggregate current year
    const currentYear = aggregateAnnual(rawMonths as unknown as ThreeWayMonth[])

    // Determine FY details — forecastMonths are stored as "Apr-25" labels
    const fyStartMonth = company.fyStartMonth ?? 4
    const firstPeriod = forecastMonths[0] // e.g. "Apr-25"

    // Parse year from first forecast month label using the same utility as the engine
    let fyStartYear = new Date().getFullYear()
    const parsedFirstMonth = parseMonthLabel(firstPeriod)
    if (parsedFirstMonth) {
      fyStartYear = parsedFirstMonth.getFullYear()
    }

    const currentPeriodKey = generatePeriodKey(fyStartMonth, fyStartYear)
    const priorPeriodKey = generatePeriodKey(fyStartMonth, fyStartYear - 1)

    // Compute FY end date for cover page
    const fyEndMonth = fyStartMonth === 1 ? 12 : fyStartMonth - 1
    const fyEndYear = fyStartMonth === 1 ? fyStartYear : fyStartYear + 1
    const fyEndDate = new Date(fyEndYear, fyEndMonth - 1, 1)
      .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

    // Build currentForecastStartDate as YYYY-MM-01 for prior year resolver
    const currentForecastStartDate = parsedFirstMonth
      ? `${parsedFirstMonth.getFullYear()}-${String(parsedFirstMonth.getMonth() + 1).padStart(2, '0')}-01`
      : `${fyStartYear}-${String(fyStartMonth).padStart(2, '0')}-01`

    const priorYearResult = await resolvePriorYear(
      ctx.companyId,
      currentForecastStartDate,
      priorPeriodKey
    )

    // Generate the two-column annual PDF
    const pdfBuffer = await generateAnnualPDFReport({
      companyName: company.name,
      cin: company.cin ?? null,
      pan: company.pan ?? null,
      gstin: company.gstin ?? null,
      registeredAddress: company.registeredAddress ?? null,
      currentYear,
      priorYear: priorYearResult.annual,
      priorYearDataSource: priorYearResult.dataSource,
      currentPeriodLabel: currentPeriodKey,
      priorPeriodLabel: priorPeriodKey,
      fyEndDate,
      notes,
    })

    const filename = `${company.name.replace(/[^a-z0-9]/gi, '_')}_annual_${currentPeriodKey}.pdf`
    const arrayBuffer = pdfBuffer.buffer instanceof SharedArrayBuffer
      ? new Uint8Array(pdfBuffer).buffer
      : pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength)

    return new Response(arrayBuffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    return handleRouteError('ANNUAL_PDF_GENERATE', err)
  }
}
