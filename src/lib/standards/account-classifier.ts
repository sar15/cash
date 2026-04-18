/**
 * Account classification helpers — Schedule III taxonomy aware.
 *
 * Centralises the COGS detection logic so it only needs to change in one place.
 * Previously scattered across 8+ files using `standardMapping?.startsWith('cogs')`,
 * which broke when the taxonomy changed from 'cogs.*' to 'expense.materials_consumed' etc.
 *
 * Phase 2: All COGS detection now uses isCOGSAccount().
 */

import {
  SM_EXP_MATERIALS,
  SM_EXP_STOCK_IN_TRADE,
  SM_EXP_INVENTORY_CHANGES,
} from './standard-mappings'

/**
 * The set of standardMapping values that represent Cost of Goods Sold.
 * Schedule III Line IV(a), (b), (c).
 */
const COGS_MAPPINGS = new Set<string>([
  SM_EXP_MATERIALS,       // expense.materials_consumed
  SM_EXP_STOCK_IN_TRADE,  // expense.stock_in_trade
  SM_EXP_INVENTORY_CHANGES, // expense.inventory_changes
  // Legacy values — kept for backward compat with any pre-migration data
  'cogs.materials',
  'cogs.labour',
  'cogs.stock',
  'cogs.overhead',
])

/**
 * Returns true if the account is a COGS account.
 * An account is COGS if:
 *   - accountType === 'expense' AND
 *   - standardMapping is in the COGS set
 *
 * Falls back to the old `startsWith('cogs')` heuristic for accounts
 * that somehow still have legacy mappings not in the set above.
 */
export function isCOGSAccount(account: {
  accountType: string
  standardMapping?: string | null
}): boolean {
  if (account.accountType !== 'expense') return false
  const sm = account.standardMapping
  if (!sm) return false
  return COGS_MAPPINGS.has(sm) || sm.startsWith('cogs.')
}

/**
 * Maps a DB account to an engine AccountInput category.
 * Single source of truth — used by ForecastClient, use-current-forecast,
 * recompute-forecast, scenarios page, and reports.
 */
export function accountToEngineCategory(account: {
  accountType: string
  standardMapping?: string | null
}): 'Revenue' | 'COGS' | 'Operating Expenses' | 'Assets' | 'Liabilities' | 'Equity' {
  if (account.accountType === 'revenue') return 'Revenue'
  if (isCOGSAccount(account)) return 'COGS'
  if (account.accountType === 'expense') return 'Operating Expenses'
  if (account.accountType === 'asset') return 'Assets'
  if (account.accountType === 'liability') return 'Liabilities'
  return 'Equity'
}
