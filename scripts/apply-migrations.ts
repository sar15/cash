/**
 * Direct migration script — applies pending SQL migrations to Turso.
 * Run with: npx tsx scripts/apply-migrations.ts
 */
import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// Create migrations tracking table if it doesn't exist
async function ensureMigrationsTable() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER
    )
  `)
}

async function getAppliedMigrations(): Promise<Set<string>> {
  try {
    const result = await client.execute('SELECT hash FROM __drizzle_migrations')
    return new Set(result.rows.map((r) => r.hash as string))
  } catch {
    return new Set()
  }
}

async function applyMigration(filename: string, sql: string) {
  // Remove full-line comments, then split on semicolons
  const cleaned = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')

  const statements = cleaned
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  // Execute all statements sequentially in order
  for (const statement of statements) {
    try {
      await client.execute(statement)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // Ignore "already exists" / "duplicate" errors — idempotent
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        msg.includes('UNIQUE constraint failed')
      ) {
        console.log(`  ⚠ Skipped (already applied): ${statement.slice(0, 60)}...`)
        continue
      }
      console.error(`  ✗ Failed statement: ${statement.slice(0, 120)}`)
      throw err
    }
  }

  await client.execute({
    sql: 'INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    args: [filename, Date.now()],
  })
}

async function main() {
  await ensureMigrationsTable()
  const applied = await getAppliedMigrations()

  const migrationsDir = path.join(process.cwd(), 'drizzle')
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let count = 0
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ Already applied: ${file}`)
      continue
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    console.log(`→ Applying: ${file}`)
    await applyMigration(file, sql)
    console.log(`✓ Applied: ${file}`)
    count++
  }

  if (count === 0) {
    console.log('\nAll migrations already applied.')
  } else {
    console.log(`\n✅ Applied ${count} migration(s).`)
  }

  client.close()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
