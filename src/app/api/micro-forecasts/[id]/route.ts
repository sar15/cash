import { eq } from 'drizzle-orm'
import { type NextRequest } from 'next/server'

import { db, schema } from '@/lib/db'
import {
  deleteMicroForecast,
  getMicroForecastById,
  updateMicroForecast,
} from '@/lib/db/queries/micro-forecasts'
import { updateMicroForecastSchema } from '@/lib/db/validation'
import {
  handleRouteError,
  jsonResponse,
  noContent,
  parseJsonBody,
  RouteError,
} from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

async function getOwnedForecastRecord(userId: string, forecastId: string) {
  const forecast = await db.query.microForecasts.findFirst({
    columns: { id: true, companyId: true },
    where: eq(schema.microForecasts.id, forecastId),
  })

  if (!forecast) {
    return null
  }

  const company = await requireOwnedCompany(userId, forecast.companyId)
  const fullForecast = await getMicroForecastById(forecastId, company.id)

  return { company, forecast: fullForecast }
}

export async function GET(_request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const result = await getOwnedForecastRecord(userId, id)

    if (!result?.forecast) {
      throw new RouteError(404, 'Micro-forecast not found.')
    }

    return jsonResponse({
      companyId: result.company.id,
      forecast: result.forecast,
    })
  } catch (error) {
    return handleRouteError('MICRO_FORECASTS_ITEM_GET', error)
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const result = await getOwnedForecastRecord(userId, id)

    if (!result?.forecast) {
      throw new RouteError(404, 'Micro-forecast not found.')
    }

    const body = await parseJsonBody(request, updateMicroForecastSchema)
    const lines = body.lines?.map((line) => ({
      accountId: line.accountId,
      futureAccountName: line.futureAccountName,
      futureAccountType: line.futureAccountType,
      ruleType: line.ruleType,
      config: typeof line.config === 'string' ? line.config : JSON.stringify(line.config),
      timingProfileId: line.timingProfileId,
    }))
    const updated = await updateMicroForecast(
      id,
      result.company.id,
      {
        name: body.name,
        category: body.category,
        isActive: body.isActive,
        startMonth: body.startMonth,
        endMonth: body.endMonth,
        wizardConfig:
          typeof body.wizardConfig === 'string'
            ? body.wizardConfig
            : body.wizardConfig
              ? JSON.stringify(body.wizardConfig)
              : undefined,
        sortOrder: body.sortOrder,
      },
      lines
    )

    if (!updated) {
      throw new RouteError(404, 'Micro-forecast not found.')
    }

    return jsonResponse({
      companyId: result.company.id,
      forecast: updated,
    })
  } catch (error) {
    return handleRouteError('MICRO_FORECASTS_PATCH', error)
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const result = await getOwnedForecastRecord(userId, id)

    if (!result?.forecast) {
      throw new RouteError(404, 'Micro-forecast not found.')
    }

    await deleteMicroForecast(id, result.company.id)
    return noContent()
  } catch (error) {
    return handleRouteError('MICRO_FORECASTS_DELETE', error)
  }
}
