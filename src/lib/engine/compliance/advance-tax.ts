/**
 * Advance Tax Forecast
 *
 * FIX audit3 C5: Loss months now included in annual profit calculation.
 * Previously: each month had Math.max(0, ...)  which zeroed losses → overstated annual profit.
 * Now: sum ALL months (including losses), THEN apply Math.max(0, total).
 */
import { multiplyByPct } from '../../utils/math'
import { ComplianceMonthAdjustment, createZeroAdjustment } from './types'

interface AdvanceTaxForecastInput {
  periods: string[]
  projectedProfitBeforeTax: number[] // can be negative for loss months
  taxRatePct?: number
}

export interface AdvanceTaxInstallment {
  dueDate: string
  paymentPeriod: string
  installmentPct: number
  requiredCumulative: number
  installmentAmount: number
}

export interface AdvanceTaxForecastResult {
  annualProjectedProfitBeforeTax: number
  annualEstimatedTax: number
  installments: AdvanceTaxInstallment[]
  adjustments: ComplianceMonthAdjustment[]
}

const ADVANCE_TAX_SCHEDULE = new Map<number, { day: number; cumulativePct: number }>([
  [6, { day: 15, cumulativePct: 15 }],
  [9, { day: 15, cumulativePct: 45 }],
  [12, { day: 15, cumulativePct: 75 }],
  [3, { day: 15, cumulativePct: 100 }],
])

// FIX audit3 A2: Advance tax is only payable if total liability exceeds ₹10,000
const MINIMUM_ADVANCE_TAX_THRESHOLD = 1_000_000 // ₹10,000 in paise

export function calculateAdvanceTaxForecast({
  periods,
  projectedProfitBeforeTax,
  taxRatePct = 25,
}: AdvanceTaxForecastInput): AdvanceTaxForecastResult {
  const adjustments = periods.map((period) => createZeroAdjustment(period))

  // FIX audit3 C5: Sum ALL months including losses, THEN max(0)
  const annualProjectedProfitBeforeTax = projectedProfitBeforeTax.reduce(
    (sum, profit) => sum + profit,
    0
  )
  const annualEstimatedTax = Math.max(0, multiplyByPct(annualProjectedProfitBeforeTax, taxRatePct))

  const installments: AdvanceTaxInstallment[] = []
  let cumulativePaid = 0

  // FIX audit3 A2: Skip advance tax if below minimum threshold
  if (annualEstimatedTax < MINIMUM_ADVANCE_TAX_THRESHOLD) {
    return { annualProjectedProfitBeforeTax, annualEstimatedTax, installments, adjustments }
  }

  periods.forEach((period, index) => {
    const [year, month] = period.split('-').map(Number)
    const schedule = ADVANCE_TAX_SCHEDULE.get(month)

    if (!schedule) return

    const requiredCumulative = multiplyByPct(annualEstimatedTax, schedule.cumulativePct)
    const installmentAmount = requiredCumulative - cumulativePaid
    cumulativePaid = requiredCumulative

    adjustments[index].advanceTaxAssetDelta += installmentAmount
    adjustments[index].advanceTaxPaid += installmentAmount

    installments.push({
      dueDate: `${year}-${String(month).padStart(2, '0')}-${String(schedule.day).padStart(2, '0')}`,
      paymentPeriod: period,
      installmentPct: schedule.cumulativePct,
      requiredCumulative,
      installmentAmount,
    })
  })

  return {
    annualProjectedProfitBeforeTax,
    annualEstimatedTax,
    installments,
    adjustments,
  }
}
