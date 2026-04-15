import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError } from '@/lib/api/helpers'
import { getAuditLog } from '@/lib/db/queries/audit-log'

// GET /api/audit?companyId=&limit= — get audit log for company
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '50')
    const log = await getAuditLog(ctx.companyId, Math.min(limit, 200))
    return jsonOk({ log })
  } catch {
    return jsonError('Failed to fetch audit log', 500)
  }
}
