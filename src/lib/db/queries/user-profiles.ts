import { eq } from 'drizzle-orm'

import { db, schema } from '@/lib/db'

export type UserType = 'business_owner' | 'ca_firm'

export async function getUserProfile(clerkUserId: string) {
  return db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.clerkUserId, clerkUserId),
  })
}

export async function getOrCreateUserProfile(clerkUserId: string) {
  const existing = await getUserProfile(clerkUserId)
  if (existing) return existing

  await db
    .insert(schema.userProfiles)
    .values({ clerkUserId, userType: 'business_owner', onboardingCompleted: false })
    .onConflictDoNothing({
      target: [schema.userProfiles.clerkUserId],
    })

  const created = await getUserProfile(clerkUserId)
  if (!created) {
    throw new Error('Failed to create user profile')
  }
  return created
}

export async function updateUserType(clerkUserId: string, userType: UserType) {
  await db
    .insert(schema.userProfiles)
    .values({
      clerkUserId,
      userType,
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [schema.userProfiles.clerkUserId],
      set: { userType, onboardingCompleted: true, updatedAt: new Date().toISOString() },
    })

  return getUserProfile(clerkUserId)
}
