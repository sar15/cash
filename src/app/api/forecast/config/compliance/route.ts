import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { upsertComplianceConfig } from '@/lib/db/queries/forecast-config'
import { upsertComplianceConfigSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

const requestSchema = z.object({
  companyId: z.string().uuid(),
}).merge(upsertComplianceConfigSchema)

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, requestSchema)
    const company = await requireOwnedCompany(userId, body.companyId)
    const config = await upsertComplianceConfig(company.id, {
      gstType: body.gstType,
      supplyType: body.supplyType,
      gstRate: body.gstRate,
      itcPct: body.itcPct,
      gstFrequency: body.gstFrequency,
      tdsRegime: body.tdsRegime,
      tdsSections: JSON.stringify(body.tdsSections),
      taxRate: body.taxRate,
      pfApplicable: body.pfApplicable,
      esiApplicable: body.esiApplicable,
    })

    return jsonResponse({ companyId: company.id, config })
  } catch (error) {
    return handleRouteError('FORECAST_COMPLIANCE_PATCH', error)
  }
}
