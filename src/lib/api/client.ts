/**
 * API Client Utility
 *
 * Centralized fetch wrapper for all API calls.
 * Handles JSON parsing, error responses, auth headers,
 * request timeouts, and exponential-backoff retry for Indian networks.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Request timeout in ms. Default: 30 000 */
  timeout?: number
  /** Max retry attempts on network errors / 5xx. Default: 3 */
  retries?: number
  /**
   * Idempotency key behavior for unsafe mutations.
   * - undefined: auto-generate for POST/PUT/PATCH/DELETE
   * - string: use provided key
   * - false: do not send the header
   */
  idempotencyKey?: string | false
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const data = await response.json().catch(() => ({}))
      const message = (() => {
        if (data && typeof data === 'object' && 'error' in data) {
          const err = (data as { error?: unknown }).error
          if (typeof err === 'string') return err
        }
        return JSON.stringify(data)
      })()
      throw new ApiError(response.status, message, data)
    }

    const text = await response.text().catch(() => 'Unknown error')
    throw new ApiError(response.status, text, null)
  }

  if (response.status === 204) return null as T

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>
  }
  return response.text() as unknown as T
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Returns true for errors that are safe to retry */
function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    // Retry on server errors (5xx) but not client errors (4xx)
    return error.status >= 500
  }
  // Network-level failures (TypeError: Failed to fetch, AbortError from timeout)
  return true
}

export async function api<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const { body, headers, timeout = 30_000, retries = 3, idempotencyKey, ...rest } = options

  const config: RequestInit = {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  const method = (config.method ?? 'GET').toUpperCase()
  const isUnsafeMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  if (isUnsafeMutation && idempotencyKey !== false) {
    const key = typeof idempotencyKey === 'string' ? idempotencyKey : crypto.randomUUID()
    ;(config.headers as Record<string, string>)['Idempotency-Key'] = key
  }

  if (body !== undefined) {
    config.body = JSON.stringify(body)
  }

  let attempt = 0
  while (true) {
    attempt++
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, { ...config, signal: controller.signal })
      clearTimeout(timer)
      return await handleResponse<T>(response)
    } catch (error) {
      clearTimeout(timer)

      const isLastAttempt = attempt >= retries
      if (isLastAttempt || !isRetryable(error)) {
        throw error
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms …
      await sleep(500 * 2 ** (attempt - 1))
    }
  }
}

// Convenience methods
export const apiGet = <T>(url: string) => api<T>(url, { method: 'GET' })
export const apiPost = <T>(url: string, body: unknown) => api<T>(url, { method: 'POST', body })
export const apiPatch = <T>(url: string, body: unknown) => api<T>(url, { method: 'PATCH', body })
export const apiPut = <T>(url: string, body: unknown) => api<T>(url, { method: 'PUT', body })
export const apiDelete = <T>(url: string) => api<T>(url, { method: 'DELETE' })
