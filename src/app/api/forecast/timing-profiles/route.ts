import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError, jsonValidationError } from '@/lib/api/helpers'
import { upsertTimingProfileSchema } from '@/lib/db/validation'
import * as configQueries from '@/lib/db/queries/forecast-config'

// GET /api/forecast/timing-profiles — Get timing profiles for company
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const profiles = await configQueries.getTimingProfiles(ctx.companyId)
    return jsonOk({ profiles })
  } catch {
    return jsonError('Failed to fetch timing profiles', 500)
  }
}

// POST /api/forecast/timing-profiles — Create a timing profile
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const body = await request.json()
    const parsed = upsertTimingProfileSchema.safeParse(body)
    if (!parsed.success) return jsonValidationError(parsed.error.issues)

    const profile = await configQueries.upsertTimingProfile(ctx.companyId, {
      ...parsed.data,
      config: JSON.stringify(parsed.data.config),
    })
    return jsonOk({ profile }, 201)
  } catch {
    return jsonError('Failed to create timing profile', 500)
  }
}
