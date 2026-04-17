import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveCompanyAccessForUser } from '@/lib/db/company-context'
import type { MemberRole } from '@/lib/db/queries/company-members'

export interface AuthedContext {
  userId: string
  companyId: string
  role: MemberRole
  isOwner: boolean
}

export type CompanyCapability =
  | 'settings.manage'
  | 'compliance.manage'
  | 'members.manage'
  | 'reports.export'

export function hasCompanyCapability(
  ctx: Pick<AuthedContext, 'role' | 'isOwner'>,
  capability: CompanyCapability
) {
  if (ctx.isOwner) return true

  switch (capability) {
    case 'reports.export':
      return ctx.role === 'editor'
    case 'settings.manage':
    case 'compliance.manage':
    case 'members.manage':
      return false
    default:
      return false
  }
}

export function requireCompanyCapability(
  ctx: Pick<AuthedContext, 'role' | 'isOwner'>,
  capability: CompanyCapability
) {
  if (hasCompanyCapability(ctx, capability)) {
    return null
  }

  return NextResponse.json(
    { error: 'Insufficient permissions for this action' },
    { status: 403 }
  )
}

/**
 * Resolves auth + company isolation for API routes.
 * Returns context on success or a NextResponse error on failure.
 *
 * For mutating requests (POST/PUT/PATCH/DELETE), companyId MUST be explicitly
 * provided via query param or x-company-id header. Missing companyId on a write
 * returns 400 — we never silently fall back to the primary company on mutations.
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

  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method)

  // Require explicit companyId on all mutating requests to prevent wrong-tenant writes
  if (isMutation && !companyId) {
    return NextResponse.json(
      { error: 'companyId is required for this request' },
      { status: 400 }
    )
  }

  const access = await resolveCompanyAccessForUser(userId, companyId)

  if (!access) {
    return NextResponse.json(
      { error: 'Company not found or access denied' },
      { status: 403 }
    )
  }

  if (isMutation && access.role === 'viewer' && !access.isOwner) {
    return NextResponse.json(
      { error: 'Insufficient permissions for this action' },
      { status: 403 }
    )
  }

  return {
    userId,
    companyId: access.company.id,
    role: access.role,
    isOwner: access.isOwner,
  }
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
