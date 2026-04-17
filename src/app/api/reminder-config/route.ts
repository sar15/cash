import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  resolveAuthedCompany,
  isErrorResponse,
  jsonOk,
  jsonError,
  requireCompanyCapability,
} from '@/lib/api/helpers'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'

const upsertSchema = z.object({
  enabled: z.boolean(),
  alertEmail: z.string().email().nullable().optional(),
  reminderDays: z.number().int().min(1).max(30).default(3),
})

// GET /api/reminder-config?companyId= — get reminder config
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const config = await db.query.reminderConfig.findFirst({
      where: eq(schema.reminderConfig.companyId, ctx.companyId),
    })
    return jsonOk({ config: config ?? { enabled: false, alertEmail: null, reminderDays: 3 } })
  } catch {
    return jsonError('Failed to fetch reminder config', 500)
  }
}

// POST /api/reminder-config — upsert reminder config
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx
    const capabilityError = requireCompanyCapability(ctx, 'settings.manage')
    if (capabilityError) return capabilityError

    const body = await request.json() as unknown
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) return jsonError('Invalid reminder config', 422)

    const [config] = await db
      .insert(schema.reminderConfig)
      .values({
        companyId: ctx.companyId,
        enabled: parsed.data.enabled,
        alertEmail: parsed.data.alertEmail ?? null,
        reminderDays: parsed.data.reminderDays,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [schema.reminderConfig.companyId],
        set: {
          enabled: parsed.data.enabled,
          alertEmail: parsed.data.alertEmail ?? null,
          reminderDays: parsed.data.reminderDays,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning()

    return jsonOk({ config })
  } catch {
    return jsonError('Failed to save reminder config', 500)
  }
}
