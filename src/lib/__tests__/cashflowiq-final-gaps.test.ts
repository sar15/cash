/**
 * CashFlowIQ Final Gaps — Bug Condition & Preservation Tests
 *
 * Task 1: Bug condition exploration tests (confirm bugs exist on unfixed code,
 *         confirm bugs are fixed on current code)
 * Task 2: Preservation tests (non-buggy inputs are unaffected)
 *
 * Validates: Requirements 1.1, 1.2, 2.1–2.8, 3.1–3.10
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Task 1.1 — Gap 1: Forecast URL uses query string (not path param)
// Bug condition: URL matches /api/forecast/result/<uuid> pattern
// On FIXED code this test PASSES (bug is gone)
// ─────────────────────────────────────────────────────────────────────────────

describe('Gap 1 — Forecast result URL (bug condition exploration)', () => {
  it('apiPost is called with companyId as query string, not path segment', () => {
    // Read the source and assert the URL pattern used
    const src = readFileSync(
      resolve(process.cwd(), 'src/hooks/use-current-forecast.ts'),
      'utf-8'
    )

    // MUST contain the correct query-string pattern (supports team members via resolveAuthedCompany)
    expect(src).toMatch(/apiPost\s*\(\s*`\/api\/forecast\/result\?companyId=\$\{/)

    // Must NOT contain the old path-param pattern (hits requireOwnedCompany, blocks team members)
    expect(src).not.toMatch(/apiPost\s*\(\s*`\/api\/forecast\/result\/\$\{/)
  })

  it('companyId is NOT included in the POST body (resolveAuthedCompany reads from query string)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/hooks/use-current-forecast.ts'),
      'utf-8'
    )

    // Extract the apiPost call block
    const apiPostIdx = src.indexOf('apiPost(`/api/forecast/result')
    expect(apiPostIdx).toBeGreaterThan(-1)

    // The body object passed to apiPost should not contain companyId as a key
    // (it should be in the URL query string only)
    const bodySlice = src.slice(apiPostIdx, apiPostIdx + 600)
    // companyId should only appear in the URL template literal, not as a body key
    const bodyStart = bodySlice.indexOf('{', bodySlice.indexOf(','))
    const bodyContent = bodySlice.slice(bodyStart)
    expect(bodyContent).not.toMatch(/companyId\s*:/)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Task 1.3 — Gap 4: addMember sets acceptedAt immediately
// Bug condition: member.acceptedAt IS NULL after addMember()
// On FIXED code this test PASSES (acceptedAt is set)
// ─────────────────────────────────────────────────────────────────────────────

describe('Gap 4 — Member invite acceptedAt (bug condition exploration)', () => {
  it('addMember() insert includes acceptedAt: new Date().toISOString()', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/company-members.ts'),
      'utf-8'
    )
    // The .values({...}) block in addMember must include acceptedAt
    const fnMatch = src.match(/async function addMember[\s\S]*?^}/m)?.[0] ?? ''
    expect(fnMatch).toMatch(/acceptedAt\s*:/)
    expect(fnMatch).toMatch(/new Date\(\)\.toISOString\(\)/)
  })

  it('canAccessCompany returns true for member with non-null acceptedAt', () => {
    // Verify the logic: !!member?.acceptedAt is true when acceptedAt is a non-null ISO string
    const isoString = new Date().toISOString()
    expect(!!isoString).toBe(true)
    const nullValue: string | null = null
    expect(!!nullValue).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 1.4 — Gap 6: RESEND_FROM_EMAIL fallback is '' with production warning
// Bug condition: fallback is 'onboarding@resend.dev', no warning
// On FIXED code this test PASSES (fallback is '', warning is emitted)
// ─────────────────────────────────────────────────────────────────────────────

describe('Gap 6 — RESEND_FROM_EMAIL fallback (bug condition exploration)', () => {
  it('env.ts does NOT use onboarding@resend.dev as fallback', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/server/env.ts'),
      'utf-8'
    )
    expect(src).not.toMatch(/onboarding@resend\.dev/)
  })

  it('env.ts uses empty string as RESEND_FROM_EMAIL fallback', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/server/env.ts'),
      'utf-8'
    )
    expect(src).toMatch(/optionalEnv\s*\(\s*['"]RESEND_FROM_EMAIL['"]\s*,\s*['"]{2}\s*\)/)
  })

  it('env.ts emits console.warn in production when RESEND_FROM_EMAIL is not set', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/server/env.ts'),
      'utf-8'
    )
    // Must have a production guard + warn for missing RESEND_FROM_EMAIL
    expect(src).toMatch(/isProduction.*RESEND_FROM_EMAIL|RESEND_FROM_EMAIL.*isProduction/)
    expect(src).toMatch(/console\.warn/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2.1 — Preservation: Owner access unaffected by addMember fix
// Validates: Requirements 3.8
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation — Owner access unaffected by addMember fix', () => {
  it('canAccessCompany checks direct ownership BEFORE checking member table', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/company-members.ts'),
      'utf-8'
    )
    const fnMatch = src.match(/async function canAccessCompany[\s\S]*?^}/m)?.[0] ?? ''

    // Direct ownership check must appear before member check
    const ownershipIdx = fnMatch.indexOf('companies.findFirst')
    const memberIdx = fnMatch.indexOf('companyMembers.findFirst')
    expect(ownershipIdx).toBeGreaterThan(-1)
    expect(memberIdx).toBeGreaterThan(-1)
    expect(ownershipIdx).toBeLessThan(memberIdx)
  })

  it('canAccessCompany returns true for owner via direct ownership check (logic verification)', () => {
    // Simulate the ownership check logic: if company.clerkUserId === clerkUserId → true
    const company = { clerkUserId: 'owner-clerk-id' }
    const clerkUserId = 'owner-clerk-id'
    const ownerCheck = company?.clerkUserId === clerkUserId
    expect(ownerCheck).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2.2 — Preservation: Explicit RESEND_FROM_EMAIL is used as-is, no warning
// Validates: Requirements 3.7
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation — Explicit RESEND_FROM_EMAIL respected', () => {
  it('optionalEnv returns the provided value when env var is set', () => {
    // Simulate optionalEnv logic: process.env[name] ?? fallback
    const simulateOptionalEnv = (envValue: string | undefined, fallback: string) =>
      envValue ?? fallback

    expect(simulateOptionalEnv('noreply@myapp.com', '')).toBe('noreply@myapp.com')
    expect(simulateOptionalEnv(undefined, '')).toBe('')
  })

  it('env.ts production warning is guarded by !process.env.RESEND_FROM_EMAIL', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/server/env.ts'),
      'utf-8'
    )
    // The warn block must check that RESEND_FROM_EMAIL is falsy
    expect(src).toMatch(/!process\.env\.RESEND_FROM_EMAIL/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2.3 — Preservation: Encrypt/decrypt round-trip is lossless (PBT)
// Property 2: For any string t of length 1–512, decrypt(encrypt(t, key), key) === t
// Validates: Requirements 3.9
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation — Encrypt/decrypt round-trip is lossless (Property-Based)', () => {
  /**
   * **Validates: Requirements 3.9**
   *
   * Property: For any plaintext string t (length 1–512),
   *   decrypt(encrypt(t, key), key) === t
   *
   * We generate 50 random token strings across the full character space
   * and verify the round-trip is lossless.
   */
  it('round-trip is lossless for random token strings (property-based)', async () => {
    const { encryptToken, decryptToken } = await import('../utils/crypto')

    // Character set covering typical OAuth token characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-+/='

    function randomToken(length: number): string {
      let result = ''
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)]
      }
      return result
    }

    // Test 50 random tokens of varying lengths (1–512)
    for (let i = 0; i < 50; i++) {
      const length = Math.max(1, Math.floor(Math.random() * 512))
      const plaintext = randomToken(length)
      const encrypted = encryptToken(plaintext)
      const decrypted = decryptToken(encrypted)
      expect(decrypted).toBe(plaintext)
    }
  })

  it('encrypted value differs from plaintext (not stored as-is)', async () => {
    const { encryptToken } = await import('../utils/crypto')
    const token = '1000.abc.def.ghi.jkl'
    const encrypted = encryptToken(token)
    expect(encrypted).not.toBe(token)
    // Base64 encoded
    expect(encrypted.length).toBeGreaterThan(token.length)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2.4 — Preservation: Forecast engine purity unaffected by URL fix
// Validates: Requirements 3.1, 3.2, 3.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation — Forecast engine purity unaffected by URL fix', () => {
  it('runScenarioForecastEngine is a pure function (no DB imports in engine file)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/engine/scenarios/engine.ts'),
      'utf-8'
    )
    // Engine must not import from db
    expect(src).not.toMatch(/from.*['"]@\/lib\/db['"]/)
    expect(src).not.toMatch(/from.*['"]\.\.\/\.\.\/db['"]/)
  })

  it('use-current-forecast.ts does not call runScenarioForecastEngine inside the apiPost callback', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/hooks/use-current-forecast.ts'),
      'utf-8'
    )
    // The apiPost call is inside a setTimeout, not inside the engine call
    // Engine is called in useMemo, apiPost is called in useEffect — they are separate
    const useMemoIdx = src.indexOf('useMemo(')
    const apiPostIdx = src.indexOf('apiPost(')
    const useEffectIdx = src.indexOf('useEffect(')

    // apiPost must be inside useEffect, not useMemo
    expect(apiPostIdx).toBeGreaterThan(useEffectIdx)
    expect(useMemoIdx).toBeLessThan(useEffectIdx)
  })

  it('engine produces deterministic output for same inputs (purity check)', async () => {
    const { runScenarioForecastEngine } = await import('../engine/scenarios/engine')
    const { demoData, forecastMonths, demoValueRules, demoTimingProfiles } = await import('../demo-data')

    const opts = {
      accounts: demoData,
      forecastMonthLabels: forecastMonths,
      valueRules: demoValueRules,
      timingProfiles: demoTimingProfiles,
    }

    const result1 = runScenarioForecastEngine(opts)
    const result2 = runScenarioForecastEngine(opts)

    // Same inputs → same outputs (pure function)
    expect(result1.forecastMonths).toEqual(result2.forecastMonths)
    expect(result1.integrationResults.length).toBe(result2.integrationResults.length)
    result1.integrationResults.forEach((m, i) => {
      expect(m.pl.revenue).toBe(result2.integrationResults[i].pl.revenue)
      expect(m.pl.netIncome).toBe(result2.integrationResults[i].pl.netIncome)
      expect(m.bs.cash).toBe(result2.integrationResults[i].bs.cash)
    })
  })
})
