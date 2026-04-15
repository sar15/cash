import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { companies, bankReconciliations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// Auth pattern: uses auth() + inline ownership check (equivalent to resolveAuthedCompany).
// Kept as-is because companyId comes from query/body, not a path param, and the
// ownership check (companies.clerkUserId === userId) provides the same isolation guarantee.

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

  const reconciliations = await db.query.bankReconciliations.findMany({
    where: eq(bankReconciliations.companyId, companyId),
    orderBy: (recons, { desc }) => [desc(recons.period)],
  })

  return NextResponse.json({ reconciliations })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { companyId, period, bookClosingBalancePaise } = body as {
    companyId: string
    period: string
    bookClosingBalancePaise: number
  }

  // Verify ownership
  const company = await db.query.companies.findFirst({
    where: and(eq(companies.id, companyId), eq(companies.clerkUserId, userId)),
  })

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // Create reconciliation record
  await db.insert(bankReconciliations).values({
    id: crypto.randomUUID(),
    companyId,
    period,
    status: 'unreconciled',
    bookClosingBalancePaise,
    bankClosingBalancePaise: null,
    variancePaise: null,
  })

  return NextResponse.json({ success: true })
}
