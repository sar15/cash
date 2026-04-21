import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, checkImportRateLimit, checkReportRateLimit, checkExportRateLimit, checkPublicRateLimit } from '@/lib/rate-limit'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/privacy',
  '/api/health',
  '/api/webhooks(.*)',
  '/api/inngest(.*)', // Inngest server-to-server — verified by Inngest signing key, not Clerk
  '/api/import/template', // Public blank CSV template — no company data
  '/manifest.webmanifest(.*)', // PWA manifest — must be public
  '/manifest.json(.*)',
])

export default clerkMiddleware(async (auth, request: NextRequest) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }

  // Generate per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  // In dev, use a permissive CSP so Clerk's OAuth flows and hot-reload work.
  // In production, tighten with nonces.
  const cspHeader = isDev
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.cashflowiq.in https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://img.clerk.com",
        "connect-src 'self' https://*.clerk.accounts.dev https://*.ingest.sentry.io wss://*.clerk.accounts.dev ws://localhost:* http://localhost:*",
        "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; ')
    : [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.cashflowiq.in https://*.clerk.accounts.dev https://challenges.cloudflare.com`,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://img.clerk.com",
        "connect-src 'self' https://*.clerk.accounts.dev https://*.ingest.sentry.io wss://*.clerk.accounts.dev",
        "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; ')

  const isMutationMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/')
  const isWebhookRoute = request.nextUrl.pathname.startsWith('/api/webhooks/')
  if (isMutationMethod && isApiRequest && !isWebhookRoute) {
    const origin = request.headers.get('origin')
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      )
    }
  }

  // Skip rate limiting in development for faster iteration
  if (isDev) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('Content-Security-Policy', cspHeader)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Content-Security-Policy', cspHeader)
    return response
  }

  const { userId } = await auth()
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'

  if (userId) {
    const path = request.nextUrl.pathname

    // Import upload: 10/hour per user
    if (path === '/api/import/upload' || path === '/api/import/seed-demo') {
      const { success } = await checkImportRateLimit(userId)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many import requests. Please wait.' },
          { status: 429 }
        )
      }
    }

    // Report generation: 5/hour per user
    if (path === '/api/reports/generate') {
      const { success } = await checkReportRateLimit(userId)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many report requests. Please wait.' },
          { status: 429 }
        )
      }
    }

    // Full export: 3/hour per user (large DB query + payload)
    if (path === '/api/export/full') {
      const { success } = await checkExportRateLimit(userId)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many export requests. Please wait.' },
          { status: 429 }
        )
      }
    }

    // General API: 100/minute per user
    if (path.startsWith('/api/') && !path.startsWith('/api/health') && !path.startsWith('/api/inngest')) {
      const { success } = await checkRateLimit(userId)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please slow down.' },
          { status: 429 }
        )
      }
    }
  } else if (isApiRequest) {
    // Rate limit public API requests (including health/webhooks) by IP
    const { success } = await checkPublicRateLimit(ip)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests from this IP. Please slow down.' },
        { status: 429 }
      )
    }
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', cspHeader)
  return response
})

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    '/(api|trpc)(.*)',
  ],
}
