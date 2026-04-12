import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { upsertQuickMetricsConfig } from '@/lib/db/queries/forecast-config'
import { upsertQuickMetricsConfigSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

const requestSchema = z.object({
  companyId: z.string().uuid(),
}).merge(upsertQuickMetricsConfigSchema)

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, requestSchema)
    const company = await requireOwnedCompany(userId, body.companyId)
    const config = await upsertQuickMetricsConfig(company.id, {
      metric1: body.metric1,
      metric2: body.metric2,
      metric3: body.metric3,
      metric4: body.metric4,
      metric5: body.metric5,
      threshold: JSON.stringify(body.threshold),
    })

    return jsonResponse({ companyId: company.id, config })
  } catch (error) {
    return handleRouteError('FORECAST_METRICS_PATCH', error)
  }
}
