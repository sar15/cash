import { decryptToken } from '@/lib/utils/crypto'

/**
 * Zoho Books integration record shape.
 * Tokens are stored encrypted; always decrypt before use.
 */
interface ZohoIntegration {
  companyId: string
  accessToken: string   // encrypted
  refreshToken: string  // encrypted
  externalOrgId?: string
  expiresAt?: string
}

interface ZohoTransaction {
  transaction_id: string
  date: string
  amount: number
  transaction_type: 'debit' | 'credit'
  description: string
}

/**
 * Sync transactions from Zoho Books for a given company.
 * Decrypts stored tokens before making API calls.
 */
export async function syncZohoBooks(integration: ZohoIntegration): Promise<ZohoTransaction[]> {
  // Decrypt tokens before use
  const accessToken = decryptToken(integration.accessToken)
  const refreshToken = decryptToken(integration.refreshToken)

  const orgId = integration.externalOrgId ?? ''

  const res = await fetch(
    `https://books.zoho.in/api/v3/banktransactions?organization_id=${orgId}`,
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (res.status === 401) {
    // Token expired — refresh and retry
    const newAccessToken = await refreshZohoToken(refreshToken)
    return syncWithToken(newAccessToken, orgId)
  }

  if (!res.ok) {
    throw new Error(`Zoho Books API error: ${res.status}`)
  }

  const data = await res.json() as { banktransactions: ZohoTransaction[] }
  return data.banktransactions ?? []
}

async function refreshZohoToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://accounts.zoho.in/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ZOHO_CLIENT_ID ?? '',
      client_secret: process.env.ZOHO_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error('Failed to refresh Zoho token')

  const tokens = await res.json() as { access_token: string }
  return tokens.access_token
}

async function syncWithToken(accessToken: string, orgId: string): Promise<ZohoTransaction[]> {
  const res = await fetch(
    `https://books.zoho.in/api/v3/banktransactions?organization_id=${orgId}`,
    { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`Zoho Books API error after refresh: ${res.status}`)
  const data = await res.json() as { banktransactions: ZohoTransaction[] }
  return data.banktransactions ?? []
}
