import { db } from '@/lib/db'
import { integrations, transactions } from '@/lib/db/schema'
import { decryptToken } from '@/lib/utils/crypto'
import { eq, and } from 'drizzle-orm'

/**
 * Sync transactions from Zoho Books for a given company.
 * Decrypts stored tokens before making API calls.
 */
export async function syncZohoBooks(companyId: string): Promise<void> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.companyId, companyId), eq(integrations.provider, 'zoho')))
    .limit(1)

  if (!integration) {
    throw new Error(`No Zoho integration found for company ${companyId}`)
  }

  // Decrypt tokens before use
  const accessToken = decryptToken(integration.accessToken)
  const refreshToken = decryptToken(integration.refreshToken)

  // Fetch transactions from Zoho Books API
  const res = await fetch(
    `https://books.zoho.in/api/v3/banktransactions?organization_id=${integration.externalOrgId ?? ''}`,
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (res.status === 401) {
    // Token expired — refresh and retry
    const newAccessToken = await refreshZohoToken(refreshToken, companyId)
    await syncWithToken(newAccessToken, companyId, integration.externalOrgId ?? '')
    return
  }

  if (!res.ok) {
    throw new Error(`Zoho Books API error: ${res.status}`)
  }

  const data = await res.json() as { banktransactions: ZohoTransaction[] }
  await upsertTransactions(companyId, data.banktransactions ?? [])
}

async function refreshZohoToken(refreshToken: string, companyId: string): Promise<string> {
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

  const tokens = await res.json() as { access_token: string; expires_in: number }

  // Re-encrypt and store the new access token
  const { encryptToken } = await import('@/lib/utils/crypto')
  await db
    .update(integrations)
    .set({
      accessToken: encryptToken(tokens.access_token),
      expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    })
    .where(and(eq(integrations.companyId, companyId), eq(integrations.provider, 'zoho')))

  return tokens.access_token
}

async function syncWithToken(accessToken: string, companyId: string, orgId: string) {
  const res = await fetch(
    `https://books.zoho.in/api/v3/banktransactions?organization_id=${orgId}`,
    { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`Zoho Books API error after refresh: ${res.status}`)
  const data = await res.json() as { banktransactions: ZohoTransaction[] }
  await upsertTransactions(companyId, data.banktransactions ?? [])
}

interface ZohoTransaction {
  transaction_id: string
  date: string
  amount: number
  transaction_type: 'debit' | 'credit'
  description: string
}

async function upsertTransactions(companyId: string, txns: ZohoTransaction[]) {
  for (const txn of txns) {
    await db
      .insert(transactions)
      .values({
        companyId,
        externalId: txn.transaction_id,
        date: txn.date,
        amount: txn.amount,
        type: txn.transaction_type,
        description: txn.description,
        source: 'zoho',
      })
      .onConflictDoNothing()
  }
}
