import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { upsertComplianceConfigSchema } from '@/lib/db/validation'
import * as configQueries from '@/lib/db/queries/forecast-config'

// GET /api/forecast/compliance — Get compliance config for company
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const config = await configQueries.getComplianceConfig(ctx.companyId)
    return jsonOk({ config: config ?? null })
  } catch {
    return jsonError('Failed to fetch compliance config', 500)
  }
}

// POST /api/forecast/compliance — Upsert compliance config
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json()
    const parsed = upsertComplianceConfigSchema.safeParse(body)
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const config = await configQueries.upsertComplianceConfig(ctx.companyId, {
      ...parsed.data,
      tdsSections: JSON.stringify(parsed.data.tdsSections),
    })
    return jsonOk({ config })
  } catch {
    return jsonError('Failed to upsert compliance config', 500)
  }
}
