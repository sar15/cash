'use client'

import { useState, useMemo } from 'react'
import { X, TrendingUp, TrendingDown, RotateCcw, Sliders } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAuto } from '@/lib/utils/indian-format'
import type { EngineResult } from '@/lib/engine'

interface SensitivityPanelProps {
  baselineResult: EngineResult | null
  onClose: () => void
  onRunSensitivity: (params: SensitivityParams) => EngineResult | null
}

export interface SensitivityParams {
  revenueGrowthPct: number
  expenseGrowthPct: number
  collectionDays: number
  paymentDays: number
}

const DEFAULT_PARAMS: SensitivityParams = {
  revenueGrowthPct: 0,
  expenseGrowthPct: 0,
  collectionDays: 0,
  paymentDays: 0,
}

export function SensitivityPanel({
  baselineResult,
  onClose,
  onRunSensitivity,
}: SensitivityPanelProps) {
  const [params, setParams] = useState<SensitivityParams>(DEFAULT_PARAMS)
  const [isComputing, setIsComputing] = useState(false)

  const handleReset = () => {
    setParams(DEFAULT_PARAMS)
  }

  const sensitivityResult = useMemo(() => {
    if (!baselineResult) return null
    if (
      params.revenueGrowthPct === 0 &&
      params.expenseGrowthPct === 0 &&
      params.collectionDays === 0 &&
      params.paymentDays === 0
    ) {
      return null // No changes, don't recompute
    }

    setIsComputing(true)
    try {
      return onRunSensitivity(params)
    } finally {
      setTimeout(() => setIsComputing(false), 300)
    }
  }, [baselineResult, params, onRunSensitivity])

  const impact = useMemo(() => {
    if (!baselineResult || !sensitivityResult) return null

    const baselineIntegration = baselineResult.integrationResults
    const sensitivityIntegration = sensitivityResult.integrationResults

    const baselineClosingCash =
      baselineIntegration[baselineIntegration.length - 1]?.bs.cash ?? 0
    const sensitivityClosingCash =
      sensitivityIntegration[sensitivityIntegration.length - 1]?.bs.cash ?? 0

    const baselineNetIncome = baselineIntegration.reduce(
      (sum, m) => sum + m.pl.netIncome,
      0
    )
    const sensitivityNetIncome = sensitivityIntegration.reduce(
      (sum, m) => sum + m.pl.netIncome,
      0
    )

    // Calculate runway (months until cash runs out)
    const calculateRunway = (results: typeof baselineIntegration) => {
      for (let i = 0; i < results.length; i++) {
        if (results[i].bs.cash < 0) return i
      }
      return results.length // Positive cash throughout
    }

    const baselineRunway = calculateRunway(baselineIntegration)
    const sensitivityRunway = calculateRunway(sensitivityIntegration)

    return {
      cashDelta: sensitivityClosingCash - baselineClosingCash,
      incomeDelta: sensitivityNetIncome - baselineNetIncome,
      runwayDelta: sensitivityRunway - baselineRunway,
      baselineCash: baselineClosingCash,
      sensitivityCash: sensitivityClosingCash,
      baselineIncome: baselineNetIncome,
      sensitivityIncome: sensitivityNetIncome,
      baselineRunway,
      sensitivityRunway,
    }
  }, [baselineResult, sensitivityResult])

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-[#059669]" />
          <h3 className="text-sm font-semibold text-[#0F172A]">
            Sensitivity Analysis
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-[#94A3B8] transition-colors hover:bg-[#F8FAFC] hover:text-[#475569]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Revenue Growth */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-[#0F172A]">
                Revenue Growth
              </label>
              <span className="font-num text-xs font-semibold text-[#059669]">
                {params.revenueGrowthPct > 0 ? '+' : ''}
                {params.revenueGrowthPct}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="5"
              value={params.revenueGrowthPct}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  revenueGrowthPct: Number(e.target.value),
                }))
              }
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#94A3B8]">
              <span>-50%</span>
              <span>0%</span>
              <span>+50%</span>
            </div>
          </div>

          {/* Expense Growth */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-[#0F172A]">
                Expense Growth
              </label>
              <span className="font-num text-xs font-semibold text-[#DC2626]">
                {params.expenseGrowthPct > 0 ? '+' : ''}
                {params.expenseGrowthPct}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="5"
              value={params.expenseGrowthPct}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  expenseGrowthPct: Number(e.target.value),
                }))
              }
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#94A3B8]">
              <span>-50%</span>
              <span>0%</span>
              <span>+50%</span>
            </div>
          </div>

          {/* Collection Days */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-[#0F172A]">
                Collection Days (AR)
              </label>
              <span className="font-num text-xs font-semibold text-[#334155]">
                {params.collectionDays > 0 ? '+' : ''}
                {params.collectionDays}d
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="30"
              step="5"
              value={params.collectionDays}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  collectionDays: Number(e.target.value),
                }))
              }
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#94A3B8]">
              <span>-30d</span>
              <span>0d</span>
              <span>+30d</span>
            </div>
          </div>

          {/* Payment Days */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-[#0F172A]">
                Payment Days (AP)
              </label>
              <span className="font-num text-xs font-semibold text-[#334155]">
                {params.paymentDays > 0 ? '+' : ''}
                {params.paymentDays}d
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="30"
              step="5"
              value={params.paymentDays}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  paymentDays: Number(e.target.value),
                }))
              }
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#94A3B8]">
              <span>-30d</span>
              <span>0d</span>
              <span>+30d</span>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#64748B] transition-colors hover:border-[#CBD5E1] hover:text-[#475569]"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Baseline
          </button>

          {/* Impact Summary */}
          {impact && (
            <div className="mt-6 space-y-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="flex items-center gap-2">
                {isComputing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#059669]" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-[#059669]" />
                )}
                <h4 className="text-xs font-semibold text-[#0F172A]">
                  Impact Analysis
                </h4>
              </div>

              {/* 12-Month Closing Cash */}
              <div>
                <p className="text-[10px] text-[#94A3B8]">
                  12-Month Closing Cash
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="font-num text-lg font-semibold text-[#0F172A]">
                    {formatAuto(impact.sensitivityCash)}
                  </p>
                  <div
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium',
                      impact.cashDelta > 0 && 'text-[#059669]',
                      impact.cashDelta < 0 && 'text-[#DC2626]',
                      impact.cashDelta === 0 && 'text-[#94A3B8]'
                    )}
                  >
                    {impact.cashDelta > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : impact.cashDelta < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : null}
                    {impact.cashDelta !== 0 && formatAuto(Math.abs(impact.cashDelta))}
                  </div>
                </div>
              </div>

              {/* Net Income */}
              <div>
                <p className="text-[10px] text-[#94A3B8]">Total Net Income</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="font-num text-lg font-semibold text-[#0F172A]">
                    {formatAuto(impact.sensitivityIncome)}
                  </p>
                  <div
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium',
                      impact.incomeDelta > 0 && 'text-[#059669]',
                      impact.incomeDelta < 0 && 'text-[#DC2626]',
                      impact.incomeDelta === 0 && 'text-[#94A3B8]'
                    )}
                  >
                    {impact.incomeDelta > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : impact.incomeDelta < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : null}
                    {impact.incomeDelta !== 0 &&
                      formatAuto(Math.abs(impact.incomeDelta))}
                  </div>
                </div>
              </div>

              {/* Cash Runway */}
              <div>
                <p className="text-[10px] text-[#94A3B8]">Cash Runway</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="font-num text-lg font-semibold text-[#0F172A]">
                    {impact.sensitivityRunway >= 12
                      ? '12+ months'
                      : `${impact.sensitivityRunway} months`}
                  </p>
                  {impact.runwayDelta !== 0 && (
                    <div
                      className={cn(
                        'flex items-center gap-1 text-xs font-medium',
                        impact.runwayDelta > 0 && 'text-[#059669]',
                        impact.runwayDelta < 0 && 'text-[#DC2626]'
                      )}
                    >
                      {impact.runwayDelta > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(impact.runwayDelta)} months
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
