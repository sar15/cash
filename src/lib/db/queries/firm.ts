import { db } from '@/lib/db'
import { companies, companyMembers, forecastResults, gstFilings } from '@/lib/db/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { getFirmClientCompanies } from '@/lib/db/queries/firms'
import { getOrCreateUserProfile } from '@/lib/db/queries/user-profiles'
import { todayISTString } from '@/lib/utils/ist'

export interface FirmCompanySummary {
  id: string
  name: string
  industry: string
  cashRunwayMonths: number | null
  cashRunwayDays: number | null
  netIncome: number
  complianceHealth: 'good' | 'warning' | 'critical'
  lastUpdated: string
}

/**
 * Get all companies accessible by a user (owned or member) with real metrics
 * from cached forecast_results — no engine re-run on page load.
 *
 * All DB queries are batched by company IDs to avoid N+1.
 */
export async function getFirmCompanies(clerkUserId: string): Promise<FirmCompanySummary[]> {
  const profile = await getOrCreateUserProfile(clerkUserId)

  // Get companies where user is owner
  const ownedCompanies = await db.query.companies.findMany({
    where: eq(companies.clerkUserId, clerkUserId),
  })

  // Get companies where user is an accepted member
  const memberRows = await db.query.companyMembers.findMany({
    where: eq(companyMembers.clerkUserId, clerkUserId),
    with: { company: true },
  })

  // Deduplicate
  const seen = new Set<string>()
  const allCompanies: typeof ownedCompanies = []
  for (const c of ownedCompanies) {
    if (!seen.has(c.id)) { seen.add(c.id); allCompanies.push(c) }
  }
  for (const m of memberRows) {
    if (m.company && !seen.has(m.company.id)) { seen.add(m.company.id); allCompanies.push(m.company) }
  }

  if (profile.userType === 'ca_firm') {
    const firmCompanies = await getFirmClientCompanies(clerkUserId)
    for (const c of firmCompanies) {
      if (!seen.has(c.id)) { seen.add(c.id); allCompanies.push(c) }
    }
  }

  if (allCompanies.length === 0) return []

  const companyIds = allCompanies.map((c) => c.id)

  // Batch fetch all baseline forecast results in one query
  const allForecastResults = await db.query.forecastResults.findMany({
    where: and(
      inArray(forecastResults.companyId, companyIds),
      isNull(forecastResults.scenarioId)
    ),
  })
  const forecastByCompany = new Map(allForecastResults.map((r) => [r.companyId, r]))

  // Batch fetch all GST filings in one query
  const allFilings = await db.query.gstFilings.findMany({
    where: inArray(gstFilings.companyId, companyIds),
  })

  // Group filings by company
  const filingsByCompany = new Map<string, typeof allFilings>()
  for (const filing of allFilings) {
    const list = filingsByCompany.get(filing.companyId) ?? []
    list.push(filing)
    filingsByCompany.set(filing.companyId, list)
  }

  const todayStr = todayISTString()
  const todayMs = new Date(todayStr).getTime()

  return allCompanies.map((company) => {
    const cached = forecastByCompany.get(company.id)

    let cashRunwayMonths: number | null = null
    let netIncome = 0
    let lastUpdated = company.updatedAt ?? new Date().toISOString()

    if (cached) {
      lastUpdated = cached.createdAt ?? lastUpdated
      try {
        const metrics = JSON.parse(cached.metrics) as {
          closingCash?: number
          totalNetIncome?: number
          forecastMonths?: string[]
        }
        const cfData = JSON.parse(cached.cfData) as { months?: Array<{ operatingCashFlow?: number }> }

        netIncome = metrics.totalNetIncome ?? 0

        const closingCash = metrics.closingCash ?? 0
        const cfMonths = cfData.months ?? []
        const negativeCFMonths = cfMonths.filter((m) => (m?.operatingCashFlow ?? 0) < 0)
        if (negativeCFMonths.length > 0) {
          const avgBurn = Math.abs(
            negativeCFMonths.reduce((s, m) => s + (m?.operatingCashFlow ?? 0), 0) / negativeCFMonths.length
          )
          if (avgBurn > 0) {
            cashRunwayMonths = Math.min(36, Math.round((closingCash / avgBurn) * 10) / 10)
          }
        } else if (closingCash > 0) {
          cashRunwayMonths = 36
        }
      } catch {}
    }

    const companyFilings = filingsByCompany.get(company.id) ?? []
    const overdueFilings = companyFilings.filter((f) => f.status === 'overdue')
    const dueSoon = companyFilings.filter((f) => {
      if (f.status !== 'pending') return false
      const due = new Date(f.dueDate)
      const daysUntilDue = (due.getTime() - todayMs) / (1000 * 60 * 60 * 24)
      return daysUntilDue <= 7
    })

    let complianceHealth: 'good' | 'warning' | 'critical' = 'good'
    if (overdueFilings.length > 0) complianceHealth = 'critical'
    else if (dueSoon.length > 0) complianceHealth = 'warning'

    return {
      id: company.id,
      name: company.name,
      industry: company.industry ?? 'general',
      cashRunwayMonths,
      cashRunwayDays: cashRunwayMonths !== null ? Math.round(cashRunwayMonths * 30) : null,
      netIncome,
      complianceHealth,
      lastUpdated,
    }
  })
}
