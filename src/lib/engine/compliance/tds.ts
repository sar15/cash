/**
 * Salary TDS Forecast
 *
 * FIX audit3 C2: Per-employee TDS calculation.
 * Previously: aggregated all salaries → computed tax on total → massive overstatement
 * Now: accepts per-employee salary data OR falls back to headcount-based estimation
 */
import { buildPeriodIndexMap, getFollowingMonthDueDate, getFollowingMonthPeriod } from './periods'
import { ComplianceMonthAdjustment, createZeroAdjustment } from './types'

interface EmployeeSalaryInput {
  id: string
  monthlyCTC: number // paise per month
}

interface SalaryTDSForecastInput {
  periods: string[]
  projectedGrossSalaries: number[] // aggregate monthly salary
  standardDeduction?: number
  employees?: EmployeeSalaryInput[] // per-employee data for accurate TDS
  estimatedHeadcount?: number // fallback if no employee list
}

export interface SalaryTDSForecastMonth {
  period: string
  grossSalary: number
  salaryTDS: number
  dueDate: string
  paymentPeriod?: string
}

export interface SalaryTDSForecastResult {
  annualGrossSalary: number
  taxableIncome: number
  annualTax: number
  months: SalaryTDSForecastMonth[]
  adjustments: ComplianceMonthAdjustment[]
}

const STANDARD_DEDUCTION_NEW_REGIME = 7_500_000
const REBATE_THRESHOLD = 120_000_000
const REBATE_MAX_TAX = 6_000_000
const CESS_PCT = 4

const NEW_REGIME_AY_2026_27_SLABS = [
  { upperLimit: 40_000_000, ratePct: 0 },
  { upperLimit: 80_000_000, ratePct: 5 },
  { upperLimit: 120_000_000, ratePct: 10 },
  { upperLimit: 160_000_000, ratePct: 15 },
  { upperLimit: 200_000_000, ratePct: 20 },
  { upperLimit: 240_000_000, ratePct: 25 },
  { upperLimit: Number.POSITIVE_INFINITY, ratePct: 30 },
]

function multiplyAndDivide(amount: number, pct: number, divisor: number): number {
  return Math.round((amount * pct) / divisor)
}

function calculateAnnualTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0

  let taxBeforeRelief = 0
  let previousLimit = 0

  for (const slab of NEW_REGIME_AY_2026_27_SLABS) {
    const taxableSlice = Math.min(taxableIncome, slab.upperLimit) - previousLimit
    if (taxableSlice > 0) {
      taxBeforeRelief += multiplyAndDivide(taxableSlice, slab.ratePct, 100)
    }
    if (taxableIncome <= slab.upperLimit) break
    previousLimit = slab.upperLimit
  }

  if (taxableIncome <= REBATE_THRESHOLD) return 0

  const taxWithCess = taxBeforeRelief + multiplyAndDivide(taxBeforeRelief, CESS_PCT, 100)
  const marginalReliefCap = taxableIncome - REBATE_THRESHOLD

  if (
    taxableIncome > REBATE_THRESHOLD &&
    taxBeforeRelief <= REBATE_MAX_TAX &&
    taxWithCess > marginalReliefCap
  ) {
    return marginalReliefCap
  }

  return taxWithCess
}

function allocateProRata(total: number, weights: number[]): number[] {
  if (total === 0 || weights.every((weight) => weight === 0)) {
    return new Array(weights.length).fill(0)
  }

  const totalBigInt = BigInt(total)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const totalWeightBigInt = BigInt(totalWeight)
  const allocations = weights.map((weight) =>
    Number((totalBigInt * BigInt(weight)) / totalWeightBigInt)
  )
  const remainderByIndex = weights.map((weight, index) => ({
    index,
    remainder: Number((totalBigInt * BigInt(weight)) % totalWeightBigInt),
  }))
  let remaining = total - allocations.reduce((sum, value) => sum + value, 0)

  remainderByIndex
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach(({ index }) => {
      if (remaining <= 0) return
      allocations[index] += 1
      remaining -= 1
    })

  return allocations
}

/**
 * FIX audit3 C2: Per-employee TDS
 *
 * Strategy:
 * 1. If employee list provided → calculate tax per employee individually, then sum
 * 2. If headcount provided → estimate average salary, calculate per-employee, multiply
 * 3. Fallback → assume 1 employee (backward compatible)
 */
function calculateTotalAnnualTDS(
  annualGrossSalary: number,
  standardDeduction: number,
  employees?: EmployeeSalaryInput[],
  estimatedHeadcount?: number
): { annualTax: number; taxableIncome: number } {
  if (employees && employees.length > 0) {
    // Per-employee calculation (most accurate)
    let totalTax = 0
    let totalTaxableIncome = 0

    for (const emp of employees) {
      const annualSalary = emp.monthlyCTC * 12
      const taxable = Math.max(0, annualSalary - standardDeduction)
      totalTaxableIncome += taxable
      totalTax += calculateAnnualTax(taxable)
    }

    return { annualTax: totalTax, taxableIncome: totalTaxableIncome }
  }

  if (estimatedHeadcount && estimatedHeadcount > 1) {
    // Estimate per-employee from aggregate
    const avgAnnualSalary = Math.round(annualGrossSalary / estimatedHeadcount)
    const taxablePerEmp = Math.max(0, avgAnnualSalary - standardDeduction)
    const taxPerEmp = calculateAnnualTax(taxablePerEmp)

    return {
      annualTax: taxPerEmp * estimatedHeadcount,
      taxableIncome: taxablePerEmp * estimatedHeadcount,
    }
  }

  // Fallback: single employee (backward compatible)
  const taxableIncome = Math.max(0, annualGrossSalary - standardDeduction)
  return { annualTax: calculateAnnualTax(taxableIncome), taxableIncome }
}

export function calculateSalaryTDSForecast({
  periods,
  projectedGrossSalaries,
  standardDeduction = STANDARD_DEDUCTION_NEW_REGIME,
  employees,
  estimatedHeadcount,
}: SalaryTDSForecastInput): SalaryTDSForecastResult {
  const periodIndexMap = buildPeriodIndexMap(periods)
  const adjustments = periods.map((period) => createZeroAdjustment(period))
  const annualGrossSalary = projectedGrossSalaries.reduce((sum, salary) => sum + salary, 0)

  const { annualTax, taxableIncome } = calculateTotalAnnualTDS(
    annualGrossSalary,
    standardDeduction,
    employees,
    estimatedHeadcount
  )

  const monthlyAllocations = allocateProRata(annualTax, projectedGrossSalaries)

  const months = periods.map((period, index) => {
    const salaryTDS = monthlyAllocations[index] ?? 0
    adjustments[index].tdsPayableDelta += salaryTDS
    adjustments[index].apReclassification += salaryTDS

    const paymentPeriod = getFollowingMonthPeriod(period)
    const paymentIndex = periodIndexMap.get(paymentPeriod)

    if (paymentIndex !== undefined && salaryTDS > 0) {
      adjustments[paymentIndex].tdsPayableDelta -= salaryTDS
      adjustments[paymentIndex].tdsPaid += salaryTDS
    }

    return {
      period,
      grossSalary: projectedGrossSalaries[index] ?? 0,
      salaryTDS,
      dueDate: getFollowingMonthDueDate(period, 7),
      paymentPeriod: paymentIndex === undefined ? undefined : paymentPeriod,
    }
  })

  return {
    annualGrossSalary,
    taxableIncome,
    annualTax,
    months,
    adjustments,
  }
}
