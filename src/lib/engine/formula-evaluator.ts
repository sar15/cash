/**
 * Custom Formula Evaluator
 *
 * Evaluates user-defined formulas against forecast engine results.
 * Formulas reference accounts by ID or built-in metrics.
 *
 * Syntax:
 *   [account_id]          → sum of that account's forecast values
 *   [account_id] / 100    → divide by 100
 *   ([rev] - [cogs]) / [rev] * 100  → gross margin %
 *
 * Built-in tokens:
 *   REVENUE, COGS, GROSS_PROFIT, OPEX, NET_INCOME, OCF, FCF, CASH
 *
 * Security: Uses expr-eval (AST-based parser) — NO eval() or new Function().
 * expr-eval parses expressions into an AST and walks it safely.
 */

import { Parser } from 'expr-eval'
import type { EngineResult } from './index'

export interface CustomFormula {
  id: string
  name: string
  expression: string   // e.g. "([rev-id] - [cogs-id]) / [rev-id] * 100"
  format: 'currency' | 'percent' | 'number' | 'days'
  description?: string
  companyId: string
}

export interface FormulaToken {
  type: 'account' | 'builtin' | 'operator' | 'number' | 'paren'
  value: string
  accountId?: string
  displayName?: string
}

export interface FormulaResult {
  value: number        // 0 on div/0 or arithmetic error — never null, never NaN
  warning?: string     // set when a div/0 or arithmetic issue occurred
}

// Built-in aggregate tokens
const BUILTIN_TOKENS: Record<string, string> = {
  REVENUE:      'Total Revenue',
  COGS:         'Cost of Goods Sold',
  GROSS_PROFIT: 'Gross Profit',
  OPEX:         'Operating Expenses',
  NET_INCOME:   'Net Income',
  OCF:          'Operating Cash Flow',
  FCF:          'Free Cash Flow',
  CASH:         'Cash Balance',
}

// Safe expr-eval parser — only arithmetic + a small set of math functions
// No access to JS globals, prototype chain, or any side-effecting operations
const SAFE_PARSER = new Parser({
  operators: {
    add: true,
    concatenate: false,
    conditional: true,   // ternary: a ? b : c
    divide: true,
    factorial: false,
    multiply: true,
    power: true,
    remainder: true,
    subtract: true,
    logical: false,      // no && || to prevent short-circuit tricks
    comparison: true,    // allow > < >= <= == for IF-like conditions
    'in': false,
    assignment: false,   // CRITICAL: no variable assignment
  },
})

// Whitelist only safe math functions — no access to anything else
SAFE_PARSER.functions = {
  abs:   Math.abs,
  ceil:  Math.ceil,
  floor: Math.floor,
  round: Math.round,
  max:   Math.max,
  min:   Math.min,
  sqrt:  Math.sqrt,
  pow:   Math.pow,
  log:   Math.log,
  log2:  Math.log2,
  log10: Math.log10,
}

// No constants beyond what we explicitly provide
SAFE_PARSER.consts = {}

/**
 * Sanitize an account ID so it can be used as a variable name in expr-eval.
 * Account IDs may contain hyphens (e.g. "rev-001") which are not valid identifiers.
 * We replace them with underscores and prefix with "acc_".
 */
function accountIdToVar(id: string): string {
  return 'acc_' + id.replace(/[^a-zA-Z0-9_]/g, '_')
}

/**
 * Evaluate a formula for a single month's data.
 * Returns a FormulaResult — value is always a finite number (0 on error).
 * Never returns null/NaN/Infinity so downstream charts never get broken data points.
 */
