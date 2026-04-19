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
import { createId } from '@paralleldrive/cuid2'

/**
 * ID generation strategy:
 * - crypto.randomUUID() (UUIDv4) for low-write tables (companies, accounts, scenarios, etc.)
 *   These are queried by compound indexes, not PK scans, so random PKs are fine.
 * - createId() (cuid2) for HIGH-WRITE append-only tables (auditLog, communicationLogs,
 *   notifications, monthlyActuals). cuid2 is time-sortable, so new rows always append
 *   to the end of the B-Tree index — no page thrashing or index fragmentation.
 */
const cuid = () => createId()

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
    cin: text('cin'),                              // Corporate Identity Number (e.g. U72200MH2020PTC123456)
    registeredAddress: text('registered_address'), // Full registered address for statutory documents
    industry: text('industry').default('general'),
    fyStartMonth: integer('fy_start_month').default(4),
    currency: text('currency').default('INR'),
    numberFormat: text('number_format').default('lakhs'),
    logoUrl: text('logo_url'),
    isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
    booksClosedDate: text('books_closed_date'),
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
    uniqueIndex('idx_firms_owner_unique').on(table.ownerClerkUserId),
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
  (table) => [
    index('idx_accounts_company').on(table.companyId, table.sortOrder),
    // Prevents duplicate account names per company — guards against concurrent import races
    uniqueIndex('idx_accounts_company_name').on(table.companyId, table.name),
  ]
)

// ============================================================
// MONTHLY ACTUALS (historical data — amounts in PAISE)
// ============================================================
export const monthlyActuals = sqliteTable(
  'monthly_actuals',
  {
    id: text('id').primaryKey().$defaultFn(() => cuid()),
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
    // Optimistic Concurrency Control: increment on every update.
    // API rejects updates where client sends an outdated version → 409 Conflict.
    version: integer('version').notNull().default(1),
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
    id: text('id').primaryKey().$defaultFn(() => cuid()),
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
    id: text('id').primaryKey().$defaultFn(() => cuid()),
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
// COMPANY INVITES — pending email-based collaboration invites
// ============================================================
export const companyInvites = sqliteTable(
  'company_invites',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    invitedEmail: text('invited_email').notNull(),
    role: text('role').notNull().default('viewer'),
    invitedBy: text('invited_by').notNull(),
    tokenHash: text('token_hash').notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'revoked' | 'expired'
    acceptedByClerkUserId: text('accepted_by_clerk_user_id'),
    acceptedAt: text('accepted_at'),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_company_invites_email_unique').on(table.companyId, table.invitedEmail),
    uniqueIndex('idx_company_invites_token_unique').on(table.tokenHash),
    index('idx_company_invites_status').on(table.companyId, table.status),
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
// WEBHOOK DELIVERIES — dedupe external webhook retries
// ============================================================
export const webhookDeliveries = sqliteTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    processedAt: text('processed_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_webhook_deliveries_unique').on(table.provider, table.eventId),
  ]
)

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
    // 'in_progress' = request is being processed (concurrent replay → 409)
    // 'completed'   = request finished, responseBody is the cached result
    status: text('status').notNull().default('in_progress'),
    responseStatus: integer('response_status').notNull().default(0),
    responseBody: text('response_body').notNull().default('{}'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_idempotency_unique').on(table.companyId, table.key, table.route, table.method),
    index('idx_idempotency_created').on(table.createdAt),
  ]
)

