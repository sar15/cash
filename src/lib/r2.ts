import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { withRetry, withTimeout } from '@/lib/server/resilience'

const BUCKET = process.env.R2_BUCKET_NAME ?? 'cashflowiq-uploads'
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), '.local-uploads')
// FIX audit1: Enforce max file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024
const R2_TIMEOUT_MS = 12_000

// H5: Allowed MIME types for server-side content-type validation
const ALLOWED_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'text/plain', // some CSV uploads arrive as text/plain
  'application/octet-stream', // generic binary — validated further by magic bytes
])

// Magic byte signatures for allowed file types
const MAGIC_BYTES: Array<{ bytes: number[]; type: string }> = [
  { bytes: [0x50, 0x4b, 0x03, 0x04], type: 'xlsx/zip' }, // XLSX (ZIP container)
  { bytes: [0xd0, 0xcf, 0x11, 0xe0], type: 'xls' },       // XLS (OLE2)
]

function validateContentType(buffer: Buffer | Uint8Array, declaredContentType: string): void {
  // Check declared MIME type
  const baseType = declaredContentType.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(baseType)) {
    throw new Error(`Unsupported file type: ${baseType}. Only Excel and CSV files are allowed.`)
  }

  // For binary types, verify magic bytes
  if (baseType !== 'text/csv' && baseType !== 'text/plain') {
    const header = Array.from(buffer.slice(0, 4))
    const matched = MAGIC_BYTES.some((sig) =>
      sig.bytes.every((byte, index) => header[index] === byte)
    )
    if (!matched) {
      throw new Error('File content does not match a valid Excel format.')
    }
  }
}

const hasRemoteR2Config = Boolean(
  process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
)

const r2 = hasRemoteR2Config
  ? new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null

function getLocalUploadPath(key: string) {
  return path.join(LOCAL_UPLOAD_ROOT, key)
}

export function isR2Configured() {
  return hasRemoteR2Config
}

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  // FIX H5: Validate content-type server-side
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'text/csv'
  ])

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new Error(`Invalid file type: ${contentType}`)
  }

  // FIX audit1: Enforce file size limit
  if (body.length > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }
  // H5: Server-side content-type + magic byte validation
  validateContentType(body, contentType)
  if (!r2) {
    const localPath = getLocalUploadPath(key)
    await mkdir(path.dirname(localPath), { recursive: true })
    await writeFile(localPath, body)
    return key
  }

  await withRetry(
    () =>
      withTimeout(
        r2.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
          })
        ),
        R2_TIMEOUT_MS,
        'R2 put object'
      ),
    3
  )

  return key
}

export async function getFile(key: string): Promise<Buffer> {
  if (!r2) {
    return readFile(getLocalUploadPath(key))
  }

  const response = await withTimeout(
    r2.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    ),
    R2_TIMEOUT_MS,
    'R2 get object'
  )
  const stream = response.Body

  if (!stream) {
    throw new Error(`File not found: ${key}`)
  }

  const chunks: Uint8Array[] = []
  // @ts-expect-error - AWS SDK stream typing is broader than Buffer.concat expects.
  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

export async function deleteFile(key: string): Promise<void> {
  if (!r2) {
    try {
      const { unlink } = await import('node:fs/promises')
      await unlink(getLocalUploadPath(key))
    } catch {
      // File may not exist — ignore
    }
    return
  }

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
  await withTimeout(
    r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })),
    R2_TIMEOUT_MS,
    'R2 delete object'
  )
}

export function generateUploadKey(companyId: string, filename: string): string {
  // FIX audit1: UUID instead of Date.now() to prevent collisions under concurrency
  const uid = randomUUID()
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `uploads/${companyId}/${uid}_${sanitized}`
}
