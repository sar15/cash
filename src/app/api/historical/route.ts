import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { bulkUpsertActualsSchema } from '@/lib/db/validation'
import * as historicalQueries from '@/lib/db/queries/historical'

// GET /api/historical — Get all actuals for company
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const period = request.nextUrl.searchParams.get('period')

    if (period) {
      const actuals = await historicalQueries.getActualsByPeriod(ctx.companyId, period)
      return jsonOk({ actuals })
    }

    const actuals = await historicalQueries.getActualsForCompany(ctx.companyId)
    return jsonOk({ actuals })
  } catch {
    return jsonError('Failed to fetch actuals', 500)
  }
}

// PATCH /api/historical — Bulk upsert actuals (used by import pipeline)
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json()
    const parsed = bulkUpsertActualsSchema.safeParse({ ...body, companyId: ctx.companyId })
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const results = await historicalQueries.upsertActuals(ctx.companyId, parsed.data.actuals)
    return jsonOk({ count: results.length, actuals: results })
  } catch {
    return jsonError('Failed to upsert actuals', 500)
  }
}