// ============================================================
// ACCOUNT MAPPINGS — persisted user corrections for ledger name → COA mapping
// ============================================================
export const accountMappings = sqliteTable(
  'account_mappings',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    rawLedgerName: text('raw_ledger_name').notNull(),
    standardAccountId: text('standard_account_id'), // null when skipped=true
    skipped: integer('skipped', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_account_mappings_unique').on(table.companyId, table.rawLedgerName),
    index('idx_account_mappings_company').on(table.companyId),
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
  invites: many(companyInvites),
  compliancePayments: many(compliancePayments),
  taxRateHistory: many(taxRateHistory),
  accountMappings: many(accountMappings),
  scenarioNotes: many(scenarioNotes),
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
  scenarioNotes: many(scenarioNotes),
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

export const companyInvitesRelations = relations(companyInvites, ({ one }) => ({
  company: one(companies, {
    fields: [companyInvites.companyId],
    references: [companies.id],
  }),
}))

export const reminderConfigRelations = relations(reminderConfig, ({ one }) => ({
  company: one(companies, {
    fields: [reminderConfig.companyId],
    references: [companies.id],
  }),
}))

export const webhookDeliveriesRelations = relations(webhookDeliveries, () => ({}))

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

export const accountMappingsRelations = relations(accountMappings, ({ one }) => ({
  company: one(companies, {
    fields: [accountMappings.companyId],
    references: [companies.id],
  }),
}))

// ============================================================
// COMPLIANCE TASKS — unified workflow table for all filing types
// Replaces the limited gstFilings table with a generic, extensible schema.
// Supports: GSTR-1, GSTR-3B, TDS, PF/ESI, Advance Tax, ITR, ROC, etc.
// ============================================================
export const complianceTasks = sqliteTable(
  'compliance_tasks',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    // Filing type — open string for extensibility
    filingType: text('filing_type').notNull(), // 'GSTR-1' | 'GSTR-3B' | 'TDS' | 'PF/ESI' | 'Advance Tax' | 'ITR' | 'ROC'
    // Human-readable period label e.g. 'May 2024', 'Q1 24-25', 'FY 2024-25'
    periodLabel: text('period_label').notNull(),
    // ISO date YYYY-MM-DD
    dueDate: text('due_date').notNull(),
    // CA workflow states
    // not_started → waiting_on_client → docs_received → processing → pending_otp → filed
    status: text('status').notNull().default('not_started'),
    // Which staff member is handling this task
    assignedTo: text('assigned_to_user_id'),
    // When it was filed
    filedAt: text('filed_at'),
    // Acknowledgement Receipt Number (ARN) from the portal
    arn: text('arn'),
    // Optional notes
    notes: text('notes'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (t) => [
    index('idx_tasks_company_status').on(t.companyId, t.status),
    index('idx_tasks_due_date').on(t.dueDate),
    uniqueIndex('idx_tasks_unique').on(t.companyId, t.filingType, t.periodLabel),
  ]
)

// ============================================================
// COMMUNICATION LOGS — audit trail for all client communications
// Enables CAs to prove "we asked on the 5th, you sent on the 10th"
// ============================================================
export const communicationLogs = sqliteTable(
  'communication_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => cuid()),
    taskId: text('task_id').references(() => complianceTasks.id, { onDelete: 'set null' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    // Channel: 'email' | 'system_note' (WhatsApp excluded per product decision)
    channel: text('channel').notNull(),
    // Direction: 'outbound' (CA → client) | 'inbound' (client → CA) | 'internal'
    direction: text('direction').notNull(),
    // Message content or system note
    content: text('content').notNull(),
    // null = automated system; set = staff member who sent it
    sentBy: text('sent_by_user_id'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [
    index('idx_comm_logs_company').on(t.companyId, t.createdAt),
    index('idx_comm_logs_task').on(t.taskId),
  ]
)

// ============================================================
// SCENARIO NOTES — MD&A commentary for annual financial statements
// Stores auto-generated summaries and user notes per statement, period, and scenario
// ============================================================
export const scenarioNotes = sqliteTable(
  'scenario_notes',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    scenarioId: text('scenario_id').references(() => scenarios.id, {
      onDelete: 'set null',
    }), // null = base case
    statementType: text('statement_type').notNull(), // 'PL' | 'BS' | 'CF'
    periodKey: text('period_key').notNull(), // e.g. "FY25-26" — soft reference, no FK
    autoSummary: text('auto_summary').notNull().default('[]'), // JSON array of strings
    autoSummaryGeneratedAt: text('auto_summary_generated_at'), // ISO timestamp
    userNotes: text('user_notes').notNull().default(''), // plain text (no Markdown in v1)
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
    updatedBy: text('updated_by').notNull(), // Clerk user ID
  },
  (table) => [
    uniqueIndex('idx_scenario_notes_unique').on(
      table.companyId,
      table.scenarioId,
      table.statementType,
      table.periodKey
    ),
    index('idx_scenario_notes_company_period').on(table.companyId, table.periodKey),
  ]
)

export const complianceTasksRelations = relations(complianceTasks, ({ one, many }) => ({
  company: one(companies, {
    fields: [complianceTasks.companyId],
    references: [companies.id],
  }),
  communicationLogs: many(communicationLogs),
}))

export const communicationLogsRelations = relations(communicationLogs, ({ one }) => ({
  task: one(complianceTasks, {
    fields: [communicationLogs.taskId],
    references: [complianceTasks.id],
  }),
  company: one(companies, {
    fields: [communicationLogs.companyId],
    references: [companies.id],
  }),
}))

export const scenarioNotesRelations = relations(scenarioNotes, ({ one }) => ({
  company: one(companies, {
    fields: [scenarioNotes.companyId],
    references: [companies.id],
  }),
  scenario: one(scenarios, {
    fields: [scenarioNotes.scenarioId],
    references: [scenarios.id],
  }),
}))
