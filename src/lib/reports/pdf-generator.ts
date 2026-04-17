/**
 * PDF Report Generator — CashFlowIQ
 * Uses jsPDF for layout + Indian number formatting
 * Server-safe: no DOM/canvas dependencies (pure data tables)
 */
import type { EngineResult } from '@/lib/engine'
import type { Account } from '@/stores/accounts-store'
import type { GSTForecastMonth } from '@/lib/engine/compliance/gst'
import { nowIST } from '@/lib/utils/ist'

export interface ReportParams {
  companyName: string
  companyLogo?: string
  periodStart: string
  periodEnd: string
  engineResult: EngineResult
  accounts: Account[]
  includeWaterfall?: boolean
  includeScenarios?: boolean
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
    const totalRevenue = integration.reduce((s, m) => s + (m?.pl?.revenue ?? 0), 0)
    const totalNetIncome = integration.reduce((s, m) => s + (m?.pl?.netIncome ?? 0), 0)
    const closingCash = lastMonth?.bs?.cash ?? 0

    y = 80
    const metrics = [
      { label: 'Total Revenue', value: formatPaise(totalRevenue) },
      { label: 'Net Income', value: formatPaise(totalNetIncome) },
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

  sectionHeader('Profit & Loss Statement')
  tableHeader(forecastMonths)

  const revenueAccounts = accounts.filter(a => a.accountType === 'revenue').sort((a, b) => a.sortOrder - b.sortOrder)
  const cogsAccounts = accounts.filter(a => a.accountType === 'expense' && (a.standardMapping?.startsWith('cogs') ?? false)).sort((a, b) => a.sortOrder - b.sortOrder)
  const opexAccounts = accounts.filter(a => a.accountType === 'expense' && !(a.standardMapping?.startsWith('cogs') ?? false)).sort((a, b) => a.sortOrder - b.sortOrder)

  const empty = () => Array(forecastMonths.length).fill(0)
  const sum = (vals: number[]) => vals.reduce((s, v) => s + v, 0)

  // Revenue
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('REVENUE', margin + 2, y + 4); y += 7
  const revTotals = empty()
  revenueAccounts.forEach(acc => {
    const vals = forecasts[acc.id] ?? empty()
    vals.forEach((v: number, i: number) => { revTotals[i] += v })
    dataRow(acc.name, vals, sum(vals), { indent: 1 })
  })
  dataRow('Total Revenue', revTotals, sum(revTotals), { bold: true, bg: [241, 245, 249] })
  divider()

  // COGS
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('COST OF GOODS SOLD', margin + 2, y + 4); y += 7
  const cogsTotals = empty()
  cogsAccounts.forEach(acc => {
    const vals = forecasts[acc.id] ?? empty()
    vals.forEach((v: number, i: number) => { cogsTotals[i] += v })
    dataRow(acc.name, vals, sum(vals), { indent: 1 })
  })
  dataRow('Total COGS', cogsTotals, sum(cogsTotals), { bold: true, bg: [241, 245, 249] })

  const grossProfit = revTotals.map((r, i) => r - cogsTotals[i])
  dataRow('Gross Profit', grossProfit, sum(grossProfit), { bold: true, bg: [236, 253, 245] })
  divider()

  // OpEx
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('OPERATING EXPENSES', margin + 2, y + 4); y += 7
  const opexTotals = empty()
  opexAccounts.forEach(acc => {
    const vals = forecasts[acc.id] ?? empty()
    vals.forEach((v: number, i: number) => { opexTotals[i] += v })
    dataRow(acc.name, vals, sum(vals), { indent: 1 })
  })
  dataRow('Total OpEx', opexTotals, sum(opexTotals), { bold: true, bg: [241, 245, 249] })

  const netIncome = grossProfit.map((g, i) => g - opexTotals[i])
  dataRow('Net Income', netIncome, sum(netIncome), { bold: true, bg: [236, 253, 245] })

  // ── Cash Flow Page ───────────────────────────────────────
  newPage()
  sectionHeader('Cash Flow Statement')
  tableHeader(forecastMonths)

  const cfExtract = (key: string) => integration.map((m) => ((m as unknown as Record<string, Record<string, number>>)?.cf?.[key] ?? 0))
  const cfIndirect = (key: string) => integration.map((m) => ((m as unknown as Record<string, Record<string, Record<string, number>>>)?.cf?.indirect?.[key] ?? 0))

  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('OPERATING ACTIVITIES', margin + 2, y + 4); y += 7
  const ni = cfIndirect('netIncome'); dataRow('Net Income', ni, sum(ni), { indent: 1 })
  const dep = cfIndirect('depreciation'); dataRow('Add: Depreciation', dep, sum(dep), { indent: 1 })
  const ar = cfIndirect('changeInAR'); dataRow('(Inc)/Dec in Receivables', ar, sum(ar), { indent: 1 })
  const ap = cfIndirect('changeInAP'); dataRow('Inc/(Dec) in Payables', ap, sum(ap), { indent: 1 })
  const ocf = cfExtract('operatingCashFlow'); dataRow('Net Cash from Operations', ocf, sum(ocf), { bold: true, bg: [241, 245, 249] })
  divider()

  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('INVESTING ACTIVITIES', margin + 2, y + 4); y += 7
  const icf = cfExtract('investingCashFlow'); dataRow('Net Cash from Investing', icf, sum(icf), { bold: true, bg: [241, 245, 249] })
  divider()

  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('FINANCING ACTIVITIES', margin + 2, y + 4); y += 7
  const fcf = cfExtract('financingCashFlow'); dataRow('Net Cash from Financing', fcf, sum(fcf), { bold: true, bg: [241, 245, 249] })
  divider()

  const netCF = cfExtract('netCashFlow'); dataRow('Net Change in Cash', netCF, sum(netCF), { bold: true, bg: [236, 253, 245] })

  // ── Balance Sheet Page ───────────────────────────────────
  newPage()
  sectionHeader('Balance Sheet (End of Period)')
  tableHeader(forecastMonths)

  const bsExtract = (key: string) => integration.map((m) => ((m as unknown as Record<string, Record<string, number>>)?.bs?.[key] ?? 0))

  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('ASSETS', margin + 2, y + 4); y += 7
  const cash = bsExtract('cash'); dataRow('Cash & Bank', cash, cash[cash.length - 1] ?? 0, { indent: 1 })
  const arVals = bsExtract('ar'); dataRow('Accounts Receivable', arVals, arVals[arVals.length - 1] ?? 0, { indent: 1 })
  const fa = bsExtract('fixedAssets'); dataRow('Fixed Assets', fa, fa[fa.length - 1] ?? 0, { indent: 1 })
  const totalAssets = bsExtract('totalAssets'); dataRow('Total Assets', totalAssets, totalAssets[totalAssets.length - 1] ?? 0, { bold: true, bg: [241, 245, 249] })
  divider()

  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('LIABILITIES', margin + 2, y + 4); y += 7
  const apVals = bsExtract('ap'); dataRow('Accounts Payable', apVals, apVals[apVals.length - 1] ?? 0, { indent: 1 })
  const debt = bsExtract('debt'); dataRow('Debt', debt, debt[debt.length - 1] ?? 0, { indent: 1 })
  const totalLiab = bsExtract('totalLiabilities'); dataRow('Total Liabilities', totalLiab, totalLiab[totalLiab.length - 1] ?? 0, { bold: true, bg: [241, 245, 249] })
  divider()

  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('EQUITY', margin + 2, y + 4); y += 7
  const eq = bsExtract('equity'); dataRow('Share Capital', eq, eq[eq.length - 1] ?? 0, { indent: 1 })
  const re = bsExtract('retainedEarnings'); dataRow('Retained Earnings', re, re[re.length - 1] ?? 0, { indent: 1 })
  const totalEq = bsExtract('totalEquity'); dataRow('Total Equity', totalEq, totalEq[totalEq.length - 1] ?? 0, { bold: true, bg: [236, 253, 245] })

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
