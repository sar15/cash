import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function getAccountsForCompany(companyId: string) {
  return db.query.accounts.findMany({
    where: eq(schema.accounts.companyId, companyId),
    orderBy: (accounts, { asc }) => [asc(accounts.sortOrder)],
  })
}

export async function getAccountTree(companyId: string) {
  const accounts = await getAccountsForCompany(companyId)
  const roots = accounts.filter((a) => !a.parentId)
  const childMap = new Map<string, typeof accounts>()

  accounts.forEach((a) => {
    if (a.parentId) {
      const children = childMap.get(a.parentId) ?? []
      children.push(a)
      childMap.set(a.parentId, children)
    }
  })

  return roots.map((root) => ({
    ...root,
    children: childMap.get(root.id) ?? [],
  }))
}

export async function upsertAccount(
  companyId: string,
  data: Omit<typeof schema.accounts.$inferInsert, 'id' | 'companyId'>
) {
  const [account] = await db
    .insert(schema.accounts)
    .values({ ...data, companyId })
    .returning()
  return account
}

export async function updateAccount(
  accountId: string,
  companyId: string,
  data: Partial<typeof schema.accounts.$inferInsert>
) {
  const [updated] = await db
    .update(schema.accounts)
    .set(data)
    .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.companyId, companyId)))
    .returning()
  return updated
}

export async function deleteAccount(accountId: string, companyId: string) {
  await db
    .delete(schema.accounts)
    .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.companyId, companyId)))
}
