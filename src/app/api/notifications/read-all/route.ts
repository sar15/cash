import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError } from '@/lib/api/helpers'
import { markAllNotificationsRead } from '@/lib/db/queries/notifications'

// POST /api/notifications/read-all — mark all as read
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    await markAllNotificationsRead(ctx.companyId)
    return jsonOk({ success: true })
  } catch {
    return jsonError('Failed to mark all notifications read', 500)
  }
}
