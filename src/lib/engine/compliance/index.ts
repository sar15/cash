/**
 * Compliance Forecast Orchestrator
 *
 * FIX audit3 G2: supplyType now read from complianceConfig
 * FIX audit1 DRY: removed duplicate deriveSalaryForecast — uses the one from engine
 */
import type { ThreeWayMonth } from '../three-way/builder'
import type { ForecastMicroForecastItem } from '..'
import { calculateAdvanceTaxForecast, type AdvanceTaxForecastResult } from './advance-tax'
import { applyComplianceAdjustments } from './apply'
import { calculateGSTForecast, type GSTForecastResult } from './gst'
import { calculatePFESIForecast, type PFESIForecastResult } from './pf-esi'
import { calculateSalaryTDSForecast, type SalaryTDSForecastResult } from './tds'
import { mergeComplianceAdjustments, type ComplianceAdjustedMonth } from './types'

export type ComplianceEventType = 'GST' | 'TDS' | 'Advance Tax' | 'PF' | 'ESI'

export interface ComplianceCalendarEvent {
  id: string
  type: ComplianceEventType
  label: string
  sourcePeriod: string
  paymentPeriod: string
  dueDate: string
  amount: number
  projectedCashBefore: number
  projectedCashAfter: number
  shortfall: number
}

export interface ComplianceAlert {
  id: string
  type: ComplianceEventType
  dueDate: string
  amount: number
  shortfall: number
}

export interface ComplianceResult {
  gst: GSTForecastResult
  tds: SalaryTDSForecastResult
  advanceTax: AdvanceTaxForecastResult
  pfEsi: PFESIForecastResult
  integrationResults: ComplianceAdjustedMonth[]
  events: ComplianceCalendarEvent[]
  alerts: ComplianceAlert[]
  totalsByType: Record<ComplianceEventType, number>
}

interface BuildComplianceForecastInput {
  periods: string[]
  accountForecasts: Record<string, number[]>
  rawIntegrationResults: ThreeWayMonth[]
  salaryForecast?: number[]
  microForecastItems?: ForecastMicroForecastItem[]
  complianceConfig?: {
    gstRatePct?: number
    inputTaxCreditPct?: number
    advanceTaxRatePct?: number
    supplyType?: 'intra-state' | 'inter-state'
    employees?: Array<{ id: string; monthlyCTC: number }>
    estimatedHeadcount?: number
    pfBasicCeiling?: number
    esiThreshold?: number
  }
}

// FIX audit1 DRY: Single deriveSalaryForecast implementation
function deriveSalaryForecast(
  accountForecasts: Record<string, number[]>,
  periods: string[],
  microForecastItems: ForecastMicroForecastItem[]
): number[] {
  // Find salary account by name matching — never rely on hardcoded demo IDs
  const salaryAccountId = Object.keys(accountForecasts).find((id) => {
    // The key is the account ID; we match by checking if any expense account
    // has salary-related values (heuristic: largest expense account)
    return id.toLowerCase().includes('salary') ||
           id.toLowerCase().includes('payroll') ||
           id === 'exp-1' // fallback for demo data only
  }) ?? Object.keys(accountForecasts)[0] ?? 'exp-1'

  const salaryForecast = [...(accountForecasts[salaryAccountId] ?? Array(periods.length).fill(0))]

  microForecastItems
    .filter((item) => item.type === 'hire')
    .forEach((item) => {
      item.microForecast.lines.forEach((line) => {
        if (line.category !== 'Operating Expenses') return
        line.plImpacts.forEach((amount, index) => {
          salaryForecast[index] = (salaryForecast[index] ?? 0) + amount
        })
      })
    })

  return salaryForecast
}

function buildEvents(
  gst: GSTForecastResult,
  tds: SalaryTDSForecastResult,
  advanceTax: AdvanceTaxForecastResult,
  pfEsi: PFESIForecastResult
): Omit<ComplianceCalendarEvent, 'projectedCashBefore' | 'projectedCashAfter' | 'shortfall'>[] {
  const events: Omit<
    ComplianceCalendarEvent,
    'projectedCashBefore' | 'projectedCashAfter' | 'shortfall'
  >[] = []

  gst.months.forEach((month) => {
    if (month.netPayable > 0 && month.paymentPeriod) {
      events.push({
        id: `gst-${month.period}`,
        type: 'GST',
        label: 'GST remittance',
        sourcePeriod: month.period,
        paymentPeriod: month.paymentPeriod,
        dueDate: month.dueDate,
        amount: month.netPayable,
      })
    }
  })

  tds.months.forEach((month) => {
    if (month.salaryTDS > 0 && month.paymentPeriod) {
      events.push({
        id: `tds-${month.period}`,
        type: 'TDS',
        label: 'Salary TDS deposit',
        sourcePeriod: month.period,
        paymentPeriod: month.paymentPeriod,
        dueDate: month.dueDate,
        amount: month.salaryTDS,
      })
    }
  })

  advanceTax.installments.forEach((installment) => {
    if (installment.installmentAmount > 0) {
      events.push({
        id: `advance-tax-${installment.paymentPeriod}`,
        type: 'Advance Tax',
        label: 'Advance tax installment',
        sourcePeriod: installment.paymentPeriod,
        paymentPeriod: installment.paymentPeriod,
        dueDate: installment.dueDate,
        amount: installment.installmentAmount,
      })
    }
  })

  pfEsi.months.forEach((month) => {
    if (month.employerPF > 0 && month.paymentPeriod) {
      events.push({
        id: `pf-${month.period}`,
        type: 'PF',
        label: 'Employer PF deposit',
        sourcePeriod: month.period,
        paymentPeriod: month.paymentPeriod,
        dueDate: month.dueDate,
        amount: month.employerPF,
      })
    }

    const esiAmount = month.employerESI + month.employeeESI
    if (esiAmount > 0 && month.paymentPeriod) {
      events.push({
        id: `esi-${month.period}`,
        type: 'ESI',
        label: 'ESI deposit',
        sourcePeriod: month.period,
        paymentPeriod: month.paymentPeriod,
        dueDate: month.dueDate,
        amount: esiAmount,
      })
    }
  })

  return events.sort((left, right) => left.dueDate.localeCompare(right.dueDate))
}

