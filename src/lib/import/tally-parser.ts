/**
 * Tally XML Parser
 *
 * Parses Tally ERP 9 / Tally Prime XML exports into the same ParsedSheet
 * format used by the Excel parser, so the rest of the import pipeline
 * (structure-detector, account-mapper, save route) works unchanged.
 *
 * Supported Tally export formats:
 *   - TALLYMESSAGE / ENVELOPE exports (Tally Prime default)
 *   - LEDGER-based exports with monthly closing balances
 *   - Trial Balance XML exports
 *
 * Usage:
 *   const sheets = await parseTallyXml(buffer)
 *   // returns ParsedSheet[] identical to parseExcelBuffer output
 */

import { XMLParser } from 'fast-xml-parser'
import type { ParsedSheet } from './excel-parser'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TallyLedger {
  name: string
  parent: string
  closingBalance: number // in rupees (will be converted to paise)
  period: string // YYYY-MM-01
}

interface TallyEnvelope {
  ENVELOPE?: {
    BODY?: {
      IMPORTDATA?: {
        REQUESTDATA?: {
          TALLYMESSAGE?: TallyMessage | TallyMessage[]
        }
      }
      DATA?: {
        TALLYMESSAGE?: TallyMessage | TallyMessage[]
      }
    }
    HEADER?: unknown
  }
}

interface TallyMessage {
  LEDGER?: TallyLedgerRaw | TallyLedgerRaw[]
  VOUCHER?: unknown
}

interface TallyLedgerRaw {
  '@_NAME'?: string
  NAME?: string
  PARENT?: string
  CLOSINGBALANCE?: string | number
  OPENINGBALANCE?: string | number
  LEDGERCLOSINGBALANCE?: string | number
  // Monthly breakdown (Tally Prime format)
  LEDGERMONTHLYSUMMARY?: {
    LEDGERMONTHLYENTRY?: TallyMonthlyEntry | TallyMonthlyEntry[]
  }
}

