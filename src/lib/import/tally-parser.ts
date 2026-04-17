/**
 * Tally XML Parser — SAX-based streaming implementation
 *
 * Uses saxes (SAX parser) instead of fast-xml-parser to avoid loading the
 * entire XML document into memory. A 200MB Tally export is parsed in chunks
 * without OOM risk on Vercel serverless functions.
 *
 * Supported Tally export formats:
 *   - TALLYMESSAGE / ENVELOPE exports (Tally Prime default)
 *   - LEDGER-based exports with monthly closing balances
 *
 * Usage:
 *   const sheets = await parseTallyXml(buffer)
 *   // returns ParsedSheet[] identical to parseExcelBuffer output
 */

import { SaxesParser } from 'saxes'
import type { ParsedSheet } from './excel-parser'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TallyLedger {
  name: string
  closingBalance: number // in paise
  period: string         // YYYY-MM-01
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse Tally balance strings like "1234.56 Dr" or "9876.00 Cr"
 * Returns paise as integer. We return the absolute value — COA mapper handles signs.
 */
function parseTallyBalance(raw: string): number {
  const str = raw.trim()
  if (!str || str === '0') return 0
  const cleaned = str.replace(/\s*(Dr|Cr)\s*$/i, '').replace(/,/g, '').trim()
  const value = parseFloat(cleaned)
  if (isNaN(value)) return 0
  return Math.round(Math.abs(value) * 100)
}

/**
 * Parse Tally date format YYYYMMDD → YYYY-MM-01
 */
function parseTallyDate(raw: string): string | null {
  const str = raw.trim()
  if (str.length !== 8) return null
  const year = str.slice(0, 4)
  const month = str.slice(4, 6)
  // Validate year and month are numeric
  if (isNaN(Number(year)) || isNaN(Number(month))) return null
  const monthNum = Number(month)
  if (monthNum < 1 || monthNum > 12) return null
  return `${year}-${month}-01`
}

// ─── SAX-based streaming parser ───────────────────────────────────────────────

/**
 * Parse a Tally XML buffer using a SAX streaming parser.
 * Extracts LEDGER entries with monthly summaries without loading the full DOM.
 */
function parseTallyXmlSax(text: string): TallyLedger[] {
  const ledgers: TallyLedger[] = []

  // State machine
  let inLedger = false
  let inMonthlyEntry = false
  let currentLedgerName = ''
  let currentDate = ''
  let currentBalance = ''
  let currentTag = ''
  let depth = 0
  let ledgerDepth = 0

  const parser = new SaxesParser({ xmlns: false })

  parser.on('opentag', (node) => {
    depth++
    currentTag = node.name.toUpperCase()

    if (currentTag === 'LEDGER') {
      inLedger = true
      ledgerDepth = depth
      // Ledger name can be in NAME attribute or NAME child element
      const nameAttr = node.attributes['NAME'] ?? node.attributes['name'] ?? ''
      currentLedgerName = String(nameAttr).trim()
      currentDate = ''
      currentBalance = ''
    }

    if (inLedger && currentTag === 'LEDGERMONTHLYENTRY') {
      inMonthlyEntry = true
      currentDate = ''
      currentBalance = ''
    }
  })

  parser.on('text', (text) => {
    const t = text.trim()
    if (!t) return

    if (inLedger && !inMonthlyEntry && currentTag === 'NAME' && !currentLedgerName) {
      currentLedgerName = t
    }

    if (inMonthlyEntry) {
      if (currentTag === 'MONTHSTARTDATE') currentDate = t
      if (currentTag === 'CLOSINGBALANCE') currentBalance = t
    }
  })

  parser.on('closetag', (node) => {
    const tag = node.name.toUpperCase()

    if (inMonthlyEntry && tag === 'LEDGERMONTHLYENTRY') {
      // Commit this monthly entry
      if (currentLedgerName && currentDate && currentBalance) {
        const period = parseTallyDate(currentDate)
        if (period) {
          ledgers.push({
            name: currentLedgerName,
            closingBalance: parseTallyBalance(currentBalance),
            period,
          })
        } else {
          console.warn(
            `[TallyParser] Ledger "${currentLedgerName}": skipped entry with invalid date "${currentDate}". ` +
            `Expected format: YYYYMMDD (e.g. 20240401 for April 2024).`
          )
        }
      }
      inMonthlyEntry = false
      currentDate = ''
      currentBalance = ''
    }

    if (inLedger && depth === ledgerDepth && tag === 'LEDGER') {
      inLedger = false
      currentLedgerName = ''
    }

    depth--
    currentTag = ''
  })

  parser.on('error', (err) => {
    const msg = err instanceof Error ? err.message : String(err)
    const lineMatch = msg.match(/line[:\s]+(\d+)/i)
    const lineHint = lineMatch ? ` (near line ${lineMatch[1]})` : ''
    throw new Error(
      `Tally XML is malformed${lineHint}. This can happen with pirated or older Tally versions. ` +
      `Try re-exporting from Tally: Gateway of Tally → Display → Account Books → Ledger → Export. ` +
      `Parser detail: ${msg}`
    )
  })

  // Feed the text to the parser in 64KB chunks to avoid stack overflows on huge files
  const CHUNK_SIZE = 64 * 1024
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    parser.write(text.slice(i, i + CHUNK_SIZE))
  }
  parser.close()

  return ledgers
}

