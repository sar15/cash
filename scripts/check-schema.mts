/**
 * Schema drift detector — compares the live Turso DB against what the code expects.
 * Run before deploying: npx tsx scripts/check-schema.mts
 *
 * Checks:
 *  1. All expected tables exist
 *  2. All expected columns exist on each table
 *  3. All unique indexes that back onConflictDoUpdate calls exist
 *
 * Exit code 0 = all good, exit code 1 = drift detected (blocks deploy).
 */
import { createClient, type Row } from '@libsql/client'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

let driftFound = false

function fail(msg: string) {
  console.error('❌ SCHEMA DRIFT:', msg)
  driftFound = true
}

function ok(msg: string) {
  console.log('✓', msg)
}

async function getColumns(table: string): Promise<Set<string>> {
  const rows = await client.execute(`PRAGMA table_info(${table})`)
  return new Set(rows.rows.map((r: Row) => String(r['name'] ?? '')))
}

async function getIndexes(table: string): Promise<Set<string>> {
  const rows = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='${table}'`
  )
  return new Set(rows.rows.map((r: Row) => String(r['name'] ?? '')))
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
  )
  return rows.rows.length > 0
}

// ── 1. Required tables ────────────────────────────────────────────────────────
const REQUIRED_TABLES = [
  'companies', 'user_profiles', 'accounts', 'monthly_actuals',
  'scenarios', 'scenario_overrides', 'value_rules', 'timing_profiles',
  'micro_forecasts', 'micro_forecast_lines', 'compliance_config',
  'tax_rate_history', 'forecast_results', 'quick_metrics_config',
  'audit_log', 'notifications', 'company_members', 'company_invites',
  'compliance_payments', 'reminder_config', 'webhook_deliveries',
  'idempotency_keys', 'account_mappings', 'gst_filings',
  'bank_reconciliations', 'firms', 'firm_members', 'firm_clients',
]

for (const table of REQUIRED_TABLES) {
  if (await tableExists(table)) {
    ok(`table ${table} exists`)
  } else {
    fail(`table ${table} is MISSING`)
  }
}

// ── 2. Required columns per table ─────────────────────────────────────────────
const REQUIRED_COLUMNS: Record<string, string[]> = {
  companies: ['id', 'clerk_user_id', 'name', 'pan', 'gstin', 'industry',
    'fy_start_month', 'currency', 'number_format', 'logo_url', 'is_primary',
    'books_closed_date', 'created_at', 'updated_at'],
  accounts: ['id', 'company_id', 'code', 'name', 'parent_id', 'level',
    'account_type', 'standard_mapping', 'is_group', 'sort_order',
    'archived_at', 'currency'],
  monthly_actuals: ['id', 'company_id', 'account_id', 'period', 'amount'],
  idempotency_keys: ['id', 'company_id', 'key', 'route', 'method',
    'status', 'response_status', 'response_body', 'created_at'],
  forecast_results: ['id', 'company_id', 'scenario_id', 'pl_data', 'bs_data',
    'cf_data', 'compliance', 'metrics', 'status', 'version', 'created_at'],
  user_profiles: ['clerk_user_id', 'user_type', 'onboarding_completed',
    'created_at', 'updated_at'],
  account_mappings: ['id', 'company_id', 'raw_ledger_name', 'standard_account_id',
    'skipped', 'created_at', 'updated_at'],
  company_invites: ['id', 'company_id', 'invited_email', 'role', 'invited_by',
    'token_hash', 'status', 'accepted_by_clerk_user_id', 'accepted_at',
    'expires_at', 'created_at', 'updated_at'],
  compliance_config: ['id', 'company_id', 'gst_type', 'supply_type', 'gst_rate',
    'itc_pct', 'gst_frequency', 'tds_regime', 'tds_sections', 'tax_rate',
    'pf_applicable', 'esi_applicable'],
  tax_rate_history: ['id', 'company_id', 'rate_type', 'rate', 'effective_from',
    'notes', 'created_at'],
}

for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
  const actual = await getColumns(table)
  for (const col of cols) {
    if (actual.has(col)) {
      ok(`${table}.${col} exists`)
    } else {
      fail(`${table}.${col} is MISSING`)
    }
  }
}

// ── 3. Required unique indexes (back every onConflictDoUpdate target) ─────────
const REQUIRED_UNIQUE_INDEXES: Record<string, string[]> = {
  accounts:            ['idx_accounts_company_name'],          // ON CONFLICT (company_id, name)
  monthly_actuals:     ['idx_actuals_unique'],                  // ON CONFLICT (company_id, account_id, period)
  value_rules:         ['idx_value_rules_unique'],              // ON CONFLICT (company_id, account_id, scenario_id)
  timing_profiles:     ['idx_timing_profiles_company_name'],   // ON CONFLICT (company_id, name)
  compliance_config:   ['compliance_config_company_id_unique'], // ON CONFLICT (company_id)
  quick_metrics_config:['quick_metrics_config_company_id_unique'], // ON CONFLICT (company_id)
  forecast_results:    ['idx_forecast_result_stable'],          // ON CONFLICT (company_id, scenario_id)
  idempotency_keys:    ['idx_idempotency_unique'],              // ON CONFLICT (company_id, key, route, method)
  company_members:     ['idx_members_unique'],                  // ON CONFLICT (company_id, clerk_user_id)
  company_invites:     ['idx_company_invites_email_unique', 'idx_company_invites_token_unique'],
  account_mappings:    ['idx_account_mappings_unique'],         // ON CONFLICT (company_id, raw_ledger_name)
  bank_reconciliations:['idx_bank_recon_unique'],               // ON CONFLICT (company_id, period)
  compliance_payments: ['idx_compliance_payments_unique'],      // ON CONFLICT (company_id, obligation_id)
  reminder_config:     ['reminder_config_company_id_unique'],   // ON CONFLICT (company_id)
  webhook_deliveries:  ['idx_webhook_deliveries_unique'],       // ON CONFLICT (provider, event_id)
  firm_members:        ['idx_firm_members_unique'],             // ON CONFLICT (firm_id, clerk_user_id)
  firm_clients:        ['idx_firm_clients_unique'],             // ON CONFLICT (firm_id, company_id)
  gst_filings:         ['idx_gst_filings_unique'],              // ON CONFLICT (company_id, period, return_type)
}

for (const [table, indexes] of Object.entries(REQUIRED_UNIQUE_INDEXES)) {
  const actual = await getIndexes(table)
  for (const idx of indexes) {
    if (actual.has(idx)) {
      ok(`${table} has unique index ${idx}`)
    } else {
      fail(`${table} is MISSING unique index ${idx} — onConflictDoUpdate will fail at runtime`)
    }
  }
}

client.close()

if (driftFound) {
  console.error('\n🚨 Schema drift detected. Run: npx tsx scripts/apply-migrations.ts')
  process.exit(1)
} else {
  console.log('\n✅ Schema is fully in sync with code expectations.')
  process.exit(0)
}
