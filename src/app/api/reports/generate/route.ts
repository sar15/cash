import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonError } from '@/lib/api/helpers'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getForecastResult } from '@/lib/db/queries/forecast-results'
import { getAccountsForCompany } from '@/lib/db/queries/accounts'
import { generatePDFReport } from '@/lib/reports/pdf-generator'
import { uploadFile } from '@/lib/r2'
import type { EngineResult } from '@/lib/engine'
import type { ComplianceResult } from '@/lib/engine/compliance'
import type { Account } from '@/stores/accounts-store'

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json() as {
      companyId: string
      periodStart: string
      periodEnd: string
      scenarioId?: string | null
      includeWaterfall?: boolean
      includeScenarios?: boolean
    }

    const { periodStart, periodEnd, scenarioId, includeWaterfall, includeScenarios } = body

    if (!periodStart || !periodEnd) {
      return jsonError('periodStart and periodEnd are required', 400)
    }

    // Fetch company
    const company = await db.query.companies.findFirst({
      where: and(eq(companies.id, ctx.companyId), eq(companies.clerkUserId, ctx.userId)),
    })
    if (!company) return jsonError('Company not found', 404)

    // Fetch cached forecast result
    const cachedResult = await getForecastResult(ctx.companyId, scenarioId ?? null)
    if (!cachedResult) {
      return jsonError('No forecast data found. Please open the Forecast page to generate a forecast first.', 422)
    }

    // Reconstruct EngineResult from cached JSON
    let plData: Record<string, unknown> = {}
    let bsData: Record<string, unknown> = {}
    let cfData: Record<string, unknown> = {}
    let complianceData: Record<string, unknown> = {}
    let metricsData: Record<string, unknown> = {}

    try { plData = JSON.parse(cachedResult.plData) } catch {}
    try { bsData = JSON.parse(cachedResult.bsData) } catch {}
    try { cfData = JSON.parse(cachedResult.cfData) } catch {}
    try { complianceData = JSON.parse(cachedResult.compliance) } catch {}
    try { metricsData = JSON.parse(cachedResult.metrics) } catch {}

    // Reconstruct a minimal EngineResult for the PDF generator
    const forecastMonths = (metricsData.forecastMonths as string[]) ?? []
    const accountForecasts = (plData.accountForecasts as Record<string, number[]>) ?? {}
    const bsMonths = (bsData.months as Record<string, unknown>[]) ?? []
    const cfMonths = (cfData.months as Record<string, unknown>[]) ?? []

    // Build integrationResults from cached BS/CF data
    const integrationResults = forecastMonths.map((_: string, i: number) => ({
      pl: {
        revenue: 0,
        cogs: 0,
        expense: 0,
        netIncome: 0,
      },
      bs: bsMonths[i] ?? {},
      cf: cfMonths[i] ?? {},
    }))

    // Compute P&L totals from accountForecasts
    const accounts = await getAccountsForCompany(ctx.companyId)
    accounts.forEach(acc => {
      const vals = accountForecasts[acc.id] ?? []
      vals.forEach((v: number, i: number) => {
        if (!integrationResults[i]) return
        if (acc.accountType === 'revenue') {
          integrationResults[i].pl.revenue += v
        } else if (acc.accountType === 'expense') {
          if (acc.standardMapping?.startsWith('cogs')) {
            integrationResults[i].pl.cogs += v
          } else {
            integrationResults[i].pl.expense += v
          }
        }
      })
    })
    integrationResults.forEach(m => {
      m.pl.netIncome = m.pl.revenue - m.pl.cogs - m.pl.expense
    })

    const engineResult: EngineResult = {
      accountForecasts,
      rawIntegrationResults: integrationResults as unknown as EngineResult['rawIntegrationResults'],
      integrationResults: integrationResults as unknown as EngineResult['integrationResults'],
      forecastMonths,
      compliance: complianceData as unknown as ComplianceResult,
      salaryForecast: [],
    }

    // Generate PDF
    const pdfBuffer = await generatePDFReport({
      companyName: company.name,
      companyLogo: company.logoUrl ?? undefined,
      periodStart,
      periodEnd,
      engineResult,
      accounts: accounts as unknown as Account[],
      includeWaterfall,
      includeScenarios,
    })

    // Upload to R2 (or local fallback)
    const key = `reports/${ctx.companyId}/${Date.now()}_report.pdf`
    await uploadFile(key, pdfBuffer, 'application/pdf')

    // Return download URL — direct API endpoint serves the file
    const downloadUrl = `/api/reports/download?key=${encodeURIComponent(key)}&companyId=${ctx.companyId}`

    return NextResponse.json({
      success: true,
      downloadUrl,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
  } catch (err) {
    console.error('[Reports] PDF generation failed:', err)
    return jsonError('Failed to generate report', 500)
  }
}
