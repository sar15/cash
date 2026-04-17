'use client'

import React, { useMemo, useState, useCallback, memo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Settings2, TrendingUp, TrendingDown, Minus, Lock, Unlock, Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Account } from '@/stores/accounts-store'
import type { EngineResult } from '@/lib/engine'
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types'
import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types'
import type { ViewType } from './ViewSwitcher'
import { useFormulaStore } from '@/stores/formula-store'
import { evaluateFormula } from '@/lib/engine/formula-evaluator'
import { formatAuto } from '@/lib/utils/indian-format'
import { CustomFormulaBuilder } from './CustomFormulaBuilder'

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
  actuals?: Record<string, Record<string, number>>
  valueRules?: Record<string, AnyValueRuleConfig>
  timingProfiles?: Record<string, AnyTimingProfileConfig>
  onCellEdit?: (accountId: string, monthIndex: number, value: number) => void
  onAccountClick?: (accountId: string) => void
  fullHeight?: boolean
  compareMode?: boolean
  scenarioResults?: Array<{ id: string; name: string; result: EngineResult | null }> | null
  lockedPeriods?: string[]
  onToggleLock?: (period: string) => Promise<void>
  companyId?: string
  onCreateFormula?: () => void
}

function buildPLRows(accounts: Account[], engineResult: EngineResult | null, monthCount: number): GridRow[] {
  const rows: GridRow[] = []
  const forecasts = engineResult?.accountForecasts ?? {}
  const emptyValues = () => Array(monthCount).fill(0)

  const addSection = (headerName: string, accountFilter: (a: Account) => boolean, subtotalName?: string) => {
    rows.push({ id: `header-${headerName}`, name: headerName, type: 'header', values: emptyValues(), total: 0 })
    // Only include leaf accounts (isGroup=false) to prevent double-counting parent totals
    const sectionAccounts = accounts.filter(a => accountFilter(a) && !a.isGroup).sort((a, b) => a.sortOrder - b.sortOrder)
    const sectionTotals = emptyValues()
    sectionAccounts.forEach((acc) => {
      const values = forecasts[acc.id] ?? emptyValues()
      values.forEach((v: number, i: number) => { sectionTotals[i] += v })
      rows.push({ id: acc.id, name: acc.name, type: 'account', values, total: values.reduce((s: number, v: number) => s + v, 0), indent: 1 })
    })
    if (subtotalName) {
      rows.push({ id: `subtotal-${headerName}`, name: subtotalName, type: 'subtotal', values: sectionTotals, total: sectionTotals.reduce((s, v) => s + v, 0) })
    }
    return sectionTotals
  }

  const revTotals = addSection('Revenue', (a) => a.accountType === 'revenue', 'Total Revenue')
  const cogsTotals = addSection('Cost of Goods Sold', (a) => a.accountType === 'expense' && (a.standardMapping?.startsWith('cogs') ?? false), 'Total COGS')
  const grossProfit = revTotals.map((r, i) => r - cogsTotals[i])
  rows.push({ id: 'gross-profit', name: 'Gross Profit', type: 'total', values: grossProfit, total: grossProfit.reduce((s, v) => s + v, 0) })
  const opexTotals = addSection('Operating Expenses', (a) => a.accountType === 'expense' && !(a.standardMapping?.startsWith('cogs') ?? false), 'Total OpEx')
  const ebitda = grossProfit.map((g, i) => g - opexTotals[i])
  rows.push({ id: 'ebitda', name: 'EBITDA', type: 'subtotal', values: ebitda, total: ebitda.reduce((s, v) => s + v, 0) })
  // Depreciation from integration results (if available)
  const depVals = engineResult?.rawIntegrationResults?.map(m => m?.pl?.depreciation ?? 0) ?? Array(monthCount).fill(0)
  const netIncome = ebitda.map((e, i) => e - depVals[i])
  rows.push({ id: 'net-income', name: 'Net Income (PAT)', type: 'total', values: netIncome, total: netIncome.reduce((s, v) => s + v, 0) })
  return rows
}

