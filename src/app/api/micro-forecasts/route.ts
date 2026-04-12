import { type NextRequest } from 'next/server'

import { createMicroForecast, getMicroForecasts } from '@/lib/db/queries/micro-forecasts'
import { createMicroForecastSchema } from '@/lib/db/validation'
import { jsonResponse, handleRouteError, parseJsonBody } from '@/lib/server/api'
import { requireCompanyForUser, requireUserId } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const company = await requireCompanyForUser(
      userId,
      request.nextUrl.searchParams.get('companyId')
    )
    const forecasts = await getMicroForecasts(company.id)

    return jsonResponse({
      companyId: company.id,
      forecasts,
    })
  } catch (error) {
    return handleRouteError('MICRO_FORECASTS_GET', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, createMicroForecastSchema)
    const company = await requireCompanyForUser(userId, body.companyId)
    const lines = body.lines?.map((line) => ({
      accountId: line.accountId,
      futureAccountName: line.futureAccountName,
      futureAccountType: line.futureAccountType,
      ruleType: line.ruleType,
      config: typeof line.config === 'string' ? line.config : JSON.stringify(line.config),
      timingProfileId: line.timingProfileId,
    }))
    const forecast = await createMicroForecast(
      company.id,
      {
        name: body.name,
        category: body.category,
        isActive: body.isActive,
        startMonth: body.startMonth,
        endMonth: body.endMonth ?? null,
        wizardConfig:
          typeof body.wizardConfig === 'string'
            ? body.wizardConfig
            : JSON.stringify(body.wizardConfig),
        sortOrder: body.sortOrder,
      },
      lines
    )

    return jsonResponse(
      {
        companyId: company.id,
        forecast,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleRouteError('MICRO_FORECASTS_POST', error)
  }
}
