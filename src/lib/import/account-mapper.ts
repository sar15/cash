/**
 * Account Mapper
 *
 * FIX audit1 C6: Uses full Indian CoA (44 accounts) instead of 8 hardcoded accounts.
 * FIX audit6: Category-aware matching, proper alias support.
 */
import { INDIAN_COA, type IndianCoAEntry } from '@/lib/standards/indian-coa'

// Levenshtein distance implementation
export function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0
  const bn = b ? b.length : 0
  if (an === 0) return bn
  if (bn === 0) return an
  const matrix = new Array<number[]>(bn + 1)
  for (let i = 0; i <= bn; ++i) {
    const row = (matrix[i] = new Array<number>(an + 1))
    row[0] = i
  }
  const firstRow = matrix[0]
  for (let j = 1; j <= an; ++j) {
    firstRow[j] = j
  }
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }
  return matrix[bn][an]
}

export type AccountMatchType = 'exact' | 'fuzzy' | 'unmapped'

export interface AccountMappingResult {
  accountId: string | null
  matchType: AccountMatchType
  matchedEntry?: IndianCoAEntry
  confidence?: number
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[&]/g, 'and').replace(/\s+/g, ' ')
}

/**
 * Substring containment check for quick matching
 */
function containsMatch(needle: string, haystack: string): boolean {
  return haystack.includes(needle) || needle.includes(haystack)
}

export function mapAccountDetailed(rawName: string, categoryHint?: string): AccountMappingResult {
  const normalized = normalize(rawName)

  // Phase 1: Exact match against name or aliases
  for (const entry of INDIAN_COA) {
    if (normalize(entry.name) === normalized) {
      return { accountId: entry.id, matchType: 'exact', matchedEntry: entry, confidence: 100 }
    }

    for (const alias of entry.aliases) {
      if (normalize(alias) === normalized) {
        return { accountId: entry.id, matchType: 'exact', matchedEntry: entry, confidence: 100 }
      }
    }
  }

  // Phase 2: Containment match (e.g., "Raw Material Consumed" contains "Raw Material")
  for (const entry of INDIAN_COA) {
    const entryNorm = normalize(entry.name)
    if (containsMatch(entryNorm, normalized) && entryNorm.length > 3) {
      return { accountId: entry.id, matchType: 'fuzzy', matchedEntry: entry, confidence: 85 }
    }

    for (const alias of entry.aliases) {
      const aliasNorm = normalize(alias)
      if (containsMatch(aliasNorm, normalized) && aliasNorm.length > 3) {
        return { accountId: entry.id, matchType: 'fuzzy', matchedEntry: entry, confidence: 80 }
      }
    }
  }

  // Phase 3: Fuzzy (Levenshtein) match
  let bestMatch: IndianCoAEntry | null = null
  let bestDistance = Infinity

  // Filter by category hint if provided
  const candidates = categoryHint
    ? INDIAN_COA.filter((e) => normalize(e.category) === normalize(categoryHint))
    : INDIAN_COA

  const pool = candidates.length > 0 ? candidates : INDIAN_COA

  for (const entry of pool) {
    const dist = levenshtein(normalize(entry.name), normalized)
    if (dist < bestDistance) {
      bestDistance = dist
      bestMatch = entry
    }

    for (const alias of entry.aliases) {
      const aliasDist = levenshtein(normalize(alias), normalized)
      if (aliasDist < bestDistance) {
        bestDistance = aliasDist
        bestMatch = entry
      }
    }
  }

  // Threshold: Levenshtein distance < 4 for reasonable fuzzy match
  if (bestDistance < 4 && bestMatch) {
    const maxLen = Math.max(normalized.length, normalize(bestMatch.name).length)
    const confidence = Math.round(((maxLen - bestDistance) / maxLen) * 100)
    return { accountId: bestMatch.id, matchType: 'fuzzy', matchedEntry: bestMatch, confidence }
  }

  return { accountId: null, matchType: 'unmapped' }
}

export function mapAccount(rawName: string): string | null {
  return mapAccountDetailed(rawName).accountId
}

// Re-export for backward compatibility
export type StandardAccountOption = IndianCoAEntry
export const STANDARD_ACCOUNT_OPTIONS = INDIAN_COA
