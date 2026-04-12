/**
 * Safe Paise Arithmetic Helpers
 *
 * ALL financial math MUST use these. No floating point.
 * Amounts are always integers representing paise.
 */

/** Sum of paise amounts */
export function sumPaise(...amounts: number[]): number {
  return amounts.reduce((total, a) => total + Math.round(a), 0)
}

/** Multiply paise by a percentage (e.g., 18% = 18.0) → result in paise */
export function multiplyByPct(paise: number, pct: number): number {
  return Math.round(paise * pct / 100)
}

/**
 * Safe percentage calculation: (part / total) * 100.
 * ⚠️ DISPLAY ONLY — returns a FLOAT, NOT an integer paise value.
 * NEVER use this result in engine calculations. For engine math, use multiplyByPct instead.
 */
export function calculatePct(partPaise: number, totalPaise: number): number {
  if (totalPaise === 0) return 0
  return (partPaise / totalPaise) * 100
}

/** Apply growth rate: paise * (1 + growthPct/100) */
export function applyGrowth(paise: number, growthPct: number): number {
  return Math.round(paise * (1 + growthPct / 100))
}

/** Rolling average of paise amounts */
export function rollingAverage(amounts: number[], windowSize: number): number {
  if (amounts.length === 0) return 0
  const window = amounts.slice(-windowSize)
  const sum = window.reduce((a, b) => a + b, 0)
  return Math.round(sum / window.length)
}

/** Check three-way balance tolerance (±1 paise) */
export function isBalanced(a: number, b: number, tolerance = 1): boolean {
  return Math.abs(a - b) <= tolerance
}
