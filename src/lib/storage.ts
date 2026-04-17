/**
 * Storage abstraction — Uploadthing (production) with local filesystem fallback (dev)
 *
 * Uploadthing: free tier, 2GB, no credit card required.
 * Set UPLOADTHING_TOKEN in .env.local to enable.
 * Without it: files are stored in .local-uploads/ (dev only — breaks on Vercel).
 *
 * Public interface matches the old r2.ts so no other files need to change.
 */

import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { withRetry, withTimeout } from '@/lib/server/resilience'

const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), '.local-uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const UT_TIMEOUT_MS = 15_000

// ── Magic byte validation ──────────────────────────────────────────────────

const ALLOWED_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'application/octet-stream',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const MAGIC_BYTES: Array<{ bytes: number[]; type: string }> = [
  { bytes: [0x50, 0x4b, 0x03, 0x04], type: 'xlsx/zip' },
  { bytes: [0xd0, 0xcf, 0x11, 0xe0], type: 'xls' },
]

function validateContentType(buffer: Buffer | Uint8Array, declaredContentType: string): void {
  const baseType = declaredContentType.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(baseType)) {
    throw new Error(`Unsupported file type: ${baseType}. Only Excel and CSV files are allowed.`)
  }
  if (baseType !== 'text/csv' && baseType !== 'text/plain' &&
      !baseType.startsWith('image/') && baseType !== 'application/pdf') {
    const header = Array.from(buffer.slice(0, 4))
    const matched = MAGIC_BYTES.some((sig) =>
      sig.bytes.every((byte, index) => header[index] === byte)
    )
    if (!matched) {
      throw new Error('File content does not match a valid Excel format.')
    }
  }
}

// ── Uploadthing client (lazy-loaded so missing token doesn't crash at import) ──

let _utApi: import('uploadthing/server').UTApi | null = null

function getUtApi(): import('uploadthing/server').UTApi | null {
  if (!process.env.UPLOADTHING_TOKEN) return null
  if (!_utApi) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { UTApi } = require('uploadthing/server') as typeof import('uploadthing/server')
    _utApi = new UTApi({ token: process.env.UPLOADTHING_TOKEN })
  }
  return _utApi
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.UPLOADTHING_TOKEN)
}

/** @deprecated use isStorageConfigured() */
export const isR2Configured = isStorageConfigured

// ── Key helpers ────────────────────────────────────────────────────────────

export function generateUploadKey(companyId: string, filename: string): string {
  const uid = randomUUID()
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `uploads/${companyId}/${uid}_${sanitized}`
}

function getLocalUploadPath(key: string) {
  return path.join(LOCAL_UPLOAD_ROOT, key)
}

// ── Upload ─────────────────────────────────────────────────────────────────

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  if (body.length > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }
  validateContentType(body, contentType)

  const utApi = getUtApi()

  if (!utApi) {
    // Local filesystem fallback (dev only)
    const localPath = getLocalUploadPath(key)
    await mkdir(path.dirname(localPath), { recursive: true })
    await writeFile(localPath, body)
    return key
  }

  // Uploadthing: upload as a File blob
  const filename = key.split('/').pop() ?? 'upload'
  const file = new File([new Uint8Array(body)], filename, { type: contentType })

  const result = await withRetry(
    () => withTimeout(
      utApi.uploadFiles(file),
      UT_TIMEOUT_MS,
      'Uploadthing upload'
    ),
    3
  )

  if (result.error) {
    throw new Error(`Upload failed: ${result.error.message}`)
  }

  // Store the UT file key alongside our internal key so we can retrieve/delete it
  // We encode it as: ut:<utKey>:<originalKey>
  return `ut:${result.data.key}:${key}`
}

// ── Download ───────────────────────────────────────────────────────────────

export async function getFile(key: string): Promise<Buffer> {
  // Local fallback
  if (!key.startsWith('ut:')) {
    return readFile(getLocalUploadPath(key))
  }

  const utApi = getUtApi()
  if (!utApi) throw new Error('Storage not configured')

  // Parse: ut:<utKey>:<originalKey>
  const utKey = key.slice(3, key.indexOf(':', 3))

  const urls = await withTimeout(
    utApi.getSignedURL(utKey, { expiresIn: '1h' }),
    UT_TIMEOUT_MS,
    'Uploadthing getSignedURL'
  )

  if (!urls?.url) throw new Error(`File not found: ${key}`)

  const response = await withTimeout(
    fetch(urls.url),
    UT_TIMEOUT_MS,
    'Uploadthing fetch file'
  )

  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`)

  return Buffer.from(await response.arrayBuffer())
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
  if (!key.startsWith('ut:')) {
    // Local fallback
    try {
      await unlink(getLocalUploadPath(key))
    } catch {
      // File may not exist — ignore
    }
    return
  }

  const utApi = getUtApi()
  if (!utApi) return

  const utKey = key.slice(3, key.indexOf(':', 3))
  await withTimeout(
    utApi.deleteFiles(utKey),
    UT_TIMEOUT_MS,
    'Uploadthing delete'
  ).catch(() => {}) // non-critical
}
