import { type NextRequest } from 'next/server'
import { getMembersForCompany, removeMember } from '@/lib/db/queries/company-members'
import {
  createCompanyInvite,
  getPendingInvitesForCompany,
  revokeCompanyInvite,
} from '@/lib/db/queries/company-invites'
import { handleRouteError, jsonResponse, noContent, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'
import { sendCompanyInviteEmail } from '@/lib/email/send'
import { z } from 'zod'

const addMemberSchema = z.object({
  invitedEmail: z.string().email(),
  role: z.enum(['editor', 'viewer']).optional(),
})

export async function GET(_request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    await requireOwnedCompany(userId, id)
    const [members, invites] = await Promise.all([
      getMembersForCompany(id),
      getPendingInvitesForCompany(id),
    ])
    return jsonResponse({ members, invites })
  } catch (error) {
    return handleRouteError('MEMBERS_GET', error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const company = await requireOwnedCompany(userId, id)
    const body = await parseJsonBody(request, addMemberSchema)
    const result = await createCompanyInvite({
      companyId: id,
      invitedEmail: body.invitedEmail,
      role: body.role ?? 'viewer',
      invitedBy: userId,
    })

    sendCompanyInviteEmail({
      to: body.invitedEmail,
      companyName: company.name,
      inviteUrl: result.inviteUrl,
      role: body.role ?? 'viewer',
    }).catch((error) => {
      console.error('[MEMBERS_POST] Failed to send invite email', error)
    })

    return jsonResponse(
      {
        invite: result.invite,
        inviteUrl: result.inviteUrl,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleRouteError('MEMBERS_POST', error)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    await requireOwnedCompany(userId, id)
    const memberId = request.nextUrl.searchParams.get('memberId')
    const inviteId = request.nextUrl.searchParams.get('inviteId')
    if (!memberId && !inviteId) {
      return jsonResponse({ error: 'memberId or inviteId query param required' }, { status: 400 })
    }
    if (memberId) {
      const members = await getMembersForCompany(id)
      const member = members.find((entry) => entry.id === memberId)
      if (!member) {
        return jsonResponse({ error: 'Member not found' }, { status: 404 })
      }
      await removeMember(id, member.clerkUserId)
    }
    if (inviteId) {
      const invite = await revokeCompanyInvite(id, inviteId)
      if (!invite) {
        return jsonResponse({ error: 'Invite not found' }, { status: 404 })
      }
    }
    return noContent()
  } catch (error) {
    return handleRouteError('MEMBERS_DELETE', error)
  }
}
