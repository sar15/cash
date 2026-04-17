import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const fixes = [
  {
    check: 'books_closed_date',
    table: 'companies',
    sql: 'ALTER TABLE companies ADD COLUMN books_closed_date TEXT',
  },
  {
    check: 'status',
    table: 'forecast_results',
    sql: "ALTER TABLE forecast_results ADD COLUMN status TEXT NOT NULL DEFAULT 'ready'",
  },
]

for (const fix of fixes) {
  const info = await client.execute(`PRAGMA table_info(${fix.table})`)
  const exists = info.rows.some((r: any) => r.name === fix.check)
  if (exists) {
    console.log(`✓ ${fix.table}.${fix.check} already exists`)
    continue
  }
  try {
    await client.execute(fix.sql)
    console.log(`✅ Added ${fix.table}.${fix.check}`)
  } catch (err: any) {
    console.error(`✗ Failed: ${err.message}`)
  }
}

client.close()
console.log('Done.')
