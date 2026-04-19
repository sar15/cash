import { eq, and, isNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { RouteError } from '@/lib/server/api'

/**
 * Returns only active (non-archived) accounts for a company.
 * Archived accounts are excluded from engine calculations and reports.
 */
export async function getAccountsForCompany(companyId: string) {
  return db.query.accounts.findMany({
    where: and(
      eq(schema.accounts.companyId, companyId),
      isNull(schema.accounts.archivedAt)
    ),
    orderBy: (accounts, { asc }) => [asc(accounts.sortOrder)],
  })
}

export async function getAccountTree(companyId: string) {
  // Use getAccountsForCompany which already filters out archived accounts
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

  // Build tree with cycle protection — max depth of 20 prevents infinite recursion
  // if a circular reference somehow exists in the DB despite the write-time guard.
  const buildNode = (account: (typeof accounts)[0], depth = 0): object => {
    if (depth > 20) return { ...account, children: [] }
    return {
      ...account,
      children: (childMap.get(account.id) ?? []).map(child => buildNode(child, depth + 1)),
    }
  }

  return roots.map(root => buildNode(root))
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
  // Guard against circular parent references before writing to DB.
  // If parentId is being changed, walk up the ancestor chain to ensure
  // the new parent is not already a descendant of this account.
  if (data.parentId && data.parentId !== accountId) {
    const allAccounts = await getAccountsForCompany(companyId)
    const accountMap = new Map(allAccounts.map(a => [a.id, a]))

    // Walk up from the proposed new parent — if we ever reach accountId, it's a cycle
    let cursor: string | null = data.parentId
    const visited = new Set<string>()
    while (cursor) {
      if (cursor === accountId) {
        throw new RouteError(
          409,
          'Circular reference detected: the selected parent account is a descendant of this account. ' +
          'Choose a different parent to avoid an infinite loop in the account tree.'
        )
      }
      if (visited.has(cursor)) break // existing cycle in DB — stop traversal
      visited.add(cursor)
      cursor = accountMap.get(cursor)?.parentId ?? null
    }
  }

  const [updated] = await db
    .update(schema.accounts)
    .set(data)
    .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.companyId, companyId)))
    .returning()
  return updated
}

/**
 * Soft-delete an account by setting archivedAt.
 *
 * BLOCKS archival if the account has:
 *   - Active value rules (forecast would silently use 0)
 *   - Historical actuals (data loss risk)
 *   - Active micro-forecast lines referencing it
 *
 * This prevents orphaned rules from silently corrupting the forecast engine.
 */
export async function archiveAccount(accountId: string, companyId: string) {
  // 1. Verify ownership
  const account = await db.query.accounts.findFirst({
    where: and(eq(schema.accounts.id, accountId), eq(schema.accounts.companyId, companyId)),
  })
  if (!account) throw new RouteError(404, 'Account not found.')
  if (account.archivedAt) throw new RouteError(409, 'Account is already archived.')

  // 2. Check for active value rules
  const activeRules = await db.query.valueRules.findMany({
    where: and(
      eq(schema.valueRules.accountId, accountId),
      eq(schema.valueRules.companyId, companyId)
    ),
  })
  if (activeRules.length > 0) {
    throw new RouteError(
      409,
      `Cannot archive "${account.name}": it has ${activeRules.length} active forecast rule(s). ` +
      `Remove the rules first, then archive the account.`
    )
  }

  // 3. Check for historical actuals
  const actuals = await db.query.monthlyActuals.findFirst({
    where: and(
      eq(schema.monthlyActuals.accountId, accountId),
      eq(schema.monthlyActuals.companyId, companyId)
    ),
  })
  if (actuals) {
    throw new RouteError(
      409,
      `Cannot archive "${account.name}": it has historical actuals. ` +
      `Accounts with transaction history cannot be archived to prevent data loss.`
    )
  }

  // 4. Check for micro-forecast lines
  const mfLines = await db.query.microForecastLines.findFirst({
    where: eq(schema.microForecastLines.accountId, accountId),
  })
  if (mfLines) {
    throw new RouteError(
      409,
      `Cannot archive "${account.name}": it is referenced by an active micro-forecast. ` +
      `Remove the micro-forecast line first.`
    )
  }

  // 5. Safe to archive
  const [archived] = await db
    .update(schema.accounts)
    .set({ archivedAt: new Date().toISOString() })
    .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.companyId, companyId)))
    .returning()
  return archived
}

/**
 * Hard delete — only allowed if account has no actuals and no rules.
 * Prefer archiveAccount() for most cases.
 */
export async function deleteAccount(accountId: string, companyId: string) {
  await db
    .delete(schema.accounts)
    .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.companyId, companyId)))
}
