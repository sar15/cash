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

export async function findIdempotentResponse(ctx: IdempotencyContext) {
  return db.query.idempotencyKeys.findFirst({
    where: and(
      eq(schema.idempotencyKeys.companyId, ctx.companyId),
      eq(schema.idempotencyKeys.key, ctx.key),
      eq(schema.idempotencyKeys.route, ctx.route),
      eq(schema.idempotencyKeys.method, ctx.method)
    ),
  })
}

export async function saveIdempotentResponse(
  ctx: IdempotencyContext,
  responseStatus: number,
  responseBody: unknown
) {
  await db
    .insert(schema.idempotencyKeys)
    .values({
      companyId: ctx.companyId,
      key: ctx.key,
      route: ctx.route,
      method: ctx.method,
      responseStatus,
      responseBody: JSON.stringify(responseBody ?? {}),
    })
    .onConflictDoNothing({
      target: [
        schema.idempotencyKeys.companyId,
        schema.idempotencyKeys.key,
        schema.idempotencyKeys.route,
        schema.idempotencyKeys.method,
      ],
    })
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
