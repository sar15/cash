import { eq, and, isNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function getForecastResult(companyId: string, scenarioId?: string | null) {
  if (scenarioId) {
    return db.query.forecastResults.findFirst({
      where: and(
        eq(schema.forecastResults.companyId, companyId),
        eq(schema.forecastResults.scenarioId, scenarioId)
      ),
    })
  }
  return db.query.forecastResults.findFirst({
    where: and(
      eq(schema.forecastResults.companyId, companyId),
      isNull(schema.forecastResults.scenarioId)
    ),
  })
}

export async function upsertForecastResult(
  companyId: string,
  data: Omit<typeof schema.forecastResults.$inferInsert, 'id' | 'companyId' | 'createdAt'>
) {
  // Single atomic upsert — no race condition
  // SQLite doesn't support ON CONFLICT on nullable columns well,
  // so we use a transaction with a deterministic ID based on company+scenario
  const stableId = `${companyId}:${data.scenarioId ?? 'baseline'}`

  const [result] = await db
    .insert(schema.forecastResults)
    .values({
      id: stableId,
      companyId,
      ...data,
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
        createdAt: new Date().toISOString(),
      },
    })
    .returning()
  return result
}

// Alias for backward compatibility
export const saveForecastResult = upsertForecastResult
