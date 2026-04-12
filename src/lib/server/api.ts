import { type NextRequest, NextResponse } from 'next/server'
import { type ZodType, z } from 'zod'

export class RouteError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'RouteError'
  }
}

export function jsonResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function textError(message: string, status: number) {
  return new NextResponse(message, { status })
}

export function parseJsonText(value: unknown, fallback = {}) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      throw new RouteError(422, 'Invalid JSON string payload.')
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return fallback as Record<string, unknown>
}

export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodType<T>
): Promise<T> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw new RouteError(400, 'Invalid JSON body.')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const message = z.flattenError(parsed.error).formErrors[0] ?? 'Validation failed.'
    throw new RouteError(422, message)
  }

  return parsed.data
}

export function getRequiredSearchParam(
  request: NextRequest,
  key: string,
  message = `Missing "${key}" query parameter.`
) {
  const value = request.nextUrl.searchParams.get(key)
  if (!value) {
    throw new RouteError(400, message)
  }

  return value
}

export function handleRouteError(label: string, error: unknown) {
  if (error instanceof RouteError) {
    return textError(error.message, error.status)
  }

  console.error(`[${label}]`, error)
  return textError('Internal Error', 500)
}
