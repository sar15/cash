import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { encryptToken } from '@/lib/utils/crypto'
import { eq, and } from 'drizzle-orm'

/**
 * Zoho OAuth callback handler
 * Exchanges the authorization code for tokens and stores them encrypted.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const companyId = searchParams.get('state')

  if (!code || !companyId) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://accounts.zoho.in/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ZOHO_CLIENT_ID ?? '',
      client_secret: process.env.ZOHO_CLIENT_SECRET ?? '',
      redirect_uri: process.env.ZOHO_REDIRECT_URI ?? '',
      code,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 })
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  // Encrypt tokens before storing
  const encryptedAccess = encryptToken(tokens.accessToken ?? tokens.access_token)
  const encryptedRefresh = encryptToken(tokens.refreshToken ?? tokens.refresh_token)

  await db
    .insert(integrations)
    .values({
      companyId,
      provider: 'zoho',
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    })
    .onConflictDoUpdate({
      target: [integrations.companyId, integrations.provider],
      set: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      },
    })

  return NextResponse.redirect(new URL(`/settings?connected=zoho`, req.url))
}
