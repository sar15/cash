'use client'

/**
 * Annual Cash Flow Statement Component
 * 
 * Renders AS 3-compliant Cash Flow statement (Indirect Method)
 * with two columns: Current Year | Prior Year
 * Structure: A. Operating Activities, B. Investing Activities, C. Financing Activities
 */

import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'
import type { AnnualStatement } from '@/lib/reports/annual-aggregator'

export interface AnnualCFStatementProps {
  current: AnnualStatement['cf']
  prior: AnnualStatement['cf'] | null
  priorDataSource: 'actuals' | 'mixed' | 'forecast'
  currentPeriodLabel: string
  priorPeriodLabel: string
}

export function AnnualCFStatement({
  current,
  prior,
  priorDataSource,
  currentPeriodLabel,
  priorPeriodLabel,
}: AnnualCFStatementProps) {
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
        aria-label="AS 3 Cash Flow Statement"
      >
        <thead>
          <tr className="border-b-2 border-[#0F172A]">
            <th
              scope="col"
              className="px-4 py-3 text-left text-sm font-bold text-[#0F172A]"
            >
              Cash Flow Statement
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
          {/* Opening Cash Balance */}
          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-semibold text-[#334155]">
              Opening Cash Balance
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#334155]">
              {formatValue(current.openingCash)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#334155]">
                {formatValue(prior.openingCash)}
              </td>
            )}
          </tr>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* A. OPERATING ACTIVITIES */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              A. Cash Flow from Operating Activities
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          <tr className="hover:bg-[#F8FAFC]">
            <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Net Profit Before Tax</td>
            <td className={cn('px-4 py-1.5 text-right text-sm', current.operatingIndirect.profitBeforeTax < 0 && 'text-[#DC2626]')}>
              {formatValue(current.operatingIndirect.profitBeforeTax)}
            </td>
            {prior && (
              <td className={cn('px-4 py-1.5 text-right text-sm', prior.operatingIndirect.profitBeforeTax < 0 && 'text-[#DC2626]')}>
                {formatValue(prior.operatingIndirect.profitBeforeTax)}
              </td>
            )}
          </tr>

          {(current.operatingIndirect.addDepreciation !== 0 || (prior && prior.operatingIndirect.addDepreciation !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Add: Depreciation</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.operatingIndirect.addDepreciation)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.operatingIndirect.addDepreciation)}</td>}
            </tr>
          )}

          {(current.operatingIndirect.addAmortisation !== 0 || (prior && prior.operatingIndirect.addAmortisation !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Add: Amortisation</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.operatingIndirect.addAmortisation)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.operatingIndirect.addAmortisation)}</td>}
            </tr>
          )}

          {(current.operatingIndirect.addFinanceCosts !== 0 || (prior && prior.operatingIndirect.addFinanceCosts !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Add: Finance Costs</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.operatingIndirect.addFinanceCosts)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.operatingIndirect.addFinanceCosts)}</td>}
            </tr>
          )}

          {(current.operatingIndirect.lessOtherIncome !== 0 || (prior && prior.operatingIndirect.lessOtherIncome !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Less: Other Income</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.operatingIndirect.lessOtherIncome)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.operatingIndirect.lessOtherIncome)}</td>}
            </tr>
          )}

          {(current.operatingIndirect.changeInInventories !== 0 || (prior && prior.operatingIndirect.changeInInventories !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">(Increase)/Decrease in Inventories</td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.operatingIndirect.changeInInventories < 0 && 'text-[#DC2626]')}>
                {formatValue(current.operatingIndirect.changeInInventories)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.operatingIndirect.changeInInventories < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.operatingIndirect.changeInInventories)}
                </td>
              )}
            </tr>
          )}

          <tr className="hover:bg-[#F8FAFC]">
            <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">(Increase)/Decrease in Trade Receivables</td>
            <td className={cn('px-4 py-1.5 text-right text-sm', current.operatingIndirect.changeInTradeReceivables < 0 && 'text-[#DC2626]')}>
              {formatValue(current.operatingIndirect.changeInTradeReceivables)}
            </td>
            {prior && (
              <td className={cn('px-4 py-1.5 text-right text-sm', prior.operatingIndirect.changeInTradeReceivables < 0 && 'text-[#DC2626]')}>
                {formatValue(prior.operatingIndirect.changeInTradeReceivables)}
              </td>
            )}
          </tr>

          {(current.operatingIndirect.changeInSTLoansAdvances !== 0 || (prior && prior.operatingIndirect.changeInSTLoansAdvances !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">(Increase)/Decrease in Loans & Advances</td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.operatingIndirect.changeInSTLoansAdvances < 0 && 'text-[#DC2626]')}>
                {formatValue(current.operatingIndirect.changeInSTLoansAdvances)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.operatingIndirect.changeInSTLoansAdvances < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.operatingIndirect.changeInSTLoansAdvances)}
                </td>
              )}
            </tr>
          )}

          {(current.operatingIndirect.changeInOtherCurrentAssets !== 0 || (prior && prior.operatingIndirect.changeInOtherCurrentAssets !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">(Increase)/Decrease in Other Current Assets</td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.operatingIndirect.changeInOtherCurrentAssets < 0 && 'text-[#DC2626]')}>
                {formatValue(current.operatingIndirect.changeInOtherCurrentAssets)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.operatingIndirect.changeInOtherCurrentAssets < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.operatingIndirect.changeInOtherCurrentAssets)}
                </td>
              )}
            </tr>
          )}

          <tr className="hover:bg-[#F8FAFC]">
            <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Increase/(Decrease) in Trade Payables</td>
            <td className={cn('px-4 py-1.5 text-right text-sm', current.operatingIndirect.changeInTradePayables < 0 && 'text-[#DC2626]')}>
              {formatValue(current.operatingIndirect.changeInTradePayables)}
            </td>
            {prior && (
              <td className={cn('px-4 py-1.5 text-right text-sm', prior.operatingIndirect.changeInTradePayables < 0 && 'text-[#DC2626]')}>
                {formatValue(prior.operatingIndirect.changeInTradePayables)}
              </td>
            )}
          </tr>

          {(current.operatingIndirect.changeInOtherCurrentLiabilities !== 0 || (prior && prior.operatingIndirect.changeInOtherCurrentLiabilities !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Increase/(Decrease) in Other Current Liabilities</td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.operatingIndirect.changeInOtherCurrentLiabilities < 0 && 'text-[#DC2626]')}>
                {formatValue(current.operatingIndirect.changeInOtherCurrentLiabilities)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.operatingIndirect.changeInOtherCurrentLiabilities < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.operatingIndirect.changeInOtherCurrentLiabilities)}
                </td>
              )}
            </tr>
          )}

          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-semibold text-[#334155]">
              Cash Generated from Operations
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#334155]">
              {formatValue(current.operatingIndirect.cashFromOperations)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#334155]">
                {formatValue(prior.operatingIndirect.cashFromOperations)}
              </td>
            )}
          </tr>

          {(current.operatingIndirect.lessIncomeTaxPaid !== 0 || (prior && prior.operatingIndirect.lessIncomeTaxPaid !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Less: Income Tax Paid</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.operatingIndirect.lessIncomeTaxPaid)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.operatingIndirect.lessIncomeTaxPaid)}</td>}
            </tr>
          )}

          <tr className="border-t border-[#E2E8F0] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-bold text-[#0F172A]">
              A. Net Cash from Operating Activities
            </th>
            <td className={cn('px-4 py-2 text-right font-bold', current.netOperatingCF < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
              {formatValue(current.netOperatingCF)}
            </td>
            {prior && (
              <td className={cn('px-4 py-2 text-right font-bold', prior.netOperatingCF < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
                {formatValue(prior.netOperatingCF)}
              </td>
            )}
          </tr>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* B. INVESTING ACTIVITIES */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              B. Cash Flow from Investing Activities
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          {(current.purchaseOfPPE !== 0 || (prior && prior.purchaseOfPPE !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Purchase of PPE</td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.purchaseOfPPE < 0 && 'text-[#DC2626]')}>
                {formatValue(current.purchaseOfPPE)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.purchaseOfPPE < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.purchaseOfPPE)}
                </td>
              )}
            </tr>
          )}

          {(current.purchaseOfIntangibles !== 0 || (prior && prior.purchaseOfIntangibles !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Purchase of Intangibles</td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.purchaseOfIntangibles < 0 && 'text-[#DC2626]')}>
                {formatValue(current.purchaseOfIntangibles)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.purchaseOfIntangibles < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.purchaseOfIntangibles)}
                </td>
              )}
            </tr>
          )}

          {(current.proceedsFromAssetSale !== 0 || (prior && prior.proceedsFromAssetSale !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Proceeds from Sale of Assets</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.proceedsFromAssetSale)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.proceedsFromAssetSale)}</td>}
            </tr>
          )}

          <tr className="border-t border-[#E2E8F0] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-bold text-[#0F172A]">
              B. Net Cash from Investing Activities
            </th>
            <td className={cn('px-4 py-2 text-right font-bold', current.netInvestingCF < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
              {formatValue(current.netInvestingCF)}
            </td>
            {prior && (
              <td className={cn('px-4 py-2 text-right font-bold', prior.netInvestingCF < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
                {formatValue(prior.netInvestingCF)}
              </td>
            )}
          </tr>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* C. FINANCING ACTIVITIES */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              C. Cash Flow from Financing Activities
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          {(current.proceedsFromBorrowings !== 0 || (prior && prior.proceedsFromBorrowings !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Proceeds from Borrowings</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.proceedsFromBorrowings)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.proceedsFromBorrowings)}</td>}
            </tr>
          )}

          {(current.repaymentOfBorrowings !== 0 || (prior && prior.repaymentOfBorrowings !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Repayment of Borrowings</td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.repaymentOfBorrowings < 0 && 'text-[#DC2626]')}>
                {formatValue(current.repaymentOfBorrowings)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.repaymentOfBorrowings < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.repaymentOfBorrowings)}
                </td>
              )}
            </tr>
          )}

          {(current.financeCostsPaid !== 0 || (prior && prior.financeCostsPaid !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Finance Costs Paid</td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.financeCostsPaid < 0 && 'text-[#DC2626]')}>
                {formatValue(current.financeCostsPaid)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.financeCostsPaid < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.financeCostsPaid)}
                </td>
              )}
            </tr>
          )}

          {(current.dividendsPaid !== 0 || (prior && prior.dividendsPaid !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Dividends Paid</td>
              <td className={cn('px-4 py-1.5 text-right text-sm', current.dividendsPaid < 0 && 'text-[#DC2626]')}>
                {formatValue(current.dividendsPaid)}
              </td>
              {prior && (
                <td className={cn('px-4 py-1.5 text-right text-sm', prior.dividendsPaid < 0 && 'text-[#DC2626]')}>
                  {formatValue(prior.dividendsPaid)}
                </td>
              )}
            </tr>
          )}

          {(current.proceedsFromShareIssue !== 0 || (prior && prior.proceedsFromShareIssue !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Proceeds from Issue of Shares</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.proceedsFromShareIssue)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.proceedsFromShareIssue)}</td>}
            </tr>
          )}

          <tr className="border-t border-[#E2E8F0] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-bold text-[#0F172A]">
              C. Net Cash from Financing Activities
            </th>
            <td className={cn('px-4 py-2 text-right font-bold', current.netFinancingCF < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
              {formatValue(current.netFinancingCF)}
            </td>
            {prior && (
              <td className={cn('px-4 py-2 text-right font-bold', prior.netFinancingCF < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
                {formatValue(prior.netFinancingCF)}
              </td>
            )}
          </tr>

          {/* Net Change & Closing */}
          <tr className="border-t-2 border-[#0F172A] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-3 text-left text-sm font-bold text-[#0F172A]">
              Net Increase/(Decrease) in Cash (A+B+C)
            </th>
            <td className={cn('px-4 py-3 text-right text-base font-bold', current.netCashFlow < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
              {formatValue(current.netCashFlow)}
            </td>
            {prior && (
              <td className={cn('px-4 py-3 text-right text-base font-bold', prior.netCashFlow < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]')}>
                {formatValue(prior.netCashFlow)}
              </td>
            )}
          </tr>

          <tr className="border-t-2 border-[#0F172A] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-3 text-left text-sm font-bold text-[#0F172A]">
              Closing Cash & Cash Equivalents
            </th>
            <td className="px-4 py-3 text-right text-base font-bold text-[#0F172A]">
              {formatValue(current.closingCash)}
            </td>
            {prior && (
              <td className="px-4 py-3 text-right text-base font-bold text-[#0F172A]">
                {formatValue(prior.closingCash)}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
