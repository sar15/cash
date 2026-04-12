import { relations, sql } from 'drizzle-orm'
import {
  AnySQLiteColumn,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

// ============================================================
// COMPANIES (Clerk manages users — no users table needed)
// ============================================================
export const companies = sqliteTable(
  'companies',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    clerkUserId: text('clerk_user_id').notNull(),
    name: text('name').notNull(),
    pan: text('pan'),
    gstin: text('gstin'),
    industry: text('industry').default('general'),
    fyStartMonth: integer('fy_start_month').default(4),
    currency: text('currency').default('INR'),
    numberFormat: text('number_format').default('lakhs'),
    logoUrl: text('logo_url'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_companies_user').on(table.clerkUserId)]
)

// ============================================================
// CHART OF ACCOUNTS
// ============================================================
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    code: text('code'),
    name: text('name').notNull(),
    parentId: text('parent_id').references((): AnySQLiteColumn => accounts.id, {
      onDelete: 'set null',
    }),
    level: integer('level').default(0),
    accountType: text('account_type').notNull(),
    standardMapping: text('standard_mapping'),
    isGroup: integer('is_group', { mode: 'boolean' }).default(false),
    sortOrder: integer('sort_order').default(0),
  },
  (table) => [index('idx_accounts_company').on(table.companyId, table.sortOrder)]
)

// ============================================================
// MONTHLY ACTUALS (historical data — amounts in PAISE)
// ============================================================
export const monthlyActuals = sqliteTable(
  'monthly_actuals',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    amount: integer('amount').notNull(),
  },
  (table) => [
    uniqueIndex('idx_actuals_unique').on(table.companyId, table.accountId, table.period),
    index('idx_actuals_company_period').on(table.companyId, table.period),
  ]
)

// ============================================================
// SCENARIOS
// ============================================================
export const scenarios = sqliteTable(
  'scenarios',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    parentId: text('parent_id').references((): AnySQLiteColumn => scenarios.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_scenarios_company').on(table.companyId)]
)

export const scenarioOverrides = sqliteTable(
  'scenario_overrides',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    scenarioId: text('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    config: text('config').notNull().default('{}'),
  },
  (table) => [index('idx_scenario_overrides_scenario').on(table.scenarioId)]
)

// ============================================================
// VALUE RULES (forecast configuration)
// ============================================================
export const valueRules = sqliteTable(
  'value_rules',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    scenarioId: text('scenario_id').references(() => scenarios.id, {
      onDelete: 'set null',
    }),
    ruleType: text('rule_type').notNull(),
    config: text('config').notNull().default('{}'),
    sortOrder: integer('sort_order').default(0),
  },
  (table) => [
    uniqueIndex('idx_value_rules_unique').on(
      table.companyId,
      table.accountId,
      table.scenarioId
    ),
  ]
)

// ============================================================
// TIMING PROFILES
// ============================================================
export const timingProfiles = sqliteTable(
  'timing_profiles',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    profileType: text('profile_type').notNull(),
    config: text('config').notNull().default('{}'),
    autoDerived: integer('auto_derived', { mode: 'boolean' }).default(false),
    isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  },
  (table) => [index('idx_timing_profiles_company').on(table.companyId)]
)

// ============================================================
// MICRO-FORECASTS (business events)
// ============================================================
export const microForecasts = sqliteTable(
  'micro_forecasts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    startMonth: text('start_month').notNull(),
    endMonth: text('end_month'),
    wizardConfig: text('wizard_config').notNull().default('{}'),
    sortOrder: integer('sort_order').default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_micro_forecasts_company').on(table.companyId)]
)

export const microForecastLines = sqliteTable(
  'micro_forecast_lines',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    microForecastId: text('micro_forecast_id')
      .notNull()
      .references(() => microForecasts.id, { onDelete: 'cascade' }),
    accountId: text('account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    futureAccountName: text('future_account_name'),
    futureAccountType: text('future_account_type'),
    ruleType: text('rule_type').default('direct_entry'),
    config: text('config').notNull().default('{}'),
    timingProfileId: text('timing_profile_id').references(() => timingProfiles.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [index('idx_mfl_forecast').on(table.microForecastId)]
)

// ============================================================
// COMPLIANCE CONFIGURATION
// ============================================================
export const complianceConfig = sqliteTable('compliance_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' })
    .unique(),
  gstType: text('gst_type').default('regular'),
  supplyType: text('supply_type').default('intra-state'),
  gstRate: real('gst_rate').default(18.0),
  itcPct: real('itc_pct').default(85.0),
  gstFrequency: text('gst_frequency').default('monthly'),
  tdsRegime: text('tds_regime').default('new'),
  tdsSections: text('tds_sections').default('{}'),
  taxRate: real('tax_rate').default(25.17),
  pfApplicable: integer('pf_applicable', { mode: 'boolean' }).default(true),
  esiApplicable: integer('esi_applicable', { mode: 'boolean' }).default(true),
})

