import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'

import { acceptCompanyInvite, getInviteForToken } from '@/lib/db/queries/company-invites'
import { handleRouteError, jsonResponse, parseJsonBody, RouteError } from '@/lib/server/api'

import { z } from 'zod'

const acceptInviteSchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      throw new RouteError(401, 'Unauthorized')
    }

    const user = await currentUser()
    const email =
      user?.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress

    if (!email) {
      throw new RouteError(422, 'Your account does not have a verified email address.')
    }

    const { token } = await parseJsonBody(request, acceptInviteSchema)
    const invite = await getInviteForToken(token)

    if (!invite) {
      throw new RouteError(404, 'This invitation is invalid or has expired.')
    }

    const accepted = await acceptCompanyInvite({
      token,
      clerkUserId: userId,
      email,
    })

    if (!accepted) {
      throw new RouteError(403, 'This invitation does not match your signed-in email address.')
    }

    return jsonResponse({
      success: true,
      companyId: accepted.member.companyId,
    })
  } catch (error) {
    return handleRouteError('COMPANY_INVITES_ACCEPT_POST', error)
  }
}
