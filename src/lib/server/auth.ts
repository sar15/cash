import { auth } from '@clerk/nextjs/server'

import { getCompanyById } from '@/lib/db/queries/companies'
import { resolveCompanyForUser } from '@/lib/db/company-context'
import { getMemberRole } from '@/lib/db/queries/company-members'

import { RouteError } from './api'

export async function requireUserId() {
  const { userId } = await auth()

  if (!userId) {
    throw new RouteError(401, 'Unauthorized')
  }

  return userId
}

export async function requireCompanyForUser(userId: string, companyId?: string | null) {
  const company = await resolveCompanyForUser(userId, companyId)

  if (!company) {
    throw new RouteError(401, 'Unauthorized')
  }

  return company
}

/**
 * Require that the user is an owner of the company.
 *
 * Ownership is determined by EITHER:
 *   1. company.clerkUserId === userId  (original creator)
 *   2. companyMembers row with role = 'owner' (co-founder invited as owner)
 *
 * Previously only checked (1), which caused 401 for co-founders invited as owners.
 */
export async function requireOwnedCompany(userId: string, companyId: string) {
  const company = await getCompanyById(companyId)

  if (!company) {
    throw new RouteError(404, 'Company not found.')
  }

  // Check original creator
  if (company.clerkUserId === userId) {
    return company
  }

  // Check companyMembers owner role (co-founder / transferred ownership)
  const role = await getMemberRole(companyId, userId)
  if (role === 'owner') {
    return company
  }

  throw new RouteError(403, 'Forbidden: owner access required.')
}

export async function requireAccessibleCompany(userId: string, companyId: string) {
  const company = await resolveCompanyForUser(userId, companyId)
  if (!company) {
    throw new RouteError(401, 'Unauthorized')
  }

  return company
}
