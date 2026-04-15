'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Search } from 'lucide-react'
import { PageHeader, HeaderBadge, SurfaceCard } from '@/components/shared/page-header'
import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'

interface FirmCompany {
  id: string
  name: string
  industry: string
  cashRunwayMonths: number | null
  cashRunwayDays: number | null
  netIncome: number
  complianceHealth: 'good' | 'warning' | 'critical'
  lastUpdated: string
}

type SortField = 'name' | 'runway' | 'income' | 'updated'
type SortDirection = 'asc' | 'desc'

export default function FirmPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<FirmCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField] = useState<SortField>('name')
  const [sortDirection] = useState<SortDirection>('asc')
  const [filterCompliance, setFilterCompliance] = useState<'all' | 'good' | 'warning' | 'critical'>('all')

  useEffect(() => {
    fetch('/api/firm/companies')
      .then(r => r.ok ? r.json() : null)
      .then((data: { companies?: FirmCompany[] } | null) => {
        if (data?.companies) setCompanies(data.companies)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const filteredAndSorted = useMemo(() => {
    let result = companies

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.industry.toLowerCase().includes(query)
      )
    }

    // Filter by compliance
    if (filterCompliance !== 'all') {
      result = result.filter(c => c.complianceHealth === filterCompliance)
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: string | number, bVal: string | number
      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'runway':
          aVal = a.cashRunwayDays ?? -1
          bVal = b.cashRunwayDays ?? -1
          break
        case 'income':
          aVal = a.netIncome
          bVal = b.netIncome
          break
        case 'updated':
          aVal = new Date(a.lastUpdated).getTime()
          bVal = new Date(b.lastUpdated).getTime()
          break
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [companies, searchQuery, sortField, sortDirection, filterCompliance])

  const complianceStats = useMemo(() => ({
    good: companies.filter(c => c.complianceHealth === 'good').length,
    warning: companies.filter(c => c.complianceHealth === 'warning').length,
    critical: companies.filter(c => c.complianceHealth === 'critical').length,
  }), [companies])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          <p className="text-sm text-[#94A3B8]">Loading firm dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="CA Firm"
        title="Multi-Company Dashboard"
        description="Manage all client companies from one view"
        badges={
          <>
            <HeaderBadge label={`${companies.length} companies`} />
            {complianceStats.critical > 0 && (
              <HeaderBadge label={`${complianceStats.critical} critical`} tone="danger" />
            )}
            {complianceStats.warning > 0 && (
              <HeaderBadge label={`${complianceStats.warning} warnings`} tone="warning" />
            )}
          </>
        }
      />

      {/* Search and Filters */}
      <SurfaceCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2 pl-10 pr-4 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterCompliance('all')}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                filterCompliance === 'all'
                  ? 'border-[#059669] bg-[#ECFDF5] text-[#059669]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]'
              )}
            >
              All ({companies.length})
            </button>
            <button
              onClick={() => setFilterCompliance('good')}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                filterCompliance === 'good'
                  ? 'border-[#059669] bg-[#ECFDF5] text-[#059669]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]'
              )}
            >
              Good ({complianceStats.good})
            </button>
            {complianceStats.warning > 0 && (
              <button
                onClick={() => setFilterCompliance('warning')}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                  filterCompliance === 'warning'
                    ? 'border-[#D97706] bg-[#FFFBEB] text-[#D97706]'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]'
                )}
              >
                Warning ({complianceStats.warning})
              </button>
            )}
            {complianceStats.critical > 0 && (
              <button
                onClick={() => setFilterCompliance('critical')}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                  filterCompliance === 'critical'
                    ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]'
                )}
              >
                Critical ({complianceStats.critical})
              </button>
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* Company Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAndSorted.map(company => (
          <div
            key={company.id}
            onClick={() => router.push(`/dashboard?companyId=${company.id}`)}
          >
            <SurfaceCard
              className="cursor-pointer transition-all hover:border-[#CBD5E1] hover:shadow-sm"
            >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                  <Building2 className="h-5 w-5 text-[#64748B]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F172A]">{company.name}</h3>
                  <p className="text-xs text-[#94A3B8]">{company.industry}</p>
                </div>
              </div>
              <span className={cn(
                'health-dot',
                company.complianceHealth === 'good' && 'health-dot-green',
                company.complianceHealth === 'warning' && 'health-dot-amber',
                company.complianceHealth === 'critical' && 'health-dot-red',
              )} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[#94A3B8]">Cash Runway</p>
                <p className="mt-1 font-num text-lg font-semibold text-[#0F172A]">
                  {company.cashRunwayMonths !== null
                    ? company.cashRunwayMonths >= 36
                      ? '36+ mo'
                      : `${company.cashRunwayMonths}mo`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#94A3B8]">Net Income</p>
                <div className="mt-1 flex items-center gap-1">
                  {company.netIncome > 0 ? (
                    <TrendingUp className="h-3 w-3 text-[#059669]" />
                  ) : company.netIncome < 0 ? (
                    <TrendingDown className="h-3 w-3 text-[#DC2626]" />
                  ) : null}
                  <p className={cn(
                    'font-num text-lg font-semibold',
                    company.netIncome > 0 && 'text-[#059669]',
                    company.netIncome < 0 && 'text-[#DC2626]',
                    company.netIncome === 0 && 'text-[#94A3B8]'
                  )}>
                    {formatAuto(company.netIncome)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-3">
              <p className="text-xs text-[#94A3B8]">
                Updated {new Date(company.lastUpdated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
              <div className="flex items-center gap-1">
                {company.complianceHealth === 'good' && (
                  <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                )}
                {company.complianceHealth === 'warning' && (
                  <AlertTriangle className="h-4 w-4 text-[#D97706]" />
                )}
                {company.complianceHealth === 'critical' && (
                  <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
                )}
              </div>
            </div>
          </SurfaceCard>
          </div>
        ))}
      </div>

      {filteredAndSorted.length === 0 && (
        <SurfaceCard>
          <div className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-[#CBD5E1]" />
            <p className="mt-3 text-sm font-medium text-[#0F172A]">No companies found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {searchQuery ? 'Try a different search term' : 'Add companies to get started'}
            </p>
          </div>
        </SurfaceCard>
      )}
    </div>
  )
}
