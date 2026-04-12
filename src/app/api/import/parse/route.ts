import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { getFile } from '@/lib/r2'
import { handleRouteError, jsonResponse, parseJsonBody, RouteError } from '@/lib/server/api'
import { requireCompanyForUser, requireUserId } from '@/lib/server/auth'
import { buildImportPreview } from '@/lib/server/imports'

const parseRequestSchema = z.object({
  companyId: z.string().uuid().optional(),
  fileKey: z.string().min(1),
  sheetName: z.string().min(1).optional(),
})

function toArrayBuffer(buffer: Buffer) {
  return Uint8Array.from(buffer).buffer
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, parseRequestSchema)
    const company = await requireCompanyForUser(userId, body.companyId)

    if (!body.fileKey.startsWith(`uploads/${company.id}/`)) {
      throw new RouteError(403, 'Uploaded file does not belong to the selected company.')
    }

    const file = await getFile(body.fileKey)
    const preview = buildImportPreview(toArrayBuffer(file), body.sheetName)

    return jsonResponse({
      companyId: company.id,
      fileKey: body.fileKey,
      ...preview,
    })
  } catch (error) {
    return handleRouteError('IMPORT_PARSE_POST', error)
  }
}
