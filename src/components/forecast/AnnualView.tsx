'use client'

/**
 * Annual View Wrapper
 *
 * Handles aggregation of monthly engine results into annual statements
 * and passes them to AnnualStatementView for rendering.
 */

import { useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import type { EngineResult } from '@/lib/engine'
import type { Company } from '@/stores/company-store'
import { aggregateAnnual } from '@/lib/reports/annual-aggregator'
import { generatePeriodKey } from '@/lib/utils/date-utils'
import { AnnualStatementView } from '@/components/reports/AnnualStatementView'

interface AnnualViewProps {
  engineResult: EngineResult | null
  companyId: string
  scenarioId?: string | null
  company: Company | null
}

export function AnnualView({
  engineResult,
  companyId,
  scenarioId,
  company,
}: AnnualViewProps) {
  const { user } = useUser()

  // Derive role synchronously — no effect needed
  const userRole = useMemo<'owner' | 'editor' | 'viewer'>(() => {
    if (!user || !company) return 'viewer'
    return company.clerkUserId === user.id ? 'owner' : 'editor'
  }, [user, company])

  // Aggregate current year data
  const currentYear = useMemo(() => {
    if (!engineResult?.rawIntegrationResults?.length) return null
    const annual = aggregateAnnual(engineResult.rawIntegrationResults)
    const fyStartMonth = company?.fyStartMonth ?? 4
    const periodKey = generatePeriodKey(fyStartMonth, new Date().getFullYear())
    return { ...annual, metadata: { ...annual.metadata, periodLabel: periodKey } }
  }, [engineResult, company])

  const fyStartMonth = company?.fyStartMonth ?? 4
  const currentYearNum = new Date().getFullYear()
  const periodKey = generatePeriodKey(fyStartMonth, currentYearNum)
  const priorPeriodKey = generatePeriodKey(fyStartMonth, currentYearNum - 1)

  if (!currentYear) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB]" />
          <p className="text-sm text-[#64748B]">Loading annual statements...</p>
        </div>
      </div>
    )
  }

  return (
    <AnnualStatementView
      currentYear={currentYear}
      priorYear={null}
      priorYearDataSource="forecast"
      companyId={companyId}
      scenarioId={scenarioId}
      periodKey={periodKey}
      priorPeriodKey={priorPeriodKey}
      userRole={userRole}
      forecastUpdatedAt={null}
    />
  )
}
