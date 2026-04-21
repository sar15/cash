/**
 * Distributed rate limiting using Upstash Redis
 * Falls back to in-memory rate limiting when Redis is unavailable
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client if credentials are available
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

// Distributed rate limiter (Upstash Redis)
export const distributedRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
      analytics: true,
      prefix: 'cashflowiq',
    })
  : null

// In-memory fallback rate limiter
interface RateLimitEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, RateLimitEntry>()

function inMemoryRateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = memoryStore.get(identifier)

  // Clean up expired entries periodically
  if (memoryStore.size > 10000) {
    for (const [key, value] of memoryStore.entries()) {
      if (value.resetAt < now) {
        memoryStore.delete(key)
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    memoryStore.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

/**
 * Rate limit for public/unauthenticated endpoints (IP-based)
 * 30 requests per minute per IP
 */
export async function checkPublicRateLimit(ip: string): Promise<{ success: boolean }> {
  if (distributedRateLimiter) {
    try {
      const limiter = new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        analytics: true,
        prefix: 'cashflowiq:public',
      })
      const result = await limiter.limit(ip)
      return { success: result.success }
    } catch (error) {
      console.error('[RateLimit] Upstash error for public route:', error)
    }
  }

  // Fallback
  const success = inMemoryRateLimit(`public:${ip}`, 30, 60000)
  return { success }
}

/**
 * Check rate limit for a given identifier (usually userId)
 * Returns { success: true } if request is allowed
 * Returns { success: false } if rate limit exceeded
 */
export async function checkRateLimit(
  identifier: string
): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number }> {
  // Use distributed limiter if available
  if (distributedRateLimiter) {
    try {
      const result = await distributedRateLimiter.limit(identifier)
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      }
    } catch (error) {
      console.error('[RateLimit] Upstash error, falling back to in-memory:', error)
      // Fall through to in-memory limiter
    }
  }

  // Fallback to in-memory limiter
  const success = inMemoryRateLimit(identifier, 100, 60000) // 100 req/min
  return { success }
}

/**
 * Rate limit for import endpoints (stricter)
 */
export async function checkImportRateLimit(identifier: string): Promise<{ success: boolean }> {
  if (distributedRateLimiter) {
    try {
      const limiter = new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 imports per hour
        analytics: true,
        prefix: 'cashflowiq:import',
      })
      const result = await limiter.limit(identifier)
      return { success: result.success }
    } catch (error) {
      console.error('[RateLimit] Upstash error for import:', error)
    }
  }

  // Fallback
  const success = inMemoryRateLimit(`import:${identifier}`, 10, 3600000) // 10/hour
  return { success }
}

/**
 * Rate limit for expensive report generation (5/hour per user)
 */
export async function checkReportRateLimit(identifier: string): Promise<{ success: boolean }> {
  if (redis) {
    try {
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'),
        analytics: true,
        prefix: 'cashflowiq:report',
      })
      const result = await limiter.limit(identifier)
      return { success: result.success }
    } catch (error) {
      console.error('[RateLimit] Upstash error for report:', error)
    }
  }
  const success = inMemoryRateLimit(`report:${identifier}`, 5, 3600000)
  return { success }
}

/**
 * Rate limit for full export (3/hour per user — large payload, expensive query)
 */
export async function checkExportRateLimit(identifier: string): Promise<{ success: boolean }> {
  if (redis) {
    try {
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '1 h'),
        analytics: true,
        prefix: 'cashflowiq:export',
      })
      const result = await limiter.limit(identifier)
      return { success: result.success }
    } catch (error) {
      console.error('[RateLimit] Upstash error for export:', error)
    }
  }
  const success = inMemoryRateLimit(`export:${identifier}`, 3, 3600000)
  return { success }
}/**
 * Log error if Redis is not configured in production — in-memory fallback
 * does not work correctly across multiple serverless instances.
 * Set STRICT_PROD_GUARDS=true to fail hard instead of degrading silently.
 *
 * For a production-grade deployment, Redis is mandatory. The in-memory fallback
 * is intentionally left only for local development.
 */
if (!redis && process.env.NODE_ENV === 'production') {
  // Always throw in production — rate limiting without Redis is not a real control
  throw new Error(
    '[RateLimit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production. ' +
    'In-memory rate limiting does not work across serverless instances. ' +
    'Configure Upstash Redis or set NODE_ENV=development to bypass this check.'
  )
}
