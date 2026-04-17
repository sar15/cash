import { and, eq, isNotNull, inArray } from 'drizzle-orm'

import { db, schema } from '@/lib/db'

export type FirmMemberRole = 'partner' | 'admin' | 'staff' | 'readonly'

export async function getFirmForUser(clerkUserId: string) {
  const member = await db.query.firmMembers.findFirst({
    where: and(
      eq(schema.firmMembers.clerkUserId, clerkUserId),
      isNotNull(schema.firmMembers.acceptedAt)
    ),
  })
  if (!member) return null
  return db.query.firms.findFirst({
    where: eq(schema.firms.id, member.firmId),
  })
}

export async function getOrCreateDefaultFirm(clerkUserId: string) {
  const existing = await getFirmForUser(clerkUserId)
  if (existing) return existing

  let firm: Awaited<ReturnType<typeof getFirmForUser>> = null
  try {
    ;[firm] = await db
      .insert(schema.firms)
      .values({
        ownerClerkUserId: clerkUserId,
        name: 'My Practice',
      })
      .returning()
  } catch {
    firm = await db.query.firms.findFirst({
      where: eq(schema.firms.ownerClerkUserId, clerkUserId),
    }) ?? null
  }

  if (!firm) {
    throw new Error('Failed to create or resolve default firm')
  }

  await db
    .insert(schema.firmMembers)
    .values({
      firmId: firm.id,
      clerkUserId,
      role: 'partner',
      acceptedAt: new Date().toISOString(),
    })
    .onConflictDoNothing({
      target: [schema.firmMembers.firmId, schema.firmMembers.clerkUserId],
    })

  return firm
}

export async function addCompanyToFirm(firmId: string, companyId: string) {
  await db
    .insert(schema.firmClients)
    .values({ firmId, companyId })
    .onConflictDoNothing({
      target: [schema.firmClients.firmId, schema.firmClients.companyId],
    })
}

export async function canAccessCompanyViaFirm(companyId: string, clerkUserId: string) {
  const member = await db.query.firmMembers.findFirst({
    where: and(
      eq(schema.firmMembers.clerkUserId, clerkUserId),
      isNotNull(schema.firmMembers.acceptedAt)
    ),
  })
  if (!member) return false

  const link = await db.query.firmClients.findFirst({
    where: and(
      eq(schema.firmClients.firmId, member.firmId),
      eq(schema.firmClients.companyId, companyId)
    ),
    columns: { id: true },
  })
  return Boolean(link?.id)
}

/**
 * Returns the app-level MemberRole for a firm member accessing a client company.
 * Firm role mapping:
 *   partner | admin → 'editor'  (can read/write client data)
 *   staff           → 'editor'  (same — firm staff need write access)
 *   readonly        → 'viewer'
 */
export async function getFirmMemberRole(
  companyId: string,
  clerkUserId: string
): Promise<import('@/lib/db/queries/company-members').MemberRole | null> {
  const member = await db.query.firmMembers.findFirst({
    where: and(
      eq(schema.firmMembers.clerkUserId, clerkUserId),
      isNotNull(schema.firmMembers.acceptedAt)
    ),
  })
  if (!member) return null

  const link = await db.query.firmClients.findFirst({
    where: and(
      eq(schema.firmClients.firmId, member.firmId),
      eq(schema.firmClients.companyId, companyId)
    ),
    columns: { id: true },
  })
  if (!link) return null

  // Map firm roles to app-level permissions
  const role = member.role as FirmMemberRole
  if (role === 'readonly') return 'viewer'
  return 'editor'
}

export async function getFirmClientCompanies(clerkUserId: string) {
  const member = await db.query.firmMembers.findFirst({
    where: and(
      eq(schema.firmMembers.clerkUserId, clerkUserId),
      isNotNull(schema.firmMembers.acceptedAt)
    ),
  })
  if (!member) return []

  const links = await db.query.firmClients.findMany({
    where: eq(schema.firmClients.firmId, member.firmId),
  })
  const ids = links.map((l) => l.companyId)
  if (ids.length === 0) return []

  return db.query.companies.findMany({
    where: inArray(schema.companies.id, ids),
  })
}
