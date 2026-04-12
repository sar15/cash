import { type NextRequest, NextResponse } from 'next/server'

import { generateUploadKey, isR2Configured, uploadFile } from '@/lib/r2'
import { handleRouteError, RouteError } from '@/lib/server/api'
import { requireCompanyForUser, requireUserId } from '@/lib/server/auth'

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv'])

function getExtension(filename: string) {
  const index = filename.lastIndexOf('.')
  return index >= 0 ? filename.slice(index).toLowerCase() : ''
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const formData = await request.formData()
    const companyId = formData.get('companyId')
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new RouteError(400, 'Missing upload file.')
    }

    if (!ALLOWED_EXTENSIONS.has(getExtension(file.name))) {
      throw new RouteError(422, 'Only .xlsx, .xls, and .csv files are supported.')
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new RouteError(422, 'Upload file must be 10MB or smaller.')
    }

    const company = await requireCompanyForUser(
      userId,
      typeof companyId === 'string' ? companyId : null
    )
    const fileKey = generateUploadKey(company.id, file.name)
    const buffer = Buffer.from(await file.arrayBuffer())

    await uploadFile(fileKey, buffer, file.type || 'application/octet-stream')

    return NextResponse.json(
      {
        companyId: company.id,
        fileKey,
        filename: file.name,
        size: file.size,
        contentType: file.type || 'application/octet-stream',
        storage: isR2Configured() ? 'r2' : 'local',
      },
      { status: 201 }
    )
  } catch (error) {
    return handleRouteError('IMPORT_UPLOAD_POST', error)
  }
}
