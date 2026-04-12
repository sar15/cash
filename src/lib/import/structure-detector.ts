/**
 * Structure Detector for Excel/CSV Import
 *
 * FIX audit1 C7: parseIndianNumberString now returns PAISE (×100)
 * FIX audit6 H2: 'Cr' false-positive fixed with word-boundary regex
 */
import type { ParsedSheet } from './excel-parser'

export interface ColumnMap {
  headerRowIndex: number
  accountNameColIndex: number
  dataColIndices: number[] // columns that contain the monthly values
  months: string[]
}

/**
 * Parse Indian formatted number strings into PAISE (integer).
 * E.g., "12,34,567" → 12345670000 (paise), "12.34 Cr" → 123400000000 (paise)
 *
 * FIX audit6 H2: Use word-boundary regex to prevent false-positive on words containing 'cr'
 * FIX audit1 C7: Return paise (×100) not rupees
 */
export function parseIndianNumberString(val: string | number): number | null {
  if (typeof val === 'number') return Math.round(val * 100) // Convert rupees → paise

  if (!val || typeof val !== 'string') return null

  const clean = val.replace(/₹|Rs\.?|INR/gi, '').trim()

  // FIX audit6 H2: Word-boundary regex to prevent false-positive on 'cr' in words like 'accrual'
  let multiplier = 1
  const lower = clean.toLowerCase()
  if (/\bcr(ore)?\b/i.test(lower)) {
    multiplier = 10_000_000
  } else if (/\blakhs?\b|\blacs?\b/i.test(lower)) {
    multiplier = 100_000
  } else if (/\bk\b/i.test(lower)) {
    multiplier = 1_000
  }

  // Remove commas and magnitude words
  const numericString = clean
    .replace(/,/g, '')
    .replace(/\b(crore|cr|lakhs?|lacs?|k)\b/gi, '')
    .trim()
  const num = parseFloat(numericString)

  if (isNaN(num)) return null

  // FIX audit1 C7: Return PAISE (multiply by 100 after applying magnitude)
  return Math.round(num * multiplier * 100)
}

export function detectStructure(sheet: ParsedSheet): ColumnMap {
  let headerRowIndex = -1
  let accountNameColIndex = -1
  let dataColIndices: number[] = []
  let months: string[] = []

  const data = sheet.data

  // Defensive scanning for header row
  for (let r = 0; r < Math.min(data.length, 20); r++) {
    const row = data[r]
    if (!row) continue

    let hasAccountHeader = false
    const potentialDataCols: number[] = []
    const potentialMonths: string[] = []

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c]).toLowerCase()
      if (cell.includes('particulars') || cell.includes('account') || cell.includes('description')) {
        hasAccountHeader = true
        accountNameColIndex = c
      } else if (
        cell.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i) ||
        cell.match(/^[0-9\/]+(-[0-9]+)?$/) // Dates
      ) {
        if (!cell.includes('total')) {
          potentialDataCols.push(c)
          potentialMonths.push(String(row[c]))
        }
      }
    }

    if (hasAccountHeader && potentialDataCols.length > 0) {
      headerRowIndex = r
      dataColIndices = potentialDataCols
      months = potentialMonths
      break
    }
  }

  // Fallback: look for first row with many numbers
  if (headerRowIndex === -1) {
    for (let r = 0; r < data.length; r++) {
      const row = data[r]
      let numCount = 0
      let firstTextCol = -1
      const curDataCols: number[] = []

      for (let c = 0; c < row.length; c++) {
        const cell = row[c]
        if (typeof cell === 'string' && isNaN(Number(cell)) && firstTextCol === -1) {
          firstTextCol = c
        } else if (
          (typeof cell === 'string' || typeof cell === 'number') &&
          parseIndianNumberString(cell) !== null
        ) {
          numCount++
          curDataCols.push(c)
        }
      }

      if (numCount >= 3 && firstTextCol !== -1) {
        headerRowIndex = r - 1 >= 0 ? r - 1 : r
        accountNameColIndex = firstTextCol
        dataColIndices = curDataCols
        if (headerRowIndex < r && data[headerRowIndex]) {
          months = curDataCols.map((c) => String(data[headerRowIndex][c]))
        } else {
          months = curDataCols.map((_, i) => `Month ${i + 1}`)
        }
        break
      }
    }
  }

  return { headerRowIndex, accountNameColIndex, dataColIndices, months }
}
