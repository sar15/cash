/**
 * GET  /api/compliance-tasks?companyId=&month=YYYY-MM  — list tasks for a month
 * POST /api/compliance-tasks?companyId=               — create or upsert a task
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { and, eq, gte, lte } from 'drizzle-orm'
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

const createTaskSchema = z.object({
  filingType: z.string().min(1).max(50),
  periodLabel: z.string().min(1).max(50),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD'),
  status: z.enum(VALID_STATUSES).default('not_started'),
  assignedTo: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const month = request.nextUrl.searchParams.get('month') // YYYY-MM
    let tasks

    if (month) {
      // Filter tasks whose dueDate falls within the given month
      const start = `${month}-01`
      const end = `${month}-31`
      tasks = await db.query.complianceTasks.findMany({
        where: and(
          eq(schema.complianceTasks.companyId, ctx.companyId),
          gte(schema.complianceTasks.dueDate, start),
          lte(schema.complianceTasks.dueDate, end)
        ),
        orderBy: (t, { asc }) => [asc(t.dueDate)],
      })
    } else {
      tasks = await db.query.complianceTasks.findMany({
        where: eq(schema.complianceTasks.companyId, ctx.companyId),
        orderBy: (t, { asc }) => [asc(t.dueDate)],
      })
    }

    return jsonOk({ tasks })
  } catch {
    return jsonError('Failed to fetch compliance tasks', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await parseJsonBody(request, createTaskSchema)

    // Upsert — if same (companyId, filingType, periodLabel) exists, update it
    const existing = await db.query.complianceTasks.findFirst({
      where: and(
        eq(schema.complianceTasks.companyId, ctx.companyId),
        eq(schema.complianceTasks.filingType, body.filingType),
        eq(schema.complianceTasks.periodLabel, body.periodLabel)
      ),
    })

    if (existing) {
      const [updated] = await db
        .update(schema.complianceTasks)
        .set({
          dueDate: body.dueDate,
          status: body.status,
          assignedTo: body.assignedTo ?? existing.assignedTo,
          notes: body.notes ?? existing.notes,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.complianceTasks.id, existing.id))
        .returning()
      return jsonOk({ task: updated })
    }

    const [task] = await db
      .insert(schema.complianceTasks)
      .values({
        companyId: ctx.companyId,
        filingType: body.filingType,
        periodLabel: body.periodLabel,
        dueDate: body.dueDate,
        status: body.status,
        assignedTo: body.assignedTo ?? null,
        notes: body.notes ?? null,
      })
      .returning()

    return jsonOk({ task }, 201)
  } catch {
    return jsonError('Failed to create compliance task', 500)
  }
}
