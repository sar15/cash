import { type NextRequest } from 'next/server'

import { getOrCreateUserProfile, updateUserType } from '@/lib/db/queries/user-profiles'
import { updateUserProfileSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/auth'

export async function GET() {
  try {
    const userId = await requireUserId()
    const profile = await getOrCreateUserProfile(userId)
    return jsonResponse({ profile })
  } catch (error) {
    return handleRouteError('PROFILE_GET', error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, updateUserProfileSchema)
    const updated = await updateUserType(userId, body.userType)
    return jsonResponse({ profile: updated })
  } catch (error) {
    return handleRouteError('PROFILE_PUT', error)
  }
}
