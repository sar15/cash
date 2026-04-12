import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { getActualsByPeriod, getActualsForCompany, upsertActuals } from '@/lib/db/queries/historical'
import { upsertActualSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

interface RouteContext {
  params: Promise<{ companyId: string }>
}

const upsertHistoricalSchema = z.object({
  actuals: z.array(upsertActualSchema).min(1).max(5000),
})

function groupActualsByPeriod(
  actuals: Awaited<ReturnType<typeof getActualsForCompany>>
) {
  return Object.values(
    actuals.reduce<Record<string, { period: string; actuals: typeof actuals }>>((acc, item) => {
      if (!acc[item.period]) {
        acc[item.period] = {
          period: item.period,
          actuals: [],
        }
      }

      acc[item.period].actuals.push(item)
      return acc
    }, {})
  )
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireUserId()
    const { companyId } = await context.params
    const company = await requireOwnedCompany(userId, companyId)
    const period = request.nextUrl.searchParams.get('period')
    const actuals = period
      ? await getActualsByPeriod(company.id, period)
      : await getActualsForCompany(company.id)

    return jsonResponse({
      companyId: company.id,
      actuals,
      periods: groupActualsByPeriod(actuals),
    })
  } catch (error) {
    return handleRouteError('HISTORICAL_GET', error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireUserId()
    const { companyId } = await context.params
    const company = await requireOwnedCompany(userId, companyId)
    const body = await parseJsonBody(request, upsertHistoricalSchema)
    const actuals = await upsertActuals(company.id, body.actuals)

    return jsonResponse({
      companyId: company.id,
      count: actuals.length,
      actuals,
    })
  } catch (error) {
    return handleRouteError('HISTORICAL_PATCH', error)
  }
}
