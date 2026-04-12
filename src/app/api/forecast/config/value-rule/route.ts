import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { upsertValueRule } from '@/lib/db/queries/forecast-config'
import { upsertValueRuleSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

const requestSchema = z.object({
  companyId: z.string().uuid(),
}).merge(upsertValueRuleSchema)

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, requestSchema)
    const company = await requireOwnedCompany(userId, body.companyId)
    const rule = await upsertValueRule(company.id, {
      accountId: body.accountId,
      scenarioId: body.scenarioId,
      ruleType: body.ruleType,
      config: JSON.stringify(body.config),
      sortOrder: body.sortOrder,
    })

    return jsonResponse({ companyId: company.id, rule })
  } catch (error) {
    return handleRouteError('FORECAST_VALUE_RULE_PATCH', error)
  }
}
