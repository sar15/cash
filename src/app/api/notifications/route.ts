import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError } from '@/lib/api/helpers'
import { getNotifications, getUnreadCount } from '@/lib/db/queries/notifications'

// GET /api/notifications?companyId= — list notifications + unread count
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(ctx.companyId, ctx.userId),
      getUnreadCount(ctx.companyId, ctx.userId),
    ])

    return jsonOk({ notifications, unreadCount })
  } catch {
    return jsonError('Failed to fetch notifications', 500)
  }
}
