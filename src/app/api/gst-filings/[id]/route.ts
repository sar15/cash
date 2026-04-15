import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { gstFilings, companies } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { markFilingAsFiled } from '@/lib/db/queries/gst-filings'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: filingId } = await context.params
  const body = await request.json()
  const { referenceNumber } = body as { referenceNumber?: string }

  // Get filing and verify ownership
  const filing = await db.query.gstFilings.findFirst({
    where: eq(gstFilings.id, filingId),
  })

  if (!filing) {
    return NextResponse.json({ error: 'Filing not found' }, { status: 404 })
  }

  const company = await db.query.companies.findFirst({
    where: and(
      eq(companies.id, filing.companyId),
      eq(companies.clerkUserId, userId)
    ),
  })

  if (!company) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  await markFilingAsFiled(filingId, referenceNumber)

  return NextResponse.json({ success: true })
}
