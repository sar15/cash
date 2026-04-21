import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { updateScenarioSchema, saveScenarioOverridesSchema } from '@/lib/db/validation'
import * as scenarioQueries from '@/lib/db/queries/scenarios'
import { writeAuditLog } from '@/lib/db/queries/audit-log'
import { auth } from '@clerk/nextjs/server'

// GET /api/scenarios/[id] — Get scenario with overrides
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<any> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id } = await params
    const scenario = await scenarioQueries.getScenarioById(id, ctx.companyId)
    if (!scenario) return jsonError('Scenario not found', 404)

    return jsonOk({ scenario })
  } catch {
    return jsonError('Failed to fetch scenario', 500)
  }
}

// PATCH /api/scenarios/[id] — Update scenario metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id } = await params
    const body = await request.json()
    const parsed = updateScenarioSchema.safeParse(body)
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    // Support OCC: client may send `version` to prevent concurrent overwrites
    const expectedVersion = typeof body.version === 'number' ? body.version : undefined

    const result = await scenarioQueries.updateScenario(id, ctx.companyId, parsed.data, expectedVersion)

    if (!result) return jsonError('Scenario not found', 404)
    if ('conflict' in result) {
      return jsonError(
        'This scenario was modified by another user. Please refresh and try again.',
        409
      )
    }

    return jsonOk({ scenario: result.scenario })
  } catch {
    return jsonError('Failed to update scenario', 500)
  }
}

// DELETE /api/scenarios/[id] — Delete a scenario
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<any> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id } = await params
    await scenarioQueries.deleteScenario(id, ctx.companyId)
    return jsonOk({ success: true })
  } catch {
    return jsonError('Failed to delete scenario', 500)
  }
}

// PUT /api/scenarios/[id] — Save scenario overrides (replace all)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<any> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id } = await params

    // Verify scenario exists and belongs to company
    const scenario = await scenarioQueries.getScenarioById(id, ctx.companyId)
    if (!scenario) return jsonError('Scenario not found', 404)

    const body = await request.json()
    const parsed = saveScenarioOverridesSchema.safeParse(body)
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const overrides = await scenarioQueries.saveScenarioOverrides(
      id,
      parsed.data.overrides.map((o) => ({
        ...o,
        config: JSON.stringify(o.config),
      }))
    )

    // Audit log
    const { userId } = await auth()
    if (userId) {
      await writeAuditLog({
        companyId: ctx.companyId,
        clerkUserId: userId,
        action: 'scenario.overrides.saved',
        entityType: 'scenario',
        entityId: id,
        newValue: { overridesCount: parsed.data.overrides.length },
      }).catch((err) => {
        console.error('[AuditLog] Failed to write scenario.overrides.saved:', err)
      })
    }

    return jsonOk({ overrides })
  } catch {
    return jsonError('Failed to save overrides', 500)
  }
}
