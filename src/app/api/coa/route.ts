import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { createAccountSchema, updateAccountSchema } from '@/lib/db/validation'
import * as accountQueries from '@/lib/db/queries/accounts'
import { FALLBACK_BY_ACCOUNT_TYPE } from '@/lib/standards/standard-mappings'

// GET /api/coa — List all accounts for company
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const tree = request.nextUrl.searchParams.get('tree') === 'true'

    if (tree) {
      const accounts = await accountQueries.getAccountTree(ctx.companyId)
      return jsonOk({ accounts })
    }

    const accounts = await accountQueries.getAccountsForCompany(ctx.companyId)
    return jsonOk({ accounts })
  } catch {
    return jsonError('Failed to fetch accounts', 500)
  }
}

// POST /api/coa — Create a new account
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json()
    const parsed = createAccountSchema.safeParse({ ...body, companyId: ctx.companyId })
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const data = {
      code: parsed.data.code,
      name: parsed.data.name,
      parentId: parsed.data.parentId,
      level: parsed.data.level,
      accountType: parsed.data.accountType,
      // Apply fallback mapping if not provided — ensures no account has null standardMapping
      standardMapping: parsed.data.standardMapping
        ?? FALLBACK_BY_ACCOUNT_TYPE[parsed.data.accountType],
      isGroup: parsed.data.isGroup,
      sortOrder: parsed.data.sortOrder,
    }
    const account = await accountQueries.upsertAccount(ctx.companyId, data)
    return jsonOk({ account }, 201)
  } catch {
    return jsonError('Failed to create account', 500)
  }
}

// PATCH /api/coa — Update an account
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json()
    const { id, ...rest } = body
    if (!id) return jsonError('Account ID is required', 400)

    const parsed = updateAccountSchema.safeParse(rest)
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const updated = await accountQueries.updateAccount(id, ctx.companyId, parsed.data)
    if (!updated) return jsonError('Account not found', 404)

    return jsonOk({ account: updated })
  } catch {
    return jsonError('Failed to update account', 500)
  }
}

// DELETE /api/coa — Delete an account
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return jsonError('Account ID is required', 400)

    await accountQueries.deleteAccount(id, ctx.companyId)
    return jsonOk({ success: true })
  } catch {
    return jsonError('Failed to delete account', 500)
  }
}
