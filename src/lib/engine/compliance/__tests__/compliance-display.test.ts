/**
 * Bug 3 — Compliance page does NOT double PF/ESI amounts
 *
 * Validates: Requirements 1.3, 2.3, 3.3
 *
 * The original compliance page applied `* 2` to pfAmount and esiAmount.
 * The fix removes the multiplier so displayed values equal the engine output.
 *
 * These are pure logic tests — no React rendering needed.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { PFESIForecastMonth } from '../pf-esi'

// ── Source-level verification ─────────────────────────────────────────────

describe('Compliance page — PF/ESI not doubled (Bug 3, source check)', () => {
  const src = readFileSync(
    resolve(process.cwd(), 'src/app/(app)/compliance/page.tsx'),
    'utf-8'
  )

  it('compliance page does not multiply pfAmount by 2', () => {
    expect(src).not.toMatch(/pfAmount\s*\*\s*2/)
  })

  it('compliance page does not multiply esiAmount by 2', () => {
    expect(src).not.toMatch(/esiAmount\s*\*\s*2/)
  })

  it('pfAmount is derived directly from pfMonth.employerPF', () => {
    // The fixed code: const pfAmount = pfMonth?.employerPF ?? 0
    expect(src).toMatch(/pfAmount\s*=\s*pfMonth\?\.employerPF/)
  })

  it('esiAmount is the sum of employerESI and employeeESI', () => {
    // The fixed code: const esiAmount = (pfMonth?.employerESI ?? 0) + (pfMonth?.employeeESI ?? 0)
    expect(src).toMatch(/esiAmount\s*=\s*\(pfMonth\?\.employerESI[^)]*\)\s*\+\s*\(pfMonth\?\.employeeESI/)
  })
})

// ── Logic tests — verify correct amount computation ───────────────────────

describe('Compliance display logic — PF/ESI amounts (Bug 3)', () => {
  /**
   * Simulate the compliance page's amount derivation logic (the fixed version).
   * This mirrors the exact lines in compliance/page.tsx.
   */
  function deriveAmounts(pfMonth: PFESIForecastMonth | undefined) {
    const pfAmount = pfMonth?.employerPF ?? 0
    const esiAmount = (pfMonth?.employerESI ?? 0) + (pfMonth?.employeeESI ?? 0)
    return { pfAmount, esiAmount }
  }

  it('pfAmount equals employerPF (not doubled)', () => {
    const pfMonth: PFESIForecastMonth = {
      period: '2025-04-01',
      grossSalary: 2_000_000,
      basicSalary: 1_000_000,
      employerPF: 900_000,
      employerESI: 175_000,
      employeeESI: 150_000,
      employerStatutoryExpense: 1_075_000,
      totalDeposit: 1_225_000,
      dueDate: '2025-05-15',
    }

    const { pfAmount } = deriveAmounts(pfMonth)
    expect(pfAmount).toBe(900_000)
    expect(pfAmount).not.toBe(900_000 * 2)
  })

  it('esiAmount equals employerESI + employeeESI (not doubled)', () => {
    const pfMonth: PFESIForecastMonth = {
      period: '2025-04-01',
      grossSalary: 2_000_000,
      basicSalary: 1_000_000,
      employerPF: 900_000,
      employerESI: 175_000,
      employeeESI: 150_000,
      employerStatutoryExpense: 1_075_000,
      totalDeposit: 1_225_000,
      dueDate: '2025-05-15',
    }

    const { esiAmount } = deriveAmounts(pfMonth)
    expect(esiAmount).toBe(175_000 + 150_000)
    expect(esiAmount).toBe(325_000)
    expect(esiAmount).not.toBe(325_000 * 2)
  })

  it('handles zero pfMonth gracefully (returns 0 for both amounts)', () => {
    const { pfAmount, esiAmount } = deriveAmounts(undefined)
    expect(pfAmount).toBe(0)
    expect(esiAmount).toBe(0)
  })

  it('pfAmount + esiAmount equals totalDeposit when all employees are ESI-eligible', () => {
    const pfMonth: PFESIForecastMonth = {
      period: '2025-04-01',
      grossSalary: 2_000_000,
      basicSalary: 1_000_000,
      employerPF: 900_000,
      employerESI: 175_000,
      employeeESI: 150_000,
      employerStatutoryExpense: 1_075_000,
      totalDeposit: 1_225_000,
      dueDate: '2025-05-15',
    }

    const { pfAmount, esiAmount } = deriveAmounts(pfMonth)
    expect(pfAmount + esiAmount).toBe(pfMonth.totalDeposit)
  })
})
