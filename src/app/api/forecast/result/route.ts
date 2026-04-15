import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { saveForecastResultSchema } from '@/lib/db/validation'
import * as resultQueries from '@/lib/db/queries/forecast-results'
import { populateGSTFilings } from '@/lib/db/queries/gst-filings'
import type { ComplianceResult } from '@/lib/engine/compliance'

// GET /api/forecast/result — Get cached forecast result
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const scenarioId = request.nextUrl.searchParams.get('scenarioId')
    const result = await resultQueries.getForecastResult(ctx.companyId, scenarioId)
    return jsonOk({ result: result ?? null })
  } catch {
    return jsonError('Failed to fetch forecast result', 500)
  }
}

// POST /api/forecast/result — Save (cache) forecast result
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json()
    const parsed = saveForecastResultSchema.safeParse(body)
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const result = await resultQueries.saveForecastResult(ctx.companyId, {
      ...parsed.data,
      plData: JSON.stringify(parsed.data.plData),
      bsData: JSON.stringify(parsed.data.bsData),
      cfData: JSON.stringify(parsed.data.cfData),
      compliance: JSON.stringify(parsed.data.compliance),
      metrics: JSON.stringify(parsed.data.metrics),
    })

    // Auto-populate GST filings from compliance data (fire-and-forget, non-blocking)
    if (parsed.data.compliance && !parsed.data.scenarioId) {
      populateGSTFilings(ctx.companyId, parsed.data.compliance as unknown as ComplianceResult).catch(err => {
        console.warn('[forecast/result] GST filing population failed (non-critical):', err)
      })
    }

    return jsonOk({ result }, 201)
  } catch {
    return jsonError('Failed to save forecast result', 500)
  }
}
