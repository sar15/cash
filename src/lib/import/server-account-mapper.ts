import { levenshtein } from './account-mapper'
import { STANDARD_INDIAN_COA, type StandardIndianAccount } from '@/lib/standards/indian-coa'

export type ServerAccountMatchType = 'exact' | 'alias' | 'keyword' | 'fuzzy' | 'unmapped' | 'saved' | 'skipped'

export interface ServerAccountMappingResult {
  account: StandardIndianAccount | null
  matchType: ServerAccountMatchType
  confidence: number
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreKeywordMatch(account: StandardIndianAccount, normalizedName: string) {
  const keywords = [account.name, ...account.aliases]
    .flatMap((value) => normalize(value).split(' '))
    .filter((token) => token.length >= 4)

  const matched = keywords.filter((token) => normalizedName.includes(token))
  return matched.length / Math.max(keywords.length, 1)
}

export function mapServerAccountDetailed(rawName: string): ServerAccountMappingResult {
  const normalizedName = normalize(rawName)

  if (!normalizedName) {
    return { account: null, matchType: 'unmapped', confidence: 0 }
  }

  for (const account of STANDARD_INDIAN_COA) {
    if (normalize(account.name) === normalizedName) {
      return { account, matchType: 'exact', confidence: 1 }
    }

    if (account.aliases.some((alias) => normalize(alias) === normalizedName)) {
      return { account, matchType: 'alias', confidence: 0.98 }
    }
  }

  let bestKeyword: { account: StandardIndianAccount; score: number } | null = null
  for (const account of STANDARD_INDIAN_COA) {
    const score = scoreKeywordMatch(account, normalizedName)
    if (score >= 0.5 && (!bestKeyword || score > bestKeyword.score)) {
      bestKeyword = { account, score }
    }
  }

  if (bestKeyword) {
    return {
      account: bestKeyword.account,
      matchType: 'keyword',
      confidence: Math.min(0.95, 0.6 + bestKeyword.score / 2),
    }
  }

  let bestFuzzy: { account: StandardIndianAccount; distance: number } | null = null
  for (const account of STANDARD_INDIAN_COA) {
    const candidates = [account.name, ...account.aliases]
    for (const candidate of candidates) {
      const distance = levenshtein(normalize(candidate), normalizedName)
      if (!bestFuzzy || distance < bestFuzzy.distance) {
        bestFuzzy = { account, distance }
      }
    }
  }

  if (
    bestFuzzy &&
    bestFuzzy.distance <= Math.max(2, Math.floor(normalizedName.length * 0.15))
  ) {
    return {
      account: bestFuzzy.account,
      matchType: 'fuzzy',
      confidence: Math.max(0.4, 1 - bestFuzzy.distance / Math.max(normalizedName.length, 1)),
    }
  }

  return { account: null, matchType: 'unmapped', confidence: 0 }
}
