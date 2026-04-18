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
import { isCOGSAccount } from '@/lib/standards/account-classifier'
import {
  SM_REV_OTHER_INTEREST,
  SM_REV_OTHER_DIVIDEND,
  SM_REV_OTHER_MISC,
  SM_EXP_EMPLOYEE_BENEFITS,
  SM_EXP_FINANCE_COSTS,
  SM_EXP_DEPRECIATION,
  SM_EXP_AMORTISATION,
  SM_EXP_EXCEPTIONAL,
} from '@/lib/standards/standard-mappings'

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

// ─────────────────────────────────────────────────────────────────────────────
// Schedule III P&L Builder
// ─────────────────────────────────────────────────────────────────────────────

function buildPLRows(
  accounts: Account[],
  engineResult: EngineResult | null,
  monthCount: number
): GridRow[] {
  const rows: GridRow[] = []
  const forecasts = engineResult?.accountForecasts ?? {}
  const raw = engineResult?.rawIntegrationResults ?? []
  const empty = (): number[] => Array(monthCount).fill(0)

  // Engine totals from rawIntegrationResults — these INCLUDE micro-forecast overlays
  // (hire salary, asset depreciation, loan interest) that don't appear in accountForecasts
  const engineRevenue   = raw.map(m => m?.pl?.revenueFromOps ?? m?.pl?.revenue ?? 0)
  const engineOtherInc  = raw.map(m => m?.pl?.otherIncome ?? 0)
  const engineTotalRev  = raw.map(m => m?.pl?.totalRevenue ?? (m?.pl?.revenue ?? 0))
  const engineTotalExp  = raw.map(m => m?.pl?.totalExpenses ?? (m?.pl?.cogs ?? 0) + (m?.pl?.expense ?? 0))
  const enginePBT       = raw.map(m => m?.pl?.profitBeforeTax ?? m?.pl?.netIncome ?? 0)
  const engineTaxExp    = raw.map(m => m?.pl?.taxExpense ?? 0)
  const enginePAT       = raw.map(m => m?.pl?.profitAfterTax ?? m?.pl?.netIncome ?? 0)
  const engineDep       = raw.map(m => (m?.pl?.depreciation ?? 0) + (m?.pl?.amortisation ?? 0))

  const sumAccounts = (filter: (a: Account) => boolean): number[] => {
    const totals = empty()
    accounts.filter((a) => filter(a) && !a.isGroup).sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((acc) => {
        const vals = forecasts[acc.id] ?? empty()
        vals.forEach((v: number, i: number) => { totals[i] += v })
      })
    return totals
  }

  const addAccountRows = (filter: (a: Account) => boolean): number[] => {
    const totals = empty()
    accounts.filter((a) => filter(a) && !a.isGroup).sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((acc) => {
        const vals = forecasts[acc.id] ?? empty()
        vals.forEach((v: number, i: number) => { totals[i] += v })
        rows.push({ id: acc.id, name: acc.name, type: 'account', values: vals, total: vals.reduce((s: number, v: number) => s + v, 0), indent: 1 })
      })
    return totals
  }

  const OTHER_INCOME_SM = new Set<string>([SM_REV_OTHER_INTEREST, SM_REV_OTHER_DIVIDEND, SM_REV_OTHER_MISC])
  const isOtherIncome = (a: Account) => a.accountType === 'revenue' && !!a.standardMapping && OTHER_INCOME_SM.has(a.standardMapping)
  const isRevFromOps  = (a: Account) => a.accountType === 'revenue' && !isOtherIncome(a)

  // I. Revenue from Operations — account rows + engine total (includes micro-forecast revenue)
  rows.push({ id: 'header-rev-ops', name: 'I. Revenue from Operations', type: 'header', values: empty(), total: 0 })
  addAccountRows(isRevFromOps)
  // Use engine total so micro-forecast revenue events are included
  rows.push({ id: 'rev-ops-total', name: 'Total Revenue from Operations', type: 'subtotal', values: engineRevenue, total: engineRevenue.reduce((s, v) => s + v, 0) })

  // II. Other Income
  rows.push({ id: 'header-other-income', name: 'II. Other Income', type: 'header', values: empty(), total: 0 })
  addAccountRows(isOtherIncome)
  rows.push({ id: 'other-income-total', name: 'Total Other Income', type: 'subtotal', values: engineOtherInc, total: engineOtherInc.reduce((s, v) => s + v, 0) })

  // III. Total Revenue — always from engine (includes all micro-forecast impacts)
  rows.push({ id: 'total-revenue', name: 'III. Total Revenue (I + II)', type: 'total', values: engineTotalRev, total: engineTotalRev.reduce((s, v) => s + v, 0) })

  // IV. Expenses — account rows for breakdown, engine totals for summary lines
  rows.push({ id: 'header-expenses', name: 'IV. Expenses', type: 'header', values: empty(), total: 0 })

  const cogsTotals = sumAccounts(isCOGSAccount)
  if (cogsTotals.some((v) => v !== 0)) rows.push({ id: 'exp-cogs', name: '(a)+(b) Cost of Materials / Purchases', type: 'account', values: cogsTotals, total: cogsTotals.reduce((s, v) => s + v, 0), indent: 1 })

  const empTotals = sumAccounts((a) => a.accountType === 'expense' && a.standardMapping === SM_EXP_EMPLOYEE_BENEFITS)
  if (empTotals.some((v) => v !== 0)) rows.push({ id: 'exp-employee', name: '(d) Employee Benefits Expense', type: 'account', values: empTotals, total: empTotals.reduce((s, v) => s + v, 0), indent: 1 })

  const finTotals = sumAccounts((a) => a.accountType === 'expense' && a.standardMapping === SM_EXP_FINANCE_COSTS)
  if (finTotals.some((v) => v !== 0)) rows.push({ id: 'exp-finance', name: '(e) Finance Costs', type: 'account', values: finTotals, total: finTotals.reduce((s, v) => s + v, 0), indent: 1 })

  // Depreciation — use engine values (includes asset micro-forecast depreciation)
  const depAcct = sumAccounts((a) => a.accountType === 'expense' && (a.standardMapping === SM_EXP_DEPRECIATION || a.standardMapping === SM_EXP_AMORTISATION))
  const depFinal = depAcct.some((v) => v !== 0) ? depAcct : engineDep
  if (depFinal.some((v) => v !== 0)) rows.push({ id: 'exp-dep', name: '(f) Depreciation & Amortisation', type: 'account', values: depFinal, total: depFinal.reduce((s, v) => s + v, 0), indent: 1 })

  const otherExpTotals = sumAccounts((a) =>
    a.accountType === 'expense' && !isCOGSAccount(a) &&
    a.standardMapping !== SM_EXP_EMPLOYEE_BENEFITS && a.standardMapping !== SM_EXP_FINANCE_COSTS &&
    a.standardMapping !== SM_EXP_DEPRECIATION && a.standardMapping !== SM_EXP_AMORTISATION &&
    a.standardMapping !== SM_EXP_EXCEPTIONAL
  )
  if (otherExpTotals.some((v) => v !== 0)) rows.push({ id: 'exp-other', name: '(g) Other Expenses', type: 'account', values: otherExpTotals, total: otherExpTotals.reduce((s, v) => s + v, 0), indent: 1 })

  // V. Total Expenses — from engine (includes hire salary, loan interest, asset depreciation)
  rows.push({ id: 'total-expenses', name: 'V. Total Expenses', type: 'subtotal', values: engineTotalExp, total: engineTotalExp.reduce((s, v) => s + v, 0) })

  // VI. Profit Before Exceptional Items & Tax — from engine
  const exceptTotals = sumAccounts((a) => a.accountType === 'expense' && a.standardMapping === SM_EXP_EXCEPTIONAL)
  const pbe = engineTotalRev.map((v, i) => v - engineTotalExp[i])
  rows.push({ id: 'profit-before-exceptional', name: 'VI. Profit Before Exceptional Items & Tax', type: 'total', values: pbe, total: pbe.reduce((s, v) => s + v, 0) })

  if (exceptTotals.some((v) => v !== 0)) rows.push({ id: 'exceptional', name: 'VII. Exceptional Items', type: 'account', values: exceptTotals, total: exceptTotals.reduce((s, v) => s + v, 0), indent: 0 })

  // VIII. Profit Before Tax — from engine
  rows.push({ id: 'profit-before-tax', name: 'VIII. Profit Before Tax', type: 'total', values: enginePBT, total: enginePBT.reduce((s, v) => s + v, 0) })

  // IX. Tax Expense
  if (engineTaxExp.some((v) => v !== 0)) rows.push({ id: 'tax-expense', name: 'IX. Tax Expense', type: 'account', values: engineTaxExp, total: engineTaxExp.reduce((s, v) => s + v, 0), indent: 1 })

  // X. Profit After Tax — from engine
  rows.push({ id: 'profit-after-tax', name: 'X. Profit After Tax (PAT)', type: 'total', values: enginePAT, total: enginePAT.reduce((s, v) => s + v, 0) })

  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule III Balance Sheet Builder
// ─────────────────────────────────────────────────────────────────────────────

function buildBSRows(engineResult: EngineResult | null, monthCount: number): GridRow[] {
  const rows: GridRow[] = []
  const raw = engineResult?.rawIntegrationResults ?? []
  const integration = engineResult?.integrationResults ?? []
  const empty = (): number[] => Array(monthCount).fill(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractRaw = (key: string) => raw.map((m: any) => m?.bs?.[key] ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractAdj = (key: string) => integration.map((m: any) => m?.bs?.[key] ?? 0)

  const hdr  = (id: string, name: string) => rows.push({ id, name, type: 'header', values: empty(), total: 0 })
  const acct = (id: string, name: string, vals: number[], indent = 1) => rows.push({ id, name, type: 'account', values: vals, total: vals[vals.length - 1] ?? 0, indent })
  const sub  = (id: string, name: string, vals: number[]) => rows.push({ id, name, type: 'subtotal', values: vals, total: vals[vals.length - 1] ?? 0 })
  const tot  = (id: string, name: string, vals: number[]) => rows.push({ id, name, type: 'total', values: vals, total: vals[vals.length - 1] ?? 0 })

  // ── EQUITY & LIABILITIES ──────────────────────────────────────────────────
  hdr('header-equity-liab', 'EQUITY & LIABILITIES')

  hdr('header-equity', "Shareholders' Funds")
  acct('bs-share-capital', 'Share Capital', extractRaw('shareCapital'))
  const secPrem = extractRaw('securitiesPremium')
  if (secPrem.some((v) => v !== 0)) acct('bs-sec-prem', 'Securities Premium Reserve', secPrem)
  const genRes = extractRaw('generalReserve')
  if (genRes.some((v) => v !== 0)) acct('bs-gen-res', 'General Reserve', genRes)
  acct('bs-retained', 'Retained Earnings (P&L Balance)', extractRaw('retainedEarnings'))
  sub('bs-total-equity', "Total Shareholders' Funds", extractRaw('totalShareholdersEquity'))

  hdr('header-nc-liab', 'Non-Current Liabilities')
  const ltBorrow = extractRaw('ltBorrowings')
  if (ltBorrow.some((v) => v !== 0)) acct('bs-lt-borrow', 'Long-term Borrowings', ltBorrow)
  sub('bs-total-nc-liab', 'Total Non-Current Liabilities', extractRaw('totalNonCurrentLiabilities'))

  hdr('header-curr-liab', 'Current Liabilities')
  const stBorrow = extractRaw('stBorrowings')
  if (stBorrow.some((v) => v !== 0)) acct('bs-st-borrow', 'Short-term Borrowings', stBorrow)
  acct('bs-trade-pay', 'Trade Payables', extractRaw('ap'))
  const gstPay = extractAdj('gstPayable')
  if (gstPay.some((v) => v !== 0)) acct('bs-gst-pay', 'GST Payable', gstPay)
  const tdsPay = extractAdj('tdsPayable')
  if (tdsPay.some((v) => v !== 0)) acct('bs-tds-pay', 'TDS Payable', tdsPay)
  const otherCL = extractRaw('otherCurrentLiabilities')
  if (otherCL.some((v) => v !== 0)) acct('bs-other-cl', 'Other Current Liabilities', otherCL)
  const stProv = extractRaw('stProvisions')
  if (stProv.some((v) => v !== 0)) acct('bs-st-prov', 'Short-term Provisions', stProv)
  sub('bs-total-curr-liab', 'Total Current Liabilities', extractRaw('totalCurrentLiabilities'))

  const totalEqLiab = extractRaw('totalShareholdersEquity').map((v, i) =>
    v + (extractRaw('totalNonCurrentLiabilities')[i] ?? 0) + (extractRaw('totalCurrentLiabilities')[i] ?? 0)
  )
  tot('bs-total-eq-liab', 'Total Equity & Liabilities', totalEqLiab)

  // ── ASSETS ────────────────────────────────────────────────────────────────
  hdr('header-assets', 'ASSETS')

  hdr('header-nc-assets', 'Non-Current Assets')
  acct('bs-net-ppe', 'Property, Plant & Equipment (Net)', extractRaw('netPPE'))
  const netIntang = extractRaw('netIntangibles')
  if (netIntang.some((v) => v !== 0)) acct('bs-net-intang', 'Intangible Assets (Net)', netIntang)
  sub('bs-total-nca', 'Total Non-Current Assets', extractRaw('totalNonCurrentAssets'))

  hdr('header-curr-assets', 'Current Assets')
  const inv = extractRaw('inventories')
  if (inv.some((v) => v !== 0)) acct('bs-inv', 'Inventories', inv)
  acct('bs-trade-rec', 'Trade Receivables', extractRaw('tradeReceivables'))
  const gstRec = extractAdj('gstReceivable')
  if (gstRec.some((v) => v !== 0)) acct('bs-gst-rec', 'GST Receivable (ITC)', gstRec)
  const stLoans = extractRaw('stLoansAdvances')
  if (stLoans.some((v) => v !== 0)) acct('bs-st-loans', 'Short-term Loans & Advances', stLoans)
  const otherCA = extractRaw('otherCurrentAssets')
  if (otherCA.some((v) => v !== 0)) acct('bs-other-ca', 'Other Current Assets', otherCA)
  acct('bs-cash', 'Cash & Cash Equivalents', extractRaw('cash'))
  sub('bs-total-ca', 'Total Current Assets', extractRaw('totalCurrentAssets'))

  tot('bs-total-assets', 'Total Assets', extractRaw('totalAssets'))

  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// AS 3 Cash Flow Builder (Indirect Method)
// ─────────────────────────────────────────────────────────────────────────────

function buildCFRows(engineResult: EngineResult | null, monthCount: number): GridRow[] {
  const rows: GridRow[] = []
  const raw = engineResult?.rawIntegrationResults ?? []
  const integration = engineResult?.integrationResults ?? []
  const empty = (): number[] => Array(monthCount).fill(0)

  const extractRaw = (path: string): number[] => {
    const keys = path.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return raw.map((m: any) => {
      let v: unknown = m
      for (const k of keys) v = (v as Record<string, unknown>)?.[k]
      return typeof v === 'number' ? v : 0
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractAdj = (key: string): number[] => integration.map((m: any) => m?.cf?.[key] ?? 0)

  const hdr  = (id: string, name: string) => rows.push({ id, name, type: 'header', values: empty(), total: 0 })
  const acct = (id: string, name: string, vals: number[], indent = 1) => rows.push({ id, name, type: 'account', values: vals, total: vals.reduce((s, v) => s + v, 0), indent })
  const sub  = (id: string, name: string, vals: number[]) => rows.push({ id, name, type: 'subtotal', values: vals, total: vals.reduce((s, v) => s + v, 0) })
  const tot  = (id: string, name: string, vals: number[]) => rows.push({ id, name, type: 'total', values: vals, total: vals.reduce((s, v) => s + v, 0) })

  // Opening Cash
  sub('cf-opening', 'Opening Cash Balance', extractRaw('cf.openingCash'))

  // A. Operating Activities
  hdr('header-ocf', 'A. Cash Flow from Operating Activities')
  acct('cf-pbt', 'Net Profit Before Tax', extractRaw('cf.operatingIndirect.profitBeforeTax'))
  const dep = extractRaw('cf.operatingIndirect.addDepreciation')
  if (dep.some((v) => v !== 0)) acct('cf-dep', 'Add: Depreciation', dep)
  const amort = extractRaw('cf.operatingIndirect.addAmortisation')
  if (amort.some((v) => v !== 0)) acct('cf-amort', 'Add: Amortisation', amort)
  const finCosts = extractRaw('cf.operatingIndirect.addFinanceCosts')
  if (finCosts.some((v) => v !== 0)) acct('cf-fin-costs', 'Add: Finance Costs', finCosts)
  const otherInc = extractRaw('cf.operatingIndirect.lessOtherIncome')
  if (otherInc.some((v) => v !== 0)) acct('cf-other-inc', 'Less: Other Income', otherInc)
  const chgInv = extractRaw('cf.operatingIndirect.changeInInventories')
  if (chgInv.some((v) => v !== 0)) acct('cf-inv', '(Increase)/Decrease in Inventories', chgInv)
  acct('cf-ar', '(Increase)/Decrease in Trade Receivables', extractRaw('cf.operatingIndirect.changeInTradeReceivables'))
  const chgSTL = extractRaw('cf.operatingIndirect.changeInSTLoansAdvances')
  if (chgSTL.some((v) => v !== 0)) acct('cf-st-loans', '(Increase)/Decrease in Loans & Advances', chgSTL)
  const chgOCA = extractRaw('cf.operatingIndirect.changeInOtherCurrentAssets')
  if (chgOCA.some((v) => v !== 0)) acct('cf-other-ca', '(Increase)/Decrease in Other Current Assets', chgOCA)
  acct('cf-ap', 'Increase/(Decrease) in Trade Payables', extractRaw('cf.operatingIndirect.changeInTradePayables'))
  const chgOCL = extractRaw('cf.operatingIndirect.changeInOtherCurrentLiabilities')
  if (chgOCL.some((v) => v !== 0)) acct('cf-other-cl', 'Increase/(Decrease) in Other Current Liabilities', chgOCL)
  const gstPaid = extractAdj('gstPaid')
  if (gstPaid.some((v) => v !== 0)) acct('cf-gst', 'GST Paid', gstPaid.map((v) => -Math.abs(v)))
  const tdsPaid = extractAdj('tdsPaid')
  if (tdsPaid.some((v) => v !== 0)) acct('cf-tds', 'TDS Paid', tdsPaid.map((v) => -Math.abs(v)))
  sub('cf-cash-from-ops', 'Cash Generated from Operations', extractRaw('cf.operatingIndirect.cashFromOperations'))
  const taxPaid = extractRaw('cf.operatingIndirect.lessIncomeTaxPaid')
  if (taxPaid.some((v) => v !== 0)) acct('cf-tax-paid', 'Less: Income Tax Paid', taxPaid)
  tot('cf-net-ocf', 'A. Net Cash from Operating Activities', extractRaw('cf.netOperatingCF'))

  // B. Investing Activities
  hdr('header-icf', 'B. Cash Flow from Investing Activities')
  const capex = extractRaw('cf.purchaseOfPPE')
  if (capex.some((v) => v !== 0)) acct('cf-capex', 'Purchase of PPE', capex)
  const intCapex = extractRaw('cf.purchaseOfIntangibles')
  if (intCapex.some((v) => v !== 0)) acct('cf-int-capex', 'Purchase of Intangibles', intCapex)
  const assetSale = extractRaw('cf.proceedsFromAssetSale')
  if (assetSale.some((v) => v !== 0)) acct('cf-asset-sale', 'Proceeds from Sale of Assets', assetSale)
  tot('cf-net-icf', 'B. Net Cash from Investing Activities', extractRaw('cf.netInvestingCF'))

  // C. Financing Activities
  hdr('header-fcf', 'C. Cash Flow from Financing Activities')
  const borrow = extractRaw('cf.proceedsFromBorrowings')
  if (borrow.some((v) => v !== 0)) acct('cf-borrow', 'Proceeds from Borrowings', borrow)
  const repay = extractRaw('cf.repaymentOfBorrowings')
  if (repay.some((v) => v !== 0)) acct('cf-repay', 'Repayment of Borrowings', repay)
  const finPaid = extractRaw('cf.financeCostsPaid')
  if (finPaid.some((v) => v !== 0)) acct('cf-fin-paid', 'Finance Costs Paid', finPaid)
  const divPaid = extractRaw('cf.dividendsPaid')
  if (divPaid.some((v) => v !== 0)) acct('cf-div', 'Dividends Paid', divPaid)
  const shareIssue = extractRaw('cf.proceedsFromShareIssue')
  if (shareIssue.some((v) => v !== 0)) acct('cf-share-issue', 'Proceeds from Issue of Shares', shareIssue)
  tot('cf-net-fcf', 'C. Net Cash from Financing Activities', extractRaw('cf.netFinancingCF'))

  // Net Change & Closing
  tot('cf-net-change', 'Net Increase/(Decrease) in Cash (A+B+C)', extractRaw('cf.netCashFlow'))
  tot('cf-closing', 'Closing Cash & Cash Equivalents', extractRaw('cf.closingCash'))

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
    const raw = engineResult.rawIntegrationResults

    // ── EBITDA = PBT + Finance Costs + Depreciation + Amortisation ───────────
    // Derived from Schedule III fields (Phase 3 migration)
    const ebitda: (number | null)[] = raw.map(m => {
      const pbt = m?.pl?.profitBeforeTax ?? m?.pl?.netIncome ?? 0
      const finCosts = m?.pl?.financeCosts ?? 0
      const dep = m?.pl?.depreciation ?? 0
      const amort = m?.pl?.amortisation ?? 0
      return pbt + finCosts + dep + amort
    })

    // ── EBITDA Margin % = EBITDA / Revenue from Operations ───────────────────
    const ebitdaMarginPct: (number | null)[] = raw.map((m, i) => {
      const revOps = m?.pl?.revenueFromOps ?? m?.pl?.revenue ?? 0
      if (revOps === 0) return null
      const e = ebitda[i]
      if (e === null) return null
      return (e / revOps) * 100
    })

    // ── Gross Margin % = Gross Profit / Revenue from Operations ──────────────
    // Uses revenueFromOps (Schedule III Line I) not total revenue
    const grossMarginPct: (number | null)[] = raw.map(m => {
      const revOps = m?.pl?.revenueFromOps ?? m?.pl?.revenue ?? 0
      if (revOps === 0) return null
      return (m.pl.grossProfit / revOps) * 100
    })

    // ── Net Margin % = PAT / Total Revenue ───────────────────────────────────
    // Uses profitAfterTax (Schedule III Line X) and totalRevenue (Line III)
    const netMarginPct: (number | null)[] = raw.map(m => {
      const totalRev = m?.pl?.totalRevenue ?? m?.pl?.revenue ?? 0
      if (totalRev === 0) return null
      const pat = m?.pl?.profitAfterTax ?? m?.pl?.netIncome ?? 0
      return (pat / totalRev) * 100
    })

    // ── Operating Cash Conversion (OCF / Revenue from Operations) ────────────
    const cashConversion: (number | null)[] = raw.map(m => {
      const revOps = m?.pl?.revenueFromOps ?? m?.pl?.revenue ?? 0
      if (revOps === 0) return null
      const ocf = m?.cf?.netOperatingCF ?? m?.cf?.operatingCashFlow ?? 0
      return (ocf / revOps) * 100
    })

    // ── AR Days (Trade Receivables / Revenue from Ops * 30) ──────────────────
    const arDays: (number | null)[] = raw.map(m => {
      const revOps = m?.pl?.revenueFromOps ?? m?.pl?.revenue ?? 0
      if (revOps === 0) return null
      const ar = m?.bs?.tradeReceivables ?? m?.bs?.ar ?? 0
      return (ar / revOps) * 30
    })

    // ── AP Days (Trade Payables / (COGS + Expense) * 30) ─────────────────────
    const apDays: (number | null)[] = raw.map(m => {
      const costs = m.pl.cogs + m.pl.expense
      if (costs === 0) return null
      const ap = m?.bs?.ap ?? 0
      return (ap / costs) * 30
    })

    // ── Working Capital Days (AR Days - AP Days) ──────────────────────────────
    const wcDays: (number | null)[] = arDays.map((ar, i) => {
      const ap = apDays[i]
      if (ar === null || ap === null) return null
      return ar - ap
    })

    // ── Burn Rate (monthly cash burn when OCF < 0, in rupees) ────────────────
    const burnRate: (number | null)[] = raw.map(m => {
      const ocf = m?.cf?.netOperatingCF ?? m?.cf?.operatingCashFlow ?? 0
      return ocf < 0 ? Math.abs(ocf) / 100 : null
    })

    // ── Revenue Growth MoM % ─────────────────────────────────────────────────
    const revGrowth: (number | null)[] = raw.map((m, i) => {
      if (i === 0) return null
      const prev = raw[i - 1]?.pl?.revenueFromOps ?? raw[i - 1]?.pl?.revenue ?? 0
      if (prev === 0) return null
      const curr = m?.pl?.revenueFromOps ?? m?.pl?.revenue ?? 0
      return ((curr - prev) / prev) * 100
    })

    // ── Expense Ratio (Total Expenses / Total Revenue) ────────────────────────
    const expenseRatio: (number | null)[] = raw.map(m => {
      const totalRev = m?.pl?.totalRevenue ?? m?.pl?.revenue ?? 0
      if (totalRev === 0) return null
      const totalExp = m?.pl?.totalExpenses ?? (m.pl.cogs + m.pl.expense)
      return (totalExp / totalRev) * 100
    })

    return [
      {
        id: 'ebitda-margin',
        label: 'EBITDA Margin',
        sublabel: 'EBITDA / Revenue from Operations',
        values: ebitdaMarginPct,
        format: formatPct,
        tone: (v) => v >= 20 ? 'green' : v >= 10 ? 'neutral' : 'red',
      },
      {
        id: 'gross-margin',
        label: 'Gross Margin',
        sublabel: '(Rev from Ops − COGS) / Rev from Ops',
        values: grossMarginPct,
        format: formatPct,
        tone: (v) => v >= 40 ? 'green' : v >= 20 ? 'neutral' : 'red',
      },
      {
        id: 'net-margin',
        label: 'Net Margin (PAT)',
        sublabel: 'Profit After Tax / Total Revenue',
        values: netMarginPct,
        format: formatPct,
        tone: (v) => v > 0 ? 'green' : 'red',
      },
      {
        id: 'cash-conversion',
        label: 'Cash Conversion',
        sublabel: 'Operating CF / Revenue from Ops',
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
        sublabel: 'Total Expenses / Total Revenue',
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

  // ── Virtualized main table setup ─────────────────────────────────────────
  // Hooks MUST be declared before any early returns (Rules of Hooks).
  // The virtualizer is only active for the main table path — drivers and
  // compareMode render their own non-virtualized tables.
  const scrollRef = useRef<HTMLDivElement>(null)
  const ROW_HEIGHT = 36 // px — matches py-1.5 + font-size
  const rows = baselineRows

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

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
