import { and, eq, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { getFirmClientCompanies } from '@/lib/db/queries/firms'
import { getOrCreateUserProfile } from '@/lib/db/queries/user-profiles'

export async function getCompaniesForUser(clerkUserId: string) {
  return db.query.companies.findMany({
    where: eq(schema.companies.clerkUserId, clerkUserId),
    orderBy: (companies, { asc }) => [asc(companies.createdAt)],
  })
}

export async function getAccessibleCompaniesForUser(clerkUserId: string) {
  const profile = await getOrCreateUserProfile(clerkUserId)

  const owned = await db.query.companies.findMany({
    where: eq(schema.companies.clerkUserId, clerkUserId),
    orderBy: (companies, { asc }) => [asc(companies.createdAt)],
  })

  const members = await db.query.companyMembers.findMany({
    where: and(
      eq(schema.companyMembers.clerkUserId, clerkUserId),
      isNotNull(schema.companyMembers.acceptedAt)
    ),
    with: { company: true },
  })

  const firmClients =
    profile.userType === 'ca_firm'
      ? await getFirmClientCompanies(clerkUserId)
      : []

  const seen = new Set<string>()
  const all: typeof owned = []
  for (const c of owned) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      all.push(c)
    }
  }
  for (const m of members) {
    if (m.company && !seen.has(m.company.id)) {
      seen.add(m.company.id)
      all.push(m.company)
    }
  }
  for (const c of firmClients) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      all.push(c)
    }
  }

  return all
}

export async function getCompanyById(companyId: string) {
  return db.query.companies.findFirst({
    where: eq(schema.companies.id, companyId),
  })
}

export async function createCompany(
  clerkUserId: string,
  data: Omit<typeof schema.companies.$inferInsert, 'id' | 'clerkUserId' | 'createdAt' | 'updatedAt'>
) {
  const [company] = await db
    .insert(schema.companies)
    .values({ ...data, clerkUserId })
    .returning()
  return company
}

export async function updateCompany(
  companyId: string,
  data: Partial<typeof schema.companies.$inferInsert>
) {
  const [updated] = await db
    .update(schema.companies)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.companies.id, companyId))
    .returning()
  return updated
}

export async function deleteCompany(companyId: string) {
  await db.delete(schema.companies).where(eq(schema.companies.id, companyId))
}
