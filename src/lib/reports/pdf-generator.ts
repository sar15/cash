/**
 * PDF Report Generator — CashFlowIQ
 * Uses jsPDF for layout + Indian number formatting
 * Server-safe: no DOM/canvas dependencies (pure data tables)
 */
import type { EngineResult } from '@/lib/engine'
import type { Account } from '@/stores/accounts-store'
import type { GSTForecastMonth } from '@/lib/engine/compliance/gst'
import { nowIST } from '@/lib/utils/ist'
import { isCOGSAccount } from '@/lib/standards/account-classifier'

export interface ReportParams {
  companyName: string
  companyLogo?: string
  periodStart: string
  periodEnd: string
  engineResult: EngineResult
  accounts: Account[]
  includeWaterfall?: boolean
  includeScenarios?: boolean
  notes?: {
    pl?: string
    bs?: string
    cf?: string
  }
}

function formatPaise(paise: number): string {
  const rupees = paise / 100
  const abs = Math.abs(rupees)
  let f: string
  if (abs >= 10_000_000) f = `${(rupees / 10_000_000).toFixed(1)}Cr`
  else if (abs >= 100_000) f = `${(rupees / 100_000).toFixed(1)}L`
  else if (abs >= 1_000) f = `${(rupees / 1_000).toFixed(1)}K`
  else f = rupees.toFixed(0)
  return paise < 0 ? `(${f.replace('-', '')})` : `${f}`
}

