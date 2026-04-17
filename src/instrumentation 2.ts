/**
 * Next.js instrumentation entry point.
 * Called once at server startup before any request is served.
 * Imports env.ts to run fail-fast validation of all required environment variables.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/server/env')
  }
}
