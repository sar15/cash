import { type NextRequest } from 'next/server'

import { deleteAccount, updateAccount } from '@/lib/db/queries/accounts'
import { updateAccountSchema } from '@/lib/db/validation'
import {
  handleRouteError,
  jsonResponse,
  noContent,
  parseJsonBody,
  RouteError,
} from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

export async function PATCH(request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { companyId, accountId } = await context.params
    const company = await requireOwnedCompany(userId, companyId)
    const body = await parseJsonBody(request, updateAccountSchema)
    const account = await updateAccount(accountId, company.id, body)

    if (!account) {
      throw new RouteError(404, 'Account not found.')
    }

    return jsonResponse({ companyId: company.id, account })
  } catch (error) {
    return handleRouteError('COA_PATCH', error)
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { companyId, accountId } = await context.params
    const company = await requireOwnedCompany(userId, companyId)

    await deleteAccount(accountId, company.id)
    return noContent()
  } catch (error) {
    return handleRouteError('COA_DELETE', error)
  }
}
