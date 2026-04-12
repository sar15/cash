import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/**
 * FIX audit2 L2: Health check endpoint to verify DB connectivity.
 * GET /api/health
 */
export async function GET() {
  try {
    const start = Date.now()
    await db.run(sql`SELECT 1`)
    const dbLatencyMs = Date.now() - start

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: {
        status: 'connected',
        latencyMs: dbLatencyMs,
      },
    })
  } catch (error) {
    console.error('[HEALTH_CHECK]', error)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        db: {
          status: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 503 }
    )
  }
}
