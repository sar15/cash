import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bankReconciliations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isErrorResponse, resolveAuthedCompany } from '@/lib/api/helpers'
import { parseJsonBody } from '@/lib/server/api'
import { z } from 'zod'
import { handleRouteError } from '@/lib/server/api'

const patchReconciliationSchema = z.object({
  bankClosingBalancePaise: z.number().int(),
  notes: z.string().max(1000).optional(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<any> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id: reconId } = await context.params
    const { bankClosingBalancePaise, notes } = await parseJsonBody(
      request,
      patchReconciliationSchema
    )

    // Get reconciliation and verify ownership
    const recon = await db.query.bankReconciliations.findFirst({
      where: eq(bankReconciliations.id, reconId),
    })

    if (!recon) {
      return NextResponse.json(
        { error: 'Reconciliation not found' },
        { status: 404 }
      )
    }

    if (recon.companyId !== ctx.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Calculate variance
    const variancePaise = bankClosingBalancePaise - (recon.bookClosingBalancePaise ?? 0)
    const status = Math.abs(variancePaise) <= 100 ? 'reconciled' : 'variance' // ±₹1 tolerance

    await db
      .update(bankReconciliations)
      .set({
        bankClosingBalancePaise,
        variancePaise,
        status,
        reconciledAt: new Date().toISOString(),
        reconciledBy: ctx.userId,
        notes,
      })
      .where(eq(bankReconciliations.id, reconId))

    return NextResponse.json({ success: true, variancePaise, status })
  } catch (error) {
    return handleRouteError('RECONCILIATIONS_ID_PATCH', error)
  }
}
