import { type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import {
  resolveAuthedCompany,
  isErrorResponse,
  jsonOk,
  jsonError,
  requireCompanyCapability,
} from '@/lib/api/helpers'
import { db, schema } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx
    const payments = await db.query.compliancePayments.findMany({
      where: eq(schema.compliancePayments.companyId, ctx.companyId),
    })
    return jsonOk({ paidIds: payments.map(p => p.obligationId) })
  } catch {
    return jsonError('Failed to fetch compliance payments', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx
    const capabilityError = requireCompanyCapability(ctx, 'compliance.manage')
    if (capabilityError) return capabilityError
    const { userId } = await auth()
    if (!userId) return jsonError('Unauthorized', 401)
    const body = await request.json() as { obligationId: string }
    if (!body.obligationId) return jsonError('obligationId required', 400)
    const [payment] = await db
      .insert(schema.compliancePayments)
      .values({ companyId: ctx.companyId, clerkUserId: userId, obligationId: body.obligationId })
      .onConflictDoUpdate({
        target: [schema.compliancePayments.companyId, schema.compliancePayments.obligationId],
        set: { clerkUserId: userId, paidAt: new Date().toISOString() },
      })
      .returning()
    return jsonOk({ payment })
  } catch {
    return jsonError('Failed to mark payment', 500)
  }
}
