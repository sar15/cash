/**
 * PATCH /api/compliance-tasks/[id]?companyId= — update task status / fields
 * DELETE /api/compliance-tasks/[id]?companyId= — delete a task
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError } from '@/lib/api/helpers'
import { parseJsonBody } from '@/lib/server/api'

const VALID_STATUSES = [
  'not_started',
  'waiting_on_client',
  'docs_received',
  'processing',
  'pending_otp',
  'filed',
] as const

const updateTaskSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  assignedTo: z.string().nullable().optional(),
  filedAt: z.string().nullable().optional(),
  arn: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id } = await params
    const body = await parseJsonBody(request, updateTaskSchema)

    const task = await db.query.complianceTasks.findFirst({
      where: and(
        eq(schema.complianceTasks.id, id),
        eq(schema.complianceTasks.companyId, ctx.companyId)
      ),
    })

    if (!task) return jsonError('Task not found', 404)

    const updates: Partial<typeof schema.complianceTasks.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    }

    if (body.status !== undefined) updates.status = body.status
    if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo
    if (body.arn !== undefined) updates.arn = body.arn
    if (body.notes !== undefined) updates.notes = body.notes

    // Auto-set filedAt when status transitions to 'filed'
    if (body.status === 'filed' && !task.filedAt) {
      updates.filedAt = body.filedAt ?? new Date().toISOString()
    } else if (body.filedAt !== undefined) {
      updates.filedAt = body.filedAt
    }

    const [updated] = await db
      .update(schema.complianceTasks)
      .set(updates)
      .where(eq(schema.complianceTasks.id, id))
      .returning()

    return jsonOk({ task: updated })
  } catch {
    return jsonError('Failed to update compliance task', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id } = await params

    const task = await db.query.complianceTasks.findFirst({
      where: and(
        eq(schema.complianceTasks.id, id),
        eq(schema.complianceTasks.companyId, ctx.companyId)
      ),
    })

    if (!task) return jsonError('Task not found', 404)

    await db
      .delete(schema.complianceTasks)
      .where(eq(schema.complianceTasks.id, id))

    return jsonOk({ success: true })
  } catch {
    return jsonError('Failed to delete compliance task', 500)
  }
}
