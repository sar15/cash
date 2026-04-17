import { type NextRequest } from 'next/server'

import { deleteCompany, updateCompany } from '@/lib/db/queries/companies'
import { updateCompanySchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, noContent, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireAccessibleCompany, requireUserId } from '@/lib/server/auth'

export async function GET(_request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const company = await requireAccessibleCompany(userId, id)

    return jsonResponse({ company })
  } catch (error) {
    return handleRouteError('COMPANY_GET', error)
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    await requireOwnedCompany(userId, id)
    const body = await parseJsonBody(request, updateCompanySchema)
    const company = await updateCompany(id, body)

    return jsonResponse({ company })
  } catch (error) {
    return handleRouteError('COMPANY_PATCH', error)
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    await requireOwnedCompany(userId, id)
    await deleteCompany(id)

    return noContent()
  } catch (error) {
    return handleRouteError('COMPANY_DELETE', error)
  }
}
