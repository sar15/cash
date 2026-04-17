import { type NextRequest } from 'next/server'

import { getOrCreatePrimaryCompanyForUser } from '@/lib/db/company-context'
import { createCompany, getAccessibleCompaniesForUser } from '@/lib/db/queries/companies'
import { createCompanySchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/auth'
import { getOrCreateUserProfile } from '@/lib/db/queries/user-profiles'
import { addCompanyToFirm, getOrCreateDefaultFirm } from '@/lib/db/queries/firms'

export async function GET() {
  try {
    const userId = await requireUserId()
    const existing = await getAccessibleCompaniesForUser(userId)
    const companies = existing.length > 0 ? existing : [await getOrCreatePrimaryCompanyForUser(userId)]

    return jsonResponse({ companies })
  } catch (error) {
    return handleRouteError('COMPANIES_GET', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const profile = await getOrCreateUserProfile(userId)
    const body = await parseJsonBody(request, createCompanySchema)
    const company = await createCompany(userId, body)

    if (profile.userType === 'ca_firm') {
      const firm = await getOrCreateDefaultFirm(userId)
      await addCompanyToFirm(firm.id, company.id)
    }

    return jsonResponse({ company }, { status: 201 })
  } catch (error) {
    return handleRouteError('COMPANIES_POST', error)
  }
}
