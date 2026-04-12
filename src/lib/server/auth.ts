import { auth } from '@clerk/nextjs/server'

import { getCompanyById } from '@/lib/db/queries/companies'
import { resolveCompanyForUser } from '@/lib/db/company-context'

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

export async function requireOwnedCompany(userId: string, companyId: string) {
  const company = await getCompanyById(companyId)

  if (!company) {
    throw new RouteError(404, 'Company not found.')
  }

  if (company.clerkUserId !== userId) {
    throw new RouteError(401, 'Unauthorized')
  }

  return company
}
