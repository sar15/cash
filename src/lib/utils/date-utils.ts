/**
 * Date utilities for Indian Financial Year
 * FY runs April (month 4) to March (month 3)
 */

/**
 * Get the FY label for a date, e.g., "FY 2025-26"
 */
export function getFYLabel(date: Date): string {
  const month = date.getMonth() + 1 // 1-indexed
  const year = date.getFullYear()
  const fyStart = month >= 4 ? year : year - 1
  const fyEnd = fyStart + 1
  return `FY ${fyStart}-${String(fyEnd).slice(2)}`
}

/**
 * Get FY start date for a given date
 */
export function getFYStart(date: Date): Date {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const fyStartYear = month >= 4 ? year : year - 1
  return new Date(fyStartYear, 3, 1) // April 1st (month index 3)
}

/**
 * Get FY end date for a given date
 */
export function getFYEnd(date: Date): Date {
  const start = getFYStart(date)
  return new Date(start.getFullYear() + 1, 2, 31) // March 31st
}

/**
 * Generate period strings for N months from a start date
 * Returns array of 'YYYY-MM-01' strings (first day of month)
 */
export function generatePeriods(startDate: Date, months: number): string[] {
  const periods: string[] = []
  const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  for (let i = 0; i < months; i++) {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    periods.push(`${year}-${month}-01`)
    d.setMonth(d.getMonth() + 1)
  }
  return periods
}

/**
 * Get short month label: "Apr '24", "Mar '25"
 */
export function getMonthLabel(periodStr: string): string {
  const date = new Date(periodStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const yearShort = String(date.getFullYear()).slice(2)
  return `${months[date.getMonth()]} '${yearShort}`
}

/**
 * Format period string for display: '2024-04-01' → 'April 2024'
 */
export function formatPeriod(periodStr: string): string {
  const date = new Date(periodStr)
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

/**
 * Check if a period belongs to the Indian FY that starts in a given year
 * e.g., FY 2024 = April 2024 to March 2025
 */
export function isPeriodInFY(periodStr: string, fyStartYear: number): boolean {
  const date = new Date(periodStr)
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  if (year === fyStartYear && month >= 4) return true
  if (year === fyStartYear + 1 && month <= 3) return true
  return false
}
