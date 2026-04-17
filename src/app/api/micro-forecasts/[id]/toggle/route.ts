import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { updateMicroForecast } from '@/lib/db/queries/micro-forecasts'
import { handleRouteError, jsonResponse, parseJsonBody, RouteError } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'

const toggleSchema = z.object({
  isActive: z.boolean(),
})

export async function PATCH(request: NextRequest, context: { params: Promise<any> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const forecast = await db.query.microForecasts.findFirst({
      columns: { id: true, companyId: true },
      where: eq(schema.microForecasts.id, id),
    })

    if (!forecast) {
      throw new RouteError(404, 'Micro-forecast not found.')
    }

    const company = await requireOwnedCompany(userId, forecast.companyId)
    const body = await parseJsonBody(request, toggleSchema)
    const updated = await updateMicroForecast(id, company.id, { isActive: body.isActive })

    return jsonResponse({
      companyId: company.id,
      forecast: updated,
    })
  } catch (error) {
    return handleRouteError('MICRO_FORECASTS_TOGGLE', error)
  }
}
