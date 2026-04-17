import { type NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import {
  resolveAuthedCompany,
  isErrorResponse,
  jsonOk,
  jsonError,
  requireCompanyCapability,
} from '@/lib/api/helpers'
import { db, schema } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<any> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx
    const capabilityError = requireCompanyCapability(ctx, 'compliance.manage')
    if (capabilityError) return capabilityError
    const { id } = await params
    await db.delete(schema.compliancePayments).where(
      and(
        eq(schema.compliancePayments.companyId, ctx.companyId),
        eq(schema.compliancePayments.obligationId, id)
      )
    )
    return jsonOk({ success: true })
  } catch {
    return jsonError('Failed to unmark payment', 500)
  }
}
