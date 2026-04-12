import { eq } from 'drizzle-orm'

import { db, schema } from '@/lib/db'

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

  const [createdCompany] = await db
    .insert(schema.companies)
    .values({
      clerkUserId,
      name: companyName,
      industry: 'general',
      fyStartMonth: 4,
      currency: 'INR',
      numberFormat: 'lakhs',
    })
    .returning()

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

  if (!company || company.clerkUserId !== clerkUserId) {
    return null
  }

  return company
}