interface TallyMonthlyEntry {
  MONTHSTARTDATE?: string // YYYYMMDD
  CLOSINGBALANCE?: string | number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse Tally balance strings like "1234.56 Dr" or "9876.00 Cr"
 * Returns paise as integer. Cr = positive (liability/income), Dr = negative (asset/expense)
 * We return the absolute value — the COA mapper handles sign conventions.
 */
function parseTallyBalance(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0
  const str = String(raw).trim()
  if (!str || str === '0') return 0

  // Remove Dr/Cr suffix and parse
  const cleaned = str.replace(/\s*(Dr|Cr)\s*$/i, '').replace(/,/g, '').trim()
  const value = parseFloat(cleaned)
  if (isNaN(value)) return 0

  // Convert rupees to paise
  return Math.round(Math.abs(value) * 100)
}

/**
 * Parse Tally date format YYYYMMDD → YYYY-MM-01
 */
function parseTallyDate(raw: string | undefined): string | null {
  if (!raw) return null
  const str = String(raw).trim()
  if (str.length !== 8) return null
  const year = str.slice(0, 4)
  const month = str.slice(4, 6)
  return `${year}-${month}-01`
}

/**
 * Normalize a ledger name from Tally (trim, collapse whitespace)
 */
function normalizeName(raw: string | undefined): string {
  if (!raw) return ''
  return String(raw).trim().replace(/\s+/g, ' ')
}

/**
 * Ensure value is always an array (Tally XML can return single object or array)
 */
function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

// ─── Core Parser ──────────────────────────────────────────────────────────────

function extractLedgersFromMessage(message: TallyMessage): TallyLedger[] {
  const ledgers: TallyLedger[] = []
  const rawLedgers = toArray(message.LEDGER)

  for (const raw of rawLedgers) {
    const name = normalizeName(raw['@_NAME'] ?? raw.NAME)
    if (!name) continue

    const parent = normalizeName(raw.PARENT)

    // Check for monthly breakdown first (Tally Prime)
    const monthlyEntries = toArray(
      raw.LEDGERMONTHLYSUMMARY?.LEDGERMONTHLYENTRY
    )

    if (monthlyEntries.length > 0) {
      for (const entry of monthlyEntries) {
        const period = parseTallyDate(entry.MONTHSTARTDATE)
        if (!period) continue
        const closingBalance = parseTallyBalance(entry.CLOSINGBALANCE)
        ledgers.push({ name, parent, closingBalance, period })
      }
    } else {
      // Single closing balance — we don't know the period, skip
      // (these are summary exports without monthly breakdown)
    }
  }

  return ledgers
}

function buildSheetFromLedgers(ledgers: TallyLedger[]): ParsedSheet | null {
  if (ledgers.length === 0) return null

  // Collect all unique periods, sorted
  const periods = [...new Set(ledgers.map((l) => l.period))].sort()
  if (periods.length === 0) return null

  // Collect all unique account names
  const accountNames = [...new Set(ledgers.map((l) => l.name))]

  // Build a map: accountName → period → amount (paise)
  const dataMap = new Map<string, Map<string, number>>()
  for (const ledger of ledgers) {
    if (!dataMap.has(ledger.name)) {
      dataMap.set(ledger.name, new Map())
    }
    dataMap.get(ledger.name)!.set(ledger.period, ledger.closingBalance)
  }

  // Header row: ["Particulars", "Apr-24", "May-24", ...]
  const header: unknown[] = [
    'Particulars',
    ...periods.map((p) => {
      const [year, month] = p.split('-').map(Number)
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      return `${monthNames[month - 1]}-${String(year).slice(-2)}`
    }),
  ]

  // Data rows: [accountName, amount1, amount2, ...]
  // Amounts are in paise — divide by 100 to get rupees for the import pipeline
  // (the pipeline calls toPaise() which multiplies by 100 again)
  const dataRows: unknown[][] = accountNames.map((name) => {
    const periodMap = dataMap.get(name)!
    return [
      name,
      ...periods.map((p) => {
        const paise = periodMap.get(p) ?? 0
        // Return as rupees (float) — structure-detector and toPaise() handle conversion
        return paise / 100
      }),
    ]
  })

  return {
    sheetName: 'Tally Import',
    data: [header, ...dataRows],
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect if a buffer is a Tally XML export.
 * Checks for the ENVELOPE or TALLYMESSAGE root element.
 */
export function isTallyXml(buffer: ArrayBuffer): boolean {
  try {
    const text = new TextDecoder().decode(buffer.slice(0, 512))
    return /<ENVELOPE|<TALLYMESSAGE|<LEDGER/i.test(text)
  } catch {
    return false
  }
}

/**
 * Parse a Tally XML export buffer into ParsedSheet[].
 * Returns the same format as parseExcelBuffer so the rest of the pipeline is unchanged.
 */
export async function parseTallyXml(buffer: ArrayBuffer): Promise<ParsedSheet[]> {
  const MAX_SIZE = 20 * 1024 * 1024 // 20MB — Tally exports can be larger than Excel
  if (buffer.byteLength > MAX_SIZE) {
    throw new Error(
      `Tally file too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB). Maximum size is 20MB.`
    )
  }

  const text = new TextDecoder().decode(buffer)

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
    // Tally XML can have duplicate tags — always parse as arrays for these
    isArray: (tagName) =>
      ['TALLYMESSAGE', 'LEDGER', 'LEDGERMONTHLYENTRY'].includes(tagName),
  })

  let parsed: TallyEnvelope
  try {
    parsed = parser.parse(text) as TallyEnvelope
  } catch (err) {
    throw new Error(`Failed to parse Tally XML: ${err instanceof Error ? err.message : String(err)}`)
  }

  const envelope = parsed?.ENVELOPE
  if (!envelope) {
    throw new Error('Invalid Tally XML: missing ENVELOPE root element.')
  }

  // Try both common Tally export structures
  const messages: TallyMessage[] = [
    ...toArray(envelope.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE),
    ...toArray(envelope.BODY?.DATA?.TALLYMESSAGE),
  ]

  if (messages.length === 0) {
    throw new Error(
      'No TALLYMESSAGE found in XML. Please export using "Detailed Trial Balance" or "Ledger" format from Tally.'
    )
  }

  const allLedgers: TallyLedger[] = []
  for (const message of messages) {
    allLedgers.push(...extractLedgersFromMessage(message))
  }

  if (allLedgers.length === 0) {
    throw new Error(
      'No ledger data with monthly breakdown found. In Tally, export using: ' +
      'Gateway of Tally → Display → Account Books → Ledger → with "Monthly Summary" enabled.'
    )
  }

  const sheet = buildSheetFromLedgers(allLedgers)
  if (!sheet) return []

  return [sheet]
}
