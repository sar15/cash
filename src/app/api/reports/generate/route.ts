import { NextRequest, NextResponse } from 'next/server'
import {
  resolveAuthedCompany,
  isErrorResponse,
  requireCompanyCapability,
} from '@/lib/api/helpers'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getForecastResult } from '@/lib/db/queries/forecast-results'
import { getAccountsForCompany } from '@/lib/db/queries/accounts'
import { generatePDFReport } from '@/lib/reports/pdf-generator'
import type { EngineResult } from '@/lib/engine'
import type { ComplianceResult } from '@/lib/engine/compliance'
import type { Account } from '@/stores/accounts-store'
import { isCOGSAccount } from '@/lib/standards/account-classifier'
import { parseJsonBody } from '@/lib/server/api'
import { handleRouteError } from '@/lib/server/api'
import { z } from 'zod'
import {
  findIdempotentResponse,
  getIdempotencyKey,
  saveIdempotentResponse,
  toIdempotencyResponse,
} from '@/lib/server/idempotency'

const reportRequestSchema = z.object({
  companyId: z.string().optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scenarioId: z.string().nullable().optional(),
  includeWaterfall: z.boolean().optional(),
  includeScenarios: z.boolean().optional(),
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
    const capabilityError = requireCompanyCapability(ctx, 'reports.export')
    if (capabilityError) return capabilityError

    const body = await parseJsonBody(request, reportRequestSchema)
    const { periodStart, periodEnd, scenarioId, includeWaterfall, includeScenarios, notes } = body

    const idempotencyKey = getIdempotencyKey(request)
    if (idempotencyKey) {
      const cached = await findIdempotentResponse({
        key: idempotencyKey,
        companyId: ctx.companyId,
        route: request.nextUrl.pathname,
        method: request.method,
      })
      if (cached) {
        return toIdempotencyResponse(cached)
      }
    }

    // Fetch company
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, ctx.companyId),
    })
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    // Fetch cached forecast result
    const cachedResult = await getForecastResult(ctx.companyId, scenarioId ?? null)
    if (!cachedResult) {
      return NextResponse.json(
        { error: 'No forecast data found. Please open the Forecast page to generate a forecast first.' },
        { status: 422 }
      )
    }

    // Fail closed on stale or in-progress forecasts — never render a report from bad data
    if (cachedResult.status === 'stale' || cachedResult.status === 'calculating') {
      return NextResponse.json(
        {
          error: 'Forecast is still being calculated. Please wait a moment and try again.',
          status: cachedResult.status,
        },
        { status: 409 }
      )
    }

    // Reconstruct EngineResult from cached JSON — validate each section strictly
    let plData: Record<string, unknown>
    let bsData: Record<string, unknown>
    let cfData: Record<string, unknown>
    let complianceData: Record<string, unknown>
    let metricsData: Record<string, unknown>

    try {
      plData = JSON.parse(cachedResult.plData)
      if (typeof plData !== 'object' || plData === null) throw new Error('plData is not an object')
    } catch (e) {
      console.error('[REPORTS_GENERATE] Corrupt plData for company', ctx.companyId, e)
      return NextResponse.json(
        { error: 'Forecast data is corrupted. Please regenerate the forecast and try again.' },
        { status: 422 }
      )
    }

    try {
      bsData = JSON.parse(cachedResult.bsData)
      if (typeof bsData !== 'object' || bsData === null) throw new Error('bsData is not an object')
    } catch (e) {
      console.error('[REPORTS_GENERATE] Corrupt bsData for company', ctx.companyId, e)
      return NextResponse.json(
        { error: 'Forecast data is corrupted. Please regenerate the forecast and try again.' },
        { status: 422 }
      )
    }

    try {
      cfData = JSON.parse(cachedResult.cfData)
      if (typeof cfData !== 'object' || cfData === null) throw new Error('cfData is not an object')
    } catch (e) {
      console.error('[REPORTS_GENERATE] Corrupt cfData for company', ctx.companyId, e)
      return NextResponse.json(
        { error: 'Forecast data is corrupted. Please regenerate the forecast and try again.' },
        { status: 422 }
      )
    }

    try {
      complianceData = JSON.parse(cachedResult.compliance)
      if (typeof complianceData !== 'object' || complianceData === null) throw new Error('compliance is not an object')
    } catch (e) {
      console.error('[REPORTS_GENERATE] Corrupt compliance for company', ctx.companyId, e)
      return NextResponse.json(
        { error: 'Forecast data is corrupted. Please regenerate the forecast and try again.' },
        { status: 422 }
      )
    }

    try {
      metricsData = JSON.parse(cachedResult.metrics)
      if (typeof metricsData !== 'object' || metricsData === null) throw new Error('metrics is not an object')
    } catch (e) {
      console.error('[REPORTS_GENERATE] Corrupt metrics for company', ctx.companyId, e)
      return NextResponse.json(
        { error: 'Forecast data is corrupted. Please regenerate the forecast and try again.' },
        { status: 422 }
      )
    }

    // Validate that we have actual forecast months — an empty forecast is not renderable
    const forecastMonths = (metricsData.forecastMonths as string[] | undefined) ?? []
    if (forecastMonths.length === 0) {
      return NextResponse.json(
        { error: 'Forecast contains no data. Please open the Forecast page to generate a forecast first.' },
        { status: 422 }
      )
    }
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
          if (isCOGSAccount(acc)) {
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
      balanceWarnings: [],
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
      notes,
    })

    // Upload to storage if configured (Uploadthing), otherwise return PDF directly
    const { uploadFile, isStorageConfigured, generateUploadKey } = await import('@/lib/storage')

    if (isStorageConfigured()) {
      const key = generateUploadKey(ctx.companyId, 'report.pdf').replace('uploads/', 'reports/')
      const storedKey = await uploadFile(key, pdfBuffer, 'application/pdf')
      const downloadUrl = `/api/reports/download?key=${encodeURIComponent(storedKey)}&companyId=${ctx.companyId}`
      const payload = {
        success: true,
        downloadUrl,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      }
      if (idempotencyKey) {
        await saveIdempotentResponse(
          { key: idempotencyKey, companyId: ctx.companyId, route: request.nextUrl.pathname, method: request.method },
          200, payload
        )
      }
      return NextResponse.json(payload)
    }

    // No R2 — return PDF directly as a download
    const filename = `${company.name.replace(/[^a-z0-9]/gi, '_')}_report_${periodStart}_${periodEnd}.pdf`
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
    return handleRouteError('REPORTS_GENERATE_POST', err)
  }
}
