/**
 * Tax Rate History Queries
 *
 * Resolves the effective compliance rate for a given period.
 * The engine calls resolveRatesForPeriods() to get per-period rates
 * instead of using the flat complianceConfig values.
 *
 * This prevents Budget Day changes from retroactively corrupting
 * historical forecast periods.
 */

import { and, eq, lte } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export type TaxRateType = 'gst' | 'corporate_tax' | 'itc_pct'

export interface EffectiveRates {
  gstRate: number        // e.g. 18.0
  corporateTaxRate: number // e.g. 25.17
  itcPct: number         // e.g. 85.0
}

/**
 * Get all tax rate history entries for a company, ordered by effectiveFrom ascending.
 */
export async function getTaxRateHistory(companyId: string) {
  return db.query.taxRateHistory.findMany({
    where: eq(schema.taxRateHistory.companyId, companyId),
    orderBy: (t, { asc }) => [asc(t.rateType), asc(t.effectiveFrom)],
  })
}

/**
 * Insert a new effective-dated rate entry.
 * Call this when the user updates their compliance config after a Budget Day change.
 */
export async function insertTaxRateEntry(
  companyId: string,
  rateType: TaxRateType,
  rate: number,
  effectiveFrom: string, // YYYY-MM-01
  notes?: string
) {
  const [entry] = await db
    .insert(schema.taxRateHistory)
    .values({ companyId, rateType, rate, effectiveFrom, notes })
    .returning()
  return entry
}

/**
 * Resolve the effective rate for a specific period.
 * Returns the latest entry whose effectiveFrom <= period.
 * Falls back to the flat complianceConfig value if no history exists.
 */
export async function resolveEffectiveRate(
  companyId: string,
  rateType: TaxRateType,
  period: string, // YYYY-MM-01
  fallback: number
): Promise<number> {
  const entry = await db.query.taxRateHistory.findFirst({
    where: and(
      eq(schema.taxRateHistory.companyId, companyId),
      eq(schema.taxRateHistory.rateType, rateType),
      lte(schema.taxRateHistory.effectiveFrom, period)
    ),
    orderBy: (t, { desc }) => [desc(t.effectiveFrom)],
  })
  return entry?.rate ?? fallback
}

/**
 * Resolve all three rates for an array of periods in a single batch query.
 * Returns a map of period → EffectiveRates.
 * Used by the Inngest recompute worker to pass per-period rates to the engine.
 */
export async function resolveRatesForPeriods(
  companyId: string,
  periods: string[],
  fallbacks: EffectiveRates
): Promise<Map<string, EffectiveRates>> {
  if (periods.length === 0) return new Map()

  // Fetch all history entries for this company once
  const history = await db.query.taxRateHistory.findMany({
    where: eq(schema.taxRateHistory.companyId, companyId),
    orderBy: (t, { asc }) => [asc(t.rateType), asc(t.effectiveFrom)],
  })

  // Group by rateType
  const byType = new Map<TaxRateType, Array<{ effectiveFrom: string; rate: number }>>()
  for (const entry of history) {
    const key = entry.rateType as TaxRateType
    if (!byType.has(key)) byType.set(key, [])
    byType.get(key)!.push({ effectiveFrom: entry.effectiveFrom, rate: entry.rate })
  }

  /**
   * Binary-search for the latest entry whose effectiveFrom <= period.
   */
  function findRate(
    entries: Array<{ effectiveFrom: string; rate: number }> | undefined,
    period: string,
    fallback: number
  ): number {
    if (!entries || entries.length === 0) return fallback
    // entries are sorted ascending by effectiveFrom
    let result = fallback
    for (const e of entries) {
      if (e.effectiveFrom <= period) result = e.rate
      else break
    }
    return result
  }

  const result = new Map<string, EffectiveRates>()
  for (const period of periods) {
    result.set(period, {
      gstRate: findRate(byType.get('gst'), period, fallbacks.gstRate),
      corporateTaxRate: findRate(byType.get('corporate_tax'), period, fallbacks.corporateTaxRate),
      itcPct: findRate(byType.get('itc_pct'), period, fallbacks.itcPct),
    })
  }

  return result
}
