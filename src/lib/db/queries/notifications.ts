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
  // Return notifications for this specific user OR company-wide (null clerkUserId)
  const all = await db.query.notifications.findMany({
    where: eq(schema.notifications.companyId, companyId),
    orderBy: (n, { desc }) => [desc(n.createdAt)],
    limit: limit * 2, // fetch extra to filter
  })
  // Show notifications targeted at this user OR broadcast to whole company
  return all
    .filter(n => !n.clerkUserId || n.clerkUserId === clerkUserId)
    .slice(0, limit)
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

export async function markNotificationRead(id: string, companyId: string) {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(
      eq(schema.notifications.id, id),
      eq(schema.notifications.companyId, companyId)
    ))
}

export async function markAllNotificationsRead(companyId: string) {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(
      eq(schema.notifications.companyId, companyId),
      isNull(schema.notifications.readAt)
    ))
}
