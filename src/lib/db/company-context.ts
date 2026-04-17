import { eq } from 'drizzle-orm'

import { db, schema } from '@/lib/db'
import { canAccessCompany, getMemberRole, type MemberRole } from '@/lib/db/queries/company-members'
import { canAccessCompanyViaFirm } from '@/lib/db/queries/firms'

// FIX audit2: Remove hardcoded "Patel Engineering Works" default
export async function getOrCreatePrimaryCompanyForUser(
  clerkUserId: string,
  companyName = 'My Company'
) {
  const existingCompany = await db.query.companies.findFirst({
    where: eq(schema.companies.clerkUserId, clerkUserId),
    orderBy: (companies, { asc }) => [asc(companies.createdAt)],
  })

  if (existingCompany) {
    return existingCompany
  }

  try {
    await db
      .insert(schema.companies)
      .values({
        clerkUserId,
        name: companyName,
        industry: 'general',
        fyStartMonth: 4,
        currency: 'INR',
        numberFormat: 'lakhs',
        isPrimary: true,
      })
  } catch {
    // Another concurrent request may have created it.
  }

  const createdCompany = await db.query.companies.findFirst({
    where: eq(schema.companies.clerkUserId, clerkUserId),
    orderBy: (companies, { asc }) => [asc(companies.createdAt)],
  })

  if (!createdCompany) {
    throw new Error('Failed to create or resolve primary company')
  }

  return createdCompany
}

export async function resolveCompanyForUser(
  clerkUserId: string,
  companyId?: string | null
) {
  if (!companyId) {
    return getOrCreatePrimaryCompanyForUser(clerkUserId)
  }

  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, companyId),
  })

  if (!company) {
    return null
  }

  if (company.clerkUserId === clerkUserId) {
    return company
  }

  const hasAccess = await canAccessCompany(companyId, clerkUserId)
  const hasFirmAccess = hasAccess ? true : await canAccessCompanyViaFirm(companyId, clerkUserId)
  if (!hasFirmAccess) {
    return null
  }

  return company
}

export interface CompanyAccessContext {
  company: typeof schema.companies.$inferSelect
  isOwner: boolean
  role: MemberRole
}

export async function resolveCompanyAccessForUser(
  clerkUserId: string,
  companyId?: string | null
): Promise<CompanyAccessContext | null> {
  const company = await resolveCompanyForUser(clerkUserId, companyId)
  if (!company) {
    return null
  }

  if (company.clerkUserId === clerkUserId) {
    return {
      company,
      isOwner: true,
      role: 'owner',
    }
  }

  const role = await getMemberRole(company.id, clerkUserId)
  if (!role) {
    return null
  }

  return {
    company,
    isOwner: false,
    role,
  }
}
