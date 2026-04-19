import { z } from 'zod'
import { ALL_STANDARD_MAPPINGS } from '@/lib/standards/standard-mappings'

// ─────────────────────────────────────────────────────────────────────────────
// Standard Mapping validation — runtime enforcement of the taxonomy
// Accepts any value in ALL_STANDARD_MAPPINGS; rejects unknown strings.
// Using z.string().refine() instead of z.enum() because the array is large
// and z.enum() requires a tuple type at compile time.
// ─────────────────────────────────────────────────────────────────────────────
const standardMappingSet = new Set<string>(ALL_STANDARD_MAPPINGS)

export const standardMappingSchema = z
  .string()
  .refine((v) => standardMappingSet.has(v), {
    message: 'Invalid standardMapping value — must be a valid Schedule III taxonomy key',
  })
  .optional()

// ============================================================
// COMPANY SCHEMAS
// ============================================================
export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  pan: z.string().max(10).optional(),
  gstin: z.string().max(15).optional(),
  cin: z.string().max(21).optional(),
  registeredAddress: z.string().max(500).optional(),
  industry: z.string().default('general'),
  fyStartMonth: z.number().int().min(1).max(12).default(4),
  currency: z.string().default('INR'),
  numberFormat: z.enum(['lakhs', 'crores', 'millions']).default('lakhs'),
  logoUrl: z.string().url().optional(),
})

export const updateCompanySchema = createCompanySchema.partial()

// ============================================================
// ACCOUNT SCHEMAS
// ============================================================
export const accountTypeEnum = z.enum(['revenue', 'expense', 'asset', 'liability', 'equity'])

export const createAccountSchema = z.object({
  companyId: z.string().uuid(),
  code: z.string().max(20).optional(),
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
  level: z.number().int().min(0).max(2).default(0),
  accountType: accountTypeEnum,
  standardMapping: standardMappingSchema,
  isGroup: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

export const updateAccountSchema = createAccountSchema.partial().omit({ companyId: true })

// ============================================================
// MONTHLY ACTUALS SCHEMAS
// ============================================================
export const upsertActualSchema = z.object({
  accountId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}-01$/, 'Period must be YYYY-MM-01 format'),
  amount: z.number().int(), // IN PAISE
})

export const bulkUpsertActualsSchema = z.object({
  companyId: z.string().uuid(),
  actuals: z.array(upsertActualSchema).min(1).max(5000),
})

// ============================================================
// VALUE RULE SCHEMAS
// ============================================================
export const valueRuleTypeEnum = z.enum([
  'rolling_avg', 'growth', 'smart_pred', 'same_last_year',
  'formula', 'direct_entry', 'baseline_adjustment',
])

export const upsertValueRuleSchema = z.object({
  accountId: z.string().uuid(),
  scenarioId: z.string().uuid().nullable().optional(),
  ruleType: valueRuleTypeEnum,
  config: z.record(z.string(), z.unknown()).default({}),
  sortOrder: z.number().int().default(0),
})

// ============================================================
// TIMING PROFILE SCHEMAS
// ============================================================
export const profileTypeEnum = z.enum(['receivables', 'payables', 'deferred', 'prepaid'])

export const upsertTimingProfileSchema = z.object({
  name: z.string().min(1).max(100),
  profileType: profileTypeEnum,
  config: z.record(z.string(), z.unknown()).default({}),
  autoDerived: z.boolean().default(false),
  isDefault: z.boolean().default(false),
})

// ============================================================
// MICRO-FORECAST SCHEMAS
// ============================================================
export const microForecastCategoryEnum = z.enum([
  'hire', 'asset', 'loan', 'revenue', 'expense', 'price_change', 'marketing', 'equity', 'custom',
])

export const microForecastLineSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  futureAccountName: z.string().max(200).nullable().optional(),
  futureAccountType: accountTypeEnum.nullable().optional(),
  ruleType: z.string().default('direct_entry'),
  config: z.union([z.string(), z.record(z.string(), z.unknown())]).default('{}'),
  timingProfileId: z.string().uuid().nullable().optional(),
})

export const createMicroForecastSchema = z.object({
  companyId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  category: microForecastCategoryEnum,
  isActive: z.boolean().default(true),
  startMonth: z.string().min(1),
  endMonth: z.string().nullable().optional(),
  wizardConfig: z.union([z.string(), z.record(z.string(), z.unknown())]).default('{}'),
  sortOrder: z.number().int().default(0),
  lines: z.array(microForecastLineSchema).max(100).optional(),
})

export const updateMicroForecastSchema = createMicroForecastSchema.partial().omit({ companyId: true })

// ============================================================
// SCENARIO SCHEMAS
// ============================================================
export const createScenarioSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().default(true),
})

export const updateScenarioSchema = createScenarioSchema.partial()

export const scenarioOverrideSchema = z.object({
  targetType: z.enum(['value_rule', 'timing_profile', 'micro_toggle']),
  targetId: z.string().max(100).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
})

export const saveScenarioOverridesSchema = z.object({
  overrides: z.array(scenarioOverrideSchema).max(500),
})

// ============================================================
// COMPLIANCE CONFIG SCHEMAS
// ============================================================
export const upsertComplianceConfigSchema = z.object({
  gstType: z.enum(['regular', 'qrmp']).default('regular'),
  supplyType: z.enum(['intra-state', 'inter-state']).default('intra-state'),
  gstRate: z.number().min(0).max(100).default(18.0),
  itcPct: z.number().min(0).max(100).default(85.0),
  gstFrequency: z.enum(['monthly', 'quarterly']).default('monthly'),
  tdsRegime: z.enum(['new', 'old']).default('new'),
  tdsSections: z.record(z.string(), z.unknown()).default({}),
  taxRate: z.number().min(0).max(100).default(25.17),
  pfApplicable: z.boolean().default(true),
  esiApplicable: z.boolean().default(true),
})

// ============================================================
// QUICK METRICS CONFIG SCHEMAS
// ============================================================
export const upsertQuickMetricsConfigSchema = z.object({
  metric1: z.string().default('cash_on_hand'),
  metric2: z.string().default('net_income'),
  metric3: z.string().default('gross_margin_pct'),
  metric4: z.string().default('working_capital_gap'),
  metric5: z.string().default(''),
  threshold: z.record(z.string(), z.unknown()).default({}),
})

// ============================================================
// FORECAST RESULT SCHEMAS
// ============================================================
export const saveForecastResultSchema = z.object({
  scenarioId: z.string().uuid().nullable().optional(),
  plData: z.record(z.string(), z.unknown()).default({}),
  bsData: z.record(z.string(), z.unknown()).default({}),
  cfData: z.record(z.string(), z.unknown()).default({}),
  compliance: z.record(z.string(), z.unknown()).default({}),
  metrics: z.record(z.string(), z.unknown()).default({}),
})

// ============================================================
// IMPORT SCHEMAS
// ============================================================
export const importSaveSchema = z.object({
  companyId: z.string().uuid(),
  accounts: z.array(z.object({
    name: z.string().min(1),
    code: z.string().optional(),
    accountType: accountTypeEnum,
    standardMapping: standardMappingSchema,
    parentId: z.string().uuid().nullable().optional(),
  })).min(1),
  actuals: z.array(z.object({
    accountName: z.string().min(1),
    period: z.string().regex(/^\d{4}-\d{2}-01$/),
    amount: z.number().int(),
  })).min(1),
})

// ============================================================
// USER PROFILE SCHEMAS
// ============================================================
export const userTypeEnum = z.enum(['business_owner', 'ca_firm'])

export const updateUserProfileSchema = z.object({
  userType: userTypeEnum,
})