function monthLabel(period: string): string {
  const d = new Date(period)
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export async function generatePDFReport(params: ReportParams): Promise<Buffer> {
  // Dynamic import — jspdf is a large lib, only load when needed
  const { jsPDF } = await import('jspdf')
  const { engineResult, accounts, companyName, periodStart, periodEnd } = params

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const colW = 18
  const labelW = 52

  const forecastMonths = engineResult.forecastMonths ?? []
  const integration = engineResult.integrationResults ?? []
  const forecasts = engineResult.accountForecasts ?? {}

  // ── Helpers ──────────────────────────────────────────────
  let y = 0

  function newPage() {
    doc.addPage()
    y = margin
    drawPageHeader()
  }

  function checkPageBreak(needed = 8) {
    if (y + needed > pageH - 10) newPage()
  }

  function drawPageHeader() {
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(companyName, margin, 8)
    doc.text(`Generated ${nowIST().toLocaleDateString('en-IN')}`, W - margin, 8, { align: 'right' })
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, 10, W - margin, 10)
  }

  function sectionHeader(title: string) {
    checkPageBreak(12)
    doc.setFillColor(248, 250, 252)
    doc.rect(margin, y, W - margin * 2, 7, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(title, margin + 2, y + 5)
    y += 9
  }

  function tableHeader(months: string[]) {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('Account', margin + 2, y + 4)
    months.forEach((m, i) => {
      doc.text(m, margin + labelW + i * colW + colW, y + 4, { align: 'right' })
    })
    doc.text('Total', W - margin - 2, y + 4, { align: 'right' })
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, y + 6, W - margin, y + 6)
    y += 8
  }

  function dataRow(
    label: string,
    values: number[],
    total: number,
    opts: { bold?: boolean; indent?: number; bg?: [number, number, number] } = {}
  ) {
    checkPageBreak(7)
    if (opts.bg) {
      doc.setFillColor(...opts.bg)
      doc.rect(margin, y, W - margin * 2, 6.5, 'F')
    }
    doc.setFontSize(7)
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setTextColor(opts.bold ? 15 : 51, opts.bold ? 23 : 65, opts.bold ? 42 : 85)
    const indent = (opts.indent ?? 0) * 4
    doc.text(label, margin + 2 + indent, y + 4.5)
    values.forEach((v, i) => {
      const color = v < 0 ? [220, 38, 38] : [51, 65, 85]
      doc.setTextColor(color[0], color[1], color[2])
      doc.text(formatPaise(v), margin + labelW + i * colW + colW, y + 4.5, { align: 'right' })
    })
    const tc = total < 0 ? [220, 38, 38] : [15, 23, 42]
    doc.setTextColor(tc[0], tc[1], tc[2])
    doc.text(formatPaise(total), W - margin - 2, y + 4.5, { align: 'right' })
    y += 7
  }

  function divider() {
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, y, W - margin, y)
    y += 3
  }

  function renderNotesBox(notes: string, y: number): number {
    // Estimate height needed for the notes box
    const lineHeight = 4
    const lines = notes.split('\n')
    const estimatedHeight = Math.max(20, lines.length * lineHeight + 16)
    const remainingSpace = pageH - y - 10

    // Start new page if insufficient space
    if (remainingSpace < estimatedHeight) {
      newPage()
      y = margin + 12
    }

    // Render gray box background
    doc.setFillColor(248, 250, 252)
    doc.rect(margin, y, W - margin * 2, estimatedHeight, 'F')

    // Render "Financial Commentary" header
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('Financial Commentary', margin + 4, y + 6)

    // Render notes text
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    const textLines = doc.splitTextToSize(notes, W - margin * 2 - 8)
    doc.text(textLines, margin + 4, y + 12)

    return y + estimatedHeight + 10
  }

  // ── Cover Page ───────────────────────────────────────────
  doc.setFillColor(5, 150, 105)
  doc.rect(0, 0, W, 40, 'F')
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Financial Report', margin, 22)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(companyName, margin, 32)

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  y = 55
  doc.setFont('helvetica', 'bold')
  doc.text('Report Period', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${periodStart} to ${periodEnd}`, margin, y + 7)

  // Key metrics summary on cover
  if (integration.length > 0) {
    const lastMonth = integration[integration.length - 1]
    const totalRevenue = integration.reduce((s, m) => s + (m?.pl?.revenueFromOps ?? m?.pl?.revenue ?? 0), 0)
    const totalPAT = integration.reduce((s, m) => s + (m?.pl?.profitAfterTax ?? m?.pl?.netIncome ?? 0), 0)
    const closingCash = lastMonth?.bs?.cash ?? 0

    y = 80
    const metrics = [
      { label: 'Revenue from Operations', value: formatPaise(totalRevenue) },
      { label: 'PAT', value: formatPaise(totalPAT) },
      { label: 'Closing Cash', value: formatPaise(closingCash) },
      { label: 'Forecast Months', value: String(forecastMonths.length) },
    ]

    doc.setFontSize(8)
    metrics.forEach((m, i) => {
      const x = margin + (i % 2) * 130
      const my = y + Math.floor(i / 2) * 20
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(x, my, 120, 16, 2, 2, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(m.label, x + 4, my + 6)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.setFontSize(10)
      doc.text(m.value, x + 4, my + 13)
      doc.setFontSize(8)
    })
  }

  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('Generated by CashFlowIQ · cashflowiq.in', margin, pageH - 8)
  doc.text(nowIST().toISOString(), W - margin, pageH - 8, { align: 'right' })

  // ── P&L Page ─────────────────────────────────────────────
  doc.addPage()
  y = margin
  drawPageHeader()
  y = 16

  sectionHeader('Profit & Loss Statement (Schedule III)')
  tableHeader(forecastMonths)

  const cogsAccounts = accounts.filter(a => isCOGSAccount(a)).sort((a, b) => a.sortOrder - b.sortOrder)
  const opexAccounts = accounts.filter(a => a.accountType === 'expense' && !isCOGSAccount(a)).sort((a, b) => a.sortOrder - b.sortOrder)

  const empty = () => Array(forecastMonths.length).fill(0)
  const sum = (vals: number[]) => vals.reduce((s, v) => s + v, 0)

  // Extract Schedule III fields from engine results
  const engineRevenue = integration.map(m => m?.pl?.revenueFromOps ?? m?.pl?.revenue ?? 0)
  const engineOtherInc = integration.map(m => m?.pl?.otherIncome ?? 0)
  const engineTotalRev = integration.map(m => m?.pl?.totalRevenue ?? (m?.pl?.revenue ?? 0))
  const engineTotalExp = integration.map(m => m?.pl?.totalExpenses ?? (m?.pl?.cogs ?? 0) + (m?.pl?.expense ?? 0))
  const enginePBT = integration.map(m => m?.pl?.profitBeforeTax ?? m?.pl?.netIncome ?? 0)
  const engineTaxExp = integration.map(m => m?.pl?.taxExpense ?? 0)
  const enginePAT = integration.map(m => m?.pl?.profitAfterTax ?? m?.pl?.netIncome ?? 0)

  // I. Revenue from Operations
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('I. REVENUE FROM OPERATIONS', margin + 2, y + 4); y += 7
  dataRow('Total Revenue from Operations', engineRevenue, sum(engineRevenue), { bold: true, bg: [241, 245, 249] })
  divider()

  // II. Other Income
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('II. OTHER INCOME', margin + 2, y + 4); y += 7
  dataRow('Total Other Income', engineOtherInc, sum(engineOtherInc), { bold: true, bg: [241, 245, 249] })
  divider()

  // III. Total Revenue
  dataRow('III. Total Revenue (I + II)', engineTotalRev, sum(engineTotalRev), { bold: true, bg: [236, 253, 245] })
  divider()

  // IV. Expenses
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('IV. EXPENSES', margin + 2, y + 4); y += 7
  
  // (a)+(b) COGS
  const cogsTotals = empty()
  cogsAccounts.forEach(acc => {
    const vals = forecasts[acc.id] ?? empty()
    vals.forEach((v: number, i: number) => { cogsTotals[i] += v })
  })
  if (cogsTotals.some(v => v !== 0)) {
    dataRow('(a)+(b) Cost of Materials / Purchases', cogsTotals, sum(cogsTotals), { indent: 1 })
  }

  // (d) Employee Benefits
  const empTotals = empty()
  opexAccounts.filter(a => a.standardMapping === 'SM_EXP_EMPLOYEE_BENEFITS').forEach(acc => {
    const vals = forecasts[acc.id] ?? empty()
    vals.forEach((v: number, i: number) => { empTotals[i] += v })
  })
  if (empTotals.some(v => v !== 0)) {
    dataRow('(d) Employee Benefits Expense', empTotals, sum(empTotals), { indent: 1 })
  }

  // (e) Finance Costs
  const finTotals = empty()
  opexAccounts.filter(a => a.standardMapping === 'SM_EXP_FINANCE_COSTS').forEach(acc => {
    const vals = forecasts[acc.id] ?? empty()
    vals.forEach((v: number, i: number) => { finTotals[i] += v })
  })
  if (finTotals.some(v => v !== 0)) {
    dataRow('(e) Finance Costs', finTotals, sum(finTotals), { indent: 1 })
  }

  // (f) Depreciation & Amortisation
  const depTotals = empty()
  opexAccounts.filter(a => a.standardMapping === 'SM_EXP_DEPRECIATION' || a.standardMapping === 'SM_EXP_AMORTISATION').forEach(acc => {
    const vals = forecasts[acc.id] ?? empty()
    vals.forEach((v: number, i: number) => { depTotals[i] += v })
  })
  if (depTotals.some(v => v !== 0)) {
    dataRow('(f) Depreciation & Amortisation', depTotals, sum(depTotals), { indent: 1 })
  }

  // (g) Other Expenses
  const otherExpTotals = empty()
  opexAccounts.filter(a => 
    a.standardMapping !== 'SM_EXP_EMPLOYEE_BENEFITS' && 
    a.standardMapping !== 'SM_EXP_FINANCE_COSTS' &&
    a.standardMapping !== 'SM_EXP_DEPRECIATION' && 
    a.standardMapping !== 'SM_EXP_AMORTISATION' &&
    a.standardMapping !== 'SM_EXP_EXCEPTIONAL'
  ).forEach(acc => {
    const vals = forecasts[acc.id] ?? empty()
    vals.forEach((v: number, i: number) => { otherExpTotals[i] += v })
  })
  if (otherExpTotals.some(v => v !== 0)) {
    dataRow('(g) Other Expenses', otherExpTotals, sum(otherExpTotals), { indent: 1 })
  }

  // V. Total Expenses
  dataRow('V. Total Expenses', engineTotalExp, sum(engineTotalExp), { bold: true, bg: [241, 245, 249] })
  divider()

  // VI. Profit Before Exceptional Items & Tax
  const pbe = engineTotalRev.map((v, i) => v - engineTotalExp[i])
  dataRow('VI. Profit Before Exceptional Items & Tax', pbe, sum(pbe), { bold: true, bg: [236, 253, 245] })

  // VII. Exceptional Items (if any)
  const exceptTotals = empty()
  opexAccounts.filter(a => a.standardMapping === 'SM_EXP_EXCEPTIONAL').forEach(acc => {
    const vals = forecasts[acc.id] ?? empty()
    vals.forEach((v: number, i: number) => { exceptTotals[i] += v })
  })
  if (exceptTotals.some(v => v !== 0)) {
    dataRow('VII. Exceptional Items', exceptTotals, sum(exceptTotals), { indent: 0 })
  }

  // VIII. Profit Before Tax
  dataRow('VIII. Profit Before Tax', enginePBT, sum(enginePBT), { bold: true, bg: [236, 253, 245] })

  // IX. Tax Expense (if any)
  if (engineTaxExp.some(v => v !== 0)) {
    dataRow('IX. Tax Expense', engineTaxExp, sum(engineTaxExp), { indent: 1 })
  }

  // X. Profit After Tax (PAT)
  dataRow('X. Profit After Tax (PAT)', enginePAT, sum(enginePAT), { bold: true, bg: [236, 253, 245] })

  // Financial Commentary for P&L (if notes exist)
  if (params.notes?.pl) {
    y = renderNotesBox(params.notes.pl, y)
  }

  // ── Cash Flow Page ───────────────────────────────────────
  newPage()
  sectionHeader('Cash Flow Statement (AS 3 — Indirect Method)')
  tableHeader(forecastMonths)

  const cfExtract = (key: string) => integration.map((m) => ((m as unknown as Record<string, Record<string, number>>)?.cf?.[key] ?? 0))
  const cfIndirect = (key: string) => integration.map((m) => ((m as unknown as Record<string, Record<string, Record<string, number>>>)?.cf?.operatingIndirect?.[key] ?? 0))

  // Opening Cash
  const openCash = cfExtract('openingCash')
  dataRow('Opening Cash Balance', openCash, openCash[openCash.length - 1] ?? 0, { bold: true, bg: [241, 245, 249] })
  divider()

  // A. Operating Activities
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('A. CASH FLOW FROM OPERATING ACTIVITIES', margin + 2, y + 4); y += 7
  const pbt = cfIndirect('profitBeforeTax'); dataRow('Net Profit Before Tax', pbt, sum(pbt), { indent: 1 })
  const dep = cfIndirect('addDepreciation')
  if (dep.some(v => v !== 0)) dataRow('Add: Depreciation', dep, sum(dep), { indent: 1 })
  const amort = cfIndirect('addAmortisation')
  if (amort.some(v => v !== 0)) dataRow('Add: Amortisation', amort, sum(amort), { indent: 1 })
  const finCosts = cfIndirect('addFinanceCosts')
  if (finCosts.some(v => v !== 0)) dataRow('Add: Finance Costs', finCosts, sum(finCosts), { indent: 1 })
  const otherInc = cfIndirect('lessOtherIncome')
  if (otherInc.some(v => v !== 0)) dataRow('Less: Other Income', otherInc, sum(otherInc), { indent: 1 })
  const chgInv = cfIndirect('changeInInventories')
  if (chgInv.some(v => v !== 0)) dataRow('(Inc)/Dec in Inventories', chgInv, sum(chgInv), { indent: 1 })
  const ar = cfIndirect('changeInTradeReceivables'); dataRow('(Inc)/Dec in Trade Receivables', ar, sum(ar), { indent: 1 })
  const ap = cfIndirect('changeInTradePayables'); dataRow('Inc/(Dec) in Trade Payables', ap, sum(ap), { indent: 1 })
  const cashFromOps = cfIndirect('cashFromOperations')
  dataRow('Cash Generated from Operations', cashFromOps, sum(cashFromOps), { bold: true, bg: [241, 245, 249] })
  const taxPaid = cfIndirect('lessIncomeTaxPaid')
  if (taxPaid.some(v => v !== 0)) dataRow('Less: Income Tax Paid', taxPaid, sum(taxPaid), { indent: 1 })
  const ocf = cfExtract('netOperatingCF'); dataRow('A. Net Cash from Operating Activities', ocf, sum(ocf), { bold: true, bg: [236, 253, 245] })
  divider()

  // B. Investing Activities
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('B. CASH FLOW FROM INVESTING ACTIVITIES', margin + 2, y + 4); y += 7
  const capex = cfExtract('purchaseOfPPE')
  if (capex.some(v => v !== 0)) dataRow('Purchase of PPE', capex, sum(capex), { indent: 1 })
  const intCapex = cfExtract('purchaseOfIntangibles')
  if (intCapex.some(v => v !== 0)) dataRow('Purchase of Intangibles', intCapex, sum(intCapex), { indent: 1 })
  const assetSale = cfExtract('proceedsFromAssetSale')
  if (assetSale.some(v => v !== 0)) dataRow('Proceeds from Sale of Assets', assetSale, sum(assetSale), { indent: 1 })
  const icf = cfExtract('netInvestingCF'); dataRow('B. Net Cash from Investing Activities', icf, sum(icf), { bold: true, bg: [236, 253, 245] })
  divider()

  // C. Financing Activities
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('C. CASH FLOW FROM FINANCING ACTIVITIES', margin + 2, y + 4); y += 7
  const borrow = cfExtract('proceedsFromBorrowings')
  if (borrow.some(v => v !== 0)) dataRow('Proceeds from Borrowings', borrow, sum(borrow), { indent: 1 })
  const repay = cfExtract('repaymentOfBorrowings')
  if (repay.some(v => v !== 0)) dataRow('Repayment of Borrowings', repay, sum(repay), { indent: 1 })
  const finPaid = cfExtract('financeCostsPaid')
  if (finPaid.some(v => v !== 0)) dataRow('Finance Costs Paid', finPaid, sum(finPaid), { indent: 1 })
  const divPaid = cfExtract('dividendsPaid')
  if (divPaid.some(v => v !== 0)) dataRow('Dividends Paid', divPaid, sum(divPaid), { indent: 1 })
  const shareIssue = cfExtract('proceedsFromShareIssue')
  if (shareIssue.some(v => v !== 0)) dataRow('Proceeds from Issue of Shares', shareIssue, sum(shareIssue), { indent: 1 })
  const fcf = cfExtract('netFinancingCF'); dataRow('C. Net Cash from Financing Activities', fcf, sum(fcf), { bold: true, bg: [236, 253, 245] })
  divider()

  // Net Change & Closing
  const netCF = cfExtract('netCashFlow'); dataRow('Net Increase/(Decrease) in Cash (A+B+C)', netCF, sum(netCF), { bold: true, bg: [236, 253, 245] })
  const closeCash = cfExtract('closingCash'); dataRow('Closing Cash & Cash Equivalents', closeCash, closeCash[closeCash.length - 1] ?? 0, { bold: true, bg: [236, 253, 245] })

  // Financial Commentary for CF (if notes exist)
  if (params.notes?.cf) {
    y = renderNotesBox(params.notes.cf, y)
  }

  // ── Balance Sheet Page ───────────────────────────────────
  newPage()
  sectionHeader('Balance Sheet (Schedule III — End of Period)')
  tableHeader(forecastMonths)

  const bsExtract = (key: string) => integration.map((m) => ((m as unknown as Record<string, Record<string, number>>)?.bs?.[key] ?? 0))

  // ── EQUITY & LIABILITIES ──────────────────────────────────
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('EQUITY & LIABILITIES', margin + 2, y + 4); y += 7

  // Shareholders' Funds
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text("Shareholders' Funds", margin + 2, y + 4); y += 7
  const shareCap = bsExtract('shareCapital'); dataRow('Share Capital', shareCap, shareCap[shareCap.length - 1] ?? 0, { indent: 1 })
  const secPrem = bsExtract('securitiesPremium')
  if (secPrem.some(v => v !== 0)) dataRow('Securities Premium Reserve', secPrem, secPrem[secPrem.length - 1] ?? 0, { indent: 1 })
  const genRes = bsExtract('generalReserve')
  if (genRes.some(v => v !== 0)) dataRow('General Reserve', genRes, genRes[genRes.length - 1] ?? 0, { indent: 1 })
  const re = bsExtract('retainedEarnings'); dataRow('Retained Earnings (P&L Balance)', re, re[re.length - 1] ?? 0, { indent: 1 })
  const totalEq = bsExtract('totalShareholdersEquity'); dataRow("Total Shareholders' Funds", totalEq, totalEq[totalEq.length - 1] ?? 0, { bold: true, bg: [241, 245, 249] })
  divider()

  // Non-Current Liabilities
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('Non-Current Liabilities', margin + 2, y + 4); y += 7
  const ltBorrow = bsExtract('ltBorrowings')
  if (ltBorrow.some(v => v !== 0)) dataRow('Long-term Borrowings', ltBorrow, ltBorrow[ltBorrow.length - 1] ?? 0, { indent: 1 })
  const totalNCL = bsExtract('totalNonCurrentLiabilities'); dataRow('Total Non-Current Liabilities', totalNCL, totalNCL[totalNCL.length - 1] ?? 0, { bold: true, bg: [241, 245, 249] })
  divider()

  // Current Liabilities
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('Current Liabilities', margin + 2, y + 4); y += 7
  const stBorrow = bsExtract('stBorrowings')
  if (stBorrow.some(v => v !== 0)) dataRow('Short-term Borrowings', stBorrow, stBorrow[stBorrow.length - 1] ?? 0, { indent: 1 })
  const apVals = bsExtract('ap'); dataRow('Trade Payables', apVals, apVals[apVals.length - 1] ?? 0, { indent: 1 })
  const otherCL = bsExtract('otherCurrentLiabilities')
  if (otherCL.some(v => v !== 0)) dataRow('Other Current Liabilities', otherCL, otherCL[otherCL.length - 1] ?? 0, { indent: 1 })
  const stProv = bsExtract('stProvisions')
  if (stProv.some(v => v !== 0)) dataRow('Short-term Provisions', stProv, stProv[stProv.length - 1] ?? 0, { indent: 1 })
  const totalCL = bsExtract('totalCurrentLiabilities'); dataRow('Total Current Liabilities', totalCL, totalCL[totalCL.length - 1] ?? 0, { bold: true, bg: [241, 245, 249] })
  divider()

  // Total Equity & Liabilities
  const totalEqLiab = totalEq.map((v, i) => v + (totalNCL[i] ?? 0) + (totalCL[i] ?? 0))
  dataRow('Total Equity & Liabilities', totalEqLiab, totalEqLiab[totalEqLiab.length - 1] ?? 0, { bold: true, bg: [236, 253, 245] })
  divider()

  // ── ASSETS ────────────────────────────────────────────────
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('ASSETS', margin + 2, y + 4); y += 7

  // Non-Current Assets
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('Non-Current Assets', margin + 2, y + 4); y += 7
  const netPPE = bsExtract('netPPE'); dataRow('Property, Plant & Equipment (Net)', netPPE, netPPE[netPPE.length - 1] ?? 0, { indent: 1 })
  const netIntang = bsExtract('netIntangibles')
  if (netIntang.some(v => v !== 0)) dataRow('Intangible Assets (Net)', netIntang, netIntang[netIntang.length - 1] ?? 0, { indent: 1 })
  const totalNCA = bsExtract('totalNonCurrentAssets'); dataRow('Total Non-Current Assets', totalNCA, totalNCA[totalNCA.length - 1] ?? 0, { bold: true, bg: [241, 245, 249] })
  divider()

  // Current Assets
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('Current Assets', margin + 2, y + 4); y += 7
  const inv = bsExtract('inventories')
  if (inv.some(v => v !== 0)) dataRow('Inventories', inv, inv[inv.length - 1] ?? 0, { indent: 1 })
  const tradeRec = bsExtract('tradeReceivables'); dataRow('Trade Receivables', tradeRec, tradeRec[tradeRec.length - 1] ?? 0, { indent: 1 })
  const stLoans = bsExtract('stLoansAdvances')
  if (stLoans.some(v => v !== 0)) dataRow('Short-term Loans & Advances', stLoans, stLoans[stLoans.length - 1] ?? 0, { indent: 1 })
  const otherCA = bsExtract('otherCurrentAssets')
  if (otherCA.some(v => v !== 0)) dataRow('Other Current Assets', otherCA, otherCA[otherCA.length - 1] ?? 0, { indent: 1 })
  const cash = bsExtract('cash'); dataRow('Cash & Cash Equivalents', cash, cash[cash.length - 1] ?? 0, { indent: 1 })
  const totalCA = bsExtract('totalCurrentAssets'); dataRow('Total Current Assets', totalCA, totalCA[totalCA.length - 1] ?? 0, { bold: true, bg: [241, 245, 249] })
  divider()

  // Total Assets
  const totalAssets = bsExtract('totalAssets'); dataRow('Total Assets', totalAssets, totalAssets[totalAssets.length - 1] ?? 0, { bold: true, bg: [236, 253, 245] })

  // Financial Commentary for BS (if notes exist)
  if (params.notes?.bs) {
    y = renderNotesBox(params.notes.bs, y)
  }

  // ── Compliance Summary Page ──────────────────────────────
  const compliance = engineResult.compliance
  if (compliance?.gst?.months?.length) {
    newPage()
    sectionHeader('GST Compliance Summary')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    const cols = ['Period', 'Output GST', 'Input Tax Credit', 'Net Payable', 'Due Date']
    const cw = [30, 35, 40, 35, 35]
    let cx = margin + 2
    cols.forEach((c, i) => { doc.text(c, cx, y + 4); cx += cw[i] })
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, y + 6, W - margin, y + 6)
    y += 9

    compliance.gst.months.slice(0, 12).forEach((m: GSTForecastMonth) => {
      checkPageBreak(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(51, 65, 85)
      doc.setFontSize(7)
      let cx2 = margin + 2
      const dueDate = new Date(m.period)
      dueDate.setMonth(dueDate.getMonth() + 1)
      dueDate.setDate(20)
      const row = [
        monthLabel(m.period),
        formatPaise(m.outputGST ?? 0),
        formatPaise(m.creditUsed ?? 0),
        formatPaise(m.netPayable ?? 0),
        dueDate.toLocaleDateString('en-IN'),
      ]
      row.forEach((v, i) => { doc.text(v, cx2, y + 4); cx2 += cw[i] })
      y += 7
    })
  }

  // Footer on last page
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('Generated by CashFlowIQ · cashflowiq.in', margin, pageH - 8)
  doc.text(nowIST().toISOString(), W - margin, pageH - 8, { align: 'right' })

  return Buffer.from(doc.output('arraybuffer'))
}
