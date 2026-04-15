import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError } from '@/lib/api/helpers'
import { markNotificationRead } from '@/lib/db/queries/notifications'

// POST /api/notifications/[id] — mark single notification as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id } = await params
    await markNotificationRead(id, ctx.companyId)
    return jsonOk({ success: true })
  } catch {
    return jsonError('Failed to mark notification read', 500)
  }
}
