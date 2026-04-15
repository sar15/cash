import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getGSTFilings } from '@/lib/db/queries/gst-filings'

// Auth pattern: uses auth() + inline ownership check (equivalent to resolveAuthedCompany).
// Ownership verified via companies.clerkUserId === userId before any data access.

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = request.nextUrl.searchParams.get('companyId')
  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 })
  }

  // Verify ownership
  const company = await db.query.companies.findFirst({
    where: and(eq(companies.id, companyId), eq(companies.clerkUserId, userId)),
  })

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const filings = await getGSTFilings(companyId)

  return NextResponse.json({ filings })
}
