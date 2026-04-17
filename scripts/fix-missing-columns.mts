import { createClient, type Row } from '@libsql/client'
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

function hasColumn(rows: Row[], columnName: string): boolean {
  return rows.some((r) => String(r['name'] ?? '') === columnName)
}

for (const fix of fixes) {
  const info = await client.execute(`PRAGMA table_info(${fix.table})`)
  if (hasColumn(info.rows, fix.check)) {
    console.log(`✓ ${fix.table}.${fix.check} already exists`)
    continue
  }
  try {
    await client.execute(fix.sql)
    console.log(`✅ Added ${fix.table}.${fix.check}`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`✗ Failed: ${message}`)
  }
}

client.close()
console.log('Done.')
