import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { getForecastResult, saveForecastResult } from '@/lib/db/queries/forecast-results'
import { saveForecastResultSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireAccessibleCompany, requireUserId } from '@/lib/server/auth'

const requestSchema = saveForecastResultSchema.extend({
  version: z.number().int().positive().default(1),
})

export async function GET(request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { companyId } = await context.params
    const company = await requireAccessibleCompany(userId, companyId)
    const result = await getForecastResult(
      company.id,
      request.nextUrl.searchParams.get('scenarioId')
    )

    return jsonResponse({ companyId: company.id, result })
  } catch (error) {
    return handleRouteError('FORECAST_RESULT_GET', error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { companyId } = await context.params
    const company = await requireAccessibleCompany(userId, companyId)
    const body = await parseJsonBody(request, requestSchema)
    const result = await saveForecastResult(company.id, {
      scenarioId: body.scenarioId,
      plData: JSON.stringify(body.plData),
      bsData: JSON.stringify(body.bsData),
      cfData: JSON.stringify(body.cfData),
      compliance: JSON.stringify(body.compliance),
      metrics: JSON.stringify(body.metrics),
      version: body.version,
    })

    return jsonResponse({ companyId: company.id, result }, { status: 201 })
  } catch (error) {
    return handleRouteError('FORECAST_RESULT_POST', error)
  }
}
