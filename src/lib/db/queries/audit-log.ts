import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export interface AuditEntry {
  companyId: string
  clerkUserId: string
  action: string
  entityType?: string
  entityId?: string
  oldValue?: unknown
  newValue?: unknown
}

export async function writeAuditLog(entry: AuditEntry) {
  await db.insert(schema.auditLog).values({
    companyId: entry.companyId,
    clerkUserId: entry.clerkUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValue: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
    newValue: entry.newValue ? JSON.stringify(entry.newValue) : null,
  })
}

export async function getAuditLog(companyId: string, limit = 50) {
  return db.query.auditLog.findMany({
    where: eq(schema.auditLog.companyId, companyId),
    orderBy: (log, { desc }) => [desc(log.createdAt)],
    limit,
  })
}

export async function getEntityHistory(
  companyId: string,
  entityType: string,
  entityId: string,
  limit = 10
) {
  return db.query.auditLog.findMany({
    where: and(
      eq(schema.auditLog.companyId, companyId),
      eq(schema.auditLog.entityType, entityType),
      eq(schema.auditLog.entityId, entityId)
    ),
    orderBy: (log, { desc }) => [desc(log.createdAt)],
    limit,
  })
}
