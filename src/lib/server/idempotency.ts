import { and, eq } from 'drizzle-orm'

import { db, schema } from '@/lib/db'

const IDEMPOTENCY_HEADER = 'idempotency-key'

export interface IdempotencyContext {
  key: string
  companyId: string
  route: string
  method: string
}

export function getIdempotencyKey(request: Request): string | null {
  const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim()
  if (!key) return null
  return key.slice(0, 255)
}

/**
 * Attempt to reserve an idempotency slot before processing begins.
 *
 * Returns:
 *   { status: 'proceed' }                  — slot reserved, caller should process the request
 *   { status: 'completed', cached }        — already completed, return cached response
 *   { status: 'in_progress' }              — concurrent replay, caller should return 409
 */
export async function reserveIdempotencySlot(ctx: IdempotencyContext): Promise<
  | { status: 'proceed' }
  | { status: 'completed'; cached: { responseStatus: number; responseBody: string } }
  | { status: 'in_progress' }
> {
  // Check for an existing record first
  const existing = await db.query.idempotencyKeys.findFirst({
    where: and(
      eq(schema.idempotencyKeys.companyId, ctx.companyId),
      eq(schema.idempotencyKeys.key, ctx.key),
      eq(schema.idempotencyKeys.route, ctx.route),
      eq(schema.idempotencyKeys.method, ctx.method)
    ),
  })

  if (existing) {
    if (existing.status === 'completed') {
      return { status: 'completed', cached: existing }
    }
    // status === 'in_progress' — concurrent request is already processing this key
    return { status: 'in_progress' }
  }

  // Try to insert the reservation row. If a concurrent request beats us to it,
  // onConflictDoNothing silently skips — we then re-read to determine the winner.
  await db
    .insert(schema.idempotencyKeys)
    .values({
      companyId: ctx.companyId,
      key: ctx.key,
      route: ctx.route,
      method: ctx.method,
      status: 'in_progress',
      responseStatus: 0,
      responseBody: '{}',
    })
    .onConflictDoNothing({
      target: [
        schema.idempotencyKeys.companyId,
        schema.idempotencyKeys.key,
        schema.idempotencyKeys.route,
        schema.idempotencyKeys.method,
      ],
    })

  // Re-read to confirm we won the race
  const reserved = await db.query.idempotencyKeys.findFirst({
    where: and(
      eq(schema.idempotencyKeys.companyId, ctx.companyId),
      eq(schema.idempotencyKeys.key, ctx.key),
      eq(schema.idempotencyKeys.route, ctx.route),
      eq(schema.idempotencyKeys.method, ctx.method)
    ),
  })

  if (!reserved) {
    // Should not happen — treat as in_progress to be safe
    return { status: 'in_progress' }
  }

  if (reserved.status === 'completed') {
    return { status: 'completed', cached: reserved }
  }

  // We own the in_progress slot — proceed with processing
  return { status: 'proceed' }
}

/**
 * Mark the idempotency slot as completed and store the response.
 * Must be called after the request has been successfully processed.
 */
export async function completeIdempotencySlot(
  ctx: IdempotencyContext,
  responseStatus: number,
  responseBody: unknown
) {
  await db
    .update(schema.idempotencyKeys)
    .set({
      status: 'completed',
      responseStatus,
      responseBody: JSON.stringify(responseBody ?? {}),
    })
    .where(
      and(
        eq(schema.idempotencyKeys.companyId, ctx.companyId),
        eq(schema.idempotencyKeys.key, ctx.key),
        eq(schema.idempotencyKeys.route, ctx.route),
        eq(schema.idempotencyKeys.method, ctx.method)
      )
    )
}

/**
 * Legacy helpers — kept for routes that haven't migrated to the reservation pattern yet.
 * @deprecated Use reserveIdempotencySlot + completeIdempotencySlot instead.
 */
export async function findIdempotentResponse(ctx: IdempotencyContext) {
  const row = await db.query.idempotencyKeys.findFirst({
    where: and(
      eq(schema.idempotencyKeys.companyId, ctx.companyId),
      eq(schema.idempotencyKeys.key, ctx.key),
      eq(schema.idempotencyKeys.route, ctx.route),
      eq(schema.idempotencyKeys.method, ctx.method)
    ),
  })
  if (!row || row.status !== 'completed') return null
  return row
}

export async function saveIdempotentResponse(
  ctx: IdempotencyContext,
  responseStatus: number,
  responseBody: unknown
) {
  await completeIdempotencySlot(ctx, responseStatus, responseBody)
}

export function toIdempotencyResponse(cached: { responseStatus: number; responseBody: string }) {
  let body: unknown = {}
  try {
    body = JSON.parse(cached.responseBody)
  } catch {
    body = {}
  }
  return Response.json(body, { status: cached.responseStatus })
}