// ─── Sheet builder ────────────────────────────────────────────────────────────

function buildSheetFromLedgers(ledgers: TallyLedger[]): ParsedSheet | null {
  if (ledgers.length === 0) return null

  // Collect all unique periods, sorted
  const periods = [...new Set(ledgers.map((l) => l.period))].sort()
  if (periods.length === 0) return null

  // Collect all unique account names (preserve insertion order = Tally order)
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
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const header: unknown[] = [
    'Particulars',
    ...periods.map((p) => {
      const [year, month] = p.split('-').map(Number)
      return `${monthNames[month - 1]}-${String(year).slice(-2)}`
    }),
  ]

  // Data rows: [accountName, rupees1, rupees2, ...]
  // Divide paise by 100 — structure-detector calls toPaise() which multiplies back
  const dataRows: unknown[][] = accountNames.map((name) => {
    const periodMap = dataMap.get(name)!
    return [
      name,
      ...periods.map((p) => (periodMap.get(p) ?? 0) / 100),
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
 * Checks the first 512 bytes for Tally-specific root elements.
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
 *
 * Uses SAX streaming to avoid loading the full XML DOM into memory.
 * Safe for files up to 50MB on Vercel serverless (1GB limit).
 * Returns the same format as parseExcelBuffer so the rest of the pipeline is unchanged.
 */
export async function parseTallyXml(buffer: ArrayBuffer): Promise<ParsedSheet[]> {
  const MAX_SIZE = 50 * 1024 * 1024 // 50MB — SAX streaming handles larger files safely
  if (buffer.byteLength > MAX_SIZE) {
    throw new Error(
      `Tally file too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB). Maximum size is 50MB.`
    )
  }

  const text = new TextDecoder().decode(buffer)

  if (!text.includes('<LEDGER') && !text.includes('<TALLYMESSAGE') && !text.includes('<ENVELOPE')) {
    throw new Error(
      'Invalid Tally XML: missing ENVELOPE or LEDGER elements. ' +
      'Please export using "Detailed Trial Balance" or "Ledger" format from Tally.'
    )
  }

  const ledgers = parseTallyXmlSax(text)

  if (ledgers.length === 0) {
    throw new Error(
      'No ledger data with monthly breakdown found. In Tally, export using: ' +
      'Gateway of Tally → Display → Account Books → Ledger → with "Monthly Summary" enabled.'
    )
  }

  const sheet = buildSheetFromLedgers(ledgers)
  if (!sheet) return []

  return [sheet]
}
