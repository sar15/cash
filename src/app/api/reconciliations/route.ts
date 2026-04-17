import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bankReconciliations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isErrorResponse, resolveAuthedCompany } from '@/lib/api/helpers'
import { parseJsonBody } from '@/lib/server/api'
import { handleRouteError } from '@/lib/server/api'
import { z } from 'zod'
import {
  findIdempotentResponse,
  getIdempotencyKey,
  saveIdempotentResponse,
  toIdempotencyResponse,
} from '@/lib/server/idempotency'

const createReconciliationSchema = z.object({
  companyId: z.string().optional(),
  period: z.string().regex(/^\d{4}-\d{2}-01$/),
  bookClosingBalancePaise: z.number().int(),
})

// Auth pattern: uses auth() + inline ownership check (equivalent to resolveAuthedCompany).
// Kept as-is because companyId comes from query/body, not a path param, and the
// ownership check (companies.clerkUserId === userId) provides the same isolation guarantee.

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const reconciliations = await db.query.bankReconciliations.findMany({
      where: eq(bankReconciliations.companyId, ctx.companyId),
      orderBy: (recons, { desc }) => [desc(recons.period)],
    })

    return NextResponse.json({ reconciliations })
  } catch (error) {
    return handleRouteError('RECONCILIATIONS_GET', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx
    const { period, bookClosingBalancePaise } = await parseJsonBody(
      request,
      createReconciliationSchema
    )

    const idempotencyKey = getIdempotencyKey(request)
    if (idempotencyKey) {
      const cached = await findIdempotentResponse({
        key: idempotencyKey,
        companyId: ctx.companyId,
        route: request.nextUrl.pathname,
        method: request.method,
      })
      if (cached) {
        return toIdempotencyResponse(cached)
      }
    }

    // Create reconciliation record
    await db
      .insert(bankReconciliations)
      .values({
        id: crypto.randomUUID(),
        companyId: ctx.companyId,
        period,
        status: 'unreconciled',
        bookClosingBalancePaise,
        bankClosingBalancePaise: null,
        variancePaise: null,
      })
      .onConflictDoUpdate({
        target: [bankReconciliations.companyId, bankReconciliations.period],
        set: {
          bookClosingBalancePaise,
        },
      })

    const payload = { success: true }
    if (idempotencyKey) {
      await saveIdempotentResponse(
        {
          key: idempotencyKey,
          companyId: ctx.companyId,
          route: request.nextUrl.pathname,
          method: request.method,
        },
        200,
        payload
      )
    }

    return NextResponse.json(payload)
  } catch (error) {
    return handleRouteError('RECONCILIATIONS_POST', error)
  }
}
