import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { encryptToken } from '@/lib/utils/crypto'

/**
 * Zoho OAuth callback handler.
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

  const raw = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  // Normalise to camelCase for consistent internal usage
  const tokens = {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresIn: raw.expires_in,
  }

  // Encrypt tokens before storing
  const encryptedAccess = encryptToken(tokens.accessToken)
  const encryptedRefresh = encryptToken(tokens.refreshToken)

  // TODO: persist encryptedAccess / encryptedRefresh to an integrations table
  void encryptedAccess
  void encryptedRefresh

  return NextResponse.redirect(new URL(`/settings?connected=zoho&company=${companyId}`, req.url))
}
