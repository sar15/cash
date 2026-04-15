import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, checkImportRateLimit } from '@/lib/rate-limit'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/privacy',
  '/api/health',
  '/api/webhooks(.*)',
  '/api/import/template', // Public blank CSV template — no company data
])

export default clerkMiddleware(async (auth, request: NextRequest) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }

  // Generate per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://clerk.cashflowiq.in https://*.clerk.accounts.dev`,
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ''} https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://img.clerk.com",
    "connect-src 'self' https://*.clerk.accounts.dev https://*.ingest.sentry.io wss://*.clerk.accounts.dev",
    "frame-src 'self' https://*.clerk.accounts.dev",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')

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
  if (userId) {
    const path = request.nextUrl.pathname

    // Import upload: 10/hour per user (expensive — parses large files)
    if (path === '/api/import/upload' || path === '/api/import/seed-demo') {
      const { success } = await checkImportRateLimit(userId)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many import requests. Please wait before trying again.' },
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
