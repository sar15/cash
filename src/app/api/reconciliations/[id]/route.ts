import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { bankReconciliations, companies } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: reconId } = await context.params
  const body = await request.json()
  const { bankClosingBalancePaise, notes } = body as {
    bankClosingBalancePaise: number
    notes?: string
  }

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

  const company = await db.query.companies.findFirst({
    where: and(
      eq(companies.id, recon.companyId),
      eq(companies.clerkUserId, userId)
    ),
  })

  if (!company) {
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
      reconciledBy: userId,
      notes,
    })
    .where(eq(bankReconciliations.id, reconId))

  return NextResponse.json({ success: true, variancePaise, status })
}
