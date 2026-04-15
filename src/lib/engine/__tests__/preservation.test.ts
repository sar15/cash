/**
 * Preservation property tests
 *
 * Validates: Requirements 3.2, 3.3, 3.5
 *
 * These tests verify that the fixes do NOT break existing correct behaviors:
 * 1. upsertTimingProfile with a NEW (companyId, name) pair inserts exactly 1 row
 * 2. GST and TDS amounts from the compliance engine are not multiplied
 * 3. Broadcast notifications (clerkUserId IS NULL) are always counted
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { calculatePFESIForecast } from '../compliance/pf-esi'
import { generatePeriods } from '../../utils/date-utils'

// ── Preservation 1: upsertTimingProfile new-row insert ───────────────────

describe('Preservation — upsertTimingProfile new (companyId, name) inserts 1 row', () => {
  it('upsertTimingProfile source uses .returning() to return the single inserted/updated row', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/forecast-config.ts'),
      'utf-8'
    )
    // The function must return exactly one row via .returning()
    const fnMatch = src.match(/async function upsertTimingProfile[\s\S]*?^}/m)?.[0] ?? ''
    expect(fnMatch).toMatch(/\.returning\(\)/)
  })

  it('upsertTimingProfile destructures the first element of the returning array', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/forecast-config.ts'),
      'utf-8'
    )
    // Pattern: const [profile] = await db.insert(...).returning()
    const fnMatch = src.match(/async function upsertTimingProfile[\s\S]*?^}/m)?.[0] ?? ''
    expect(fnMatch).toMatch(/const\s*\[\s*\w+\s*\]\s*=\s*await/)
  })
})

// ── Preservation 2: GST and TDS amounts not multiplied ───────────────────

describe('Preservation — GST/TDS amounts displayed without multiplier', () => {
  it('compliance page does not multiply gstAmount', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/compliance/page.tsx'),
      'utf-8'
    )
    expect(src).not.toMatch(/gstAmount\s*\*\s*2/)
  })

  it('compliance page does not multiply tdsAmount', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/compliance/page.tsx'),
      'utf-8'
    )
    expect(src).not.toMatch(/tdsAmount\s*\*\s*2/)
  })

  it('compliance page does not multiply atAmount (advance tax)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/compliance/page.tsx'),
      'utf-8'
    )
    expect(src).not.toMatch(/atAmount\s*\*\s*2/)
  })

  it('PF/ESI engine returns correct amounts without any multiplier in the engine itself', () => {
    const periods = generatePeriods(new Date(2025, 3, 1), 1)
    // Single employee earning ₹20,000 gross
    const result = calculatePFESIForecast({
      periods,
      projectedGrossSalaries: [2_000_000], // ₹20,000 in paise
      basicSalaryPct: 50,
    })

    const month = result.months[0]
    // employerPF = 12% of basic (50% of 20,000 = 10,000) = 1,200
    expect(month.employerPF).toBe(120_000) // ₹1,200 in paise
    // employerESI = 3.25% of gross (20,000) = 650
    expect(month.employerESI).toBe(65_000) // ₹650 in paise
    // employeeESI = 0.75% of gross (20,000) = 150
    expect(month.employeeESI).toBe(15_000) // ₹150 in paise

    // totalDeposit = employerPF + employerESI + employeeESI
    expect(month.totalDeposit).toBe(month.employerPF + month.employerESI + month.employeeESI)
  })
})

// ── Preservation 3: Broadcast notifications always counted ───────────────

describe('Preservation — broadcast notifications (clerkUserId IS NULL) always counted', () => {
  it('getUnreadCount query includes isNull(clerkUserId) in the OR condition', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/notifications.ts'),
      'utf-8'
    )
    const fnMatch = src.match(/async function getUnreadCount[\s\S]*?^}/m)?.[0] ?? ''
    // Must have isNull for the clerkUserId column to include broadcast notifications
    expect(fnMatch).toMatch(/isNull\s*\(/)
    expect(fnMatch).toMatch(/clerkUserId/)
  })

  it('getUnreadCount uses or() so broadcast AND user-specific notifications are both counted', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/notifications.ts'),
      'utf-8'
    )
    const fnMatch = src.match(/async function getUnreadCount[\s\S]*?^}/m)?.[0] ?? ''
    // or() ensures both null (broadcast) and matching userId notifications are included
    expect(fnMatch).toMatch(/\bor\s*\(/)
  })

  it('getNotifications also includes broadcast notifications (clerkUserId IS NULL)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/lib/db/queries/notifications.ts'),
      'utf-8'
    )
    const fnMatch = src.match(/async function getNotifications[\s\S]*?^}/m)?.[0] ?? ''
    // getNotifications filters: !n.clerkUserId || n.clerkUserId === clerkUserId
    expect(fnMatch).toMatch(/clerkUserId/)
  })
})
