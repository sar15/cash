import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function getCompaniesForUser(clerkUserId: string) {
  return db.query.companies.findMany({
    where: eq(schema.companies.clerkUserId, clerkUserId),
    orderBy: (companies, { asc }) => [asc(companies.createdAt)],
  })
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
