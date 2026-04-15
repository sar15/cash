import { type NextRequest } from 'next/server'
import { getMembersForCompany, addMember, removeMember } from '@/lib/db/queries/company-members'
import { handleRouteError, jsonResponse, noContent } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    await requireOwnedCompany(userId, id)
    const members = await getMembersForCompany(id)
    return jsonResponse({ members })
  } catch (error) {
    return handleRouteError('MEMBERS_GET', error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    await requireOwnedCompany(userId, id)
    const body = await request.json() as { clerkUserId: string; role?: 'editor' | 'viewer'; invitedEmail?: string }
    if (!body.clerkUserId) {
      return jsonResponse({ error: 'clerkUserId required' }, { status: 400 })
    }
    const member = await addMember(id, body.clerkUserId, body.role ?? 'viewer', userId, body.invitedEmail)
    return jsonResponse({ member }, { status: 201 })
  } catch (error) {
    return handleRouteError('MEMBERS_POST', error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    await requireOwnedCompany(userId, id)
    const clerkUserId = request.nextUrl.searchParams.get('clerkUserId')
    if (!clerkUserId) {
      return jsonResponse({ error: 'clerkUserId query param required' }, { status: 400 })
    }
    await removeMember(id, clerkUserId)
    return noContent()
  } catch (error) {
    return handleRouteError('MEMBERS_DELETE', error)
  }
}
