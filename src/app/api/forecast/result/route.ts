import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { saveForecastResultSchema } from '@/lib/db/validation'
import * as resultQueries from '@/lib/db/queries/forecast-results'

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
    return jsonOk({ result }, 201)
  } catch {
    return jsonError('Failed to save forecast result', 500)
  }
}
