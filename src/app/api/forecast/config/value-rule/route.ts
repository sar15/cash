import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { upsertValueRule, getValueRules } from '@/lib/db/queries/forecast-config'
import { upsertValueRuleSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'
import { inngest } from '@/lib/inngest/client'
import { writeAuditLog } from '@/lib/db/queries/audit-log'
import { createNotification } from '@/lib/db/queries/notifications'

const requestSchema = z.object({
  companyId: z.string().uuid(),
}).merge(upsertValueRuleSchema)

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, requestSchema)
    const company = await requireOwnedCompany(userId, body.companyId)

    // Get old rule for audit trail
    const existingRules = await getValueRules(company.id)
    const oldRule = existingRules.find(r => r.accountId === body.accountId)

    const rule = await upsertValueRule(company.id, {
      accountId: body.accountId,
      scenarioId: body.scenarioId,
      ruleType: body.ruleType,
      config: JSON.stringify(body.config),
      sortOrder: body.sortOrder,
    })

    // Write audit log (non-blocking)
    writeAuditLog({
      companyId: company.id,
      clerkUserId: userId,
      action: 'value_rule.updated',
      entityType: 'value_rule',
      entityId: body.accountId,
      oldValue: oldRule ? { ruleType: oldRule.ruleType, config: oldRule.config } : null,
      newValue: { ruleType: body.ruleType, config: body.config },
    }).catch(() => {})

    // Create notification
    createNotification({
      companyId: company.id,
      clerkUserId: userId,
      type: 'rule_changed',
      title: 'Forecast rule updated',
      body: `Forecast method changed to ${body.ruleType.replace('_', ' ')}`,
      actionUrl: '/forecast',
    }).catch(() => {})

    // Trigger background forecast recomputation (debounced 5s in Inngest)
    await inngest.send({
      name: 'forecast/config.updated',
      data: { companyId: company.id, changeType: 'value_rule' },
    }).catch(() => { /* non-critical */ })

    return jsonResponse({ companyId: company.id, rule })
  } catch (error) {
    return handleRouteError('FORECAST_VALUE_RULE_PATCH', error)
  }
}
