/**
 * PF/ESI Forecast
 *
 * FIX audit3 C3: Per-employee ESI threshold check.
 * Previously: ESI threshold checked against aggregate salary → ESI was never calculated
 *             for companies with multiple employees because aggregate always exceeds ₹21,000.
 * Now: accepts per-employee data or headcount for per-employee estimation.
 *
 * FIX audit3 C4: PF capped at ₹15,000 basic per employee (statutory ceiling).
 */
import { multiplyByPct } from '../../utils/math'
import { buildPeriodIndexMap, getFollowingMonthDueDate, getFollowingMonthPeriod } from './periods'
import { ComplianceMonthAdjustment, createZeroAdjustment } from './types'

interface EmployeeInfo {
  id: string
  monthlyCTC: number // paise
}

interface PFESIForecastInput {
  periods: string[]
  projectedGrossSalaries: number[]
  basicSalaryPct?: number
  esiThreshold?: number // per-employee threshold in paise
  pfBasicCeiling?: number // PF ceiling on basic per employee (₹15,000 = 1_500_000 paise)
  employees?: EmployeeInfo[]
  estimatedHeadcount?: number
}

export interface PFESIForecastMonth {
  period: string
  grossSalary: number
  basicSalary: number
  employerPF: number
  employerESI: number
  employeeESI: number
  employerStatutoryExpense: number
  totalDeposit: number
  dueDate: string
  paymentPeriod?: string
}

export interface PFESIForecastResult {
  months: PFESIForecastMonth[]
  adjustments: ComplianceMonthAdjustment[]
}

const EMPLOYER_PF_PCT = 12
const EMPLOYER_ESI_PCT = 3.25
const EMPLOYEE_ESI_PCT = 0.75
const DEFAULT_BASIC_PCT = 50
const DEFAULT_ESI_THRESHOLD = 2_100_000 // ₹21,000 per employee per month
const DEFAULT_PF_BASIC_CEILING = 1_500_000 // ₹15,000 per employee

/**
 * Calculate PF/ESI for a single employee month.
 * Returns { employerPF, employerESI, employeeESI }
 */
function calculatePerEmployee(
  grossSalary: number,
  basicSalaryPct: number,
  esiThreshold: number,
  pfBasicCeiling: number
): { employerPF: number; employerESI: number; employeeESI: number } {
  const basicSalary = multiplyByPct(grossSalary, basicSalaryPct)

  // FIX audit3 C4: Cap PF basic at ₹15,000 per employee
  const pfBasic = Math.min(basicSalary, pfBasicCeiling)
  const employerPF = multiplyByPct(pfBasic, EMPLOYER_PF_PCT)

  // FIX audit3 C3: ESI threshold is per-employee, not aggregate
  const esiEligible = grossSalary <= esiThreshold
  const employerESI = esiEligible ? multiplyByPct(grossSalary, EMPLOYER_ESI_PCT) : 0
  const employeeESI = esiEligible ? multiplyByPct(grossSalary, EMPLOYEE_ESI_PCT) : 0

  return { employerPF, employerESI, employeeESI }
}

export function calculatePFESIForecast({
  periods,
  projectedGrossSalaries,
  basicSalaryPct = DEFAULT_BASIC_PCT,
  esiThreshold = DEFAULT_ESI_THRESHOLD,
  pfBasicCeiling = DEFAULT_PF_BASIC_CEILING,
  employees,
  estimatedHeadcount,
}: PFESIForecastInput): PFESIForecastResult {
  const periodIndexMap = buildPeriodIndexMap(periods)
  const adjustments = periods.map((period) => createZeroAdjustment(period))

  const headcount = employees?.length ?? estimatedHeadcount ?? 1

  const months = periods.map((period, index) => {
    const grossSalary = projectedGrossSalaries[index] ?? 0

    let totalEmployerPF = 0
    let totalEmployerESI = 0
    let totalEmployeeESI = 0

    if (employees && employees.length > 0) {
      // Per-employee calculation (most accurate)
      for (const emp of employees) {
        const result = calculatePerEmployee(emp.monthlyCTC, basicSalaryPct, esiThreshold, pfBasicCeiling)
        totalEmployerPF += result.employerPF
        totalEmployerESI += result.employerESI
        totalEmployeeESI += result.employeeESI
      }
    } else {
      // Estimate per-employee from aggregate
      const avgSalary = headcount > 0 ? Math.round(grossSalary / headcount) : grossSalary
      const perEmp = calculatePerEmployee(avgSalary, basicSalaryPct, esiThreshold, pfBasicCeiling)
      totalEmployerPF = perEmp.employerPF * headcount
      totalEmployerESI = perEmp.employerESI * headcount
      totalEmployeeESI = perEmp.employeeESI * headcount
    }

    const basicSalary = multiplyByPct(grossSalary, basicSalaryPct)
    const employerStatutoryExpense = totalEmployerPF + totalEmployerESI
    const totalEsiDeposit = totalEmployerESI + totalEmployeeESI
    const totalDeposit = totalEmployerPF + totalEsiDeposit

    adjustments[index].employerExpenseAccrual += employerStatutoryExpense
    adjustments[index].pfPayableDelta += totalEmployerPF
    adjustments[index].esiPayableDelta += totalEsiDeposit
    adjustments[index].apReclassification += totalEmployeeESI

    const paymentPeriod = getFollowingMonthPeriod(period)
    const paymentIndex = periodIndexMap.get(paymentPeriod)

    if (paymentIndex !== undefined && totalDeposit > 0) {
      adjustments[paymentIndex].pfPayableDelta -= totalEmployerPF
      adjustments[paymentIndex].esiPayableDelta -= totalEsiDeposit
      adjustments[paymentIndex].pfPaid += totalEmployerPF
      adjustments[paymentIndex].esiPaid += totalEsiDeposit
    }

    return {
      period,
      grossSalary,
      basicSalary,
      employerPF: totalEmployerPF,
      employerESI: totalEmployerESI,
      employeeESI: totalEmployeeESI,
      employerStatutoryExpense,
      totalDeposit,
      dueDate: getFollowingMonthDueDate(period, 15),
      paymentPeriod: paymentIndex === undefined ? undefined : paymentPeriod,
    }
  })

  return { months, adjustments }
}
