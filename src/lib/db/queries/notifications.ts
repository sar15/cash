import { eq, and, isNull, or } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export interface CreateNotificationInput {
  companyId: string
  clerkUserId?: string
  type: 'compliance_due' | 'import_complete' | 'rule_changed' | 'scenario_activated' | 'general'
  title: string
  body: string
  actionUrl?: string
}

export async function createNotification(input: CreateNotificationInput) {
  const [notification] = await db
    .insert(schema.notifications)
    .values(input)
    .returning()
  return notification
}

export async function getNotifications(companyId: string, clerkUserId: string, limit = 20) {
  return db.query.notifications.findMany({
    where: and(
      eq(schema.notifications.companyId, companyId),
      or(
        isNull(schema.notifications.clerkUserId),
        eq(schema.notifications.clerkUserId, clerkUserId)
      )
    ),
    orderBy: (n, { desc }) => [desc(n.createdAt)],
    limit,
  })
}

export async function getUnreadCount(companyId: string, clerkUserId: string): Promise<number> {
  const all = await db.query.notifications.findMany({
    where: and(
      eq(schema.notifications.companyId, companyId),
      isNull(schema.notifications.readAt),
      or(
        isNull(schema.notifications.clerkUserId),
        eq(schema.notifications.clerkUserId, clerkUserId)
      )
    ),
    columns: { id: true },
  })
  return all.length
}

export async function markNotificationRead(id: string, companyId: string, clerkUserId: string) {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(
      eq(schema.notifications.id, id),
      eq(schema.notifications.companyId, companyId),
      or(
        isNull(schema.notifications.clerkUserId),
        eq(schema.notifications.clerkUserId, clerkUserId)
      )
    ))
}

export async function markAllNotificationsRead(companyId: string, clerkUserId: string) {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(
      eq(schema.notifications.companyId, companyId),
      isNull(schema.notifications.readAt),
      or(
        isNull(schema.notifications.clerkUserId),
        eq(schema.notifications.clerkUserId, clerkUserId)
      )
    ))
}
