import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function getValueRules(companyId: string, scenarioId?: string | null) {
  if (scenarioId) {
    return db.query.valueRules.findMany({
      where: and(
        eq(schema.valueRules.companyId, companyId),
        eq(schema.valueRules.scenarioId, scenarioId)
      ),
    })
  }
  return db.query.valueRules.findMany({
    where: eq(schema.valueRules.companyId, companyId),
  })
}

export async function upsertValueRule(
  companyId: string,
  data: { accountId: string; scenarioId?: string | null; ruleType: string; config: string; sortOrder?: number }
) {
  const [rule] = await db
    .insert(schema.valueRules)
    .values({ companyId, ...data, config: typeof data.config === 'string' ? data.config : JSON.stringify(data.config) })
    .onConflictDoUpdate({
      target: [schema.valueRules.companyId, schema.valueRules.accountId, schema.valueRules.scenarioId],
      set: { ruleType: data.ruleType, config: typeof data.config === 'string' ? data.config : JSON.stringify(data.config), sortOrder: data.sortOrder },
    })
    .returning()
  return rule
}

export async function getTimingProfiles(companyId: string) {
  return db.query.timingProfiles.findMany({
    where: eq(schema.timingProfiles.companyId, companyId),
  })
}

export async function upsertTimingProfile(
  companyId: string,
  data: Omit<typeof schema.timingProfiles.$inferInsert, 'id' | 'companyId'>
) {
  const [profile] = await db
    .insert(schema.timingProfiles)
    .values({ companyId, ...data, config: typeof data.config === 'string' ? data.config : JSON.stringify(data.config) })
    .onConflictDoUpdate({
      target: [schema.timingProfiles.companyId, schema.timingProfiles.name],
      set: {
        profileType: data.profileType,
        config: typeof data.config === 'string' ? data.config : JSON.stringify(data.config),
        autoDerived: data.autoDerived,
        isDefault: data.isDefault,
      },
    })
    .returning()
  return profile
}

export async function getComplianceConfig(companyId: string) {
  return db.query.complianceConfig.findFirst({
    where: eq(schema.complianceConfig.companyId, companyId),
  })
}

export async function upsertComplianceConfig(
  companyId: string,
  data: Omit<typeof schema.complianceConfig.$inferInsert, 'id' | 'companyId'>
) {
  const [config] = await db
    .insert(schema.complianceConfig)
    .values({ companyId, ...data })
    .onConflictDoUpdate({
      target: [schema.complianceConfig.companyId],
      set: data,
    })
    .returning()
  return config
}

export async function getQuickMetricsConfig(companyId: string) {
  return db.query.quickMetricsConfig.findFirst({
    where: eq(schema.quickMetricsConfig.companyId, companyId),
  })
}

export async function upsertQuickMetricsConfig(
  companyId: string,
  data: Omit<typeof schema.quickMetricsConfig.$inferInsert, 'id' | 'companyId'>
) {
  const [config] = await db
    .insert(schema.quickMetricsConfig)
    .values({ companyId, ...data })
    .onConflictDoUpdate({
      target: [schema.quickMetricsConfig.companyId],
      set: data,
    })
    .returning()
  return config
}