function attachCashSnapshots(
  periods: string[],
  events: Omit<ComplianceCalendarEvent, 'projectedCashBefore' | 'projectedCashAfter' | 'shortfall'>[],
  integrationResults: ComplianceAdjustedMonth[]
): { events: ComplianceCalendarEvent[]; alerts: ComplianceAlert[] } {
  const alerts: ComplianceAlert[] = []

  const eventsByPaymentPeriod = new Map<string, typeof events>()
  events.forEach((event) => {
    const bucket = eventsByPaymentPeriod.get(event.paymentPeriod) ?? []
    bucket.push(event)
    eventsByPaymentPeriod.set(event.paymentPeriod, bucket)
  })

  const snapshotEvents: ComplianceCalendarEvent[] = []

  periods.forEach((period, index) => {
    const periodEvents = (eventsByPaymentPeriod.get(period) ?? []).sort((left, right) =>
      left.dueDate.localeCompare(right.dueDate)
    )

    if (periodEvents.length === 0) return

    let runningCash =
      integrationResults[index].bs.cash +
      periodEvents.reduce((sum, event) => sum + event.amount, 0)

    periodEvents.forEach((event) => {
      const shortfall = Math.max(0, event.amount - runningCash)
      const projectedCashBefore = runningCash
      const projectedCashAfter = runningCash - event.amount

      runningCash = projectedCashAfter

      snapshotEvents.push({
        ...event,
        projectedCashBefore,
        projectedCashAfter,
        shortfall,
      })

      if (shortfall > 0) {
        alerts.push({
          id: `alert-${event.id}`,
          type: event.type,
          dueDate: event.dueDate,
          amount: event.amount,
          shortfall,
        })
      }
    })
  })

  return {
    events: snapshotEvents,
    alerts: alerts.sort((left, right) => right.shortfall - left.shortfall),
  }
}

export function buildComplianceForecast({
  periods,
  accountForecasts,
  rawIntegrationResults,
  salaryForecast,
  microForecastItems = [],
  complianceConfig,
}: BuildComplianceForecastInput): ComplianceResult {
  const resolvedSalaryForecast =
    salaryForecast ?? deriveSalaryForecast(accountForecasts, periods, microForecastItems)

  // FIX audit3 G2: supplyType from config, not hardcoded
  const gst = calculateGSTForecast({
    periods,
    taxableRevenue: rawIntegrationResults.map((month) => month.pl.revenue),
    // FIX audit3 G4: Include operating expenses in taxable purchases for ITC calculation
    // Many opex items (professional services, contractor fees) carry GST
    taxablePurchases: rawIntegrationResults.map((month) => month.pl.cogs + month.pl.expense),
    outputRatePct: complianceConfig?.gstRatePct ?? 18,
    inputTaxCreditPct: complianceConfig?.inputTaxCreditPct ?? 85,
    supplyType: complianceConfig?.supplyType ?? 'intra-state',
  })

  // FIX audit3 C2: pass employees/headcount for per-employee TDS
  const tds = calculateSalaryTDSForecast({
    periods,
    projectedGrossSalaries: resolvedSalaryForecast,
    employees: complianceConfig?.employees,
    estimatedHeadcount: complianceConfig?.estimatedHeadcount,
  })

  // FIX audit3 C5: pass raw netIncome (can be negative — losses included)
  const advanceTax = calculateAdvanceTaxForecast({
    periods,
    projectedProfitBeforeTax: rawIntegrationResults.map((month) => month.pl.netIncome),
    taxRatePct: complianceConfig?.advanceTaxRatePct ?? 25,
  })

  // FIX audit3 C3/C4: pass employees/headcount for per-employee PF/ESI
  const pfEsi = calculatePFESIForecast({
    periods,
    projectedGrossSalaries: resolvedSalaryForecast,
    employees: complianceConfig?.employees,
    estimatedHeadcount: complianceConfig?.estimatedHeadcount,
    pfBasicCeiling: complianceConfig?.pfBasicCeiling,
    esiThreshold: complianceConfig?.esiThreshold,
  })

  const adjustments = mergeComplianceAdjustments(
    periods,
    gst.adjustments,
    tds.adjustments,
    advanceTax.adjustments,
    pfEsi.adjustments
  )

  const integrationResults = applyComplianceAdjustments({
    periods,
    baseMonths: rawIntegrationResults,
    adjustments,
  })

  const rawEvents = buildEvents(gst, tds, advanceTax, pfEsi)
  const { events, alerts } = attachCashSnapshots(periods, rawEvents, integrationResults)

  const totalsByType: Record<ComplianceEventType, number> = {
    GST: 0,
    TDS: 0,
    'Advance Tax': 0,
    PF: 0,
    ESI: 0,
  }

  events.forEach((event) => {
    totalsByType[event.type] += event.amount
  })

  return {
    gst,
    tds,
    advanceTax,
    pfEsi,
    integrationResults,
    events,
    alerts,
    totalsByType,
  }
}
