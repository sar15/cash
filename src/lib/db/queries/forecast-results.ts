import { eq, and, isNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function getForecastResult(companyId: string, scenarioId?: string | null) {
  const result = await (scenarioId
    ? db.query.forecastResults.findFirst({
        where: and(
          eq(schema.forecastResults.companyId, companyId),
          eq(schema.forecastResults.scenarioId, scenarioId)
        ),
      })
    : db.query.forecastResults.findFirst({
        where: and(
          eq(schema.forecastResults.companyId, companyId),
          isNull(schema.forecastResults.scenarioId)
        ),
      }))

  if (!result) return null

  // STALE DETECTION: If a job has been 'calculating' for more than 5 minutes,
  // it likely crashed or timed out in Inngest. Treat it as 'stale' so the UI
  // can trigger a re-run instead of being stuck.
  if (result.status === 'calculating' && result.calculatingStartedAt) {
    const started = new Date(result.calculatingStartedAt).getTime()
    const now = new Date().getTime()
    const fiveMinutes = 5 * 60 * 1000

    if (now - started > fiveMinutes) {
      return { ...result, status: 'stale' }
    }
  }

  return result
}

export async function upsertForecastResult(
  companyId: string,
  data: Omit<typeof schema.forecastResults.$inferInsert, 'id' | 'companyId' | 'createdAt'>
) {
  // Single atomic upsert — deterministic ID avoids race conditions on nullable scenarioId
  const stableId = `${companyId}:${data.scenarioId ?? 'baseline'}`

  const result = await db
    .insert(schema.forecastResults)
    .values({
      id: stableId,
      companyId,
      ...data,
      status: 'ready',
      calculatingStartedAt: null,
      version: 1,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [schema.forecastResults.id],
      set: {
        plData: data.plData,
        bsData: data.bsData,
        cfData: data.cfData,
        compliance: data.compliance,
        metrics: data.metrics,
        status: 'ready',
        calculatingStartedAt: null,
        createdAt: new Date().toISOString(),
      },
    })
    .returning()
  return result[0]
}

/**
 * Mark a forecast result as stale when its inputs change (value rules, timing profiles, imports).
 * The UI should block PDF export and show a "Recalculating..." indicator when status = 'stale'.
 */
export async function markForecastStale(companyId: string, scenarioId?: string | null) {
  const stableId = `${companyId}:${scenarioId ?? 'baseline'}`
  await db
    .update(schema.forecastResults)
    .set({ status: 'stale', calculatingStartedAt: null })
    .where(eq(schema.forecastResults.id, stableId))
}

/**
 * Mark a forecast result as calculating (Inngest job started).
 */
export async function markForecastCalculating(companyId: string, scenarioId?: string | null) {
  const stableId = `${companyId}:${scenarioId ?? 'baseline'}`
  await db
    .update(schema.forecastResults)
    .set({ 
      status: 'calculating', 
      calculatingStartedAt: new Date().toISOString() 
    })
    .where(eq(schema.forecastResults.id, stableId))
}

// Alias for backward compatibility
export const saveForecastResult = upsertForecastResult
