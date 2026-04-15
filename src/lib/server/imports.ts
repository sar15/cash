import { parseExcelBuffer } from '@/lib/import/excel-parser'
import {
  mapServerAccountDetailed,
  type ServerAccountMatchType,
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

export async function buildImportPreview(buffer: ArrayBuffer, requestedSheetName?: string) {
  const sheets = await parseExcelBuffer(buffer)
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

  const rows = selectedSheet.data
    .slice(Math.max(structure.headerRowIndex + 1, 0))
    .map<PreviewRow | null>((row, rowOffset) => {
      const accountName = String(row[structure.accountNameColIndex] ?? '').trim()
      if (!accountName) {
        return null
      }

      const mapping = mapServerAccountDetailed(accountName)
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
    .filter((row) => row.values.some((value) => value.amountPaise !== 0) || row.mappedAccountId !== null)

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
  'Apr-25',
  'May-25',
  'Jun-25',
  'Jul-25',
  'Aug-25',
  'Sep-25',
  'Oct-25',
  'Nov-25',
  'Dec-25',
  'Jan-26',
  'Feb-26',
  'Mar-26',
]) {
  const header = ['Particulars', ...months].map(escapeCsvCell).join(',')
  const rows = STANDARD_INDIAN_COA.map((account) =>
    [account.name, ...months.map(() => '')].map(escapeCsvCell).join(',')
  )

  return [header, ...rows].join('\n')
}
