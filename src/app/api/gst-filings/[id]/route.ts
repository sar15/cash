import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gstFilings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { markFilingAsFiled } from '@/lib/db/queries/gst-filings'
import { isErrorResponse, resolveAuthedCompany } from '@/lib/api/helpers'
import { parseJsonBody } from '@/lib/server/api'
import { z } from 'zod'
import { handleRouteError } from '@/lib/server/api'

const patchGstFilingSchema = z.object({
  referenceNumber: z.string().trim().max(128).optional(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<any> }
) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { id: filingId } = await context.params
    const { referenceNumber } = await parseJsonBody(request, patchGstFilingSchema)

    // Get filing and verify ownership
    const filing = await db.query.gstFilings.findFirst({
      where: eq(gstFilings.id, filingId),
    })

    if (!filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 })
    }

    if (filing.companyId !== ctx.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await markFilingAsFiled(filingId, referenceNumber)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError('GST_FILING_ID_PATCH', error)
  }
}
