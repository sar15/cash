import { type NextRequest, NextResponse } from 'next/server'
import { type ZodType } from 'zod'

export class RouteError extends Error {
  readonly fieldErrors?: Record<string, string[]>

  constructor(
    readonly status: number,
    message: string,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message)
    this.name = 'RouteError'
    this.fieldErrors = fieldErrors
  }
}

/**
 * Structured JSON logger for API routes.
 * Usage: logRoute('COMPANIES_GET', request, 200, startTime)
 */
export function logRoute(
  label: string,
  request: NextRequest,
  status: number,
  startMs: number
) {
  console.log(JSON.stringify({
    event: 'route',
    route: label,
    method: request.method,
    status,
    duration: Date.now() - startMs,
    ts: new Date().toISOString(),
  }))
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
    const flattened = parsed.error.flatten()
    // Return both a human-readable message AND structured field errors
    // so the frontend can display inline validation errors per field.
    const firstFormError = flattened.formErrors[0]
    const firstFieldError = Object.entries(flattened.fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs as string[] | undefined)?.[0] ?? 'invalid'}`)
      .at(0)
    const message = firstFormError ?? firstFieldError ?? 'Validation failed.'
    throw new RouteError(422, message, flattened.fieldErrors as Record<string, string[]>)
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
    const body: Record<string, unknown> = { error: error.message }
    // Include structured field errors when present so the frontend
    // can display inline validation messages per field.
    if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
      body.fieldErrors = error.fieldErrors
    }
    return NextResponse.json(body, { status: error.status })
  }

  console.error(JSON.stringify({
    event: 'route_error',
    route: label,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join(' | ') : undefined,
    ts: new Date().toISOString(),
  }))
  return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
}
