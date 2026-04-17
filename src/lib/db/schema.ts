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
    isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
    // Single date boundary: everything on/before this date is locked actuals, everything after is forecast.
    // Replaces the fragile lockedPeriods JSON array — simpler, corruption-proof.
    booksClosedDate: text('books_closed_date'), // YYYY-MM-01 or null (nothing locked)
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_companies_user').on(table.clerkUserId),
  ]
)

// ============================================================
// USER PROFILES — per-user settings & persona mode
// ============================================================
export const userProfiles = sqliteTable(
  'user_profiles',
  {
    clerkUserId: text('clerk_user_id').primaryKey().notNull(),
    userType: text('user_type').notNull().default('business_owner'), // 'business_owner' | 'ca_firm'
    onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).default(false),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_user_profiles_type').on(table.userType)]
)

// ============================================================
// FIRMS — CA/firm multi-client workspace
// ============================================================
export const firms = sqliteTable(
  'firms',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    ownerClerkUserId: text('owner_clerk_user_id').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_firms_owner').on(table.ownerClerkUserId),
  ]
)

export const firmMembers = sqliteTable(
  'firm_members',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    firmId: text('firm_id')
      .notNull()
      .references(() => firms.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').notNull(),
    role: text('role').notNull().default('staff'), // 'partner' | 'admin' | 'staff' | 'readonly'
    acceptedAt: text('accepted_at'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_firm_members_unique').on(table.firmId, table.clerkUserId),
    index('idx_firm_members_user').on(table.clerkUserId),
  ]
)

export const firmClients = sqliteTable(
  'firm_clients',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    firmId: text('firm_id')
      .notNull()
      .references(() => firms.id, { onDelete: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_firm_clients_unique').on(table.firmId, table.companyId),
    index('idx_firm_clients_company').on(table.companyId),
  ]
)

// ============================================================
// GST FILINGS
// ============================================================
export const gstFilings = sqliteTable(
  'gst_filings',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    period: text('period').notNull(), // YYYY-MM-01
    returnType: text('return_type').notNull(), // 'GSTR-1' | 'GSTR-3B'
    status: text('status').notNull(), // 'pending' | 'filed' | 'overdue'
    dueDate: text('due_date').notNull(),
    amountPaise: integer('amount_paise').notNull(),
    filedAt: text('filed_at'),
    referenceNumber: text('reference_number'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_gst_filings_unique').on(table.companyId, table.period, table.returnType),
    index('idx_gst_filings_company_period').on(table.companyId, table.period),
  ]
)

// ============================================================
// BANK RECONCILIATIONS
// ============================================================
export const bankReconciliations = sqliteTable(
  'bank_reconciliations',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    period: text('period').notNull(), // YYYY-MM-01
    status: text('status').notNull(), // 'unreconciled' | 'reconciled' | 'variance'
    bookClosingBalancePaise: integer('book_closing_balance_paise'),
    bankClosingBalancePaise: integer('bank_closing_balance_paise'),
    variancePaise: integer('variance_paise'),
    reconciledAt: text('reconciled_at'),
    reconciledBy: text('reconciled_by'),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_bank_recon_unique').on(table.companyId, table.period),
    index('idx_bank_recon_company_period').on(table.companyId, table.period),
  ]
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
    archivedAt: text('archived_at'), // soft-delete: set to ISO timestamp instead of hard-deleting
    currency: text('currency'), // null = inherits company base currency (INR); set for foreign-currency accounts
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
    index('idx_actuals_account').on(table.accountId, table.period),
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
  (table) => [
    index('idx_timing_profiles_company').on(table.companyId),
    uniqueIndex('idx_timing_profiles_company_name').on(table.companyId, table.name),
  ]
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
// TAX RATE HISTORY — effective-dated compliance rates
// Prevents Budget Day changes from retroactively corrupting historical forecasts.
// The engine picks the rate whose effectiveFrom <= forecastPeriod (latest wins).
// ============================================================
export const taxRateHistory = sqliteTable(
  'tax_rate_history',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    rateType: text('rate_type').notNull(), // 'gst' | 'corporate_tax' | 'itc_pct'
    rate: real('rate').notNull(),          // e.g. 18.0, 25.17, 85.0
    effectiveFrom: text('effective_from').notNull(), // YYYY-MM-01
    notes: text('notes'),                  // e.g. "Finance Act 2025 — Budget Day update"
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_tax_rate_history_company').on(table.companyId, table.rateType, table.effectiveFrom),
  ]
)

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
    // 'ready' = safe to read/export | 'stale' = inputs changed, recompute pending | 'calculating' = Inngest job running
    status: text('status').notNull().default('ready'), // 'ready' | 'stale' | 'calculating'
    version: integer('version').default(1),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_forecast_company_scenario').on(table.companyId, table.scenarioId),
    uniqueIndex('idx_forecast_result_stable').on(table.companyId, table.scenarioId),
  ]
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

