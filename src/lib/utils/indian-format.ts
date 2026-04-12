/**
 * Indian Number Formatting Utilities
 *
 * CRITICAL RULE: This is the ONLY place where paise → rupees conversion happens.
 * All engine/DB values are integer paise. We divide by 100 ONLY here for display.
 */

const PAISE_PER_RUPEE = 100
const PAISE_PER_LAKH = 10_000_000 // 1,00,000 × 100
const PAISE_PER_CRORE = 10_000_000_000 // 1,00,00,000 × 100 — FIX audit1: clearer grouping

/**
 * Format paise to Indian rupee string with commas.
 * e.g. 123456789 paise → "₹12,34,567.89"
 */
export function formatRupees(paise: number, showDecimals = true): string {
  const rupees = paise / PAISE_PER_RUPEE
  const isNegative = rupees < 0
  const abs = Math.abs(rupees)

  const [intPart, decPart] = abs.toFixed(2).split('.')
  const formatted = applyIndianGrouping(intPart)

  let result = `₹${formatted}`
  if (showDecimals && decPart !== '00') {
    result += `.${decPart}`
  }

  return isNegative ? `(${result})` : result
}

/**
 * Format paise to Lakhs.
 * e.g. 1234567800 paise → "₹1.23L"
 */
export function formatLakhs(paise: number, decimals = 2): string {
  const lakhs = paise / PAISE_PER_LAKH
  const isNegative = lakhs < 0
  const formatted = `₹${Math.abs(lakhs).toFixed(decimals)}L`
  return isNegative ? `(${formatted})` : formatted
}

/**
 * Format paise to Crores.
 * e.g. 12345678900 paise → "₹1.23Cr"
 */
export function formatCrores(paise: number, decimals = 2): string {
  const crores = paise / PAISE_PER_CRORE
  const isNegative = crores < 0
  const formatted = `₹${Math.abs(crores).toFixed(decimals)}Cr`
  return isNegative ? `(${formatted})` : formatted
}

/**
 * Smart format: auto-selects between full, lakhs, or crores.
 */
export function formatAuto(paise: number): string {
  const abs = Math.abs(paise)
  if (abs >= PAISE_PER_CRORE) return formatCrores(paise)
  if (abs >= PAISE_PER_LAKH) return formatLakhs(paise)
  return formatRupees(paise)
}

/**
 * Apply Indian comma grouping to integer string.
 * "1234567" → "12,34,567"
 */
function applyIndianGrouping(num: string): string {
  if (num.length <= 3) return num

  const last3 = num.slice(-3)
  const remaining = num.slice(0, -3)

  // Group remaining digits in pairs from right
  const pairs: string[] = []
  for (let i = remaining.length; i > 0; i -= 2) {
    const start = Math.max(0, i - 2)
    pairs.unshift(remaining.slice(start, i))
  }

  return `${pairs.join(',')},${last3}`
}

/**
 * Parse an Indian-formatted string back to paise (integer).
 * FIX audit1: Previously named parseToRupees which was misleading — it returns PAISE.
 * "₹12,34,567" → 123456700
 * "12.34 Lakhs" → 123400000
 * "1.23 Cr" → 12300000000
 */
export function parseToPaise(input: string): number {
  const cleaned = input.replace(/[₹,\s]/g, '').trim()

  if (/cr(ores?)?$/i.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/cr(ores?)?$/i, ''))
    return Math.round(num * PAISE_PER_CRORE)
  }

  if (/l(akhs?)?$/i.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/l(akhs?)?$/i, ''))
    return Math.round(num * PAISE_PER_LAKH)
  }

  const num = parseFloat(cleaned)
  return Math.round(num * PAISE_PER_RUPEE)
}

/**
 * Format date as DD/MM/YYYY (Indian standard)
 */
export function formatDateIndian(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** @deprecated Use parseToPaise instead. This alias exists for backwards compatibility. */
export const parseToRupees = parseToPaise
