import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { getMappingsForCompany, upsertMappings } from '@/lib/db/queries/account-mappings'
import { handleRouteError, jsonResponse, parseJsonBody, RouteError } from '@/lib/server/api'
import { requireAccessibleCompany, requireOwnedCompany, requireUserId } from '@/lib/server/auth'
import { STANDARD_INDIAN_COA } from '@/lib/standards/indian-coa'

const VALID_COA_IDS = new Set(STANDARD_INDIAN_COA.map((a) => a.id))

const mappingEntrySchema = z.object({
  rawLedgerName: z.string().min(1).max(500),
  standardAccountId: z.string().nullable(),
  skipped: z.boolean().default(false),
})

const postMappingsSchema = z.object({
  companyId: z.string().uuid(),
  mappings: z.array(mappingEntrySchema).min(1).max(500),
})

// GET /api/import/mappings?companyId=<uuid>
// Returns all saved mappings for the company
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const companyId = request.nextUrl.searchParams.get('companyId')
    if (!companyId) throw new RouteError(400, 'companyId query parameter is required.')

    await requireAccessibleCompany(userId, companyId)

    const mappingsMap = await getMappingsForCompany(companyId)
    const mappings = Array.from(mappingsMap.entries()).map(([rawLedgerName, entry]) => ({
      rawLedgerName,
      standardAccountId: entry.standardAccountId,
      skipped: entry.skipped,
    }))

    return jsonResponse({ mappings })
  } catch (error) {
    return handleRouteError('IMPORT_MAPPINGS_GET', error)
  }
}

// POST /api/import/mappings
// Upserts a batch of account mappings for the company
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, postMappingsSchema)

    await requireOwnedCompany(userId, body.companyId)

    // Validate all non-null standardAccountIds against the COA
    for (const entry of body.mappings) {
      if (entry.standardAccountId !== null && !VALID_COA_IDS.has(entry.standardAccountId)) {
        throw new RouteError(422, `Unknown standardAccountId: ${entry.standardAccountId}`)
      }
      // skipped entries must have null standardAccountId
      if (entry.skipped) {
        entry.standardAccountId = null
      }
    }

    const saved = await upsertMappings(body.companyId, body.mappings)

    return jsonResponse({ saved })
  } catch (error) {
    return handleRouteError('IMPORT_MAPPINGS_POST', error)
  }
}
