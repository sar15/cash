import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { createScenarioSchema } from '@/lib/db/validation'
import * as scenarioQueries from '@/lib/db/queries/scenarios'

// GET /api/scenarios — List all scenarios for company
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const scenarios = await scenarioQueries.getScenarios(ctx.companyId)
    return jsonOk({ scenarios })
  } catch {
    return jsonError('Failed to fetch scenarios', 500)
  }
}

// POST /api/scenarios — Create a new scenario
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json()
    const parsed = createScenarioSchema.safeParse(body)
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const scenario = await scenarioQueries.createScenario(ctx.companyId, parsed.data)
    return jsonOk({ scenario }, 201)
  } catch {
    return jsonError('Failed to create scenario', 500)
  }
}
