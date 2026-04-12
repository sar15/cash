import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveCompanyForUser } from '@/lib/db/company-context'

export interface AuthedContext {
  userId: string
  companyId: string
}

/**
 * Resolves auth + company isolation for API routes.
 * Returns context on success or a NextResponse error on failure.
 */
export async function resolveAuthedCompany(
  request: NextRequest
): Promise<AuthedContext | NextResponse> {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId =
    request.nextUrl.searchParams.get('companyId') ??
    request.headers.get('x-company-id')

  const company = await resolveCompanyForUser(userId, companyId)

  if (!company) {
    return NextResponse.json(
      { error: 'Company not found or access denied' },
      { status: 403 }
    )
  }

  return { userId, companyId: company.id }
}

export function isErrorResponse(
  result: AuthedContext | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function jsonValidationError(issues: unknown) {
  return NextResponse.json(
    { error: 'Validation failed', issues },
    { status: 422 }
  )
}
