import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ─── Task 1 → 3: Bug condition exploration tests (now verify fixes) ────────

describe('Gap 1 — Forecast URL fix', () => {
  it('apiPost uses query string companyId (not path parameter)', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/use-current-forecast.ts'), 'utf-8')
    // Correct: `/api/forecast/result?companyId=${company.id}` — query string (matches flat route with resolveAuthedCompany)
    // Bug was: `/api/forecast/result/${company.id}` — path param (hits [companyId] route with requireOwnedCompany, blocks team members)
    expect(src).toContain('`/api/forecast/result?companyId=${company.id}`')
    expect(src).not.toContain('`/api/forecast/result/${company.id}`')
  })
})



describe('Gap 4 — Member invite acceptedAt fix', () => {
  it('addMember() sets acceptedAt on insert', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/db/queries/company-members.ts'), 'utf-8')
    // The .values() call must now include acceptedAt
    expect(src).toContain('acceptedAt: new Date().toISOString()')
  })
})

describe('Gap 6 — RESEND_FROM_EMAIL fallback fix', () => {
  it('RESEND_FROM_EMAIL falls back to empty string (not test domain)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/server/env.ts'), 'utf-8')
    expect(src).not.toContain("optionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev')")
    expect(src).toContain("optionalEnv('RESEND_FROM_EMAIL', '')")
  })

  it('production warning is emitted when RESEND_FROM_EMAIL is unset', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/server/env.ts'), 'utf-8')
    expect(src).toContain("RESEND_FROM_EMAIL is not set")
    expect(src).toContain("console.warn")
  })
})

// ─── Task 2: Preservation property tests ──────────────────────────────────

describe('Preservation — canAccessCompany owner check', () => {
  it('canAccessCompany checks direct ownership first (owner path preserved)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/db/queries/company-members.ts'), 'utf-8')
    expect(src).toContain("company?.clerkUserId === clerkUserId")
  })
})

describe('Preservation — RESEND_FROM_EMAIL explicit value', () => {
  it('optionalEnv reads from process.env first (explicit value preserved)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/server/env.ts'), 'utf-8')
    expect(src).toContain('return process.env[name] ??')
  })
})

describe('Preservation — Encrypt/decrypt round-trip (PBT)', () => {
  it('decryptToken(encryptToken(t)) === t for many token strings', async () => {
    const { encryptToken, decryptToken } = await import('../../../lib/utils/crypto')

    // Property: round-trip is lossless for a wide range of token strings
    const samples = [
      '1000.abc123def456',
      'eyJhbGciOiJSUzI1NiJ9.payload.signature',
      'short',
      'a'.repeat(512),
      'special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
      '₹ Indian rupee symbol',
      '0',
      ' ',
    ]

    for (const token of samples) {
      const encrypted = encryptToken(token)
      expect(encrypted).not.toBe(token) // must be different from plaintext
      const decrypted = decryptToken(encrypted)
      expect(decrypted).toBe(token)     // must round-trip losslessly
    }
  })
})

describe('Preservation — Forecast engine purity', () => {
  it('use-current-forecast does not call DB inside engine computation', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/use-current-forecast.ts'), 'utf-8')
    const memoBlock = src.match(/const engineResult = useMemo\(\(\) => \{[\s\S]+?\}, \[/)?.[0] ?? ''
    expect(memoBlock).not.toContain('await db')
    expect(memoBlock).not.toContain('await fetch')
  })
})
