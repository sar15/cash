import { handleRouteError, jsonResponse } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/auth'
import { isStorageConfigured } from '@/lib/storage'

function envFlag(name: string) {
  return Boolean(process.env[name] && String(process.env[name]).trim().length > 0)
}

export async function GET() {
  try {
    await requireUserId()

    const diagnostics = {
      ts: new Date().toISOString(),
      env: {
        nodeEnv: process.env.NODE_ENV ?? 'unknown',
      },
      features: {
        storage: isStorageConfigured() ? 'uploadthing' : 'local',
        resend: envFlag('RESEND_API_KEY'),
        inngest: envFlag('INNGEST_EVENT_KEY') || envFlag('INNGEST_SIGNING_KEY'),
        upstashRateLimit: envFlag('UPSTASH_REDIS_REST_URL') && envFlag('UPSTASH_REDIS_REST_TOKEN'),
        sentry: envFlag('SENTRY_DSN') || envFlag('NEXT_PUBLIC_SENTRY_DSN'),
      },
    }

    return jsonResponse({ diagnostics })
  } catch (error) {
    return handleRouteError('DIAGNOSTICS_GET', error)
  }
}