// ============================================================
// FORECAST RESULTS (cached for persistence)
// ============================================================
export const forecastResults = sqliteTable(
  'forecast_results',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    scenarioId: text('scenario_id').references(() => scenarios.id, {
      onDelete: 'set null',
    }),
    plData: text('pl_data').notNull().default('{}'),
    bsData: text('bs_data').notNull().default('{}'),
    cfData: text('cf_data').notNull().default('{}'),
    compliance: text('compliance').notNull().default('{}'),
    metrics: text('metrics').notNull().default('{}'),
    version: integer('version').default(1),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_forecast_company_scenario').on(table.companyId, table.scenarioId)]
)

// ============================================================
// QUICK METRICS CONFIGURATION
// ============================================================
export const quickMetricsConfig = sqliteTable('quick_metrics_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' })
    .unique(),
  metric1: text('metric_1').default('cash_on_hand'),
  metric2: text('metric_2').default('net_income'),
  metric3: text('metric_3').default('gross_margin_pct'),
  metric4: text('metric_4').default('working_capital_gap'),
  metric5: text('metric_5').default(''),
  threshold: text('threshold').default('{}'),
})

export const companiesRelations = relations(companies, ({ many, one }) => ({
  accounts: many(accounts),
  monthlyActuals: many(monthlyActuals),
  valueRules: many(valueRules),
  timingProfiles: many(timingProfiles),
  microForecasts: many(microForecasts),
  scenarios: many(scenarios),
  forecastResults: many(forecastResults),
  complianceConfig: one(complianceConfig, {
    fields: [companies.id],
    references: [complianceConfig.companyId],
  }),
  quickMetricsConfig: one(quickMetricsConfig, {
    fields: [companies.id],
    references: [quickMetricsConfig.companyId],
  }),
}))

export const accountsRelations = relations(accounts, ({ many, one }) => ({
  company: one(companies, { fields: [accounts.companyId], references: [companies.id] }),
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
    relationName: 'accountParent',
  }),
  children: many(accounts, { relationName: 'accountParent' }),
  monthlyActuals: many(monthlyActuals),
  valueRules: many(valueRules),
  microForecastLines: many(microForecastLines),
}))

export const monthlyActualsRelations = relations(monthlyActuals, ({ one }) => ({
  company: one(companies, {
    fields: [monthlyActuals.companyId],
    references: [companies.id],
  }),
  account: one(accounts, {
    fields: [monthlyActuals.accountId],
    references: [accounts.id],
  }),
}))

export const scenariosRelations = relations(scenarios, ({ many, one }) => ({
  company: one(companies, { fields: [scenarios.companyId], references: [companies.id] }),
  parent: one(scenarios, {
    fields: [scenarios.parentId],
    references: [scenarios.id],
    relationName: 'scenarioParent',
  }),
  children: many(scenarios, { relationName: 'scenarioParent' }),
  overrides: many(scenarioOverrides),
  valueRules: many(valueRules),
  forecastResults: many(forecastResults),
}))

export const scenarioOverridesRelations = relations(scenarioOverrides, ({ one }) => ({
  scenario: one(scenarios, {
    fields: [scenarioOverrides.scenarioId],
    references: [scenarios.id],
  }),
}))

export const valueRulesRelations = relations(valueRules, ({ one }) => ({
  company: one(companies, { fields: [valueRules.companyId], references: [companies.id] }),
  account: one(accounts, { fields: [valueRules.accountId], references: [accounts.id] }),
  scenario: one(scenarios, {
    fields: [valueRules.scenarioId],
    references: [scenarios.id],
  }),
}))

export const timingProfilesRelations = relations(timingProfiles, ({ many, one }) => ({
  company: one(companies, {
    fields: [timingProfiles.companyId],
    references: [companies.id],
  }),
  microForecastLines: many(microForecastLines),
}))

export const microForecastsRelations = relations(microForecasts, ({ many, one }) => ({
  company: one(companies, {
    fields: [microForecasts.companyId],
    references: [companies.id],
  }),
  lines: many(microForecastLines),
}))

export const microForecastLinesRelations = relations(microForecastLines, ({ one }) => ({
  microForecast: one(microForecasts, {
    fields: [microForecastLines.microForecastId],
    references: [microForecasts.id],
  }),
  account: one(accounts, {
    fields: [microForecastLines.accountId],
    references: [accounts.id],
  }),
  timingProfile: one(timingProfiles, {
    fields: [microForecastLines.timingProfileId],
    references: [timingProfiles.id],
  }),
}))

export const complianceConfigRelations = relations(complianceConfig, ({ one }) => ({
  company: one(companies, {
    fields: [complianceConfig.companyId],
    references: [companies.id],
  }),
}))

export const forecastResultsRelations = relations(forecastResults, ({ one }) => ({
  company: one(companies, {
    fields: [forecastResults.companyId],
    references: [companies.id],
  }),
  scenario: one(scenarios, {
    fields: [forecastResults.scenarioId],
    references: [scenarios.id],
  }),
}))

export const quickMetricsConfigRelations = relations(quickMetricsConfig, ({ one }) => ({
  company: one(companies, {
    fields: [quickMetricsConfig.companyId],
    references: [companies.id],
  }),
}))
