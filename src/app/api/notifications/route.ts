import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError } from '@/lib/api/helpers'
import { getNotifications, getUnreadCount } from '@/lib/db/queries/notifications'

// GET /api/notifications?companyId= — list notifications + unread count
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    // Race DB queries against a 8-second timeout to prevent hanging requests
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB_TIMEOUT')), 8000)
    )

    const [notifications, unreadCount] = await Promise.race([
      Promise.all([
        getNotifications(ctx.companyId, ctx.userId),
        getUnreadCount(ctx.companyId, ctx.userId),
      ]),
      timeoutPromise,
    ])

    return jsonOk({ notifications, unreadCount })
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === 'DB_TIMEOUT'
    if (isTimeout) {
      return jsonError('Notifications temporarily unavailable — please retry', 503)
    }
    return jsonError('Failed to fetch notifications', 500)
  }
}
