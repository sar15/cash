/**
 * Bug 4 — requireAccessibleCompany exists and accepts (userId, companyId)
 * Bug 5 — getUnreadCount filters by clerkUserId using or(isNull, eq)
 *
 * Validates: Requirements 1.4, 1.5, 2.4, 2.5, 3.4, 3.5
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Bug 4: requireAccessibleCompany ──────────────────────────────────────

describe('requireAccessibleCompany — exists and has correct signature (Bug 4)', () => {
  it('requireAccessibleCompany is exported from auth.ts', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/server/auth.ts'), 'utf-8')
    expect(src).toMatch(/export\s+async\s+function\s+requireAccessibleCompany/)
  })

  it('requireAccessibleCompany accepts (userId, companyId) parameters', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/server/auth.ts'),
      'utf-8'
    )
    // Should have the function signature with userId and companyId
    expect(src).toMatch(/requireAccessibleCompany\s*\(\s*userId\s*:\s*string\s*,\s*companyId\s*:\s*string/)
  })

  it('requireAccessibleCompany uses resolveCompanyForUser for access check', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/server/auth.ts'),
      'utf-8'
    )
    expect(src).toMatch(/resolveCompanyForUser/)
  })

  it('requireAccessibleCompany throws 401 when access is denied', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/server/auth.ts'),
      'utf-8'
    )
    // The function body should contain a 401 throw
    const fnMatch = src.match(/async function requireAccessibleCompany[\s\S]*?^}/m)?.[0] ?? ''
    expect(fnMatch).toMatch(/401/)
  })

  it('requireOwnedCompany is still present (write operations unchanged)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/server/auth.ts'), 'utf-8')
    expect(src).toMatch(/export\s+async\s+function\s+requireOwnedCompany/)
  })
})

// ── Bug 5: getUnreadCount filters by user ────────────────────────────────

describe('getUnreadCount — filters by clerkUserId (Bug 5)', () => {
  it('getUnreadCount is exported from notifications.ts', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/db/queries/notifications.ts'), 'utf-8')
    expect(src).toMatch(/export\s+async\s+function\s+getUnreadCount/)
  })

  it('getUnreadCount query uses isNull filter for broadcast notifications', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/notifications.ts'),
      'utf-8'
    )
    expect(src).toMatch(/isNull/)
  })

  it('getUnreadCount query uses or() to combine isNull and eq filters', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/notifications.ts'),
      'utf-8'
    )
    // The fixed query uses or(isNull(...), eq(...)) to include both broadcast and user-specific
    expect(src).toMatch(/or\s*\(/)
  })

  it('getUnreadCount query filters on clerkUserId column', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/notifications.ts'),
      'utf-8'
    )
    // The query should reference clerkUserId in the where clause
    const fnMatch = src.match(/async function getUnreadCount[\s\S]*?^}/m)?.[0] ?? ''
    expect(fnMatch).toMatch(/clerkUserId/)
  })

  it('getUnreadCount imports or and isNull from drizzle-orm', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/notifications.ts'),
      'utf-8'
    )
    expect(src).toMatch(/import\s*\{[^}]*\bor\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/)
    expect(src).toMatch(/import\s*\{[^}]*\bisNull\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/)
  })
})
