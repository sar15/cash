'use client'

/**
 * Annual P&L Statement Component
 * 
 * Renders Schedule III-compliant Profit & Loss statement
 * with two columns: Current Year | Prior Year
 */

import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'
import type { AnnualStatement } from '@/lib/reports/annual-aggregator'

export interface AnnualPLStatementProps {
  current: AnnualStatement['pl']
  prior: AnnualStatement['pl'] | null
  priorDataSource: 'actuals' | 'mixed' | 'forecast'
  currentPeriodLabel: string
  priorPeriodLabel: string
}

export function AnnualPLStatement({
  current,
  prior,
  priorDataSource,
  currentPeriodLabel,
  priorPeriodLabel,
}: AnnualPLStatementProps) {
  const formatValue = (paise: number) => {
    if (paise === 0) return '—'
    const formatted = formatAuto(paise)
    return paise < 0 ? `(${formatted.replace('-', '')})` : formatted
  }

  const priorBadgeColor = {
    actuals: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]',
    mixed: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',
    forecast: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  }[priorDataSource]

  const priorBadgeLabel = {
    actuals: 'Actuals',
    mixed: 'Actuals + Forecast',
    forecast: 'Forecast',
  }[priorDataSource]

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-[600px] border-collapse"
        aria-label="Schedule III Profit & Loss Statement"
      >
        <thead>
          <tr className="border-b-2 border-[#0F172A]">
            <th
              scope="col"
              className="px-4 py-3 text-left text-sm font-bold text-[#0F172A]"
            >
              Profit & Loss Statement
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-sm font-bold text-[#0F172A]"
            >
              <div className="flex flex-col items-end gap-1">
                <span>{currentPeriodLabel}</span>
              </div>
            </th>
            {prior && (
              <th
                scope="col"
                className="px-4 py-3 text-right text-sm font-bold text-[#0F172A]"
              >
                <div className="flex flex-col items-end gap-1">
                  <span>{priorPeriodLabel}</span>
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]',
                      priorBadgeColor
                    )}
                  >
                    {priorBadgeLabel}
                  </span>
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {/* I. Revenue from Operations */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              I. Revenue from Operations
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#0F172A]">
              {formatValue(current.revenueFromOps)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#0F172A]">
                {formatValue(prior.revenueFromOps)}
              </td>
            )}
          </tr>

          {/* II. Other Income */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              II. Other Income
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#0F172A]">
              {formatValue(current.otherIncome)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#0F172A]">
                {formatValue(prior.otherIncome)}
              </td>
            )}
          </tr>

          {/* III. Total Revenue */}
          <tr className="border-t border-[#E2E8F0] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-bold text-[#0F172A]">
              III. Total Revenue (I + II)
            </th>
            <td className="px-4 py-2 text-right font-bold text-[#0F172A]">
              {formatValue(current.totalRevenue)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-bold text-[#0F172A]">
                {formatValue(prior.totalRevenue)}
              </td>
            )}
          </tr>

          {/* IV. Expenses */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              IV. Expenses
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          {/* (a)+(b) Cost of Materials / Purchases */}
          {(current.cogs !== 0 || (prior && prior.cogs !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">
                (a)+(b) Cost of Materials / Purchases
              </td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.cogs < 0 && 'text-[#DC2626]')}>
                {formatValue(current.cogs)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.cogs < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.cogs)}
                </td>
              )}
            </tr>
          )}

          {/* (d) Employee Benefits Expense */}
          {(current.employeeBenefits !== 0 || (prior && prior.employeeBenefits !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">
                (d) Employee Benefits Expense
              </td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.employeeBenefits < 0 && 'text-[#DC2626]')}>
                {formatValue(current.employeeBenefits)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.employeeBenefits < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.employeeBenefits)}
                </td>
              )}
            </tr>
          )}

          {/* (e) Finance Costs */}
          {(current.financeCosts !== 0 || (prior && prior.financeCosts !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">
                (e) Finance Costs
              </td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.financeCosts < 0 && 'text-[#DC2626]')}>
                {formatValue(current.financeCosts)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.financeCosts < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.financeCosts)}
                </td>
              )}
            </tr>
          )}

          {/* (f) Depreciation & Amortisation */}
          {((current.depreciation + current.amortisation) !== 0 || (prior && (prior.depreciation + prior.amortisation) !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">
                (f) Depreciation & Amortisation
              </td>
              <td className={cn('px-4 py-1.5 text-right text-sm', (current.depreciation + current.amortisation) < 0 && 'text-[#DC2626]')}>
                {formatValue(current.depreciation + current.amortisation)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', (prior.depreciation + prior.amortisation) < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.depreciation + prior.amortisation)}
                </td>
              )}
            </tr>
          )}

          {/* (g) Other Expenses */}
          {(current.otherExpenses !== 0 || (prior && prior.otherExpenses !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">
                (g) Other Expenses
              </td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.otherExpenses < 0 && 'text-[#DC2626]')}>
                {formatValue(current.otherExpenses)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.otherExpenses < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.otherExpenses)}
                </td>
              )}
            </tr>
          )}

          {/* V. Total Expenses */}
          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-semibold text-[#334155]">
              V. Total Expenses
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#334155]">
              {formatValue(current.totalExpenses)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#334155]">
                {formatValue(prior.totalExpenses)}
              </td>
            )}
          </tr>

          {/* VI. Profit Before Exceptional Items & Tax */}
          <tr className="border-t border-[#E2E8F0] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-bold text-[#0F172A]">
              VI. Profit Before Exceptional Items & Tax
            </th>
            <td className={cn('px-4 py-2 text-right font-bold', current.profitBeforeExceptional < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
              {formatValue(current.profitBeforeExceptional)}
            </td>
            {prior && (
              <td className={cn('px-4 py-2 text-right font-bold', prior.profitBeforeExceptional < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
                {formatValue(prior.profitBeforeExceptional)}
              </td>
            )}
          </tr>

          {/* VII. Exceptional Items */}
          {(current.exceptionalItems !== 0 || (prior && prior.exceptionalItems !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 text-sm text-[#334155]">
                VII. Exceptional Items
              </td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.exceptionalItems < 0 && 'text-[#DC2626]')}>
                {formatValue(current.exceptionalItems)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.exceptionalItems < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.exceptionalItems)}
                </td>
              )}
            </tr>
          )}

          {/* VIII. Profit Before Tax */}
          <tr className="border-t border-[#E2E8F0] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-bold text-[#0F172A]">
              VIII. Profit Before Tax
            </th>
            <td className={cn('px-4 py-2 text-right font-bold', current.profitBeforeTax < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
              {formatValue(current.profitBeforeTax)}
            </td>
            {prior && (
              <td className={cn('px-4 py-2 text-right font-bold', prior.profitBeforeTax < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
                {formatValue(prior.profitBeforeTax)}
              </td>
            )}
          </tr>

          {/* IX. Tax Expense */}
          {(current.taxExpense !== 0 || (prior && prior.taxExpense !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">
                IX. Tax Expense
              </td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.taxExpense < 0 && 'text-[#DC2626]')}>
                {formatValue(current.taxExpense)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.taxExpense < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.taxExpense)}
                </td>
              )}
            </tr>
          )}

          {/* X. Profit After Tax (PAT) */}
          <tr className="border-t-2 border-[#0F172A] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-3 text-left text-sm font-bold text-[#0F172A]">
              X. Profit After Tax (PAT)
            </th>
            <td className={cn('px-4 py-3 text-right text-base font-bold', current.profitAfterTax < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
              {formatValue(current.profitAfterTax)}
            </td>
            {prior && (
              <td className={cn('px-4 py-3 text-right text-base font-bold', prior.profitAfterTax < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
                {formatValue(prior.profitAfterTax)}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
