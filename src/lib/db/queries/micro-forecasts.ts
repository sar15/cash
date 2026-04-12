import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function getMicroForecasts(companyId: string) {
  return db.query.microForecasts.findMany({
    where: eq(schema.microForecasts.companyId, companyId),
    with: { lines: true },
    orderBy: (mf, { asc }) => [asc(mf.sortOrder)],
  })
}

export async function getMicroForecastById(forecastId: string, companyId: string) {
  return db.query.microForecasts.findFirst({
    where: and(
      eq(schema.microForecasts.id, forecastId),
      eq(schema.microForecasts.companyId, companyId)
    ),
    with: { lines: true },
  })
}

export async function createMicroForecast(
  companyId: string,
  data: Omit<typeof schema.microForecasts.$inferInsert, 'id' | 'companyId' | 'createdAt'>,
  lines?: Array<Omit<typeof schema.microForecastLines.$inferInsert, 'id' | 'microForecastId'>>
) {
  return db.transaction(async (tx) => {
    const [forecast] = await tx
      .insert(schema.microForecasts)
      .values({
        companyId,
        ...data,
        wizardConfig: typeof data.wizardConfig === 'string' ? data.wizardConfig : JSON.stringify(data.wizardConfig || {}),
      })
      .returning()

    let insertedLines: (typeof schema.microForecastLines.$inferSelect)[] = []
    if (lines && lines.length > 0) {
      insertedLines = await tx
        .insert(schema.microForecastLines)
        .values(
          lines.map((l) => ({
            ...l,
            microForecastId: forecast.id,
            config: typeof l.config === 'string' ? l.config : JSON.stringify(l.config || {}),
          }))
        )
        .returning()
    }

    return { ...forecast, lines: insertedLines }
  })
}

export async function updateMicroForecast(
  forecastId: string,
  companyId: string,
  data: Partial<typeof schema.microForecasts.$inferInsert>,
  lines?: Array<Omit<typeof schema.microForecastLines.$inferInsert, 'id' | 'microForecastId'>>
) {
  return db.transaction(async (tx) => {
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() }
    if (data.wizardConfig && typeof data.wizardConfig !== 'string') {
      updateData.wizardConfig = JSON.stringify(data.wizardConfig)
    }

    const [updated] = await tx
      .update(schema.microForecasts)
      .set(updateData)
      .where(and(
        eq(schema.microForecasts.id, forecastId),
        eq(schema.microForecasts.companyId, companyId)
      ))
      .returning()

    if (!updated) return null

    if (lines !== undefined) {
      await tx
        .delete(schema.microForecastLines)
        .where(eq(schema.microForecastLines.microForecastId, forecastId))

      if (lines.length > 0) {
        await tx
          .insert(schema.microForecastLines)
          .values(
            lines.map((l) => ({
              ...l,
              microForecastId: forecastId,
              config: typeof l.config === 'string' ? l.config : JSON.stringify(l.config || {}),
            }))
          )
      }
    }

    const finalLines = await tx.query.microForecastLines.findMany({
      where: eq(schema.microForecastLines.microForecastId, forecastId),
    })

    return { ...updated, lines: finalLines }
  })
}

export async function deleteMicroForecast(forecastId: string, companyId: string) {
  await db
    .delete(schema.microForecasts)
    .where(and(
      eq(schema.microForecasts.id, forecastId),
      eq(schema.microForecasts.companyId, companyId)
    ))
}