// ============================================================
// AUDIT LOG — who changed what and when
// ============================================================
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').notNull(),
    action: text('action').notNull(),       // 'value_rule.updated' | 'import.completed' | etc.
    entityType: text('entity_type'),        // 'value_rule' | 'account' | 'scenario'
    entityId: text('entity_id'),
    oldValue: text('old_value'),            // JSON string
    newValue: text('new_value'),            // JSON string
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_audit_company').on(table.companyId, table.createdAt),
    index('idx_audit_entity').on(table.entityType, table.entityId),
  ]
)

// ============================================================
// NOTIFICATIONS — real-time feed for the bell icon
// ============================================================
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id'),     // null = all users of this company
    type: text('type').notNull(),           // 'compliance_due' | 'import_complete' | 'rule_changed'
    title: text('title').notNull(),
    body: text('body').notNull(),
    actionUrl: text('action_url'),
    readAt: text('read_at'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_notifications_company').on(table.companyId, table.createdAt),
    index('idx_notifications_user').on(table.clerkUserId, table.readAt),
  ]
)

// ============================================================
// COMPANY MEMBERS — multi-user / team sharing
// ============================================================
export const companyMembers = sqliteTable(
  'company_members',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').notNull(),
    role: text('role').notNull().default('viewer'), // 'owner' | 'editor' | 'viewer'
    invitedBy: text('invited_by'),
    invitedEmail: text('invited_email'),
    acceptedAt: text('accepted_at'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_members_unique').on(table.companyId, table.clerkUserId),
    index('idx_members_user').on(table.clerkUserId),
  ]
)

// ============================================================
// COMPLIANCE PAYMENTS — server-side paid status per obligation
// ============================================================
export const compliancePayments = sqliteTable('compliance_payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  clerkUserId: text('clerk_user_id').notNull(),
  obligationId: text('obligation_id').notNull(),
  paidAt: text('paid_at').default(sql`(datetime('now'))`),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('idx_compliance_payments_unique').on(table.companyId, table.obligationId),
  index('idx_compliance_payments_company').on(table.companyId),
])


// ============================================================
// REMINDER CONFIG — compliance email reminders per company
// ============================================================
export const reminderConfig = sqliteTable('reminder_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' })
    .unique(),
  enabled: integer('enabled', { mode: 'boolean' }).default(false),
  alertEmail: text('alert_email'),
  reminderDays: integer('reminder_days').default(3), // days before due date
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ============================================================
// IDEMPOTENCY KEYS — safe retries for mutation endpoints
// ============================================================
export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    route: text('route').notNull(),
    method: text('method').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: text('response_body').notNull().default('{}'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_idempotency_unique').on(table.companyId, table.key, table.route, table.method),
    index('idx_idempotency_created').on(table.createdAt),
  ]
)

export const companiesRelations = relations(companies, ({ many, one }) => ({
  accounts: many(accounts),
  monthlyActuals: many(monthlyActuals),
  valueRules: many(valueRules),
  timingProfiles: many(timingProfiles),
  microForecasts: many(microForecasts),
  scenarios: many(scenarios),
  forecastResults: many(forecastResults),
  auditLog: many(auditLog),
  notifications: many(notifications),
  members: many(companyMembers),
  compliancePayments: many(compliancePayments),
  taxRateHistory: many(taxRateHistory),
  complianceConfig: one(complianceConfig, {
    fields: [companies.id],
    references: [complianceConfig.companyId],
  }),
  quickMetricsConfig: one(quickMetricsConfig, {
    fields: [companies.id],
    references: [quickMetricsConfig.companyId],
  }),
  reminderConfig: one(reminderConfig, {
    fields: [companies.id],
    references: [reminderConfig.companyId],
  }),
}))

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  // Intentionally no FK relationships; Clerk is the source of truth for users.
  companies: many(companies),
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

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  company: one(companies, {
    fields: [auditLog.companyId],
    references: [companies.id],
  }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  company: one(companies, {
    fields: [notifications.companyId],
    references: [companies.id],
  }),
}))

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(companies, {
    fields: [companyMembers.companyId],
    references: [companies.id],
  }),
}))

export const reminderConfigRelations = relations(reminderConfig, ({ one }) => ({
  company: one(companies, {
    fields: [reminderConfig.companyId],
    references: [companies.id],
  }),
}))

export const compliancePaymentsRelations = relations(compliancePayments, ({ one }) => ({
  company: one(companies, {
    fields: [compliancePayments.companyId],
    references: [companies.id],
  }),
}))

export const idempotencyKeysRelations = relations(idempotencyKeys, ({ one }) => ({
  company: one(companies, {
    fields: [idempotencyKeys.companyId],
    references: [companies.id],
  }),
}))

export const taxRateHistoryRelations = relations(taxRateHistory, ({ one }) => ({
  company: one(companies, {
    fields: [taxRateHistory.companyId],
    references: [companies.id],
  }),
}))

