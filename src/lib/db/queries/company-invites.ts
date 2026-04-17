import { createHash, randomBytes } from 'node:crypto'

import { and, eq, gt } from 'drizzle-orm'

import { db, schema } from '@/lib/db'
import type { MemberRole } from '@/lib/db/queries/company-members'

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function buildCompanyInviteUrl(token: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'
  return `${baseUrl.replace(/\/+$/, '')}/accept-invite?token=${encodeURIComponent(token)}`
}

export async function getPendingInvitesForCompany(companyId: string) {
  return db.query.companyInvites.findMany({
    where: and(
      eq(schema.companyInvites.companyId, companyId),
      eq(schema.companyInvites.status, 'pending')
    ),
    orderBy: (invites, { asc }) => [asc(invites.createdAt)],
  })
}

export async function createCompanyInvite(input: {
  companyId: string
  invitedEmail: string
  role: Exclude<MemberRole, 'owner'>
  invitedBy: string
}) {
  const token = randomBytes(24).toString('hex')
  const normalizedEmail = normalizeEmail(input.invitedEmail)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS).toISOString()

  const [invite] = await db
    .insert(schema.companyInvites)
    .values({
      companyId: input.companyId,
      invitedEmail: normalizedEmail,
      role: input.role,
      invitedBy: input.invitedBy,
      tokenHash: hashToken(token),
      status: 'pending',
      expiresAt,
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: [schema.companyInvites.companyId, schema.companyInvites.invitedEmail],
      set: {
        role: input.role,
        invitedBy: input.invitedBy,
        tokenHash: hashToken(token),
        status: 'pending',
        acceptedByClerkUserId: null,
        acceptedAt: null,
        expiresAt,
        updatedAt: now.toISOString(),
      },
    })
    .returning()

  return {
    invite,
    token,
    inviteUrl: buildCompanyInviteUrl(token),
  }
}

export async function revokeCompanyInvite(companyId: string, inviteId: string) {
  const [invite] = await db
    .update(schema.companyInvites)
    .set({
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(schema.companyInvites.id, inviteId),
        eq(schema.companyInvites.companyId, companyId)
      )
    )
    .returning()

  return invite ?? null
}

export async function getInviteForToken(token: string) {
  const invite = await db.query.companyInvites.findFirst({
    where: eq(schema.companyInvites.tokenHash, hashToken(token)),
  })

  if (!invite) return null

  if (invite.status !== 'pending') return null

  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    await db
      .update(schema.companyInvites)
      .set({
        status: 'expired',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.companyInvites.id, invite.id))
    return null
  }

  return invite
}

export async function acceptCompanyInvite(input: {
  token: string
  clerkUserId: string
  email: string
}) {
  const normalizedEmail = normalizeEmail(input.email)
  const invite = await db.query.companyInvites.findFirst({
    where: and(
      eq(schema.companyInvites.tokenHash, hashToken(input.token)),
      eq(schema.companyInvites.status, 'pending'),
      gt(schema.companyInvites.expiresAt, new Date().toISOString())
    ),
  })

  if (!invite) return null
  if (normalizeEmail(invite.invitedEmail) !== normalizedEmail) return null

  const now = new Date().toISOString()

  const [member] = await db
    .insert(schema.companyMembers)
    .values({
      companyId: invite.companyId,
      clerkUserId: input.clerkUserId,
      role: invite.role,
      invitedBy: invite.invitedBy,
      invitedEmail: invite.invitedEmail,
      acceptedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.companyMembers.companyId, schema.companyMembers.clerkUserId],
      set: {
        role: invite.role,
        invitedBy: invite.invitedBy,
        invitedEmail: invite.invitedEmail,
        acceptedAt: now,
      },
    })
    .returning()

  await db
    .update(schema.companyInvites)
    .set({
      status: 'accepted',
      acceptedByClerkUserId: input.clerkUserId,
      acceptedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.companyInvites.id, invite.id))

  return { invite, member }
}
