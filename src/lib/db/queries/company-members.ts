import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export type MemberRole = 'owner' | 'editor' | 'viewer'

export async function getMembersForCompany(companyId: string) {
  return db.query.companyMembers.findMany({
    where: eq(schema.companyMembers.companyId, companyId),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  })
}

export async function getMemberRole(
  companyId: string,
  clerkUserId: string
): Promise<MemberRole | null> {
  const member = await db.query.companyMembers.findFirst({
    where: and(
      eq(schema.companyMembers.companyId, companyId),
      eq(schema.companyMembers.clerkUserId, clerkUserId)
    ),
  })
  return (member?.role as MemberRole) ?? null
}

export async function addMember(
  companyId: string,
  clerkUserId: string,
  role: MemberRole,
  invitedBy: string,
  invitedEmail?: string
) {
  const [member] = await db
    .insert(schema.companyMembers)
    .values({ companyId, clerkUserId, role, invitedBy, invitedEmail, acceptedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: [schema.companyMembers.companyId, schema.companyMembers.clerkUserId],
      set: { role },
    })
    .returning()
  return member
}

export async function removeMember(companyId: string, clerkUserId: string) {
  await db
    .delete(schema.companyMembers)
    .where(and(
      eq(schema.companyMembers.companyId, companyId),
      eq(schema.companyMembers.clerkUserId, clerkUserId)
    ))
}

export async function acceptMemberInvite(companyId: string, clerkUserId: string) {
  await db
    .update(schema.companyMembers)
    .set({ acceptedAt: new Date().toISOString() })
    .where(and(
      eq(schema.companyMembers.companyId, companyId),
      eq(schema.companyMembers.clerkUserId, clerkUserId)
    ))
}

// Check if user has access to company (owner OR member)
export async function canAccessCompany(
  companyId: string,
  clerkUserId: string
): Promise<boolean> {
  // Check direct ownership
  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, companyId),
    columns: { clerkUserId: true },
  })
  if (company?.clerkUserId === clerkUserId) return true

  // Check membership
  const member = await db.query.companyMembers.findFirst({
    where: and(
      eq(schema.companyMembers.companyId, companyId),
      eq(schema.companyMembers.clerkUserId, clerkUserId)
    ),
    columns: { id: true, acceptedAt: true },
  })
  return !!member?.acceptedAt
}
