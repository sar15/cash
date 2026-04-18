import { parseExcelBuffer } from '@/lib/import/excel-parser'
import { isTallyXml, parseTallyXml } from '@/lib/import/tally-parser'
import {
  mapServerAccountDetailed,
  type ServerAccountMatchType,
  type ServerAccountMappingResult,
} from '@/lib/import/server-account-mapper'
import {
  detectStructure,
  parseIndianNumberString,
  type ColumnMap,
} from '@/lib/import/structure-detector'
import { validateHistoricalStatement } from '@/lib/import/validator'
import {
  STANDARD_INDIAN_COA,
  type StandardAccountType,
  type StandardStatementCategory,
} from '@/lib/standards/indian-coa'
import { getMappingsForCompany } from '@/lib/db/queries/account-mappings'

import { RouteError } from './api'

interface PreviewValue {
  period: string
  amountPaise: number
}

interface PreviewRow {
  rowIndex: number
  accountName: string
  mappedAccountId: string | null
  mappedAccountName: string | null
  matchType: ServerAccountMatchType
  confidence: number
  category: StandardStatementCategory | null
  accountType: StandardAccountType | null
  values: PreviewValue[]
}

const MAX_PREVIEW_ROWS = 1000

function toPaise(value: number | null) {
  return value === null ? 0 : Math.round(value * 100)
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

function summarizeValidation(rows: PreviewRow[], structure: ColumnMap) {
  return structure.months.map((period, monthIndex) => {
    const totals = rows.reduce(
      (acc, row) => {
        const amount = row.values[monthIndex]?.amountPaise ?? 0
        switch (row.category) {
          case 'Revenue':
            acc.revenues += amount
            break
          case 'COGS':
            acc.cogs += amount
            break
          case 'Operating Expenses':
            acc.expenses += amount
            break
          case 'Assets':
            acc.assets += amount
            break
          case 'Liabilities':
            acc.liabilities += amount
            break
          case 'Equity':
            acc.equity += amount
            break
          default:
            break
        }

        return acc
      },
      {
        revenues: 0,
        cogs: 0,
        expenses: 0,
        assets: 0,
        liabilities: 0,
        equity: 0,
      }
    )

    const validation = validateHistoricalStatement(
      {
        pl: {
          revenues: totals.revenues,
          cogs: totals.cogs,
          expenses: totals.expenses,
          netProfit: totals.revenues - totals.cogs - totals.expenses,
        },
        bs:
          totals.assets || totals.liabilities || totals.equity
            ? {
                assets: totals.assets,
                liabilities: totals.liabilities,
                equity: totals.equity,
                retainedEarnings: 0,
              }
            : undefined,
      },
      period
    )

    return {
      period,
      ...validation,
    }
  })
}

function buildWarnings(rows: PreviewRow[], structure: ColumnMap) {
  const warnings: string[] = []
  const unmappedCount = rows.filter((row) => row.matchType === 'unmapped').length

  if (structure.headerRowIndex < 0 || structure.accountNameColIndex < 0) {
    warnings.push('Header detection was partial. Please review the parsed preview carefully.')
  }

  if (structure.months.length < 12) {
    warnings.push('Fewer than 12 monthly periods were detected in the uploaded file.')
  }

  if (unmappedCount > 0) {
    warnings.push(`${unmappedCount} account rows could not be confidently mapped.`)
  }

  return warnings
}

export async function buildImportPreview(buffer: ArrayBuffer, requestedSheetName?: string, companyId?: string) {
  // Auto-detect Tally XML — route to dedicated parser before trying Excel/CSV
  const sheets = isTallyXml(buffer)
    ? await parseTallyXml(buffer)
    : await parseExcelBuffer(buffer)
  if (sheets.length === 0) {
    throw new RouteError(422, 'No readable sheets were found in the uploaded file.')
  }

  const selectedSheet =
    (requestedSheetName
      ? sheets.find((sheet) => sheet.sheetName === requestedSheetName)
      : sheets[0]) ?? sheets[0]

  const structure = detectStructure(selectedSheet)
  if (structure.accountNameColIndex < 0 || structure.dataColIndices.length === 0) {
    throw new RouteError(422, 'Unable to detect account and month columns in the uploaded file.')
  }

  const savedMappings = companyId
    ? await getMappingsForCompany(companyId)
    : new Map<string, { standardAccountId: string | null; skipped: boolean }>()

  const rows = selectedSheet.data
    .slice(Math.max(structure.headerRowIndex + 1, 0))
    .map<PreviewRow | null>((row, rowOffset) => {
      const accountName = String(row[structure.accountNameColIndex] ?? '').trim()
      if (!accountName) {
        return null
      }

      const saved = savedMappings.get(accountName)
      let mapping: ServerAccountMappingResult
      if (saved) {
        if (saved.skipped) {
          const values = structure.dataColIndices.map((columnIndex, monthIndex) => ({
            period: structure.months[monthIndex],
            amountPaise: toPaise(parseIndianNumberString(row[columnIndex] as string | number)),
          }))
          return { rowIndex: structure.headerRowIndex + 1 + rowOffset, accountName, mappedAccountId: null, mappedAccountName: null, matchType: 'skipped' as const, confidence: 1, category: null, accountType: null, values }
        }
        const account = STANDARD_INDIAN_COA.find(a => a.id === saved.standardAccountId) ?? null
        mapping = { account, matchType: 'saved' as const, confidence: 1.0 }
      } else {
        mapping = mapServerAccountDetailed(accountName)
      }

      const values = structure.dataColIndices.map((columnIndex, monthIndex) => ({
        period: structure.months[monthIndex],
        amountPaise: toPaise(parseIndianNumberString(row[columnIndex] as string | number)),
      }))

      return {
        rowIndex: structure.headerRowIndex + 1 + rowOffset,
        accountName,
        mappedAccountId: mapping.account?.id ?? null,
        mappedAccountName: mapping.account?.name ?? null,
        matchType: mapping.matchType,
        confidence: mapping.confidence,
        category: mapping.account?.category ?? null,
        accountType: mapping.account?.accountType ?? null,
        values,
      }
    })
    .filter((row): row is PreviewRow => row !== null)
    .filter((row) => row.matchType !== 'skipped' && (row.values.some((value) => value.amountPaise !== 0) || row.mappedAccountId !== null))

  if (rows.length > MAX_PREVIEW_ROWS) {
    throw new RouteError(422, `Preview contains more than ${MAX_PREVIEW_ROWS} data rows. Please split the file into smaller imports.`)
  }

  return {
    sheets: sheets.map((sheet) => ({
      sheetName: sheet.sheetName,
      rowCount: sheet.data.length,
    })),
    selectedSheet: selectedSheet.sheetName,
    structure,
    rows,
    validation: summarizeValidation(rows, structure),
    warnings: buildWarnings(rows, structure),
    summary: {
      totalRows: rows.length,
      mappedRows: rows.filter((row) => row.mappedAccountId !== null).length,
      unmappedRows: rows.filter((row) => row.mappedAccountId === null).length,
      periods: structure.months.length,
    },
  }
}

export function buildImportTemplateCsv(months = [
  'Apr-25', 'May-25', 'Jun-25', 'Jul-25', 'Aug-25', 'Sep-25',
  'Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26',
]) {
  // Group accounts by category for better readability
  const sections: Array<{ comment: string; accounts: typeof STANDARD_INDIAN_COA }> = [
    {
      comment: '# REVENUE — Enter monthly income amounts in Indian Rupees (not paise)',
      accounts: STANDARD_INDIAN_COA.filter(a => a.category === 'Revenue'),
    },
    {
      comment: '# COST OF GOODS SOLD — Direct costs to produce goods/services',
      accounts: STANDARD_INDIAN_COA.filter(a => a.category === 'COGS'),
    },
    {
      comment: '# OPERATING EXPENSES — Indirect/overhead costs',
      accounts: STANDARD_INDIAN_COA.filter(a => a.category === 'Operating Expenses'),
    },
    {
      // CRITICAL: These accounts drive the AS 3 Cash Flow working capital calculation.
      // Keep them separate — do NOT lump them into a single "Assets" row.
      // Inventory, Trade Receivables, and Short-term Loans & Advances each get their own row.
      comment: '# ASSETS — Enter CLOSING BALANCE for each month (not movement). IMPORTANT: Keep Inventory, Trade Receivables, GST Receivable, and Prepaid Expenses as separate rows — the Cash Flow engine uses their month-on-month changes to compute Operating Cash Flow.',
      accounts: STANDARD_INDIAN_COA.filter(a => a.category === 'Assets'),
    },
    {
      // CRITICAL: Short-term vs Long-term borrowings must be separate rows.
      // The engine uses this split to correctly classify debt on the Balance Sheet.
      comment: '# LIABILITIES — Enter CLOSING BALANCE for each month. IMPORTANT: Keep Trade Payables, Short-term Debt (OD/CC), and Long-term Debt (Term Loans) as separate rows — the Cash Flow engine uses their changes to compute Financing Cash Flow.',
      accounts: STANDARD_INDIAN_COA.filter(a => a.category === 'Liabilities'),
    },
    {
      comment: '# EQUITY — Share capital and retained earnings (enter closing balance)',
      accounts: STANDARD_INDIAN_COA.filter(a => a.category === 'Equity'),
    },
  ]

  const header = ['Particulars', ...months].map(escapeCsvCell).join(',')

  // Instructions rows
  const instructions1 = [
    '# HOW TO USE: Fill in monthly amounts in Indian Rupees. Leave blank if not applicable. Do not change account names.',
    ...months.map(() => ''),
  ].map(escapeCsvCell).join(',')

  const instructions2 = [
    '# P&L accounts (Revenue, COGS, Expenses): enter the amount for that month only.',
    ...months.map(() => ''),
  ].map(escapeCsvCell).join(',')

  const instructions3 = [
    '# Balance Sheet accounts (Assets, Liabilities, Equity): enter the CLOSING BALANCE as of the last day of that month.',
    ...months.map(() => ''),
  ].map(escapeCsvCell).join(',')

  const rows: string[] = [header, instructions1, instructions2, instructions3]

  for (const section of sections) {
    // Section comment row
    rows.push([section.comment, ...months.map(() => '')].map(escapeCsvCell).join(','))
    // Account rows
    for (const account of section.accounts) {
      rows.push([account.name, ...months.map(() => '')].map(escapeCsvCell).join(','))
    }
    // Blank separator
    rows.push(['', ...months.map(() => '')].join(','))
  }

  return rows.join('\n')
}
