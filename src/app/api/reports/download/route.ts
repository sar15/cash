import { NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonError } from '@/lib/api/helpers'
import { getFile } from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const key = request.nextUrl.searchParams.get('key')
    if (!key) return jsonError('Missing key', 400)

    // Security: internal key must belong to this company
    const internalKey = key.startsWith('ut:') ? key.slice(key.indexOf(':', 3) + 1) : key
    if (!internalKey.startsWith(`reports/${ctx.companyId}/`)) {
      return jsonError('Forbidden', 403)
    }

    const buffer = await getFile(key)
    const filename = key.split('/').pop() ?? 'report.pdf'

    const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
    return new Response(body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[Reports] Download failed:', err)
    return jsonError('File not found', 404)
  }
}
