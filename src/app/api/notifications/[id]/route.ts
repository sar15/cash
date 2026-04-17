import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError } from '@/lib/api/helpers'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/db/queries/notifications'

// POST /api/notifications/[id] — mark single notification as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<any> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id } = await params
    if (id === 'all') {
      await markAllNotificationsRead(ctx.companyId, ctx.userId)
    } else {
      await markNotificationRead(id, ctx.companyId, ctx.userId)
    }
    return jsonOk({ success: true })
  } catch {
    return jsonError('Failed to mark notification read', 500)
  }
}
