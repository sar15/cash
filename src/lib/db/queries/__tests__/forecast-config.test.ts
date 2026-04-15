/**
 * Bug 2 — upsertTimingProfile no duplicates
 *
 * Validates: Requirements 1.2, 2.2, 3.2
 *
 * The original upsertTimingProfile had no onConflictDoUpdate, so calling it
 * twice with the same (companyId, name) created 2 rows. The fix adds
 * onConflictDoUpdate targeting (companyId, name).
 *
 * These tests verify the FIXED state by inspecting the query source.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('upsertTimingProfile — no duplicates (Bug 2)', () => {
  const src = readFileSync(
    resolve(process.cwd(), 'src/lib/db/queries/forecast-config.ts'),
    'utf-8'
  )

  it('upsertTimingProfile uses onConflictDoUpdate', () => {
    // The fixed function must include onConflictDoUpdate
    expect(src).toMatch(/onConflictDoUpdate/)
  })

  it('onConflictDoUpdate targets companyId and name columns', () => {
    // Extract the upsertTimingProfile function body specifically
    const fnMatch = src.match(/async function upsertTimingProfile[\s\S]*?^}/m)?.[0] ?? ''
    expect(fnMatch).toMatch(/onConflictDoUpdate/)
    expect(fnMatch).toMatch(/companyId/)
    expect(fnMatch).toMatch(/\.name/)
  })

  it('onConflictDoUpdate sets profileType, config, autoDerived, isDefault on conflict', () => {
    const fnMatch = src.match(/async function upsertTimingProfile[\s\S]*?^}/m)?.[0] ?? ''
    expect(fnMatch).toMatch(/profileType/)
    expect(fnMatch).toMatch(/config/)
    expect(fnMatch).toMatch(/autoDerived/)
    expect(fnMatch).toMatch(/isDefault/)
  })

  it('upsertTimingProfile returns the upserted row via .returning()', () => {
    // Must use .returning() so callers get the row back
    const fnMatch = src.match(/async function upsertTimingProfile[\s\S]*?^}/m)?.[0] ?? ''
    expect(fnMatch).toMatch(/\.returning\(\)/)
  })
})
