import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const BUCKET = process.env.R2_BUCKET_NAME ?? 'cashflowiq-uploads'
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), '.local-uploads')
// FIX audit1: Enforce max file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

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
  // FIX audit1: Enforce file size limit
  if (body.length > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }
  if (!r2) {
    const localPath = getLocalUploadPath(key)
    await mkdir(path.dirname(localPath), { recursive: true })
    await writeFile(localPath, body)
    return key
  }

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )

  return key
}

export async function getFile(key: string): Promise<Buffer> {
  if (!r2) {
    return readFile(getLocalUploadPath(key))
  }

  const response = await r2.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
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

export function generateUploadKey(companyId: string, filename: string): string {
  // FIX audit1: UUID instead of Date.now() to prevent collisions under concurrency
  const uid = randomUUID()
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `uploads/${companyId}/${uid}_${sanitized}`
}
