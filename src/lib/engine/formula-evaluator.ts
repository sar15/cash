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
 */

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

/**
 * Evaluate a formula for a single month's data
 */
function evaluateForMonth(
  expression: string,
  monthIndex: number,
  engineResult: EngineResult,
  accountForecasts: Record<string, number[]>
): number | null {
  const raw = engineResult.rawIntegrationResults[monthIndex]
  if (!raw) return null

  // Replace built-in tokens
  let expr = expression
    .replace(/\bREVENUE\b/g, String(raw.pl.revenue))
    .replace(/\bCOGS\b/g, String(raw.pl.cogs))
    .replace(/\bGROSS_PROFIT\b/g, String(raw.pl.grossProfit))
    .replace(/\bOPEX\b/g, String(raw.pl.expense))
    .replace(/\bNET_INCOME\b/g, String(raw.pl.netIncome))
    .replace(/\bOCF\b/g, String(raw.cf.operatingCashFlow))
    .replace(/\bFCF\b/g, String(raw.cf.operatingCashFlow + raw.cf.investingCashFlow))
    .replace(/\bCASH\b/g, String(raw.bs.cash))

  // Replace [account_id] tokens
  expr = expr.replace(/\[([^\]]+)\]/g, (_, accountId: string) => {
    const values = accountForecasts[accountId]
    if (!values) return '0'
    return String(values[monthIndex] ?? 0)
  })

  // Safe eval — allow numbers, math operators, and safe math functions
  // Replace MAX/MIN/ABS/IF with safe JS equivalents before evaluating
  const safeExpr = expr
    .replace(/\bMAX\s*\(/gi, 'Math.max(')
    .replace(/\bMIN\s*\(/gi, 'Math.min(')
    .replace(/\bABS\s*\(/gi, 'Math.abs(')
    .replace(/\bROUND\s*\(/gi, 'Math.round(')
    .replace(/\bFLOOR\s*\(/gi, 'Math.floor(')
    .replace(/\bCEIL\s*\(/gi, 'Math.ceil(')
    .replace(/\bIF\s*\(([^,]+),([^,]+),([^)]+)\)/gi, '(($1) ? ($2) : ($3))')

  const stripped = safeExpr.replace(/\s/g, '')
  // Allow numbers, operators, Math.* calls, and parentheses
  if (!/^[0-9+\-*/().eMath,_a-z]+$/i.test(stripped)) return null
  if (stripped.length === 0 || stripped === '()') return null

  try {
    const fn = new Function('Math', `"use strict"; return (${safeExpr})`)
    const result = fn(Math) as unknown
    if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) return null
    return result
  } catch {
    return null
  }
}

/**
 * Evaluate a formula across all forecast months
 */
export function evaluateFormula(
  formula: CustomFormula,
  engineResult: EngineResult
): (number | null)[] {
  const months = engineResult.forecastMonths.length
  const accountForecasts = engineResult.accountForecasts

  return Array.from({ length: months }, (_, i) =>
    evaluateForMonth(formula.expression, i, engineResult, accountForecasts)
  )
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

  // Check for unknown tokens (after replacing known ones)
  let testExpr = expression
  for (const token of Object.keys(BUILTIN_TOKENS)) {
    testExpr = testExpr.replace(new RegExp(`\\b${token}\\b`, 'g'), '1')
  }
  testExpr = testExpr.replace(/\[[^\]]+\]/g, '1')

  if (!/^[\d\s+\-*/().eMath,_a-zA-Z]+$/.test(testExpr.replace(/\s/g, ''))) {
    return 'Formula contains invalid characters. Use numbers, +, -, *, /, (, ), MAX(), MIN(), ABS(), IF(), and account references like [account_id]'
  }

  try {
    new Function(`return (${testExpr})`)()
    return null
  } catch {
    return 'Formula has a syntax error'
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
