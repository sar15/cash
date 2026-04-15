/**
 * Bug 1 — SubmitBtn onClick forwarding
 *
 * Validates: Requirements 1.1, 2.1
 *
 * The SubmitBtn component previously did not declare `onClick` in its props
 * interface, so the handler was silently dropped. The fix adds `onClick?` to
 * the props and forwards it to the underlying <button>.
 *
 * These tests verify the FIXED state: onClick IS forwarded.
 */
import { describe, expect, it } from 'vitest'

// ── Structural / type-level test ──────────────────────────────────────────
// We verify the SubmitBtn component accepts and forwards onClick by inspecting
// the source. Since @testing-library/react is not in package.json we test the
// component's prop interface and logic directly.

// Extract the SubmitBtn props type from the module source to confirm onClick
// is part of the interface.
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('SubmitBtn — onClick prop forwarding (Bug 1)', () => {
  it('SubmitBtn component source declares onClick in its props interface', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/forecast/MicroForecastWizard.tsx'),
      'utf-8'
    )

    // The fixed component should have onClick in the SubmitBtn props destructure
    // Pattern: function SubmitBtn({ ..., onClick ... })
    expect(src).toMatch(/function SubmitBtn\s*\(\s*\{[^}]*onClick/)
  })

  it('SubmitBtn forwards onClick to the underlying <button> element', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/forecast/MicroForecastWizard.tsx'),
      'utf-8'
    )

    // The <button> element inside SubmitBtn should have onClick={onClick}
    // We look for the pattern within the SubmitBtn function body
    const submitBtnMatch = src.match(/function SubmitBtn[\s\S]*?^}/m)
    expect(submitBtnMatch).not.toBeNull()

    const submitBtnBody = submitBtnMatch![0]
    expect(submitBtnBody).toMatch(/onClick=\{onClick\}/)
  })

  it('SubmitBtn does not have // @ts-ignore comments (Bug 1 cleanup)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/forecast/MicroForecastWizard.tsx'),
      'utf-8'
    )
    // All @ts-ignore comments should have been removed as part of the fix
    expect(src).not.toMatch(/@ts-ignore/)
  })

  it('onClick prop type is optional (does not break callers that omit it)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/forecast/MicroForecastWizard.tsx'),
      'utf-8'
    )
    // onClick should be declared as optional: onClick?: () => void
    expect(src).toMatch(/onClick\?\s*:\s*\(\s*\)\s*=>\s*void/)
  })
})
