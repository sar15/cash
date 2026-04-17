import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { upsertTimingProfile } from '@/lib/db/queries/forecast-config'
import { upsertTimingProfileSchema } from '@/lib/db/validation'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'
import { writeAuditLog } from '@/lib/db/queries/audit-log'
import { inngest } from '@/lib/inngest/client'
import { markForecastStale } from '@/lib/db/queries/forecast-results'

const requestSchema = z.object({
  companyId: z.string().uuid(),
}).merge(upsertTimingProfileSchema)

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, requestSchema)
    const company = await requireOwnedCompany(userId, body.companyId)
    const profile = await upsertTimingProfile(company.id, {
      name: body.name,
      profileType: body.profileType,
      config: JSON.stringify(body.config),
      autoDerived: body.autoDerived,
      isDefault: body.isDefault,
    })

    // Mark forecast stale immediately so UI can show recalculating state
    markForecastStale(company.id).catch(() => {})

    // Audit log (non-blocking)
    writeAuditLog({
      companyId: company.id,
      clerkUserId: userId,
      action: 'timing_profile.updated',
      entityType: 'timing_profile',
      entityId: body.name,
      newValue: { profileType: body.profileType, config: body.config },
    }).catch(() => {})

    // Trigger background recompute
    inngest.send({
      name: 'forecast/config.updated',
      data: { companyId: company.id, changeType: 'timing_profile' },
    }).catch(() => {})

    return jsonResponse({ companyId: company.id, profile })
  } catch (error) {
    return handleRouteError('FORECAST_TIMING_PROFILE_PATCH', error)
  }
}
