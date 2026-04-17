import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError } from '@/lib/api/helpers'
import * as accountQueries from '@/lib/db/queries/accounts'
import * as historicalQueries from '@/lib/db/queries/historical'
import * as configQueries from '@/lib/db/queries/forecast-config'

// GET /api/forecast/config — fetch forecast configuration for a company
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const [accounts, actuals, valueRules, timingProfiles, complianceConfig] = await Promise.all([
      accountQueries.getAccountsForCompany(ctx.companyId),
      historicalQueries.getActualsForCompany(ctx.companyId),
      configQueries.getValueRules(ctx.companyId),
      configQueries.getTimingProfiles(ctx.companyId),
      configQueries.getComplianceConfig(ctx.companyId),
    ])

    return jsonOk({
      accounts,
      actuals,
      valueRules,
      timingProfiles,
      complianceConfig: complianceConfig ?? null,
    })
  } catch {
    return jsonError('Failed to fetch forecast config', 500)
  }
}
