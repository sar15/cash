import { eq, and } from 'drizzle-orm'
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
    where: eq(schema.forecastResults.companyId, companyId),
  })
}

export async function saveForecastResult(
  companyId: string,
  data: Omit<typeof schema.forecastResults.$inferInsert, 'id' | 'companyId' | 'createdAt'>
) {
  const [result] = await db
    .insert(schema.forecastResults)
    .values({ companyId, ...data })
    .returning()
  return result
}
