import { db } from '@/lib/db'
import { companies, companyMembers, forecastResults, gstFilings } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

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
 */
export async function getFirmCompanies(clerkUserId: string): Promise<FirmCompanySummary[]> {
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

  const today = new Date()

  const summaries: FirmCompanySummary[] = await Promise.all(
    allCompanies.map(async (company) => {
      // Pull cached baseline forecast result
      const cached = await db.query.forecastResults.findFirst({
        where: and(
          eq(forecastResults.companyId, company.id),
          isNull(forecastResults.scenarioId)
        ),
      })

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

          // Runway = closingCash / avgMonthlyBurn (capped at 36)
          const closingCash = metrics.closingCash ?? 0
          const cfMonths = cfData.months ?? []
          const negativeCFMonths = cfMonths.filter(m => (m?.operatingCashFlow ?? 0) < 0)
          if (negativeCFMonths.length > 0) {
            const avgBurn = Math.abs(
              negativeCFMonths.reduce((s, m) => s + (m?.operatingCashFlow ?? 0), 0) / negativeCFMonths.length
            )
            if (avgBurn > 0) {
              cashRunwayMonths = Math.min(36, Math.round((closingCash / avgBurn) * 10) / 10)
            }
          } else if (closingCash > 0) {
            cashRunwayMonths = 36 // Positive cash throughout — capped at 36
          }
        } catch {}
      }

      // Compliance health: check for overdue GST filings
      const overdueFilings = await db.query.gstFilings.findMany({
        where: and(
          eq(gstFilings.companyId, company.id),
          eq(gstFilings.status, 'overdue')
        ),
      })

      // Check for filings due within 7 days
      const pendingFilings = await db.query.gstFilings.findMany({
        where: and(
          eq(gstFilings.companyId, company.id),
          eq(gstFilings.status, 'pending')
        ),
      })
      const dueSoon = pendingFilings.filter(f => {
        const due = new Date(f.dueDate)
        const daysUntilDue = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
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
  )

  return summaries
}
