import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { upsertQuickMetricsConfigSchema } from '@/lib/db/validation'
import * as configQueries from '@/lib/db/queries/forecast-config'

// GET /api/forecast/metrics — Get quick metrics config
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const config = await configQueries.getQuickMetricsConfig(ctx.companyId)
    return jsonOk({ config: config ?? null })
  } catch {
    return jsonError('Failed to fetch metrics config', 500)
  }
}

// POST /api/forecast/metrics — Upsert quick metrics config
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json()
    const parsed = upsertQuickMetricsConfigSchema.safeParse(body)
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const config = await configQueries.upsertQuickMetricsConfig(ctx.companyId, {
      ...parsed.data,
      threshold: JSON.stringify(parsed.data.threshold),
    })
    return jsonOk({ config })
  } catch {
    return jsonError('Failed to upsert metrics config', 500)
  }
}
