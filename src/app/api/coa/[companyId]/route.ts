import { type NextRequest } from 'next/server'

import { getAccountTree, getAccountsForCompany, upsertAccount } from '@/lib/db/queries/accounts'
import { createAccountSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

const createAccountForCompanySchema = createAccountSchema.omit({ companyId: true })

export async function GET(_request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { companyId } = await context.params
    const company = await requireOwnedCompany(userId, companyId)
    const [accounts, tree] = await Promise.all([
      getAccountsForCompany(company.id),
      getAccountTree(company.id),
    ])

    return jsonResponse({
      companyId: company.id,
      accounts,
      tree,
    })
  } catch (error) {
    return handleRouteError('COA_GET', error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { companyId } = await context.params
    const company = await requireOwnedCompany(userId, companyId)
    const body = await parseJsonBody(request, createAccountForCompanySchema)
    const account = await upsertAccount(company.id, body)

    return jsonResponse({ companyId: company.id, account }, { status: 201 })
  } catch (error) {
    return handleRouteError('COA_POST', error)
  }
}
