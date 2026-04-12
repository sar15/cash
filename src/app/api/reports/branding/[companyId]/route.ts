import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { updateCompany } from '@/lib/db/queries/companies'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

interface RouteContext {
  params: Promise<{ companyId: string }>
}

const updateBrandingSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logoUrl: z.string().url().nullable().optional(),
  numberFormat: z.enum(['lakhs', 'crores', 'millions']).optional(),
})

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireUserId()
    const { companyId } = await context.params
    const company = await requireOwnedCompany(userId, companyId)

    return jsonResponse({
      companyId: company.id,
      branding: {
        name: company.name,
        logoUrl: company.logoUrl,
        numberFormat: company.numberFormat,
      },
    })
  } catch (error) {
    return handleRouteError('REPORTS_BRANDING_GET', error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireUserId()
    const { companyId } = await context.params
    const company = await requireOwnedCompany(userId, companyId)
    const body = await parseJsonBody(request, updateBrandingSchema)
    const updatedCompany = await updateCompany(company.id, body)

    return jsonResponse({
      companyId: company.id,
      branding: {
        name: updatedCompany?.name,
        logoUrl: updatedCompany?.logoUrl,
        numberFormat: updatedCompany?.numberFormat,
      },
    })
  } catch (error) {
    return handleRouteError('REPORTS_BRANDING_PATCH', error)
  }
}
