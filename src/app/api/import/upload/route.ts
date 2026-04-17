import { type NextRequest, NextResponse } from 'next/server'

import { generateUploadKey, isStorageConfigured, uploadFile } from '@/lib/storage'
import { handleRouteError, RouteError } from '@/lib/server/api'
import { requireCompanyForUser, requireUserId } from '@/lib/server/auth'
import {
  findIdempotentResponse,
  getIdempotencyKey,
  saveIdempotentResponse,
  toIdempotencyResponse,
} from '@/lib/server/idempotency'

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv'])

// MIME type allowlist — validated server-side, not just extension
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'text/plain', // some browsers send CSV as text/plain
  'application/csv',
  'application/octet-stream', // fallback for some upload clients
])

// Magic bytes for file type verification (server-side, not client-supplied)
// xlsx/xls/zip: PK\x03\x04
const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04]
// xls (legacy BIFF): D0 CF 11 E0
const XLS_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]

function getExtension(filename: string) {
  const index = filename.lastIndexOf('.')
  return index >= 0 ? filename.slice(index).toLowerCase() : ''
}

function isAllowedMimeType(mimeType: string): boolean {
  if (!mimeType) return true // no MIME = allow (extension check is the gate)
  const base = mimeType.split(';')[0].trim().toLowerCase()
  return ALLOWED_MIME_TYPES.has(base)
}

/**
 * Validates actual file bytes against known magic bytes.
 * Returns true for CSV (text) and for xlsx/xls with correct magic.
 * Rejects binary files that don't match expected signatures.
 */
function validateMagicBytes(buffer: Buffer, extension: string): boolean {
  if (extension === '.csv') {
    // CSV must be valid UTF-8 text — check first byte is printable ASCII or UTF-8 BOM
    const first = buffer[0]
    if (first === undefined) return false
    // Allow UTF-8 BOM (EF BB BF), or printable ASCII start
    if (first === 0xef) return buffer[1] === 0xbb && buffer[2] === 0xbf
    return first >= 0x09 && first <= 0x7e // tab, newline, CR, or printable ASCII
  }

  if (extension === '.xlsx') {
    return XLSX_MAGIC.every((byte, i) => buffer[i] === byte)
  }

  if (extension === '.xls') {
    return (
      XLS_MAGIC.every((byte, i) => buffer[i] === byte) ||
      XLSX_MAGIC.every((byte, i) => buffer[i] === byte) // newer xls can be zip-based
    )
  }

  return false
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

    const ext = getExtension(file.name)

    if (!isAllowedMimeType(file.type)) {
      throw new RouteError(422, 'Invalid file type. Only Excel and CSV files are supported.')
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new RouteError(422, 'Upload file must be 10MB or smaller.')
    }

    const company = await requireCompanyForUser(
      userId,
      typeof companyId === 'string' ? companyId : null
    )

    const idempotencyKey = getIdempotencyKey(request)
    if (idempotencyKey) {
      const cached = await findIdempotentResponse({
        key: idempotencyKey,
        companyId: company.id,
        route: request.nextUrl.pathname,
        method: request.method,
      })
      if (cached) {
        return toIdempotencyResponse(cached)
      }
    }

    const fileKey = generateUploadKey(company.id, file.name)
    const buffer = Buffer.from(await file.arrayBuffer())

    // Server-side magic byte validation — cannot be spoofed by client
    if (!validateMagicBytes(buffer, ext)) {
      throw new RouteError(422, 'File content does not match the expected format. Please upload a valid Excel or CSV file.')
    }

    // uploadFile returns the storage key (may be ut:<utKey>:<originalKey> for UploadThing)
    const storedKey = await uploadFile(fileKey, buffer, file.type || 'application/octet-stream')

    const payload = {
      companyId: company.id,
      fileKey: storedKey,
      filename: file.name,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
      storage: isStorageConfigured() ? 'uploadthing' : 'local',
    }

    if (idempotencyKey) {
      await saveIdempotentResponse(
        {
          key: idempotencyKey,
          companyId: company.id,
          route: request.nextUrl.pathname,
          method: request.method,
        },
        201,
        payload
      )
    }

    return NextResponse.json(payload, { status: 201 })
  } catch (error) {
    return handleRouteError('IMPORT_UPLOAD_POST', error)
  }
}
