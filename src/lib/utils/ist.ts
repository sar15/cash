/**
 * IST (Indian Standard Time) Utilities
 *
 * Vercel serverless functions run in UTC. India is UTC+5:30 with NO daylight saving.
 * All financial period boundaries, compliance due dates, and "today" checks
 * MUST use IST to avoid midnight-boundary errors.
 *
 * Rule: Never use `new Date()` directly for financial period logic.
 *       Use `nowIST()` or `toISTDateString()` instead.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000 // UTC+5:30 in milliseconds

/**
 * Returns the current Date object adjusted to IST.
 * Use this instead of `new Date()` for any financial period or deadline logic.
 */
export function nowIST(): Date {
  const utcMs = Date.now()
  return new Date(utcMs + IST_OFFSET_MS)
}

/**
 * Returns today's date as a YYYY-MM-DD string in IST.
 * Use for comparing against due dates stored as YYYY-MM-DD.
 */
export function todayISTString(): string {
  const ist = nowIST()
  const y = ist.getUTCFullYear()
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0')
  const d = String(ist.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns the current month's period key in IST: YYYY-MM-01
 * Use for determining which financial month "now" belongs to.
 */
export function currentPeriodIST(): string {
  const ist = nowIST()
  const y = ist.getUTCFullYear()
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

/**
 * Converts a YYYY-MM-01 period string to a Date at midnight IST.
 * Avoids UTC midnight shifting the date to the previous day.
 */
export function periodToISTDate(period: string): Date {
  const [year, month] = period.split('-').map(Number)
  // Construct as UTC midnight, then shift to IST midnight
  return new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS)
}

/**
 * Formats a Date for display in IST locale (DD/MM/YYYY).
 */
export function formatISTDate(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS)
  const d = String(ist.getUTCDate()).padStart(2, '0')
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0')
  const y = ist.getUTCFullYear()
  return `${d}/${m}/${y}`
}

/**
 * Returns an ISO string with IST offset (+05:30) for audit logs and timestamps.
 * Stored as UTC in DB but displayed correctly in India.
 */
export function nowISTISOString(): string {
  return new Date().toISOString() // Store UTC in DB — always correct
}
