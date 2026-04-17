import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

/**
 * PATCH /api/companies/[id]/lock-period
 *
 * Migrated from lockedPeriods (JSON array) to booksClosedDate (single date).
 *
 * lock:   sets booksClosedDate to the given period.
 *         Everything on/before this date is treated as locked actuals.
 * unlock: clears booksClosedDate (nothing is locked).
 */
const lockPeriodSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}-01$/, 'Period must be YYYY-MM-01'),
  action: z.enum(['lock', 'unlock']),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: companyId } = await context.params

  const parsed = lockPeriodSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { period, action } = parsed.data

  // Verify ownership
  const company = await db.query.companies.findFirst({
    where: and(eq(companies.id, companyId), eq(companies.clerkUserId, userId)),
  })
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const newBooksClosedDate = action === 'lock' ? period : null

  await db
    .update(companies)
    .set({
      booksClosedDate: newBooksClosedDate,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(companies.id, companyId), eq(companies.clerkUserId, userId)))

  return NextResponse.json({
    success: true,
    booksClosedDate: newBooksClosedDate,
  })
}
