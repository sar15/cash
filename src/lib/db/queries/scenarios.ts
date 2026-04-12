import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function getScenarios(companyId: string) {
  return db.query.scenarios.findMany({
    where: eq(schema.scenarios.companyId, companyId),
    with: { overrides: true },
    orderBy: (scenarios, { asc }) => [asc(scenarios.createdAt)],
  })
}

export async function getScenarioById(scenarioId: string, companyId: string) {
  return db.query.scenarios.findFirst({
    where: and(eq(schema.scenarios.id, scenarioId), eq(schema.scenarios.companyId, companyId)),
    with: { overrides: true },
  })
}

export async function createScenario(
  companyId: string,
  data: Omit<typeof schema.scenarios.$inferInsert, 'id' | 'companyId' | 'createdAt'>
) {
  const [scenario] = await db
    .insert(schema.scenarios)
    .values({ companyId, ...data })
    .returning()
  return scenario
}

export async function updateScenario(
  scenarioId: string,
  companyId: string,
  data: Partial<typeof schema.scenarios.$inferInsert>
) {
  const [updated] = await db
    .update(schema.scenarios)
    .set(data)
    .where(and(eq(schema.scenarios.id, scenarioId), eq(schema.scenarios.companyId, companyId)))
    .returning()
  return updated
}

export async function deleteScenario(scenarioId: string, companyId: string) {
  await db
    .delete(schema.scenarios)
    .where(and(eq(schema.scenarios.id, scenarioId), eq(schema.scenarios.companyId, companyId)))
}

export async function getScenarioOverrides(scenarioId: string) {
  return db.query.scenarioOverrides.findMany({
    where: eq(schema.scenarioOverrides.scenarioId, scenarioId),
  })
}

export async function saveScenarioOverrides(
  scenarioId: string,
  overrides: Array<Omit<typeof schema.scenarioOverrides.$inferInsert, 'id' | 'scenarioId'>>
) {
  return db.transaction(async (tx) => {
    await tx
      .delete(schema.scenarioOverrides)
      .where(eq(schema.scenarioOverrides.scenarioId, scenarioId))

    if (overrides.length === 0) return []

    return tx
      .insert(schema.scenarioOverrides)
      .values(overrides.map((o) => ({ ...o, scenarioId, config: typeof o.config === 'string' ? o.config : JSON.stringify(o.config) })))
      .returning()
  })
}
