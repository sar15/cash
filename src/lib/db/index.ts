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

export const db = drizzle(client, { schema })

export { schema }
