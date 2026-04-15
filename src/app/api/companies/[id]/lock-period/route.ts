import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: companyId } = await context.params
  const body = await request.json()
  const { period, action } = body as { period: string; action: 'lock' | 'unlock' }

  if (!period || !action) {
    return NextResponse.json(
      { error: 'Missing period or action' },
      { status: 400 }
    )
  }

  // Verify ownership
  const company = await db.query.companies.findFirst({
    where: and(eq(companies.id, companyId), eq(companies.clerkUserId, userId)),
  })

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // Parse current locked periods
  let lockedPeriods: string[] = []
  try {
    lockedPeriods = JSON.parse(company.lockedPeriods || '[]')
  } catch {
    lockedPeriods = []
  }

  // Update locked periods
  if (action === 'lock') {
    if (!lockedPeriods.includes(period)) {
      lockedPeriods.push(period)
      lockedPeriods.sort() // Keep sorted
    }
  } else if (action === 'unlock') {
    lockedPeriods = lockedPeriods.filter((p) => p !== period)
  }

  // Save to database
  await db
    .update(companies)
    .set({
      lockedPeriods: JSON.stringify(lockedPeriods),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(companies.id, companyId))

  return NextResponse.json({
    success: true,
    lockedPeriods,
  })
}
