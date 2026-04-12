import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { upsertValueRuleSchema } from '@/lib/db/validation'
import * as configQueries from '@/lib/db/queries/forecast-config'

// GET /api/forecast/value-rules — Get value rules for company
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const scenarioId = request.nextUrl.searchParams.get('scenarioId')
    const rules = await configQueries.getValueRules(ctx.companyId, scenarioId)
    return jsonOk({ rules })
  } catch {
    return jsonError('Failed to fetch value rules', 500)
  }
}

// POST /api/forecast/value-rules — Upsert a value rule
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json()
    const parsed = upsertValueRuleSchema.safeParse(body)
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const rule = await configQueries.upsertValueRule(ctx.companyId, {
      ...parsed.data,
      config: JSON.stringify(parsed.data.config),
    })
    return jsonOk({ rule }, 201)
  } catch {
    return jsonError('Failed to upsert value rule', 500)
  }
}
