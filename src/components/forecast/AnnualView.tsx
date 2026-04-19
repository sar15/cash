'use client'

/**
 * Annual View Wrapper
 * 
 * Handles aggregation of monthly engine results into annual statements
 * and passes them to AnnualStatementView for rendering.
 */

import { useMemo, useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import type { EngineResult } from '@/lib/engine'
import type { Company } from '@/stores/company-store'
import { aggregateAnnual } from '@/lib/reports/annual-aggregator'
import { generatePeriodKey } from '@/lib/utils/date-utils'
import { AnnualStatementView } from '@/components/reports/AnnualStatementView'

interface AnnualViewProps {
  engineResult: EngineResult | null
  forecastMonths: string[]
  companyId: string
  scenarioId?: string | null
  company: Company | null
}

export function AnnualView({
  engineResult,
  forecastMonths,
  companyId,
  scenarioId,
  company,
}: AnnualViewProps) {
  const { user } = useUser()
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer'>('viewer')

  // Fetch user role
  useEffect(() => {
    if (!companyId || !user) return

    // Determine role: if user is the company owner, they're 'owner'
    // Otherwise, we'd need to fetch from companyMembers table
    // For now, we'll assume owner if company.clerkUserId matches user.id
    if (company?.clerkUserId === user.id) {
      setUserRole('owner')
    } else {
      // In a real implementation, we'd fetch the role from the API
      // For now, default to 'editor' for non-owners
      setUserRole('editor')
    }
  }, [companyId, user, company])

  // Aggregate current year data
  const currentYear = useMemo(() => {
    if (!engineResult || !engineResult.rawIntegrationResults || engineResult.rawIntegrationResults.length === 0) {
      return null
    }

    const annual = aggregateAnnual(engineResult.rawIntegrationResults)
    
    // Generate period key from company FY settings
    const fyStartMonth = company?.fyStartMonth ?? 4 // Default to April
    const currentYear = new Date().getFullYear()
    const periodKey = generatePeriodKey(fyStartMonth, currentYear)
    
    return {
      ...annual,
      metadata: {
        ...annual.metadata,
        periodLabel: periodKey,
      },
    }
  }, [engineResult, company])

  // TODO: Implement prior year resolution (Task 4 - resolvePriorYear)
  // For now, we'll use null for prior year
  const priorYear = null
  const priorYearDataSource: 'actuals' | 'mixed' | 'forecast' = 'forecast'

  // Generate period keys
  const fyStartMonth = company?.fyStartMonth ?? 4
  const currentYearNum = new Date().getFullYear()
  const periodKey = generatePeriodKey(fyStartMonth, currentYearNum)
  const priorPeriodKey = generatePeriodKey(fyStartMonth, currentYearNum - 1)

  // Loading state
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
      priorYear={priorYear}
      priorYearDataSource={priorYearDataSource}
      companyId={companyId}
      scenarioId={scenarioId}
      periodKey={periodKey}
      priorPeriodKey={priorPeriodKey}
      userRole={userRole}
      forecastUpdatedAt={null}
    />
  )
}
