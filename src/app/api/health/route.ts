import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/**
 * Health check endpoint — public, no auth required.
 * Returns 200 with basic service status for post-deploy smoke tests and uptime monitoring.
 */
export async function GET() {
  try {
    await db.run(sql`select 1`)
  } catch {
    return Response.json(
      {
        status: 'degraded',
        ts: new Date().toISOString(),
        checks: { database: 'down' },
      },
      { status: 503 }
    )
  }

  return Response.json({
    status: 'ok',
    ts: new Date().toISOString(),
    checks: { database: 'up' },
  })
}