function buildBSRows(engineResult: EngineResult | null, monthCount: number): GridRow[] {
  const rows: GridRow[] = []
  const integration = engineResult?.integrationResults ?? []
  const emptyValues = () => Array(monthCount).fill(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extract = (key: string) => integration.map((m: any) => m?.bs?.[key] ?? 0)

  rows.push({ id: 'header-assets', name: 'Assets', type: 'header', values: emptyValues(), total: 0 })
  const cashVals = extract('cash'); rows.push({ id: 'bs-cash', name: 'Cash & Bank', type: 'account', values: cashVals, total: cashVals[cashVals.length - 1] ?? 0, indent: 1 })
  const arVals = extract('ar'); rows.push({ id: 'bs-ar', name: 'Accounts Receivable', type: 'account', values: arVals, total: arVals[arVals.length - 1] ?? 0, indent: 1 })
  const faVals = extract('fixedAssets'); rows.push({ id: 'bs-fa', name: 'Fixed Assets', type: 'account', values: faVals, total: faVals[faVals.length - 1] ?? 0, indent: 1 })
  const depVals = extract('accDepreciation'); rows.push({ id: 'bs-dep', name: '(Acc. Depreciation)', type: 'account', values: depVals.map((v: number) => -v), total: -(depVals[depVals.length - 1] ?? 0), indent: 1 })
  const totalAssets = extract('totalAssets'); rows.push({ id: 'bs-total-assets', name: 'Total Assets', type: 'total', values: totalAssets, total: totalAssets[totalAssets.length - 1] ?? 0 })

  rows.push({ id: 'header-liab', name: 'Liabilities', type: 'header', values: emptyValues(), total: 0 })
  const apVals = extract('ap'); rows.push({ id: 'bs-ap', name: 'Accounts Payable', type: 'account', values: apVals, total: apVals[apVals.length - 1] ?? 0, indent: 1 })
  const debtVals = extract('debt'); rows.push({ id: 'bs-debt', name: 'Debt', type: 'account', values: debtVals, total: debtVals[debtVals.length - 1] ?? 0, indent: 1 })
  const totalLiab = extract('totalLiabilities'); rows.push({ id: 'bs-total-liab', name: 'Total Liabilities', type: 'subtotal', values: totalLiab, total: totalLiab[totalLiab.length - 1] ?? 0 })

  rows.push({ id: 'header-equity', name: 'Equity', type: 'header', values: emptyValues(), total: 0 })
  const equityVals = extract('equity'); rows.push({ id: 'bs-equity', name: 'Share Capital', type: 'account', values: equityVals, total: equityVals[equityVals.length - 1] ?? 0, indent: 1 })
  const reVals = extract('retainedEarnings'); rows.push({ id: 'bs-re', name: 'Retained Earnings', type: 'account', values: reVals, total: reVals[reVals.length - 1] ?? 0, indent: 1 })
  const totalEquity = extract('totalEquity'); rows.push({ id: 'bs-total-equity', name: 'Total Equity', type: 'total', values: totalEquity, total: totalEquity[totalEquity.length - 1] ?? 0 })
  return rows
}

function buildCFRows(engineResult: EngineResult | null, monthCount: number): GridRow[] {
  const rows: GridRow[] = []
  const integration = engineResult?.integrationResults ?? []
  const raw = engineResult?.rawIntegrationResults ?? []
  const emptyValues = () => Array(monthCount).fill(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extract = (key: string) => integration.map((m: any) => m?.cf?.[key] ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractIndirect = (key: string) => integration.map((m: any) => m?.cf?.indirect?.[key] ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractBS = (key: string) => raw.map((m: any) => m?.bs?.[key] ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractPL = (key: string) => raw.map((m: any) => m?.pl?.[key] ?? 0)

  // ── Opening Cash ─────────────────────────────────────────
  const cashVals = extractBS('cash')
  const ocfVals = extract('operatingCashFlow')
  const icfVals = extract('investingCashFlow')
  const fcfVals = extract('financingCashFlow')
  const netCFVals = extract('netCashFlow')

  // Opening cash = closing cash of prior month (shift by 1)
  const openingCash = cashVals.map((_, i) => {
    if (i === 0) return cashVals[0] - netCFVals[0]
    return cashVals[i - 1]
  })

  rows.push({ id: 'cf-opening', name: 'Opening Cash Balance', type: 'subtotal', values: openingCash, total: openingCash[0] ?? 0 })

  // ── Operating Activities ─────────────────────────────────
  rows.push({ id: 'header-ocf', name: 'Operating Activities', type: 'header', values: emptyValues(), total: 0 })

  const ni = extractIndirect('netIncome')
  rows.push({ id: 'cf-ni', name: 'Net Income', type: 'account', values: ni, total: ni.reduce((s: number, v: number) => s + v, 0), indent: 1 })

  const dep = extractIndirect('depreciation')
  rows.push({ id: 'cf-dep', name: 'Add: Depreciation & Amortisation', type: 'account', values: dep, total: dep.reduce((s: number, v: number) => s + v, 0), indent: 1 })

  const ar = extractIndirect('changeInAR')
  rows.push({ id: 'cf-ar', name: '(Increase)/Decrease in Receivables', type: 'account', values: ar, total: ar.reduce((s: number, v: number) => s + v, 0), indent: 1 })

  const ap = extractIndirect('changeInAP')
  rows.push({ id: 'cf-ap', name: 'Increase/(Decrease) in Payables', type: 'account', values: ap, total: ap.reduce((s: number, v: number) => s + v, 0), indent: 1 })

  rows.push({ id: 'cf-ocf', name: 'Net Cash from Operations', type: 'subtotal', values: ocfVals, total: ocfVals.reduce((s: number, v: number) => s + v, 0) })

  // ── Investing Activities ─────────────────────────────────
  rows.push({ id: 'header-icf', name: 'Investing Activities', type: 'header', values: emptyValues(), total: 0 })

  // Capital expenditure = negative of investing CF (when negative)
  const capex = icfVals.map(v => v < 0 ? v : 0)
  rows.push({ id: 'cf-capex', name: 'Capital Expenditure', type: 'account', values: capex, total: capex.reduce((s: number, v: number) => s + v, 0), indent: 1 })

  rows.push({ id: 'cf-icf', name: 'Net Cash from Investing', type: 'subtotal', values: icfVals, total: icfVals.reduce((s: number, v: number) => s + v, 0) })

  // ── Free Cash Flow (OCF − CapEx) ─────────────────────────
  const freeCF = ocfVals.map((v, i) => v + icfVals[i])
  rows.push({ id: 'cf-fcf-derived', name: 'Free Cash Flow (OCF − CapEx)', type: 'total', values: freeCF, total: freeCF.reduce((s: number, v: number) => s + v, 0) })

  // ── Financing Activities ─────────────────────────────────
  rows.push({ id: 'header-ffcf', name: 'Financing Activities', type: 'header', values: emptyValues(), total: 0 })

  // Debt raised = positive financing CF
  const debtRaised = fcfVals.map(v => v > 0 ? v : 0)
  rows.push({ id: 'cf-debt-raised', name: 'Debt Raised', type: 'account', values: debtRaised, total: debtRaised.reduce((s: number, v: number) => s + v, 0), indent: 1 })

  // Debt repaid = negative financing CF
  const debtRepaid = fcfVals.map(v => v < 0 ? v : 0)
  rows.push({ id: 'cf-debt-repaid', name: 'Debt Repaid', type: 'account', values: debtRepaid, total: debtRepaid.reduce((s: number, v: number) => s + v, 0), indent: 1 })

  rows.push({ id: 'cf-fcf', name: 'Net Cash from Financing', type: 'subtotal', values: fcfVals, total: fcfVals.reduce((s: number, v: number) => s + v, 0) })

  // ── Net Change & Closing ─────────────────────────────────
  rows.push({ id: 'cf-net', name: 'Net Change in Cash', type: 'total', values: netCFVals, total: netCFVals.reduce((s: number, v: number) => s + v, 0) })
  rows.push({ id: 'cf-closing', name: 'Closing Cash Balance', type: 'total', values: cashVals, total: cashVals[cashVals.length - 1] ?? 0 })

  // ── Key Ratios ───────────────────────────────────────────
  // Note: Cash flow ratios are shown in the Drivers view (KPI tab)
  // Here we just add a summary line for quick reference
  const grossProfit = extractPL('grossProfit')
  rows.push({ id: 'header-summary', name: 'Cash Flow Summary', type: 'header', values: emptyValues(), total: 0 })
  rows.push({ id: 'cf-gross-profit', name: 'Gross Profit (from P&L)', type: 'account', values: grossProfit, total: grossProfit.reduce((s: number, v: number) => s + v, 0), indent: 1 })
  rows.push({ id: 'cf-ocf-ref', name: 'Operating Cash Flow', type: 'account', values: ocfVals, total: ocfVals.reduce((s: number, v: number) => s + v, 0), indent: 1 })
  rows.push({ id: 'cf-fcf-ref', name: 'Free Cash Flow', type: 'account', values: freeCF, total: freeCF.reduce((s: number, v: number) => s + v, 0), indent: 1 })

  return rows
}

function buildVarianceRows(
  accounts: Account[],
  engineResult: EngineResult | null,
  actuals: Record<string, Record<string, number>>,
  forecastMonths: string[]
): GridRow[] {
  const rows: GridRow[] = []
  const forecasts = engineResult?.accountForecasts ?? {}
  const monthCount = forecastMonths.length
  const emptyValues = () => Array(monthCount).fill(0)

  // Convert 'Apr-25' label → 'YYYY-MM-01' period key
  const monthNames: Record<string, string> = {
    Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
    Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12',
  }
  const periodKeys = forecastMonths.map(label => {
    const [mon, yr] = label.split('-')
    return `20${yr}-${monthNames[mon] ?? '01'}-01`
  })

  const plAccounts = accounts.filter(a => a.accountType === 'revenue' || a.accountType === 'expense')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  plAccounts.forEach(acc => {
    const forecast = forecasts[acc.id] ?? emptyValues()
    const accountActuals = actuals[acc.id] ?? {}
    const values = periodKeys.map((period, i) => {
      const actual = accountActuals[period]
      if (actual === undefined) return 0
      return actual - (forecast[i] ?? 0)
    })
    const hasAnyActual = periodKeys.some(p => accountActuals[p] !== undefined)
    if (!hasAnyActual) return
    rows.push({
      id: `var-${acc.id}`,
      name: acc.name,
      type: 'account',
      values,
      total: values.reduce((s, v) => s + v, 0),
      indent: 1,
    })
  })

  return rows
}

function formatNum(paise: number): string {
  if (paise === 0) return '—'
  const rupees = paise / 100
  const abs = Math.abs(rupees)
  let f: string
  if (abs >= 10000000) f = `${(rupees / 10000000).toFixed(1)}Cr`
  else if (abs >= 100000) f = `${(rupees / 100000).toFixed(1)}L`
  else if (abs >= 1000) f = `${(rupees / 1000).toFixed(1)}K`
  else f = rupees.toFixed(0)
  return paise < 0 ? `(${f.replace('-', '')})` : f
}

const ruleTypeBadge: Record<string, { label: string; color: string }> = {
  growth:         { label: 'Growth', color: 'text-[#059669] bg-[#ECFDF5] border-[#A7F3D0]' },
  rolling_avg:    { label: 'Avg',    color: 'text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]' },
  same_last_year: { label: 'LY',     color: 'text-[#D97706] bg-[#FFFBEB] border-[#FDE68A]' },
  direct_entry:   { label: 'Manual', color: 'text-[#64748B] bg-[#F8FAFC] border-[#E5E7EB]' },
}

// ── Drivers View ──────────────────────────────────────────────────────────

interface DriverMetric {
  id: string
  label: string
  sublabel: string
  values: (number | null)[]
  format: (v: number) => string
  tone: (v: number, prev: number | null) => 'green' | 'red' | 'neutral'
}

function formatPct(v: number) { return `${v.toFixed(1)}%` }
function formatDays(v: number) { return `${Math.round(v)}d` }
function formatRupeesDriver(v: number) {
  const abs = Math.abs(v)
  if (abs >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`
  if (abs >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (abs >= 1000) return `₹${(v / 1000).toFixed(1)}K`
  return `₹${Math.round(v)}`
}

const DriversView = memo(function DriversView({
  forecastMonths,
  engineResult,
  fullHeight,
  accounts,
  companyId,
  onCreateFormula,
}: {
  forecastMonths: string[]
  engineResult: EngineResult | null
  fullHeight?: boolean
  accounts?: Account[]
  companyId?: string
  onCreateFormula?: () => void
}) {
  const formulas = useFormulaStore(s => s.formulas)
  const removeFormula = useFormulaStore(s => s.remove)
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null)
  const metrics = useMemo((): DriverMetric[] => {
    if (!engineResult) return []
    const results = engineResult.integrationResults
    const raw = engineResult.rawIntegrationResults    // Gross Margin %
    const grossMarginPct: (number | null)[] = results.map(m => {
      const rev = m.pl.revenue
      if (rev === 0) return null
      return ((rev - m.pl.cogs) / rev) * 100
    })

    // Net Margin %
    const netMarginPct: (number | null)[] = results.map(m => {
      const rev = m.pl.revenue
      if (rev === 0) return null
      return (m.pl.netIncome / rev) * 100
    })

    // Operating Cash Conversion (OCF / Revenue)
    const cashConversion: (number | null)[] = results.map(m => {
      const rev = m.pl.revenue
      if (rev === 0) return null
      return (m.cf.operatingCashFlow / rev) * 100
    })

    // AR Days (AR / Revenue * 30)
    const arDays: (number | null)[] = raw.map(m => {
      const rev = m.pl.revenue
      if (rev === 0) return null
      return (m.bs.ar / rev) * 30
    })

    // AP Days (AP / (COGS + Expense) * 30)
    const apDays: (number | null)[] = raw.map(m => {
      const costs = m.pl.cogs + m.pl.expense
      if (costs === 0) return null
      return (m.bs.ap / costs) * 30
    })

    // Working Capital Days (AR Days - AP Days)
    const wcDays: (number | null)[] = arDays.map((ar, i) => {
      const ap = apDays[i]
      if (ar === null || ap === null) return null
      return ar - ap
    })

    // Burn Rate (monthly cash outflows when OCF is negative, in rupees)
    const burnRate: (number | null)[] = results.map(m => {
      const ocf = m.cf.operatingCashFlow
      return ocf < 0 ? Math.abs(ocf) / 100 : null
    })

    // Revenue Growth MoM %
    const revGrowth: (number | null)[] = results.map((m, i) => {
      if (i === 0) return null
      const prev = results[i - 1].pl.revenue
      if (prev === 0) return null
      return ((m.pl.revenue - prev) / prev) * 100
    })

    // Expense Ratio (Total Expenses / Revenue)
    const expenseRatio: (number | null)[] = results.map(m => {
      const rev = m.pl.revenue
      if (rev === 0) return null
      return ((m.pl.cogs + m.pl.expense) / rev) * 100
    })

    return [
      {
        id: 'gross-margin',
        label: 'Gross Margin',
        sublabel: '(Revenue − COGS) / Revenue',
        values: grossMarginPct,
        format: formatPct,
        tone: (v) => v >= 40 ? 'green' : v >= 20 ? 'neutral' : 'red',
      },
      {
        id: 'net-margin',
        label: 'Net Margin',
        sublabel: 'Net Income / Revenue',
        values: netMarginPct,
        format: formatPct,
        tone: (v) => v > 0 ? 'green' : 'red',
      },
      {
        id: 'cash-conversion',
        label: 'Cash Conversion',
        sublabel: 'Operating CF / Revenue',
        values: cashConversion,
        format: formatPct,
        tone: (v) => v > 0 ? 'green' : 'red',
      },
      {
        id: 'rev-growth',
        label: 'Revenue Growth',
        sublabel: 'Month-on-month %',
        values: revGrowth,
        format: formatPct,
        tone: (v) => v > 0 ? 'green' : v < 0 ? 'red' : 'neutral',
      },
      {
        id: 'expense-ratio',
        label: 'Expense Ratio',
        sublabel: 'Total Costs / Revenue',
        values: expenseRatio,
        format: formatPct,
        tone: (v) => v < 70 ? 'green' : v < 90 ? 'neutral' : 'red',
      },
      {
        id: 'ar-days',
        label: 'AR Days',
        sublabel: 'Receivables collection cycle',
        values: arDays,
        format: formatDays,
        tone: (v) => v < 30 ? 'green' : v < 60 ? 'neutral' : 'red',
      },
      {
        id: 'ap-days',
        label: 'AP Days',
        sublabel: 'Payables payment cycle',
        values: apDays,
        format: formatDays,
        tone: (v) => v > 30 ? 'green' : 'neutral',
      },
      {
        id: 'wc-days',
        label: 'Working Capital Days',
        sublabel: 'AR Days − AP Days',
        values: wcDays,
        format: formatDays,
        tone: (v) => v < 30 ? 'green' : v < 60 ? 'neutral' : 'red',
      },
      {
        id: 'burn-rate',
        label: 'Burn Rate',
        sublabel: 'Monthly cash burn (when OCF < 0)',
        values: burnRate,
        format: formatRupeesDriver,
        tone: (v) => v > 0 ? 'red' : 'neutral',
      },
    ]
  }, [engineResult])

  if (!engineResult || metrics.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', fullHeight ? 'h-full' : '')}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
          <Settings2 className="h-5 w-5 text-[#94A3B8]" />
        </div>
        <p className="text-sm font-semibold text-[#0F172A]">No forecast data</p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-[#94A3B8]">
          Import financial data to see derived KPI drivers.
        </p>
      </div>
    )
  }

  const toneColors = {
    green:   'text-[#059669]',
    red:     'text-[#DC2626]',
    neutral: 'text-[#334155]',
  }

  return (
    <div className={cn('overflow-x-auto', fullHeight ? 'h-full' : '')}>
      <table className="fin-table w-full min-w-[800px] border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white pl-4 pr-2 text-left after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[#E2E8F0]">
              KPI Driver
            </th>
            {forecastMonths.map(m => <th key={m} className="px-2">{m}</th>)}
            <th className="px-3">Avg</th>
          </tr>
        </thead>
        <tbody>
          {/* Built-in metrics */}
          {metrics.map(metric => {
            const nonNull = metric.values.filter((v): v is number => v !== null)
            const avg = nonNull.length > 0 ? nonNull.reduce((s, v) => s + v, 0) / nonNull.length : null

            return (
              <tr key={metric.id} className="hover-row">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-1.5 pl-4 pr-2 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[#E2E8F0]">
                  <p className="text-sm text-[#0F172A]">{metric.label}</p>
                  <p className="text-[10px] text-[#94A3B8]">{metric.sublabel}</p>
                </td>
                {metric.values.map((v, i) => {
                  const prev = i > 0 ? metric.values[i - 1] : null
                  const tone = v !== null ? metric.tone(v, prev) : 'neutral'
                  const TrendIcon = v !== null && prev !== null
                    ? v > prev ? TrendingUp : v < prev ? TrendingDown : Minus
                    : null
                  return (
                    <td key={i} className={cn('px-2 py-1.5', v !== null ? toneColors[tone] : 'text-[#CBD5E1]')}>
                      <div className="flex items-center justify-end gap-1">
                        {TrendIcon && <TrendIcon className="h-2.5 w-2.5 opacity-50" />}
                        {v !== null ? metric.format(v) : '—'}
                      </div>
                    </td>
                  )
                })}
                <td className={cn('px-3 py-1.5 font-semibold', avg !== null ? toneColors[metric.tone(avg, null)] : 'text-[#CBD5E1]')}>
                  {avg !== null ? metric.format(avg) : '—'}
                </td>
              </tr>
            )
          })}

          {/* Custom formula KPIs */}
          {companyId && formulas.filter(f => f.companyId === companyId).length > 0 && (
            <tr className="bg-[#F8FAFC]">
              <td colSpan={forecastMonths.length + 2} className="px-4 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Custom KPIs</p>
              </td>
            </tr>
          )}
          {companyId && formulas.filter(f => f.companyId === companyId).map(formula => {
            if (!engineResult) return null
            const values = evaluateFormula(formula, engineResult)
            const nonNull = values.filter((v): v is number => v !== null)
            const avg = nonNull.length > 0 ? nonNull.reduce((s, v) => s + v, 0) / nonNull.length : null

            const fmtValue = (v: number | null) => {
              if (v === null) return '—'
              switch (formula.format) {
                case 'currency': return formatAuto(v)
                case 'percent':  return `${v.toFixed(1)}%`
                case 'days':     return `${Math.round(v)}d`
                case 'number':   return v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
              }
            }

            return (
              <tr key={formula.id} className="group hover-row">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-1.5 pl-4 pr-2 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[#E2E8F0]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-[#0F172A]">{formula.name}</p>
                        <span className="rounded bg-[#EFF6FF] px-1 py-0.5 text-[9px] font-bold text-[#2563EB]">Custom</span>
                      </div>
                      {formula.description && (
                        <p className="text-[10px] text-[#94A3B8]">{formula.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => setEditingFormulaId(formula.id)}
                        className="rounded p-1 text-[#94A3B8] hover:text-[#2563EB] transition-colors"
                        title="Edit formula"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeFormula(formula.id)}
                        className="rounded p-1 text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                        title="Delete formula"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </td>
                {values.map((v, i) => (
                  <td key={i} className={cn('px-2 py-1.5 tabular-nums', v !== null ? 'text-[#0F172A]' : 'text-[#CBD5E1]')}>
                    {fmtValue(v)}
                  </td>
                ))}
                <td className="px-3 py-1.5 font-semibold text-[#0F172A] tabular-nums">
                  {fmtValue(avg)}
                </td>
              </tr>
            )
          })}

          {/* Add custom KPI row */}
          {onCreateFormula && (
            <tr>
              <td colSpan={forecastMonths.length + 2} className="px-4 py-2">
                <button
                  onClick={onCreateFormula}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#94A3B8] transition-colors hover:border-[#2563EB] hover:text-[#2563EB]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create custom KPI formula
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Edit formula modal */}
      {editingFormulaId && accounts && companyId && engineResult && (
        <React.Suspense fallback={null}>
          <EditFormulaModal
            formulaId={editingFormulaId}
            accounts={accounts}
            engineResult={engineResult}
            companyId={companyId}
            onClose={() => setEditingFormulaId(null)}
          />
        </React.Suspense>
      )}
    </div>
  )
})

// Edit formula modal
function EditFormulaModal({ formulaId, accounts, engineResult, companyId, onClose }: {
  formulaId: string
  accounts: Account[]
  engineResult: EngineResult
  companyId: string
  onClose: () => void
}) {
  const formulas = useFormulaStore(s => s.formulas)
  const formula = formulas.find(f => f.id === formulaId)
  if (!formula) return null

  return (
    <CustomFormulaBuilder
      companyId={companyId}
      accounts={accounts}
      engineResult={engineResult}
      onClose={onClose}
      editingFormula={formula}
    />
  )
}

export function ForecastGrid({
  view, accounts, forecastMonths, engineResult,
  actuals = {}, valueRules, timingProfiles, onCellEdit, onAccountClick, fullHeight,
  compareMode = false, scenarioResults = null,
  lockedPeriods = [], onToggleLock,
  companyId, onCreateFormula,
}: ForecastGridProps) {
  const [editingCell, setEditingCell] = useState<{ row: string; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [lockingPeriod, setLockingPeriod] = useState<string | null>(null)
  const monthCount = forecastMonths.length

  // Stable period key lookup — precomputed once, O(1) per cell
  const periodKeys = useMemo(() => {
    const monthNames: Record<string, string> = {
      Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
      Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12',
    }
    return forecastMonths.map(label => {
      const [mon, yr] = label.split('-')
      return `20${yr}-${monthNames[mon] ?? '01'}-01`
    })
  }, [forecastMonths])

  // O(1) locked period lookup
  const lockedSet = useMemo(() => new Set(lockedPeriods), [lockedPeriods])

  const handleToggleLock = useCallback(async (monthLabel: string) => {
    if (!onToggleLock) return
    const idx = forecastMonths.indexOf(monthLabel)
    const period = periodKeys[idx] ?? ''
    setLockingPeriod(period)
    try {
      await onToggleLock(period)
    } finally {
      setLockingPeriod(null)
    }
  }, [onToggleLock, forecastMonths, periodKeys])

  // Always compute all rows (hooks must not be inside conditionals)
  const baselineRows = useMemo(() => {
    switch (view) {
      case 'pl': return buildPLRows(accounts, engineResult, monthCount)
      case 'bs': return buildBSRows(engineResult, monthCount)
      case 'cf': return buildCFRows(engineResult, monthCount)
      case 'variance': return buildVarianceRows(accounts, engineResult, actuals, forecastMonths)
      default:   return []
    }
  }, [view, accounts, engineResult, monthCount, actuals, forecastMonths])

  // Precompute scenario rows keyed by rowId — avoids O(scenarios × rows) rebuild per row
  const scenarioRowMaps = useMemo(() => {
    if (!compareMode || !scenarioResults || scenarioResults.length === 0) return null
    return scenarioResults.map(scenario => {
      const sRows = (() => {
        switch (view) {
          case 'pl': return buildPLRows(accounts, scenario.result, monthCount)
          case 'bs': return buildBSRows(scenario.result, monthCount)
          case 'cf': return buildCFRows(scenario.result, monthCount)
          default:   return []
        }
      })()
      const map: Record<string, typeof sRows[0]> = {}
      for (const r of sRows) map[r.id] = r
      return { scenario, map }
    })
  }, [compareMode, scenarioResults, view, accounts, monthCount])

  const handleCellClick = useCallback((rowId: string, colIndex: number, currentValue: number) => {
    if (view !== 'pl') return
    const row = baselineRows.find(r => r.id === rowId)
    if (!row || row.type !== 'account') return
    setEditingCell({ row: rowId, col: colIndex })
    setEditValue(String(Math.round(currentValue / 100)))
  }, [view, baselineRows])

  const handleCellBlur = useCallback(() => {
    if (!editingCell || !onCellEdit) { setEditingCell(null); return }
    const n = parseFloat(editValue.replace(/[^0-9.-]/g, ''))
    if (!isNaN(n)) onCellEdit(editingCell.row, editingCell.col, Math.round(n * 100))
    setEditingCell(null)
  }, [editingCell, editValue, onCellEdit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCellBlur()
    else if (e.key === 'Escape') setEditingCell(null)
  }, [handleCellBlur])

  // Drivers tab — derived KPIs from engine result
  if (view === 'drivers') {
    return (
      <DriversView
        forecastMonths={forecastMonths}
        engineResult={engineResult}
        fullHeight={fullHeight}
        accounts={accounts}
        companyId={companyId}
        onCreateFormula={onCreateFormula}
      />
    )
  }

  // Comparison mode: show a clean summary table — totals per row, delta vs baseline
  if (compareMode && scenarioRowMaps && scenarioRowMaps.length > 0) {
    const colors = ['#2563EB', '#059669', '#D97706', '#DC2626']

    return (
      <div className={cn('overflow-x-auto', fullHeight ? 'h-full' : 'rounded-md border border-[#E2E8F0]')}>
        <table className="fin-table w-full min-w-[600px] border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white pl-4 pr-2 text-left after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[#E2E8F0]">
                Account
              </th>
              <th className="border-r border-[#E2E8F0] px-3 text-right">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Baseline</span>
              </th>
              {scenarioRowMaps.map(({ scenario }, idx) => (
                <React.Fragment key={scenario.id}>
                  <th className="px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: colors[idx % colors.length] }}>
                        {scenario.name}
                      </span>
                    </div>
                  </th>
                  <th className={cn('px-3 text-right', idx < scenarioRowMaps.length - 1 && 'border-r border-[#E2E8F0]')}>
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Δ vs Base</span>
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {baselineRows.map(baseRow => {
              return (
                <tr key={baseRow.id} className={cn(
                  baseRow.type === 'header' && 'bg-[#F8FAFC]',
                  baseRow.type === 'subtotal' && 'bg-[#F8FAFC]',
                  baseRow.type === 'total' && 'border-t-2 border-[#0F172A] bg-[#F1F5F9]',
                  baseRow.type === 'account' && 'hover-row'
                )}>
                  <td className={cn(
                    'sticky left-0 z-10 whitespace-nowrap py-2 pl-4 pr-3',
                    'after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[#E2E8F0]',
                    baseRow.type === 'header' ? 'bg-[#F8FAFC]' :
                    baseRow.type === 'total' ? 'bg-[#F1F5F9]' :
                    baseRow.type === 'subtotal' ? 'bg-[#F8FAFC]' : 'bg-white',
                  )}>
                    <span className={cn(
                      baseRow.type === 'header' && 'label-xs',
                      baseRow.type === 'subtotal' && 'text-sm font-semibold text-[#334155]',
                      baseRow.type === 'total' && 'text-sm font-bold text-[#0F172A]',
                      baseRow.type === 'account' && 'text-sm text-[#334155]'
                    )} style={{ paddingLeft: (baseRow.indent ?? 0) * 16 }}>
                      {baseRow.name}
                    </span>
                  </td>

                  {/* Baseline total */}
                  <td className={cn(
                    'border-r border-[#E2E8F0] px-3 py-2 text-right tabular-nums',
                    baseRow.type === 'total' && 'font-bold text-[#0F172A]',
                    baseRow.type === 'subtotal' && 'font-semibold text-[#334155]',
                    baseRow.total < 0 && 'text-[#DC2626]',
                  )}>
                    {baseRow.type !== 'header' ? formatNum(baseRow.total) : null}
                  </td>

                  {/* Scenario totals + deltas */}
                  {scenarioRowMaps.map(({ map }, idx) => {
                    const scenarioRow = map[baseRow.id]
                    const scenarioTotal = scenarioRow?.total ?? baseRow.total
                    const delta = scenarioTotal - baseRow.total
                    const deltaPct = baseRow.total !== 0 ? (delta / Math.abs(baseRow.total)) * 100 : 0

                    return (
                      <React.Fragment key={`scenario-${idx}`}>
                        <td className={cn(
                          'px-3 py-2 text-right tabular-nums',
                          baseRow.type === 'total' && 'font-bold text-[#0F172A]',
                          baseRow.type === 'subtotal' && 'font-semibold text-[#334155]',
                          scenarioTotal < 0 && 'text-[#DC2626]',
                        )}>
                          {baseRow.type !== 'header' ? formatNum(scenarioTotal) : null}
                        </td>
                        <td className={cn(
                          'px-3 py-2 text-right tabular-nums',
                          idx < scenarioRowMaps.length - 1 && 'border-r border-[#E2E8F0]'
                        )}>
                          {baseRow.type !== 'header' && delta !== 0 ? (
                            <div className="flex flex-col items-end">
                              <span className={cn(
                                'text-xs font-semibold',
                                delta > 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                              )}>
                                {delta > 0 ? '+' : ''}{formatNum(delta)}
                              </span>
                              {Math.abs(deltaPct) < 1000 && (
                                <span className={cn(
                                  'text-[10px]',
                                  delta > 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                                )}>
                                  {delta > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          ) : baseRow.type !== 'header' ? (
                            <span className="text-[#CBD5E1]">—</span>
                          ) : null}
                        </td>
                      </React.Fragment>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const rows = baselineRows

  // ── Virtualized main table ────────────────────────────────────────────────
  // Virtualizes the row loop so only visible rows are in the DOM.
  // Fixes the "4GB RAM Lenovo freeze" for large COAs (500+ accounts × 36 months).
  const scrollRef = useRef<HTMLDivElement>(null)
  const ROW_HEIGHT = 36 // px — matches py-1.5 + font-size

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // render 10 extra rows above/below viewport
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0
  const paddingBottom = virtualRows.length > 0
    ? totalHeight - (virtualRows[virtualRows.length - 1]?.end ?? 0)
    : 0

  return (
    <div
      ref={scrollRef}
      className={cn('overflow-auto', fullHeight ? 'h-full' : 'max-h-[600px] rounded-md border border-[#E2E8F0]')}
    >
      <table className="fin-table w-full min-w-[800px] border-collapse">
        <thead className="sticky top-0 z-20 bg-white">
          <tr>
            <th className="sticky left-0 z-10 bg-white pl-4 pr-2 text-left after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[#E2E8F0]">Account</th>
            {forecastMonths.map((month, monthIdx) => {
              const period = periodKeys[monthIdx]
              const isLocked = lockedSet.has(period)
              const isLocking = lockingPeriod === period
              return (
                <th key={month} className={cn('group/header px-2 relative', isLocked && 'bg-[#F8FAFC]')}>
                  <div className="flex items-center justify-center gap-1">
                    {isLocked && <Lock className="h-3 w-3 text-[#94A3B8]" />}
                    <span>{month}</span>
                    {onToggleLock && (
                      <button
                        onClick={() => handleToggleLock(month)}
                        disabled={isLocking}
                        className="absolute right-1 top-1 opacity-0 group-hover/header:opacity-100 rounded p-0.5 text-[#94A3B8] hover:text-[#475569] transition-opacity disabled:opacity-50"
                        title={isLocked ? 'Unlock period' : 'Lock as actual'}
                      >
                        {isLocking ? (
                          <div className="h-3 w-3 animate-spin rounded-full border border-[#94A3B8] border-t-transparent" />
                        ) : isLocked ? (
                          <Unlock className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </th>
              )
            })}
            <th className="px-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {/* Top spacer — keeps scroll position correct for off-screen rows above */}
          {paddingTop > 0 && (
            <tr style={{ height: paddingTop }}>
              <td colSpan={forecastMonths.length + 2} />
            </tr>
          )}

          {virtualRows.map(virtualRow => {
            const row = rows[virtualRow.index]
            if (!row) return null
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={cn(
                  row.type === 'header' && 'bg-[#F8FAFC]',
                  row.type === 'subtotal' && 'bg-[#F8FAFC]',
                  row.type === 'total' && 'border-t border-[#0F172A] bg-[#F1F5F9]',
                  row.type === 'account' && 'hover-row'
                )}
              >
                <td className={cn(
                  'sticky left-0 z-10 whitespace-nowrap py-1.5 pl-4 pr-2',
                  'after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[#E2E8F0]',
                  row.type === 'header' ? 'bg-[#F8FAFC]' :
                  row.type === 'total' ? 'bg-[#F1F5F9]' :
                  row.type === 'subtotal' ? 'bg-[#F8FAFC]' : 'bg-white',
                )}>
                  {row.type === 'account' && view === 'pl' ? (
                    <div className="flex items-center gap-1.5 group/name" style={{ paddingLeft: (row.indent ?? 0) * 16 }}>
                      <span className="text-[#334155]">{row.name}</span>
                      {valueRules?.[row.id] && (() => {
                        const badge = ruleTypeBadge[valueRules[row.id].type]
                        return badge ? (
                          <span className={cn('rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]', badge.color)}>
                            {badge.label}
                          </span>
                        ) : null
                      })()}
                      {timingProfiles?.[row.id] && (
                        <span className="rounded border border-[#BFDBFE] bg-[#EFF6FF] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#2563EB]">
                          {timingProfiles[row.id].month_0 === 1 ? 'Imm' : `${Math.round((timingProfiles[row.id].month_0 ?? 0) * 100)}d`}
                        </span>
                      )}
                      {onAccountClick && (
                        <button
                          onClick={e => { e.stopPropagation(); onAccountClick(row.id) }}
                          className="ml-auto opacity-0 group-hover/name:opacity-100 rounded p-0.5 text-[#94A3B8] hover:text-[#475569] transition-opacity"
                          title="Configure forecast method"
                        >
                          <Settings2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className={cn(
                      row.type === 'header' && 'label-xs',
                      row.type === 'subtotal' && 'font-semibold text-[#334155]',
                      row.type === 'total' && 'font-bold text-[#0F172A]',
                      row.type === 'account' && 'text-[#334155]'
                    )} style={{ paddingLeft: (row.indent ?? 0) * 16 }}>
                      {row.name}
                    </span>
                  )}
                </td>

                {row.values.map((value, colIndex) => {
                  const isEditing = editingCell?.row === row.id && editingCell?.col === colIndex
                  const isVariance = view === 'variance'
                  const isLocked = lockedSet.has(periodKeys[colIndex])
                  return (
                    <td key={colIndex} className={cn(
                      'px-2 py-1.5',
                      row.type === 'account' && view === 'pl' && 'cursor-pointer',
                      row.type === 'total' && 'font-bold text-[#0F172A]',
                      row.type === 'subtotal' && 'font-semibold text-[#334155]',
                      !isVariance && value < 0 && 'text-[#DC2626]',
                      isVariance && value > 0 && 'text-[#059669]',
                      isVariance && value < 0 && 'text-[#DC2626]',
                      isVariance && value === 0 && 'text-[#CBD5E1]',
                      isLocked && 'bg-[#F8FAFC]',
                    )} onClick={() => handleCellClick(row.id, colIndex, value)}>
                      {isEditing ? (
                        <input type="text" aria-label="Edit cell value" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus
                          className="w-20 rounded border border-[#2563EB] bg-white px-1.5 py-0.5 text-right font-num text-sm text-[#0F172A] focus:outline-none" />
                      ) : row.type !== 'header' ? formatNum(value) : null}
                    </td>
                  )
                })}

                <td className={cn(
                  'px-3 py-1.5',
                  row.type === 'total' && 'font-bold text-[#0F172A]',
                  row.type === 'subtotal' && 'font-semibold text-[#334155]',
                  view !== 'variance' && row.total < 0 && 'text-[#DC2626]',
                  view === 'variance' && row.total > 0 && 'text-[#059669]',
                  view === 'variance' && row.total < 0 && 'text-[#DC2626]',
                )}>
                  {row.type !== 'header' ? formatNum(row.total) : null}
                </td>
              </tr>
            )
          })}

          {/* Bottom spacer — keeps scroll position correct for off-screen rows below */}
          {paddingBottom > 0 && (
            <tr style={{ height: paddingBottom }}>
              <td colSpan={forecastMonths.length + 2} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
