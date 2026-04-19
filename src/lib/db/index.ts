import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

// FIX audit2 M9: Throw error if env vars missing in production
const isProduction = process.env.NODE_ENV === 'production'
const dbUrl = process.env.TURSO_DATABASE_URL

if (isProduction && !dbUrl) {
  throw new Error(
    'TURSO_DATABASE_URL is required in production. ' +
    'Set it in your environment variables to connect to your Turso database.'
  )
}

const client = createClient({
  url: dbUrl ?? 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// Security/Reliability: Enable WAL mode and set a generous busy timeout.
// WAL (Write-Ahead Logging) allows concurrent reads during writes, dramatically
// reducing SQLITE_BUSY errors when Inngest background jobs and user requests
// hit the DB simultaneously.
// busy_timeout: 5000ms — wait up to 5s before throwing SQLITE_BUSY.
// This is a no-op for Turso remote connections (handled server-side) but
// critical for local dev with file:local.db.
client.execute('PRAGMA journal_mode=WAL').catch(() => {/* no-op for remote Turso */})
client.execute('PRAGMA busy_timeout=5000').catch(() => {/* no-op for remote Turso */})

export const db = drizzle(client, { schema })

export { schema }
