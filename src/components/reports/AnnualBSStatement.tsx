'use client'

/**
 * Annual Balance Sheet Statement Component
 * 
 * Renders Schedule III-compliant Balance Sheet
 * with two columns: Current Year | Prior Year
 * Structure: Equity & Liabilities first, then Assets
 */

import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'
import type { AnnualStatement } from '@/lib/reports/annual-aggregator'

export interface AnnualBSStatementProps {
  current: AnnualStatement['bs']
  prior: AnnualStatement['bs'] | null
  priorDataSource: 'actuals' | 'mixed' | 'forecast'
  currentPeriodLabel: string
  priorPeriodLabel: string
}

export function AnnualBSStatement({
  current,
  prior,
  priorDataSource,
  currentPeriodLabel,
  priorPeriodLabel,
}: AnnualBSStatementProps) {
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
        aria-label="Schedule III Balance Sheet"
      >
        <thead>
          <tr className="border-b-2 border-[#0F172A]">
            <th
              scope="col"
              className="px-4 py-3 text-left text-sm font-bold text-[#0F172A]"
            >
              Balance Sheet
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
          {/* ══════════════════════════════════════════════════════════════ */}
          {/* EQUITY & LIABILITIES */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              EQUITY & LIABILITIES
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          {/* Shareholders' Funds */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              Shareholders' Funds
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          <tr className="hover:bg-[#F8FAFC]">
            <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Share Capital</td>
            <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.shareCapital)}</td>
            {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.shareCapital)}</td>}
          </tr>

          {(current.securitiesPremium !== 0 || (prior && prior.securitiesPremium !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Securities Premium Reserve</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.securitiesPremium)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.securitiesPremium)}</td>}
            </tr>
          )}

          {(current.generalReserve !== 0 || (prior && prior.generalReserve !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">General Reserve</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.generalReserve)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.generalReserve)}</td>}
            </tr>
          )}

          <tr className="hover:bg-[#F8FAFC]">
            <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Retained Earnings (P&L Balance)</td>
            <td className={cn('px-4 py-1.5 text-right text-sm', current.retainedEarnings < 0 && 'text-[#DC2626]')}>
              {formatValue(current.retainedEarnings)}
            </td>
            {prior && (
              <td className={cn('px-4 py-1.5 text-right text-sm', prior.retainedEarnings < 0 && 'text-[#DC2626]')}>
                {formatValue(prior.retainedEarnings)}
              </td>
            )}
          </tr>

          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-semibold text-[#334155]">
              Total Shareholders' Funds
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#334155]">
              {formatValue(current.totalShareholdersEquity)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#334155]">
                {formatValue(prior.totalShareholdersEquity)}
              </td>
            )}
          </tr>

          {/* Non-Current Liabilities */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              Non-Current Liabilities
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          {(current.ltBorrowings !== 0 || (prior && prior.ltBorrowings !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Long-term Borrowings</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.ltBorrowings)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.ltBorrowings)}</td>}
            </tr>
          )}

          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-semibold text-[#334155]">
              Total Non-Current Liabilities
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#334155]">
              {formatValue(current.totalNonCurrentLiabilities)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#334155]">
                {formatValue(prior.totalNonCurrentLiabilities)}
              </td>
            )}
          </tr>

          {/* Current Liabilities */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              Current Liabilities
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          {(current.stBorrowings !== 0 || (prior && prior.stBorrowings !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Short-term Borrowings</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.stBorrowings)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.stBorrowings)}</td>}
            </tr>
          )}

          <tr className="hover:bg-[#F8FAFC]">
            <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Trade Payables</td>
            <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.ap)}</td>
            {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.ap)}</td>}
          </tr>

          {(current.otherCurrentLiabilities !== 0 || (prior && prior.otherCurrentLiabilities !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Other Current Liabilities</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.otherCurrentLiabilities)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.otherCurrentLiabilities)}</td>}
            </tr>
          )}

          {(current.stProvisions !== 0 || (prior && prior.stProvisions !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Short-term Provisions</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.stProvisions)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.stProvisions)}</td>}
            </tr>
          )}

          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-semibold text-[#334155]">
              Total Current Liabilities
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#334155]">
              {formatValue(current.totalCurrentLiabilities)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#334155]">
                {formatValue(prior.totalCurrentLiabilities)}
              </td>
            )}
          </tr>

          {/* Total Equity & Liabilities */}
          <tr className="border-t-2 border-[#0F172A] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-3 text-left text-sm font-bold text-[#0F172A]">
              Total Equity & Liabilities
            </th>
            <td className="px-4 py-3 text-right text-base font-bold text-[#0F172A]">
              {formatValue(current.totalShareholdersEquity + current.totalNonCurrentLiabilities + current.totalCurrentLiabilities)}
            </td>
            {prior && (
              <td className="px-4 py-3 text-right text-base font-bold text-[#0F172A]">
                {formatValue(prior.totalShareholdersEquity + prior.totalNonCurrentLiabilities + prior.totalCurrentLiabilities)}
              </td>
            )}
          </tr>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* ASSETS */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              ASSETS
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          {/* Non-Current Assets */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              Non-Current Assets
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          <tr className="hover:bg-[#F8FAFC]">
            <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Property, Plant & Equipment (Net)</td>
            <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.netPPE)}</td>
            {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.netPPE)}</td>}
          </tr>

          {(current.netIntangibles !== 0 || (prior && prior.netIntangibles !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Intangible Assets (Net)</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.netIntangibles)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.netIntangibles)}</td>}
            </tr>
          )}

          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-semibold text-[#334155]">
              Total Non-Current Assets
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#334155]">
              {formatValue(current.totalNonCurrentAssets)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#334155]">
                {formatValue(prior.totalNonCurrentAssets)}
              </td>
            )}
          </tr>

          {/* Current Assets */}
          <tr className="bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              Current Assets
            </th>
            <td className="px-4 py-2"></td>
            {prior && <td className="px-4 py-2"></td>}
          </tr>

          {(current.inventories !== 0 || (prior && prior.inventories !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Inventories</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.inventories)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.inventories)}</td>}
            </tr>
          )}

          <tr className="hover:bg-[#F8FAFC]">
            <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Trade Receivables</td>
            <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.tradeReceivables)}</td>
            {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.tradeReceivables)}</td>}
          </tr>

          {(current.stLoansAdvances !== 0 || (prior && prior.stLoansAdvances !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Short-term Loans & Advances</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.stLoansAdvances)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.stLoansAdvances)}</td>}
            </tr>
          )}

          {(current.otherCurrentAssets !== 0 || (prior && prior.otherCurrentAssets !== 0)) && (
            <tr className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Other Current Assets</td>
              <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.otherCurrentAssets)}</td>
              {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.otherCurrentAssets)}</td>}
            </tr>
          )}

          <tr className="hover:bg-[#F8FAFC]">
            <td className="px-4 py-1.5 pl-8 text-sm text-[#334155]">Cash & Cash Equivalents</td>
            <td className="px-4 py-1.5 text-right text-sm">{formatValue(current.cash)}</td>
            {prior && <td className="px-4 py-1.5 text-right text-sm">{formatValue(prior.cash)}</td>}
          </tr>

          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <th scope="row" className="px-4 py-2 text-left text-sm font-semibold text-[#334155]">
              Total Current Assets
            </th>
            <td className="px-4 py-2 text-right font-semibold text-[#334155]">
              {formatValue(current.totalCurrentAssets)}
            </td>
            {prior && (
              <td className="px-4 py-2 text-right font-semibold text-[#334155]">
                {formatValue(prior.totalCurrentAssets)}
              </td>
            )}
          </tr>

          {/* Total Assets */}
          <tr className="border-t-2 border-[#0F172A] bg-[#F1F5F9]">
            <th scope="row" className="px-4 py-3 text-left text-sm font-bold text-[#0F172A]">
              Total Assets
            </th>
            <td className="px-4 py-3 text-right text-base font-bold text-[#0F172A]">
              {formatValue(current.totalAssets)}
            </td>
            {prior && (
              <td className="px-4 py-3 text-right text-base font-bold text-[#0F172A]">
                {formatValue(prior.totalAssets)}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
