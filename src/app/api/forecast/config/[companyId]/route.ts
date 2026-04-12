import { type NextRequest } from 'next/server'

import {
  getComplianceConfig,
  getQuickMetricsConfig,
  getTimingProfiles,
  getValueRules,
} from '@/lib/db/queries/forecast-config'
import { handleRouteError, jsonResponse } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

interface RouteContext {
  params: Promise<{ companyId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireUserId()
    const { companyId } = await context.params
    const company = await requireOwnedCompany(userId, companyId)
    const scenarioId = request.nextUrl.searchParams.get('scenarioId')
    const [valueRules, timingProfiles, complianceConfig, quickMetricsConfig] =
      await Promise.all([
        getValueRules(company.id, scenarioId),
        getTimingProfiles(company.id),
        getComplianceConfig(company.id),
        getQuickMetricsConfig(company.id),
      ])

    return jsonResponse({
      companyId: company.id,
      valueRules,
      timingProfiles,
      complianceConfig,
      quickMetricsConfig,
    })
  } catch (error) {
    return handleRouteError('FORECAST_CONFIG_GET', error)
  }
}
