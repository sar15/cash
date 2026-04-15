import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getFirmCompanies } from '@/lib/db/queries/firm'

// Owner-only exception: lists ALL companies for the authenticated user across the firm.
// No single companyId to resolve — auth() directly is correct here.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companies = await getFirmCompanies(userId)

  return NextResponse.json({ companies })
}
