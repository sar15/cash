/**
 * Environment variable validation
 * Validates all required env vars at startup — fails fast with clear error messages.
 * Import this in any server-side code that needs env vars.
 */

function requireEnv(name: string, description: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `  Description: ${description}\n` +
      `  See .env.example for setup instructions.`
    )
  }
  return value
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

const isProduction = process.env.NODE_ENV === 'production'

// Validate in production only — dev uses fallbacks
export const env = {
  // Database
  TURSO_DATABASE_URL: isProduction
    ? requireEnv('TURSO_DATABASE_URL', 'Turso database URL (libsql://your-db.turso.io)')
    : optionalEnv('TURSO_DATABASE_URL', 'file:local.db'),
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,

  // Auth
  CLERK_SECRET_KEY: isProduction
    ? requireEnv('CLERK_SECRET_KEY', 'Clerk secret key from clerk.com dashboard')
    : optionalEnv('CLERK_SECRET_KEY', ''),
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET, // optional — only needed for welcome emails

  // Email
  RESEND_API_KEY: process.env.RESEND_API_KEY, // optional — emails silently skipped if missing
  RESEND_FROM_EMAIL: optionalEnv('RESEND_FROM_EMAIL', ''),

  // File storage
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: optionalEnv('R2_BUCKET_NAME', 'cashflowiq-uploads'),


  // Rate limiting
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,

  // Background jobs
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,

  // Computed
  isProduction,
  isDevelopment: !isProduction,
  hasR2: !!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
  hasEmail: !!process.env.RESEND_API_KEY,
  hasInngest: !!(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY),
}

if (isProduction && (!process.env.INNGEST_EVENT_KEY || !process.env.INNGEST_SIGNING_KEY)) {
  console.warn('[CashFlowIQ] INNGEST_EVENT_KEY or INNGEST_SIGNING_KEY missing — background jobs (compliance reminders, forecast pre-computation) are disabled')
}

if (isProduction && !process.env.RESEND_FROM_EMAIL) {
  console.warn('[CashFlowIQ] RESEND_FROM_EMAIL is not set — email sending will fail in production')
}

