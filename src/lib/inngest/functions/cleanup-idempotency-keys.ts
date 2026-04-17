import { sql } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import { db, schema } from '@/lib/db'

/**
 * Scheduled cleanup: delete idempotency keys older than 24 hours.
 * Runs every 6 hours to prevent unbounded table growth.
 */
export const cleanupIdempotencyKeys = inngest.createFunction(
  {
    id: 'cleanup-idempotency-keys',
    name: 'Cleanup Expired Idempotency Keys',
    triggers: [{ cron: '0 */6 * * *' }],
  },
  async ({ step }) => {
    const deleted = await step.run('delete-expired-keys', async () => {
      const result = await db
        .delete(schema.idempotencyKeys)
        .where(
          sql`${schema.idempotencyKeys.createdAt} < datetime('now', '-24 hours')`
        )
        .returning({ id: schema.idempotencyKeys.id })
      return result.length
    })

    return { deleted }
  }
)
