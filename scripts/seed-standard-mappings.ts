/**
 * Phase 1 Migration: Seed standardMapping on all existing accounts.
 *
 * Strategy:
 * 1. Name-based heuristics — match account names against known patterns
 * 2. Existing standardMapping migration — translate old values to new taxonomy
 * 3. Deterministic fallback — every account gets a mapping, no leaks
 *
 * Run with: npx tsx scripts/seed-standard-mappings.ts
 * Safe to run multiple times — only updates accounts with null/legacy mappings.
 * Accounts that already have a valid new-taxonomy mapping are skipped.
 */
import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import {
  FALLBACK_BY_ACCOUNT_TYPE,
  isValidStandardMapping,
  SM_REV_OPS_PRODUCTS,
  SM_REV_OPS_SERVICES,
  SM_REV_OPS_OTHER,
  SM_REV_OTHER_INTEREST,
  SM_REV_OTHER_DIVIDEND,
  SM_REV_OTHER_MISC,
  SM_EXP_MATERIALS,
  SM_EXP_STOCK_IN_TRADE,
  SM_EXP_INVENTORY_CHANGES,
  SM_EXP_EMPLOYEE_BENEFITS,
  SM_EXP_FINANCE_COSTS,
  SM_EXP_DEPRECIATION,
  SM_EXP_AMORTISATION,
  SM_EXP_OTHER,
  SM_ASSET_PPE,
  SM_ASSET_INTANGIBLE,
  SM_ASSET_INVENTORIES,
  SM_ASSET_TRADE_REC,
  SM_ASSET_CASH,
  SM_ASSET_ST_LOANS,
  SM_ASSET_OTHER_C,
  SM_LIAB_LT_BORROWINGS,
  SM_LIAB_ST_BORROWINGS,
  SM_LIAB_TRADE_PAY,
  SM_LIAB_GST_PAYABLE,
  SM_LIAB_TDS_PAYABLE,
  SM_LIAB_OTHER_C,
  SM_EQ_SHARE_CAPITAL,
  SM_EQ_RETAINED_EARNINGS,
  type StandardMapping,
} from '../src/lib/standards/standard-mappings'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// ─────────────────────────────────────────────────────────────────────────────
// Legacy value migration table
// Maps old standardMapping values (from seed-demo and early imports) to new taxonomy
// ─────────────────────────────────────────────────────────────────────────────
const LEGACY_MIGRATION: Record<string, StandardMapping> = {
  // Old revenue values
  'revenue.product':        SM_REV_OPS_PRODUCTS,
  'revenue.service':        SM_REV_OPS_SERVICES,
  'revenue.other':          SM_REV_OPS_OTHER,
  'revenue.interest':       SM_REV_OTHER_INTEREST,
  'revenue.dividend':       SM_REV_OTHER_DIVIDEND,
  'revenue.misc':           SM_REV_OTHER_MISC,
  // Old cogs values
  'cogs.materials':         SM_EXP_MATERIALS,
  'cogs.labour':            SM_EXP_EMPLOYEE_BENEFITS,
  'cogs.stock':             SM_EXP_STOCK_IN_TRADE,
  'cogs.overhead':          SM_EXP_OTHER,
  // Old opex values
  'opex.salaries':          SM_EXP_EMPLOYEE_BENEFITS,
  'opex.rent':              SM_EXP_OTHER,
  'opex.utilities':         SM_EXP_OTHER,
  'opex.marketing':         SM_EXP_OTHER,
  'opex.depreciation':      SM_EXP_DEPRECIATION,
  'opex.finance':           SM_EXP_FINANCE_COSTS,
  'opex.other':             SM_EXP_OTHER,
  // Old asset values
  'asset.cash':             SM_ASSET_CASH,
  'asset.receivable':       SM_ASSET_TRADE_REC,
  'asset.fixed':            SM_ASSET_PPE,
  'asset.inventory':        SM_ASSET_INVENTORIES,
  'asset.prepaid':          SM_ASSET_ST_LOANS,
  'asset.other':            SM_ASSET_OTHER_C,
  // Old liability values
  'liability.payable':      SM_LIAB_TRADE_PAY,
  'liability.loan':         SM_LIAB_LT_BORROWINGS,
  'liability.gst':          SM_LIAB_GST_PAYABLE,
  'liability.tds':          SM_LIAB_TDS_PAYABLE,
  'liability.other':        SM_LIAB_OTHER_C,
  // Old equity values
  'equity.capital':         SM_EQ_SHARE_CAPITAL,
  'equity.retained':        SM_EQ_RETAINED_EARNINGS,
}

