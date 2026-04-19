/**
 * Annual PDF Generator — Schedule III Compliant
 * Portrait A4, two-column format: Current Year | Prior Year
 * Suitable for ROC filing, bank submissions, and CA review
 */
import type { AnnualStatement } from './annual-aggregator'
import { nowIST } from '@/lib/utils/ist'

export interface AnnualPDFParams {
  companyName: string
  cin?: string | null
  pan?: string | null
  gstin?: string | null
  registeredAddress?: string | null
  currentYear: AnnualStatement
  priorYear: AnnualStatement | null
  priorYearDataSource: 'actuals' | 'mixed' | 'forecast'
  currentPeriodLabel: string
  priorPeriodLabel: string
  fyEndDate: string
  notes?: { pl?: string; bs?: string; cf?: string }
}

/** Format paise to ₹ Lakhs with 2 decimal places — Schedule III standard */
function fmtL(paise: number): string {
  if (paise === 0) return '-'
  const lakhs = paise / 10_000_000
  const abs = Math.abs(lakhs)
  const formatted = abs.toFixed(2)
  return paise < 0 ? `(${formatted})` : formatted
}

export async function generateAnnualPDFReport(params: AnnualPDFParams): Promise<Buffer> {
  const { jsPDF } = await import('jspdf')
  const {
    companyName, cin, pan, gstin, registeredAddress,
    currentYear, priorYear, currentPeriodLabel, priorPeriodLabel,
    fyEndDate, notes,
  } = params

  // Portrait A4
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()   // 210mm
  const H = doc.internal.pageSize.getHeight()  // 297mm
  const margin = 15
  const colLabel = 90   // width of the label column
  const colCurr = 40    // width of current year column
  const colPrior = 40   // width of prior year column
  const xLabel = margin
  const xCurr = margin + colLabel
  const xPrior = margin + colLabel + colCurr

  let y = 0

  // ── Helpers ──────────────────────────────────────────────────────────────

  function newPage() {
    doc.addPage()
    y = margin
    drawRunningHeader()
  }

  function checkBreak(needed = 7) {
    if (y + needed > H - 15) newPage()
  }

  function drawRunningHeader() {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(companyName, margin, 8)
    doc.text(`Annual Financial Statements · ${currentPeriodLabel}`, W - margin, 8, { align: 'right' })
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, 10, W - margin, 10)
    y = 14
  }

  function sectionTitle(title: string) {
    checkBreak(14)
    doc.setFillColor(15, 23, 42)
    doc.rect(margin, y, W - margin * 2, 8, 'F')
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(title, margin + 3, y + 5.5)
    y += 10
  }

  function colHeaders() {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('Particulars', xLabel + 2, y + 4)
    doc.text(`${currentPeriodLabel}`, xCurr + colCurr, y + 4, { align: 'right' })
    if (priorYear) {
      doc.text(`${priorPeriodLabel}`, xPrior + colPrior, y + 4, { align: 'right' })
    }
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y + 6, W - margin, y + 6)
    y += 8
  }

  function unitNote() {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(120, 120, 120)
    doc.text('All figures in ₹ Lakhs unless otherwise stated', margin, y + 4)
    y += 6
  }

  function row(
    label: string,
    curr: number,
    prior: number | null,
    opts: { bold?: boolean; indent?: number; bg?: [number, number, number]; topBorder?: boolean } = {}
  ) {
    checkBreak(7)
    const rowH = 6.5
    if (opts.bg) {
      doc.setFillColor(...opts.bg)
      doc.rect(margin, y, W - margin * 2, rowH, 'F')
    }
    if (opts.topBorder) {
      doc.setDrawColor(15, 23, 42)
      doc.line(margin, y, W - margin, y)
    }
    const indent = (opts.indent ?? 0) * 5
    doc.setFontSize(7.5)
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setTextColor(opts.bold ? 15 : 51, opts.bold ? 23 : 65, opts.bold ? 42 : 85)
    doc.text(label, xLabel + 2 + indent, y + 4.5)

    // Current year value
    const currStr = fmtL(curr)
    doc.setTextColor(curr < 0 ? 220 : (opts.bold ? 15 : 51), curr < 0 ? 38 : (opts.bold ? 23 : 65), curr < 0 ? 38 : (opts.bold ? 42 : 85))
    doc.text(currStr, xCurr + colCurr, y + 4.5, { align: 'right' })

    // Prior year value
    if (priorYear && prior !== null) {
      const priorStr = fmtL(prior)
      doc.setTextColor(prior < 0 ? 220 : 100, prior < 0 ? 38 : 116, prior < 0 ? 38 : 139)
      doc.text(priorStr, xPrior + colPrior, y + 4.5, { align: 'right' })
    }
    y += rowH + 0.5
  }

  function sectionRow(label: string) {
    checkBreak(6)
    doc.setFillColor(248, 250, 252)
    doc.rect(margin, y, W - margin * 2, 5.5, 'F')
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), xLabel + 2, y + 4)
    y += 6
  }

  function divider() {
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, y, W - margin, y)
    y += 2
  }

  function notesBox(text: string) {
    if (!text.trim()) return
    const lines = doc.splitTextToSize(text, W - margin * 2 - 8)
    const boxH = Math.max(16, lines.length * 4 + 12)
    checkBreak(boxH + 4)
    doc.setFillColor(248, 250, 252)
    doc.rect(margin, y, W - margin * 2, boxH, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.rect(margin, y, W - margin * 2, boxH, 'S')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('Financial Commentary', margin + 4, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text(lines, margin + 4, y + 10)
    y += boxH + 4
  }

  // ── COVER PAGE ────────────────────────────────────────────────────────────
  // Green header band
  doc.setFillColor(5, 150, 105)
  doc.rect(0, 0, W, 50, 'F')

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Annual Financial Statements', margin, 22)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`For the year ended ${fyEndDate}`, margin, 32)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName, margin, 44)

  // Company details box
  y = 60
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, y, W - margin * 2, 52, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.rect(margin, y, W - margin * 2, 52, 'S')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('Company Details', margin + 4, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)
  const details = [
    cin ? `CIN: ${cin}` : null,
    pan ? `PAN: ${pan}` : null,
    gstin ? `GSTIN: ${gstin}` : null,
    registeredAddress ? `Registered Address: ${registeredAddress}` : null,
  ].filter(Boolean) as string[]

  details.forEach((d, i) => {
    const lines = doc.splitTextToSize(d, W - margin * 2 - 8)
    doc.text(lines, margin + 4, y + 14 + i * 9)
  })

  // Unit note
  y = 122
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 116, 139)
  doc.text('All figures in ₹ Lakhs unless otherwise stated', margin, y)

  // Prepared by note
  y = 132
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('These are computer-generated forecast financial statements prepared using CashFlowIQ.', margin, y)
  doc.text('They are intended for management review and planning purposes.', margin, y + 5)

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Generated by CashFlowIQ · cashflowiq.in', margin, H - 10)
  doc.text(nowIST().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), W - margin, H - 10, { align: 'right' })

  // ── P&L PAGE ──────────────────────────────────────────────────────────────
  newPage()
  sectionTitle('Statement of Profit & Loss (Schedule III)')
  unitNote()
  colHeaders()

  const pl = currentYear.pl
  const pp = priorYear?.pl ?? null

  row('I. Revenue from Operations', pl.revenueFromOps, pp?.revenueFromOps ?? null, { bold: true })
  row('II. Other Income', pl.otherIncome, pp?.otherIncome ?? null)
  row('III. Total Revenue (I + II)', pl.totalRevenue, pp?.totalRevenue ?? null, { bold: true, bg: [236, 253, 245], topBorder: true })
  divider()

  sectionRow('IV. Expenses')
  if (pl.cogs !== 0 || (pp && pp.cogs !== 0))
    row('(a)+(b) Cost of Materials / Purchases', pl.cogs, pp?.cogs ?? null, { indent: 1 })
  if (pl.employeeBenefits !== 0 || (pp && pp.employeeBenefits !== 0))
    row('(d) Employee Benefits Expense', pl.employeeBenefits, pp?.employeeBenefits ?? null, { indent: 1 })
  if (pl.financeCosts !== 0 || (pp && pp.financeCosts !== 0))
    row('(e) Finance Costs', pl.financeCosts, pp?.financeCosts ?? null, { indent: 1 })
  if ((pl.depreciation + pl.amortisation) !== 0 || (pp && (pp.depreciation + pp.amortisation) !== 0))
    row('(f) Depreciation & Amortisation', pl.depreciation + pl.amortisation, pp ? pp.depreciation + pp.amortisation : null, { indent: 1 })
  if (pl.otherExpenses !== 0 || (pp && pp.otherExpenses !== 0))
    row('(g) Other Expenses', pl.otherExpenses, pp?.otherExpenses ?? null, { indent: 1 })

  row('V. Total Expenses', pl.totalExpenses, pp?.totalExpenses ?? null, { bold: true, bg: [241, 245, 249] })
  divider()
  row('VI. Profit Before Exceptional Items & Tax', pl.profitBeforeExceptional, pp?.profitBeforeExceptional ?? null, { bold: true, bg: [236, 253, 245] })
  if (pl.exceptionalItems !== 0 || (pp && pp.exceptionalItems !== 0))
    row('VII. Exceptional Items', pl.exceptionalItems, pp?.exceptionalItems ?? null)
  row('VIII. Profit Before Tax', pl.profitBeforeTax, pp?.profitBeforeTax ?? null, { bold: true, bg: [236, 253, 245] })
  if (pl.taxExpense !== 0 || (pp && pp.taxExpense !== 0))
    row('IX. Tax Expense', pl.taxExpense, pp?.taxExpense ?? null, { indent: 1 })
  row('X. Profit After Tax (PAT)', pl.profitAfterTax, pp?.profitAfterTax ?? null, { bold: true, bg: [236, 253, 245], topBorder: true })

  if (notes?.pl) notesBox(notes.pl)

  // ── BALANCE SHEET PAGE ────────────────────────────────────────────────────
  newPage()
  sectionTitle('Balance Sheet (Schedule III)')
  unitNote()
  colHeaders()

  const bs = currentYear.bs
  const pb = priorYear?.bs ?? null

  sectionRow('EQUITY & LIABILITIES')
  sectionRow("Shareholders' Funds")
  row('Share Capital', bs.shareCapital, pb?.shareCapital ?? null, { indent: 1 })
  if (bs.securitiesPremium !== 0 || (pb && pb.securitiesPremium !== 0))
    row('Securities Premium Reserve', bs.securitiesPremium, pb?.securitiesPremium ?? null, { indent: 1 })
  if (bs.generalReserve !== 0 || (pb && pb.generalReserve !== 0))
    row('General Reserve', bs.generalReserve, pb?.generalReserve ?? null, { indent: 1 })
  row('Retained Earnings (P&L Balance)', bs.retainedEarnings, pb?.retainedEarnings ?? null, { indent: 1 })
  row("Total Shareholders' Funds", bs.totalShareholdersEquity, pb?.totalShareholdersEquity ?? null, { bold: true, bg: [241, 245, 249] })
  divider()

  sectionRow('Non-Current Liabilities')
  if (bs.ltBorrowings !== 0 || (pb && pb.ltBorrowings !== 0))
    row('Long-term Borrowings', bs.ltBorrowings, pb?.ltBorrowings ?? null, { indent: 1 })
  row('Total Non-Current Liabilities', bs.totalNonCurrentLiabilities, pb?.totalNonCurrentLiabilities ?? null, { bold: true, bg: [241, 245, 249] })
  divider()

  sectionRow('Current Liabilities')
  if (bs.stBorrowings !== 0 || (pb && pb.stBorrowings !== 0))
    row('Short-term Borrowings', bs.stBorrowings, pb?.stBorrowings ?? null, { indent: 1 })
  row('Trade Payables', bs.ap, pb?.ap ?? null, { indent: 1 })
  if (bs.otherCurrentLiabilities !== 0 || (pb && pb.otherCurrentLiabilities !== 0))
    row('Other Current Liabilities', bs.otherCurrentLiabilities, pb?.otherCurrentLiabilities ?? null, { indent: 1 })
  if (bs.stProvisions !== 0 || (pb && pb.stProvisions !== 0))
    row('Short-term Provisions', bs.stProvisions, pb?.stProvisions ?? null, { indent: 1 })
  row('Total Current Liabilities', bs.totalCurrentLiabilities, pb?.totalCurrentLiabilities ?? null, { bold: true, bg: [241, 245, 249] })
  divider()

  const totalEqLiab = bs.totalShareholdersEquity + bs.totalNonCurrentLiabilities + bs.totalCurrentLiabilities
  const priorTotalEqLiab = pb ? pb.totalShareholdersEquity + pb.totalNonCurrentLiabilities + pb.totalCurrentLiabilities : null
  row('Total Equity & Liabilities', totalEqLiab, priorTotalEqLiab, { bold: true, bg: [236, 253, 245], topBorder: true })
  divider()

  sectionRow('ASSETS')
  sectionRow('Non-Current Assets')
  row('Property, Plant & Equipment (Net)', bs.netPPE, pb?.netPPE ?? null, { indent: 1 })
  if (bs.netIntangibles !== 0 || (pb && pb.netIntangibles !== 0))
    row('Intangible Assets (Net)', bs.netIntangibles, pb?.netIntangibles ?? null, { indent: 1 })
  row('Total Non-Current Assets', bs.totalNonCurrentAssets, pb?.totalNonCurrentAssets ?? null, { bold: true, bg: [241, 245, 249] })
  divider()

  sectionRow('Current Assets')
  if (bs.inventories !== 0 || (pb && pb.inventories !== 0))
    row('Inventories', bs.inventories, pb?.inventories ?? null, { indent: 1 })
  row('Trade Receivables', bs.tradeReceivables, pb?.tradeReceivables ?? null, { indent: 1 })
  if (bs.stLoansAdvances !== 0 || (pb && pb.stLoansAdvances !== 0))
    row('Short-term Loans & Advances', bs.stLoansAdvances, pb?.stLoansAdvances ?? null, { indent: 1 })
  if (bs.otherCurrentAssets !== 0 || (pb && pb.otherCurrentAssets !== 0))
    row('Other Current Assets', bs.otherCurrentAssets, pb?.otherCurrentAssets ?? null, { indent: 1 })
  row('Cash & Cash Equivalents', bs.cash, pb?.cash ?? null, { indent: 1 })
  row('Total Current Assets', bs.totalCurrentAssets, pb?.totalCurrentAssets ?? null, { bold: true, bg: [241, 245, 249] })
  divider()
  row('Total Assets', bs.totalAssets, pb?.totalAssets ?? null, { bold: true, bg: [236, 253, 245], topBorder: true })

  if (notes?.bs) notesBox(notes.bs)

  // ── CASH FLOW PAGE ────────────────────────────────────────────────────────
  newPage()
  sectionTitle('Cash Flow Statement (AS 3 — Indirect Method)')
  unitNote()
  colHeaders()

  const cf = currentYear.cf
  const pc = priorYear?.cf ?? null

  row('Opening Cash Balance', cf.openingCash, pc?.openingCash ?? null, { bold: true, bg: [241, 245, 249] })
  divider()

  sectionRow('A. Cash Flow from Operating Activities')
  row('Net Profit Before Tax', cf.operatingIndirect.profitBeforeTax, pc?.operatingIndirect.profitBeforeTax ?? null, { indent: 1 })
  if (cf.operatingIndirect.addDepreciation !== 0 || (pc && pc.operatingIndirect.addDepreciation !== 0))
    row('Add: Depreciation', cf.operatingIndirect.addDepreciation, pc?.operatingIndirect.addDepreciation ?? null, { indent: 1 })
  if (cf.operatingIndirect.addAmortisation !== 0 || (pc && pc.operatingIndirect.addAmortisation !== 0))
    row('Add: Amortisation', cf.operatingIndirect.addAmortisation, pc?.operatingIndirect.addAmortisation ?? null, { indent: 1 })
  if (cf.operatingIndirect.addFinanceCosts !== 0 || (pc && pc.operatingIndirect.addFinanceCosts !== 0))
    row('Add: Finance Costs', cf.operatingIndirect.addFinanceCosts, pc?.operatingIndirect.addFinanceCosts ?? null, { indent: 1 })
  if (cf.operatingIndirect.changeInInventories !== 0 || (pc && pc.operatingIndirect.changeInInventories !== 0))
    row('(Inc)/Dec in Inventories', cf.operatingIndirect.changeInInventories, pc?.operatingIndirect.changeInInventories ?? null, { indent: 1 })
  row('(Inc)/Dec in Trade Receivables', cf.operatingIndirect.changeInTradeReceivables, pc?.operatingIndirect.changeInTradeReceivables ?? null, { indent: 1 })
  row('Inc/(Dec) in Trade Payables', cf.operatingIndirect.changeInTradePayables, pc?.operatingIndirect.changeInTradePayables ?? null, { indent: 1 })
  row('Cash Generated from Operations', cf.operatingIndirect.cashFromOperations, pc?.operatingIndirect.cashFromOperations ?? null, { bold: true, bg: [241, 245, 249] })
  if (cf.operatingIndirect.lessIncomeTaxPaid !== 0 || (pc && pc.operatingIndirect.lessIncomeTaxPaid !== 0))
    row('Less: Income Tax Paid', cf.operatingIndirect.lessIncomeTaxPaid, pc?.operatingIndirect.lessIncomeTaxPaid ?? null, { indent: 1 })
  row('A. Net Cash from Operating Activities', cf.netOperatingCF, pc?.netOperatingCF ?? null, { bold: true, bg: [236, 253, 245] })
  divider()

  sectionRow('B. Cash Flow from Investing Activities')
  if (cf.purchaseOfPPE !== 0 || (pc && pc.purchaseOfPPE !== 0))
    row('Purchase of PPE', cf.purchaseOfPPE, pc?.purchaseOfPPE ?? null, { indent: 1 })
  if (cf.purchaseOfIntangibles !== 0 || (pc && pc.purchaseOfIntangibles !== 0))
    row('Purchase of Intangibles', cf.purchaseOfIntangibles, pc?.purchaseOfIntangibles ?? null, { indent: 1 })
  if (cf.proceedsFromAssetSale !== 0 || (pc && pc.proceedsFromAssetSale !== 0))
    row('Proceeds from Sale of Assets', cf.proceedsFromAssetSale, pc?.proceedsFromAssetSale ?? null, { indent: 1 })
  row('B. Net Cash from Investing Activities', cf.netInvestingCF, pc?.netInvestingCF ?? null, { bold: true, bg: [236, 253, 245] })
  divider()

  sectionRow('C. Cash Flow from Financing Activities')
  if (cf.proceedsFromBorrowings !== 0 || (pc && pc.proceedsFromBorrowings !== 0))
    row('Proceeds from Borrowings', cf.proceedsFromBorrowings, pc?.proceedsFromBorrowings ?? null, { indent: 1 })
  if (cf.repaymentOfBorrowings !== 0 || (pc && pc.repaymentOfBorrowings !== 0))
    row('Repayment of Borrowings', cf.repaymentOfBorrowings, pc?.repaymentOfBorrowings ?? null, { indent: 1 })
  if (cf.financeCostsPaid !== 0 || (pc && pc.financeCostsPaid !== 0))
    row('Finance Costs Paid', cf.financeCostsPaid, pc?.financeCostsPaid ?? null, { indent: 1 })
  if (cf.dividendsPaid !== 0 || (pc && pc.dividendsPaid !== 0))
    row('Dividends Paid', cf.dividendsPaid, pc?.dividendsPaid ?? null, { indent: 1 })
  if (cf.proceedsFromShareIssue !== 0 || (pc && pc.proceedsFromShareIssue !== 0))
    row('Proceeds from Issue of Shares', cf.proceedsFromShareIssue, pc?.proceedsFromShareIssue ?? null, { indent: 1 })
  row('C. Net Cash from Financing Activities', cf.netFinancingCF, pc?.netFinancingCF ?? null, { bold: true, bg: [236, 253, 245] })
  divider()

  row('Net Increase/(Decrease) in Cash (A+B+C)', cf.netCashFlow, pc?.netCashFlow ?? null, { bold: true, bg: [236, 253, 245], topBorder: true })
  row('Closing Cash & Cash Equivalents', cf.closingCash, pc?.closingCash ?? null, { bold: true, bg: [236, 253, 245] })

  if (notes?.cf) notesBox(notes.cf)

  // ── SIGNATURE PAGE ────────────────────────────────────────────────────────
  newPage()
  sectionTitle('Declaration & Signatures')

  y += 6
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)
  doc.text('These financial statements have been prepared on the basis of forecast data generated by CashFlowIQ.', margin, y)
  doc.text('They are intended for management review, planning, and presentation to stakeholders.', margin, y + 5)
  doc.text('They do not constitute audited financial statements under the Companies Act, 2013.', margin, y + 10)
  y += 20

  // Signature blocks
  const sigY = y + 20
  doc.setDrawColor(15, 23, 42)
  doc.line(margin, sigY, margin + 55, sigY)
  doc.line(W - margin - 55, sigY, W - margin, sigY)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('Authorised Signatory', margin, sigY + 5)
  doc.text('Director / CFO', W - margin - 55, sigY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`For ${companyName}`, margin, sigY + 10)
  doc.text(`For ${companyName}`, W - margin - 55, sigY + 10)

  y = sigY + 20
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Place: ___________________________', margin, y)
  doc.text('Date: ___________________________', margin, y + 7)

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Generated by CashFlowIQ · cashflowiq.in', margin, H - 10)
  doc.text(nowIST().toISOString(), W - margin, H - 10, { align: 'right' })

  return Buffer.from(doc.output('arraybuffer'))
}
