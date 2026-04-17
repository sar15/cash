import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const lockPeriodSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}-01$/, 'Period must be YYYY-MM-01'),
  action: z.enum(['lock', 'unlock']),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<any> }
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

  // Optimistic concurrency control to avoid clobbering concurrent lock/unlock updates.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await db.query.companies.findFirst({
      where: and(eq(companies.id, companyId), eq(companies.clerkUserId, userId)),
      columns: { lockedPeriods: true },
    })
    if (!current) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    let lockedPeriods: string[] = []
    try {
      lockedPeriods = JSON.parse(current.lockedPeriods || '[]')
    } catch {
      lockedPeriods = []
    }

    if (action === 'lock') {
      if (!lockedPeriods.includes(period)) {
        lockedPeriods.push(period)
        lockedPeriods.sort()
      }
    } else {
      lockedPeriods = lockedPeriods.filter((p) => p !== period)
    }

    const originalLockedPeriods = current.lockedPeriods || '[]'
    const updatedLockedPeriods = JSON.stringify(lockedPeriods)
    const updated = await db
      .update(companies)
      .set({
        lockedPeriods: updatedLockedPeriods,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(companies.id, companyId),
          eq(companies.clerkUserId, userId),
          eq(companies.lockedPeriods, originalLockedPeriods)
        )
      )
      .returning({ id: companies.id })

    if (updated.length > 0) {
      return NextResponse.json({
        success: true,
        lockedPeriods,
      })
    }
  }

  return NextResponse.json(
    { error: 'Concurrent update detected. Please retry.' },
    { status: 409 }
  )
}
