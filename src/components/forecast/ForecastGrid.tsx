'use client'

import { useMemo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { Account } from '@/stores/accounts-store'
import type { EngineResult } from '@/lib/engine'
import type { ViewType } from './ViewSwitcher'

interface GridRow {
  id: string
  name: string
  type: 'header' | 'account' | 'subtotal' | 'total'
  values: number[]
  total: number
  indent?: number
}

interface ForecastGridProps {
  view: ViewType
  accounts: Account[]
  forecastMonths: string[]
  engineResult: EngineResult | null
  onCellEdit?: (accountId: string, monthIndex: number, value: number) => void
}

function buildPLRows(accounts: Account[], engineResult: EngineResult | null, monthCount: number): GridRow[] {
  const rows: GridRow[] = []
  const forecasts = engineResult?.accountForecasts ?? {}
  const emptyValues = () => Array(monthCount).fill(0)

  const addSection = (
    headerName: string,
    accountFilter: (a: Account) => boolean,
    subtotalName?: string
  ) => {
    rows.push({ id: `header-${headerName}`, name: headerName, type: 'header', values: emptyValues(), total: 0 })

    const sectionAccounts = accounts.filter(accountFilter).sort((a, b) => a.sortOrder - b.sortOrder)
    const sectionTotals = emptyValues()

    sectionAccounts.forEach((acc) => {
      const values = forecasts[acc.id] ?? emptyValues()
      values.forEach((v: number, i: number) => { sectionTotals[i] += v })
      rows.push({
        id: acc.id,
        name: acc.name,
        type: 'account',
        values,
        total: values.reduce((s: number, v: number) => s + v, 0),
        indent: 1,
      })
    })

    if (subtotalName) {
      rows.push({
        id: `subtotal-${headerName}`,
        name: subtotalName,
        type: 'subtotal',
        values: sectionTotals,
        total: sectionTotals.reduce((s, v) => s + v, 0),
      })
    }

    return sectionTotals
  }

  const revTotals = addSection('Revenue', (a) => a.accountType === 'revenue', 'Total Revenue')
  const cogsTotals = addSection('Cost of Goods Sold', (a) => a.accountType === 'expense' && (a.standardMapping?.startsWith('cogs') ?? false), 'Total COGS')

  const grossProfit = revTotals.map((r, i) => r - cogsTotals[i])
  rows.push({ id: 'gross-profit', name: 'Gross Profit', type: 'total', values: grossProfit, total: grossProfit.reduce((s, v) => s + v, 0) })

  const opexTotals = addSection('Operating Expenses', (a) => a.accountType === 'expense' && !(a.standardMapping?.startsWith('cogs') ?? false), 'Total OpEx')

  const netIncome = grossProfit.map((g, i) => g - opexTotals[i])
  rows.push({ id: 'net-income', name: 'Net Income', type: 'total', values: netIncome, total: netIncome.reduce((s, v) => s + v, 0) })

  return rows
}

function buildBSRows(engineResult: EngineResult | null, monthCount: number): GridRow[] {
  const rows: GridRow[] = []
  const integration = engineResult?.integrationResults ?? []
  const emptyValues = () => Array(monthCount).fill(0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extract = (key: string) => integration.map((m: any) => m?.bs?.[key] ?? 0)

  rows.push({ id: 'header-assets', name: 'Assets', type: 'header', values: emptyValues(), total: 0 })
  const cashVals = extract('cash')
  rows.push({ id: 'bs-cash', name: 'Cash & Bank', type: 'account', values: cashVals, total: cashVals[cashVals.length - 1] ?? 0, indent: 1 })
  const arVals = extract('ar')
  rows.push({ id: 'bs-ar', name: 'Accounts Receivable', type: 'account', values: arVals, total: arVals[arVals.length - 1] ?? 0, indent: 1 })
  const faVals = extract('fixedAssets')
  rows.push({ id: 'bs-fa', name: 'Fixed Assets', type: 'account', values: faVals, total: faVals[faVals.length - 1] ?? 0, indent: 1 })
  const depVals = extract('accDepreciation')
  rows.push({ id: 'bs-dep', name: '(Acc. Depreciation)', type: 'account', values: depVals.map((v: number) => -v), total: -(depVals[depVals.length - 1] ?? 0), indent: 1 })
  const totalAssets = extract('totalAssets')
  rows.push({ id: 'bs-total-assets', name: 'Total Assets', type: 'total', values: totalAssets, total: totalAssets[totalAssets.length - 1] ?? 0 })

  rows.push({ id: 'header-liab', name: 'Liabilities', type: 'header', values: emptyValues(), total: 0 })
  const apVals = extract('ap')
  rows.push({ id: 'bs-ap', name: 'Accounts Payable', type: 'account', values: apVals, total: apVals[apVals.length - 1] ?? 0, indent: 1 })
  const debtVals = extract('debt')
  rows.push({ id: 'bs-debt', name: 'Debt', type: 'account', values: debtVals, total: debtVals[debtVals.length - 1] ?? 0, indent: 1 })
  const totalLiab = extract('totalLiabilities')
  rows.push({ id: 'bs-total-liab', name: 'Total Liabilities', type: 'subtotal', values: totalLiab, total: totalLiab[totalLiab.length - 1] ?? 0 })

  rows.push({ id: 'header-equity', name: 'Equity', type: 'header', values: emptyValues(), total: 0 })
  const equityVals = extract('equity')
  rows.push({ id: 'bs-equity', name: 'Share Capital', type: 'account', values: equityVals, total: equityVals[equityVals.length - 1] ?? 0, indent: 1 })
  const reVals = extract('retainedEarnings')
  rows.push({ id: 'bs-re', name: 'Retained Earnings', type: 'account', values: reVals, total: reVals[reVals.length - 1] ?? 0, indent: 1 })
  const totalEquity = extract('totalEquity')
  rows.push({ id: 'bs-total-equity', name: 'Total Equity', type: 'total', values: totalEquity, total: totalEquity[totalEquity.length - 1] ?? 0 })

  return rows
}

function buildCFRows(engineResult: EngineResult | null, monthCount: number): GridRow[] {
  const rows: GridRow[] = []
  const integration = engineResult?.integrationResults ?? []
  const emptyValues = () => Array(monthCount).fill(0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extract = (key: string) => integration.map((m: any) => m?.cf?.[key] ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractIndirect = (key: string) => integration.map((m: any) => m?.cf?.indirect?.[key] ?? 0)

  rows.push({ id: 'header-ocf', name: 'Cash Flow from Operations', type: 'header', values: emptyValues(), total: 0 })
  const netIncome = extractIndirect('netIncome')
  rows.push({ id: 'cf-ni', name: 'Net Income', type: 'account', values: netIncome, total: netIncome.reduce((s: number, v: number) => s + v, 0), indent: 1 })
  const dep = extractIndirect('depreciation')
  rows.push({ id: 'cf-dep', name: 'Add: Depreciation', type: 'account', values: dep, total: dep.reduce((s: number, v: number) => s + v, 0), indent: 1 })
  const changeAR = extractIndirect('changeInAR')
  rows.push({ id: 'cf-ar', name: '(Inc)/Dec in Receivables', type: 'account', values: changeAR, total: changeAR.reduce((s: number, v: number) => s + v, 0), indent: 1 })
  const changeAP = extractIndirect('changeInAP')
  rows.push({ id: 'cf-ap', name: 'Inc/(Dec) in Payables', type: 'account', values: changeAP, total: changeAP.reduce((s: number, v: number) => s + v, 0), indent: 1 })

  const ocf = extract('operatingCashFlow')
  rows.push({ id: 'cf-ocf', name: 'Net Cash from Operations', type: 'subtotal', values: ocf, total: ocf.reduce((s: number, v: number) => s + v, 0) })

  rows.push({ id: 'header-icf', name: 'Cash Flow from Investing', type: 'header', values: emptyValues(), total: 0 })
  const icf = extract('investingCashFlow')
  rows.push({ id: 'cf-icf', name: 'Net Cash from Investing', type: 'subtotal', values: icf, total: icf.reduce((s: number, v: number) => s + v, 0) })

  rows.push({ id: 'header-fcf', name: 'Cash Flow from Financing', type: 'header', values: emptyValues(), total: 0 })
  const fcf = extract('financingCashFlow')
  rows.push({ id: 'cf-fcf', name: 'Net Cash from Financing', type: 'subtotal', values: fcf, total: fcf.reduce((s: number, v: number) => s + v, 0) })

  const netCF = extract('netCashFlow')
  rows.push({ id: 'cf-net', name: 'Net Change in Cash', type: 'total', values: netCF, total: netCF.reduce((s: number, v: number) => s + v, 0) })

  return rows
}

function formatNum(paise: number): string {
  if (paise === 0) return '—'
  const rupees = paise / 100
  const abs = Math.abs(rupees)
  let formatted: string
  if (abs >= 10000000) formatted = `${(rupees / 10000000).toFixed(1)}Cr`
  else if (abs >= 100000) formatted = `${(rupees / 100000).toFixed(1)}L`
  else if (abs >= 1000) formatted = `${(rupees / 1000).toFixed(1)}K`
  else formatted = rupees.toFixed(0)
  return paise < 0 ? `(${formatted.replace('-', '')})` : formatted
}

export function ForecastGrid({ view, accounts, forecastMonths, engineResult, onCellEdit }: ForecastGridProps) {
  const [editingCell, setEditingCell] = useState<{ row: string; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const monthCount = forecastMonths.length

  const rows = useMemo(() => {
    switch (view) {
      case 'pl': return buildPLRows(accounts, engineResult, monthCount)
      case 'bs': return buildBSRows(engineResult, monthCount)
      case 'cf': return buildCFRows(engineResult, monthCount)
      default: return []
    }
  }, [view, accounts, engineResult, monthCount])

  const handleCellClick = useCallback((rowId: string, colIndex: number, currentValue: number) => {
    if (view !== 'pl') return
    const row = rows.find((r) => r.id === rowId)
    if (!row || row.type !== 'account') return
    setEditingCell({ row: rowId, col: colIndex })
    setEditValue(String(Math.round(currentValue / 100)))
  }, [view, rows])

  const handleCellBlur = useCallback(() => {
    if (!editingCell || !onCellEdit) { setEditingCell(null); return }
    const numericValue = parseFloat(editValue.replace(/[^0-9.-]/g, ''))
    if (!isNaN(numericValue)) {
      onCellEdit(editingCell.row, editingCell.col, Math.round(numericValue * 100))
    }
    setEditingCell(null)
  }, [editingCell, editValue, onCellEdit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCellBlur()
    else if (e.key === 'Escape') setEditingCell(null)
  }, [handleCellBlur])

  return (
    <div className="overflow-x-auto rounded-md border border-[#E5E7EB]">
      <table className="fin-table w-full min-w-[800px] border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white pl-4 pr-2 text-left">Account</th>
            {forecastMonths.map((month) => (
              <th key={month} className="px-2">{month}</th>
            ))}
            <th className="px-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={cn(
              row.type === 'header' && 'bg-[#F8FAFC]',
              row.type === 'subtotal' && 'bg-[#F8FAFC]',
              row.type === 'total' && 'border-t border-[#0F172A] bg-[#F1F5F9]',
              row.type === 'account' && 'hover-row'
            )}>
              <td className={cn(
                'sticky left-0 z-10 whitespace-nowrap py-1.5 pl-4 pr-2',
                row.type === 'header' ? 'bg-[#F8FAFC]' : row.type === 'total' ? 'bg-[#F1F5F9]' : row.type === 'subtotal' ? 'bg-[#F8FAFC]' : 'bg-white',
              )}>
                <span className={cn(
                  row.type === 'header' && 'label-xs',
                  row.type === 'subtotal' && 'font-semibold text-[#334155]',
                  row.type === 'total' && 'font-bold text-[#0F172A]',
                  row.type === 'account' && 'text-[#334155]'
                )} style={{ paddingLeft: (row.indent ?? 0) * 16 }}>
                  {row.name}
                </span>
              </td>

              {row.values.map((value, colIndex) => {
                const isEditing = editingCell?.row === row.id && editingCell?.col === colIndex
                return (
                  <td key={colIndex} className={cn(
                    'px-2 py-1.5',
                    row.type === 'account' && view === 'pl' && 'cursor-pointer',
                    row.type === 'total' && 'font-bold text-[#0F172A]',
                    row.type === 'subtotal' && 'font-semibold text-[#334155]',
                    value < 0 && 'text-[#DC2626]'
                  )} onClick={() => handleCellClick(row.id, colIndex, value)}>
                    {isEditing ? (
                      <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus
                        className="w-20 rounded border border-[#2563EB] bg-white px-1.5 py-0.5 text-right font-num text-sm text-[#0F172A] focus:outline-none" />
                    ) : row.type !== 'header' ? formatNum(value) : null}
                  </td>
                )
              })}

              <td className={cn(
                'px-3 py-1.5',
                row.type === 'total' && 'font-bold text-[#0F172A]',
                row.type === 'subtotal' && 'font-semibold text-[#334155]',
                row.total < 0 && 'text-[#DC2626]'
              )}>
                {row.type !== 'header' ? formatNum(row.total) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
