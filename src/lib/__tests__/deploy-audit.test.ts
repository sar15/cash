/**
 * Deploy Audit — Bug Condition Exploration Tests
 *
 * These tests are EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bugs exist. Do NOT fix the code here.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9,
 *            1.10, 1.11, 1.12, 1.13, 1.14
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { execSync } from 'child_process'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../../..')

// ── Bug 1: use-current-forecast.ts uses path-param URL (not query string) ──
describe('Bug 1 — forecast save URL', () => {
  it('should NOT contain path-param template literal /api/forecast/result/${ (expects query string instead)', () => {
    const src = readFileSync(resolve(ROOT, 'src/hooks/use-current-forecast.ts'), 'utf-8')
    // On unfixed code this FAILS because the path-param pattern IS present
    expect(src).not.toContain('/api/forecast/result/${')
  })
})

// ── Bug 2: 12 duplicate " 2." files should not exist ──────────────────────
describe('Bug 2 — duplicate " 2." files', () => {
  const duplicates = [
    'src/components/forecast/AccountRuleEditor 2.tsx',
    'src/components/forecast/SensitivityPanel 2.tsx',
    'src/components/shared/ErrorBoundary 2.tsx',
    'src/components/shared/Toast 2.tsx',
    'src/components/shared/UserTypeModal 2.tsx',
    'src/components/shared/skeleton 2.tsx',
    'src/lib/__tests__/cashflowiq-final-gaps.test 2.ts',
    'src/lib/email/send 2.ts',
    'src/lib/inngest/client 2.ts',
    'src/lib/reports/pdf-generator 2.ts',
    'src/lib/server/env 2.ts',
    'src/lib/utils/crypto 2.ts',
  ]

  for (const file of duplicates) {
    it(`should not exist: ${file}`, () => {
      // On unfixed code this FAILS because the file DOES exist
      expect(existsSync(resolve(ROOT, file))).toBe(false)
    })
  }
})

// ── Bug 3: send.ts contains hardcoded onboarding@resend.dev fallback ───────
describe('Bug 3 — hardcoded Resend fallback email', () => {
  it('send.ts should NOT contain onboarding@resend.dev', () => {
    const src = readFileSync(resolve(ROOT, 'src/lib/email/send.ts'), 'utf-8')
    // On unfixed code this FAILS because the hardcoded fallback IS present
    expect(src).not.toContain('onboarding@resend.dev')
  })
})

// ── Bug 5: .env.local is tracked by git ───────────────────────────────────
describe('Bug 5 — .env.local tracked by git', () => {
  it('git ls-files .env.local should return empty output', () => {
    const output = execSync('git ls-files .env.local', {
      cwd: ROOT,
      encoding: 'utf-8',
      // Ensure git can find the repo root
      env: { ...process.env, GIT_DIR: undefined },
    }).trim()
    // On unfixed code this FAILS because .env.local IS tracked
    expect(output).toBe('')
  })
})

// ── Bug 6: [companyId]/route.ts uses requireOwnedCompany (blocks team members) ──
describe('Bug 6 — [companyId] route uses requireOwnedCompany', () => {
  it('[companyId]/route.ts should NOT contain requireOwnedCompany', () => {
    const src = readFileSync(
      resolve(ROOT, 'src/app/api/forecast/result/[companyId]/route.ts'),
      'utf-8'
    )
    // On unfixed code this FAILS because requireOwnedCompany IS present
    expect(src).not.toContain('requireOwnedCompany')
  })
})

// ── Bug 7: .gitignore lacks explicit standalone .env.local entry ───────────
describe('Bug 7 — .gitignore missing explicit .env.local line', () => {
  it('.gitignore should contain a line that is exactly ".env.local"', () => {
    const content = readFileSync(resolve(ROOT, '.gitignore'), 'utf-8')
    const lines = content.split('\n').map((l) => l.trim())
    // On unfixed code this FAILS because no standalone ".env.local" line exists
    expect(lines).toContain('.env.local')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Deploy Audit — Preservation Property Tests
//
// These tests MUST PASS on unfixed code.
// They confirm baseline behaviour that fixes must not regress.
//
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9,
//            3.10, 3.11, 3.12, 3.13
// ═══════════════════════════════════════════════════════════════════════════

// ── Preservation 1: RESEND_FROM_EMAIL takes precedence via ?? operator ─────
describe('Preservation 1 — RESEND_FROM_EMAIL ?? operator in send.ts', () => {
  it('send.ts uses ?? so a set RESEND_FROM_EMAIL value takes precedence over the fallback', () => {
    const src = readFileSync(resolve(ROOT, 'src/lib/email/send.ts'), 'utf-8')
    // The ?? operator must be present so env value wins when set
    expect(src).toContain('process.env.RESEND_FROM_EMAIL ??')
  })
})

// ── Preservation 2: .env.example exists and is committable ────────────────
describe('Preservation 2 — .env.example is committable', () => {
  it('.env.example file exists on disk', () => {
    expect(existsSync(resolve(ROOT, '.env.example'))).toBe(true)
  })

  it('.env.example is NOT ignored by git (negation rule !.env.example is present)', () => {
    const gitignore = readFileSync(resolve(ROOT, '.gitignore'), 'utf-8')
    expect(gitignore).toContain('!.env.example')
  })
})

// ── Preservation 3: canonical send.ts exists (not the " 2." duplicate) ────
describe('Preservation 3 — canonical send.ts exists', () => {
  it('src/lib/email/send.ts exists', () => {
    expect(existsSync(resolve(ROOT, 'src/lib/email/send.ts'))).toBe(true)
  })
})

// ── Preservation 4: canonical [companyId]/route.ts exists ─────────────────
describe('Preservation 4 — canonical [companyId]/route.ts exists', () => {
  it('src/app/api/forecast/result/[companyId]/route.ts exists', () => {
    expect(
      existsSync(resolve(ROOT, 'src/app/api/forecast/result/[companyId]/route.ts'))
    ).toBe(true)
  })
})

// ── Preservation 5: requireAccessibleCompany is exported from auth.ts ─────
describe('Preservation 5 — requireAccessibleCompany exported from auth.ts', () => {
  it('src/lib/server/auth.ts exports requireAccessibleCompany as an async function', () => {
    const src = readFileSync(resolve(ROOT, 'src/lib/server/auth.ts'), 'utf-8')
    expect(src).toContain('export async function requireAccessibleCompany')
  })
})
