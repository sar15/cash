import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

/**
 * Returns all account mappings for a company as a Map keyed by rawLedgerName.
 */
export async function getMappingsForCompany(
  companyId: string
): Promise<Map<string, { standardAccountId: string | null; skipped: boolean }>> {
  const rows = await db
    .select({
      rawLedgerName: schema.accountMappings.rawLedgerName,
      standardAccountId: schema.accountMappings.standardAccountId,
      skipped: schema.accountMappings.skipped,
    })
    .from(schema.accountMappings)
    .where(eq(schema.accountMappings.companyId, companyId))

  const map = new Map<string, { standardAccountId: string | null; skipped: boolean }>()
  for (const row of rows) {
    map.set(row.rawLedgerName, {
      standardAccountId: row.standardAccountId,
      skipped: row.skipped,
    })
  }
  return map
}

export type MappingEntry = {
  rawLedgerName: string
  standardAccountId: string | null
  skipped: boolean
}

/**
 * Batch upsert account mappings for a company.
 * Uses INSERT ... ON CONFLICT DO UPDATE targeting the unique index on (companyId, rawLedgerName).
 * Returns the count of rows affected.
 */
export async function upsertMappings(
  companyId: string,
  entries: MappingEntry[]
): Promise<number> {
  if (entries.length === 0) return 0

  const values = entries.map((e) => ({
    companyId,
    rawLedgerName: e.rawLedgerName,
    standardAccountId: e.standardAccountId,
    skipped: e.skipped,
  }))

  const result = await db
    .insert(schema.accountMappings)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.accountMappings.companyId, schema.accountMappings.rawLedgerName],
      set: {
        standardAccountId: sql`excluded.standard_account_id`,
        skipped: sql`excluded.skipped`,
        updatedAt: sql`(datetime('now'))`,
      },
    })
    .returning({ id: schema.accountMappings.id })

  return result.length
}
