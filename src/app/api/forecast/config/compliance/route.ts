import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { upsertComplianceConfig } from '@/lib/db/queries/forecast-config'
import { insertTaxRateEntry } from '@/lib/db/queries/tax-rate-history'
import { upsertComplianceConfigSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

const requestSchema = z.object({
  companyId: z.string().uuid(),
  // effectiveFrom: the period from which the new rates apply (defaults to current month).
  // This prevents Budget Day changes from retroactively corrupting historical forecasts.
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-01$/).optional(),
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

    // Write effective-dated rate history so future forecasts use the new rates
    // from effectiveFrom onwards, while historical periods keep their original rates.
    // This is the Budget Day protection — changing rates here never corrupts past forecasts.
    const effectiveFrom = body.effectiveFrom ?? new Date().toISOString().slice(0, 7) + '-01'
    const notes = `Updated via compliance config on ${new Date().toISOString().slice(0, 10)}`

    const rateUpdates: Array<{ type: 'gst' | 'corporate_tax' | 'itc_pct'; rate: number | undefined }> = [
      { type: 'gst', rate: body.gstRate },
      { type: 'corporate_tax', rate: body.taxRate },
      { type: 'itc_pct', rate: body.itcPct },
    ]

    // Fire-and-forget — non-blocking, audit trail only
    Promise.all(
      rateUpdates
        .filter((r): r is { type: 'gst' | 'corporate_tax' | 'itc_pct'; rate: number } => r.rate !== undefined)
        .map((r) => insertTaxRateEntry(company.id, r.type, r.rate, effectiveFrom, notes))
    ).catch(() => {})

    return jsonResponse({ companyId: company.id, config })
  } catch (error) {
    return handleRouteError('FORECAST_COMPLIANCE_PATCH', error)
  }
}