// ─────────────────────────────────────────────────────────────────────────────
// Name-based heuristics
// Returns the best StandardMapping for an account name, or null if no match
// ─────────────────────────────────────────────────────────────────────────────
function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function heuristicMapping(
  name: string,
  accountType: string
): StandardMapping | null {
  const n = normalize(name)

  // Revenue heuristics
  if (accountType === 'revenue') {
    if (/interest|bank interest/.test(n)) return SM_REV_OTHER_INTEREST
    if (/dividend/.test(n)) return SM_REV_OTHER_DIVIDEND
    if (/service|consulting|professional income/.test(n)) return SM_REV_OPS_SERVICES
    if (/export|overseas/.test(n)) return SM_REV_OPS_PRODUCTS
    if (/sales|turnover|product|goods/.test(n)) return SM_REV_OPS_PRODUCTS
    if (/other income|misc income/.test(n)) return SM_REV_OPS_OTHER
    return null
  }

  // Expense heuristics
  if (accountType === 'expense') {
    if (/salary|salaries|wages|payroll|staff cost|employee benefit/.test(n)) return SM_EXP_EMPLOYEE_BENEFITS
    if (/direct labour|direct labor|factory wages/.test(n)) return SM_EXP_EMPLOYEE_BENEFITS
    if (/raw material|material consumed/.test(n)) return SM_EXP_MATERIALS
    if (/purchase of stock|stock purchase|stock in trade/.test(n)) return SM_EXP_STOCK_IN_TRADE
    if (/inventory change|change in stock|closing stock/.test(n)) return SM_EXP_INVENTORY_CHANGES
    if (/interest|finance charge|bank charge|loan processing/.test(n)) return SM_EXP_FINANCE_COSTS
    if (/depreciation/.test(n)) return SM_EXP_DEPRECIATION
    if (/amortis|amortiz/.test(n)) return SM_EXP_AMORTISATION
    return null // falls to SM_EXP_OTHER via fallback
  }

  // Asset heuristics
  if (accountType === 'asset') {
    if (/cash|bank balance|cash in hand|petty cash/.test(n)) return SM_ASSET_CASH
    if (/receivable|debtor|sundry debtor|trade receivable/.test(n)) return SM_ASSET_TRADE_REC
    if (/inventory|stock|closing stock|raw material stock|wip|work in progress|finished goods/.test(n)) return SM_ASSET_INVENTORIES
    if (/fixed asset|plant|machinery|equipment|ppe|property|vehicle|furniture|computer/.test(n)) return SM_ASSET_PPE
    if (/intangible|software|goodwill|patent|trademark|ip|brand/.test(n)) return SM_ASSET_INTANGIBLE
    if (/prepaid|advance|security deposit|gst receivable|itc|input credit|advance tax/.test(n)) return SM_ASSET_ST_LOANS
    return null // falls to SM_ASSET_OTHER_C via fallback
  }

  // Liability heuristics
  if (accountType === 'liability') {
    if (/trade payable|accounts payable|sundry creditor|creditor/.test(n)) return SM_LIAB_TRADE_PAY
    if (/gst payable|output gst/.test(n)) return SM_LIAB_GST_PAYABLE
    if (/tds payable|tax deducted/.test(n)) return SM_LIAB_TDS_PAYABLE
    if (/term loan|long.?term|secured loan|unsecured loan|debenture/.test(n)) return SM_LIAB_LT_BORROWINGS
    if (/od|overdraft|cash credit|working capital loan|short.?term/.test(n)) return SM_LIAB_ST_BORROWINGS
    return null // falls to SM_LIAB_OTHER_C via fallback
  }

  // Equity heuristics
  if (accountType === 'equity') {
    if (/share capital|equity capital|capital account/.test(n)) return SM_EQ_SHARE_CAPITAL
    if (/retained|surplus|profit.?loss|reserves/.test(n)) return SM_EQ_RETAINED_EARNINGS
    return null
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
interface AccountRow {
  id: string
  name: string
  account_type: string
  standard_mapping: string | null
}

async function main() {
  console.log('Phase 1: Seeding standardMapping on all accounts...\n')

  const result = await client.execute(
    'SELECT id, name, account_type, standard_mapping FROM accounts'
  )

  const accounts = result.rows as unknown as AccountRow[]
  console.log(`Total accounts: ${accounts.length}`)

  let migrated = 0
  let heuristic = 0
  let fallback = 0
  let alreadyValid = 0

  const updates: Array<{ id: string; mapping: StandardMapping; reason: string }> = []

  for (const account of accounts) {
    const current = account.standard_mapping

    // 1. Already has a valid new-taxonomy mapping — skip
    if (current && isValidStandardMapping(current)) {
      alreadyValid++
      continue
    }

    // 2. Has a legacy mapping — migrate to new taxonomy
    if (current && LEGACY_MIGRATION[current]) {
      updates.push({
        id: account.id,
        mapping: LEGACY_MIGRATION[current],
        reason: `legacy migration: ${current} → ${LEGACY_MIGRATION[current]}`,
      })
      migrated++
      continue
    }

    // 3. No mapping or unknown legacy — try name heuristics
    const heuristicResult = heuristicMapping(account.name, account.account_type)
    if (heuristicResult) {
      updates.push({
        id: account.id,
        mapping: heuristicResult,
        reason: `heuristic: "${account.name}" → ${heuristicResult}`,
      })
      heuristic++
      continue
    }

    // 4. Deterministic fallback — no account left behind
    const fallbackMapping = FALLBACK_BY_ACCOUNT_TYPE[account.account_type]
    if (fallbackMapping) {
      updates.push({
        id: account.id,
        mapping: fallbackMapping,
        reason: `fallback: accountType=${account.account_type} → ${fallbackMapping}`,
      })
      fallback++
      continue
    }

    // 5. Unknown accountType — use expense.other as last resort
    updates.push({
      id: account.id,
      mapping: SM_EXP_OTHER,
      reason: `unknown accountType "${account.account_type}" → expense.other`,
    })
    fallback++
  }

  console.log(`\nPlan:`)
  console.log(`  Already valid (skip):  ${alreadyValid}`)
  console.log(`  Legacy migration:      ${migrated}`)
  console.log(`  Heuristic match:       ${heuristic}`)
  console.log(`  Fallback:              ${fallback}`)
  console.log(`  Total to update:       ${updates.length}`)

  if (updates.length === 0) {
    console.log('\n✅ All accounts already have valid standardMapping values.')
    client.close()
    return
  }

  // Log each update for audit trail
  console.log('\nUpdates:')
  for (const u of updates) {
    console.log(`  [${u.id.slice(0, 8)}] ${u.reason}`)
  }

  // Apply updates in batches of 50
  const BATCH = 50
  let applied = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    await Promise.all(
      batch.map((u) =>
        client.execute({
          sql: 'UPDATE accounts SET standard_mapping = ? WHERE id = ?',
          args: [u.mapping, u.id],
        })
      )
    )
    applied += batch.length
    console.log(`  Applied ${applied}/${updates.length}...`)
  }

  console.log(`\n✅ Done. ${updates.length} accounts updated.`)
  client.close()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  client.close()
  process.exit(1)
})