function evaluateForMonth(
  expression: string,
  monthIndex: number,
  engineResult: EngineResult,
  accountForecasts: Record<string, number[]>
): FormulaResult {
  const raw = engineResult.rawIntegrationResults[monthIndex]
  if (!raw) return { value: 0, warning: 'No data for this month' }

  // Build variable scope with built-in tokens
  const scope: Record<string, number> = {
    REVENUE:      raw.pl.revenue,
    COGS:         raw.pl.cogs,
    GROSS_PROFIT: raw.pl.grossProfit,
    OPEX:         raw.pl.expense,
    NET_INCOME:   raw.pl.netIncome,
    OCF:          raw.cf.operatingCashFlow,
    FCF:          raw.cf.operatingCashFlow + raw.cf.investingCashFlow,
    CASH:         raw.bs.cash,
  }

  // Replace [account_id] references with sanitized variable names
  // and populate scope with their values
  let expr = expression.replace(/\[([^\]]+)\]/g, (_, accountId: string) => {
    const varName = accountIdToVar(accountId)
    const values = accountForecasts[accountId]
    scope[varName] = values ? (values[monthIndex] ?? 0) : 0
    return varName
  })

  // Replace MAX/MIN/ABS/IF with expr-eval equivalents (lowercase)
  expr = expr
    .replace(/\bMAX\s*\(/gi, 'max(')
    .replace(/\bMIN\s*\(/gi, 'min(')
    .replace(/\bABS\s*\(/gi, 'abs(')
    .replace(/\bROUND\s*\(/gi, 'round(')
    .replace(/\bFLOOR\s*\(/gi, 'floor(')
    .replace(/\bCEIL\s*\(/gi, 'ceil(')
    // IF(cond, then, else) → (cond ? then : else)
    .replace(/\bIF\s*\(([^,]+),([^,]+),([^)]+)\)/gi, '(($1) ? ($2) : ($3))')

  try {
    const parsed = SAFE_PARSER.parse(expr)
    const result = parsed.evaluate(scope) as unknown
    if (typeof result !== 'number' || isNaN(result)) {
      return { value: 0, warning: 'Formula returned a non-numeric result' }
    }
    if (!isFinite(result)) {
      // Division by zero — return 0 with a warning instead of null/Infinity
      return { value: 0, warning: 'Division by zero (Div/0)' }
    }
    // Round to avoid IEEE 754 float drift accumulating across months
    return { value: Math.round(result * 1e6) / 1e6 }
  } catch {
    return { value: 0, warning: 'Formula evaluation error' }
  }
}

/**
 * Evaluate a formula across all forecast months.
 * Returns FormulaResult[] — values are always finite numbers, never null/NaN.
 * Check result.warning to surface Div/0 indicators in the UI.
 */
export function evaluateFormula(
  formula: CustomFormula,
  engineResult: EngineResult
): FormulaResult[] {
  const months = engineResult.forecastMonths.length
  const accountForecasts = engineResult.accountForecasts

  return Array.from({ length: months }, (_, i) =>
    evaluateForMonth(formula.expression, i, engineResult, accountForecasts)
  )
}

/**
 * Convenience helper: evaluate and return plain number[] for consumers
 * that don't need the warning metadata (charts, grids, etc.).
 * Returns 0 for any month with a div/0 or error.
 */
export function evaluateFormulaValues(
  formula: CustomFormula,
  engineResult: EngineResult
): number[] {
  return evaluateFormula(formula, engineResult).map(r => {
    if (r.warning && process.env.NODE_ENV !== 'production') {
      console.warn(`[FormulaEvaluator] Warning evaluating "${formula.name}": ${r.warning}`)
    }
    return r.value
  })
}

/**
 * Validate a formula expression — returns error message or null if valid
 */
export function validateFormula(
  expression: string,
  availableAccountIds: string[]
): string | null {
  if (!expression.trim()) return 'Formula cannot be empty'

  // Check for account references
  const accountRefs = [...expression.matchAll(/\[([^\]]+)\]/g)].map(m => m[1])
  for (const ref of accountRefs) {
    if (!availableAccountIds.includes(ref) && !BUILTIN_TOKENS[ref]) {
      return `Unknown account: ${ref}`
    }
  }

  // Build a test expression with dummy values to validate syntax
  let testExpr = expression
  for (const token of Object.keys(BUILTIN_TOKENS)) {
    testExpr = testExpr.replace(new RegExp(`\\b${token}\\b`, 'g'), '1')
  }
  testExpr = testExpr.replace(/\[[^\]]+\]/g, '1')
  testExpr = testExpr
    .replace(/\bMAX\s*\(/gi, 'max(')
    .replace(/\bMIN\s*\(/gi, 'min(')
    .replace(/\bABS\s*\(/gi, 'abs(')
    .replace(/\bROUND\s*\(/gi, 'round(')
    .replace(/\bFLOOR\s*\(/gi, 'floor(')
    .replace(/\bCEIL\s*\(/gi, 'ceil(')
    .replace(/\bIF\s*\(([^,]+),([^,]+),([^)]+)\)/gi, '(($1) ? ($2) : ($3))')

  try {
    SAFE_PARSER.parse(testExpr).evaluate({})
    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Formula has a syntax error: ${msg}`
  }
}

/**
 * Parse expression into display tokens for the formula builder UI
 */
export function tokenizeExpression(
  expression: string,
  accounts: Array<{ id: string; name: string }>
): FormulaToken[] {
  const tokens: FormulaToken[] = []
  const accountMap = new Map(accounts.map(a => [a.id, a.name]))

  // Split on account refs and built-ins
  const parts = expression.split(/(\[[^\]]+\]|\bREVENUE\b|\bCOGS\b|\bGROSS_PROFIT\b|\bOPEX\b|\bNET_INCOME\b|\bOCF\b|\bFCF\b|\bCASH\b)/)

  for (const part of parts) {
    if (!part) continue

    if (part.startsWith('[') && part.endsWith(']')) {
      const accountId = part.slice(1, -1)
      tokens.push({
        type: 'account',
        value: part,
        accountId,
        displayName: accountMap.get(accountId) ?? accountId,
      })
    } else if (BUILTIN_TOKENS[part]) {
      tokens.push({ type: 'builtin', value: part, displayName: BUILTIN_TOKENS[part] })
    } else {
      // Split remaining into operators, numbers, parens
      const subParts = part.match(/[\d.]+|[+\-*/()]|\s+/g) ?? []
      for (const sub of subParts) {
        if (/^\s+$/.test(sub)) continue
        if (/^[\d.]+$/.test(sub)) {
          tokens.push({ type: 'number', value: sub })
        } else if (/^[+\-*/]$/.test(sub)) {
          tokens.push({ type: 'operator', value: sub })
        } else if (/^[()]$/.test(sub)) {
          tokens.push({ type: 'paren', value: sub })
        }
      }
    }
  }

  return tokens
}

export { BUILTIN_TOKENS }
