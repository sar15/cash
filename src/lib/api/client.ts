/**
 * API Client Utility
 *
 * Centralized fetch wrapper for all API calls.
 * Handles JSON parsing, error responses, and auth headers.
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
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
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

export async function api<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options

  const config: RequestInit = {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body !== undefined) {
    config.body = JSON.stringify(body)
  }

  const response = await fetch(url, config)
  return handleResponse<T>(response)
}

// Convenience methods
export const apiGet = <T>(url: string) => api<T>(url, { method: 'GET' })
export const apiPost = <T>(url: string, body: unknown) => api<T>(url, { method: 'POST', body })
export const apiPatch = <T>(url: string, body: unknown) => api<T>(url, { method: 'PATCH', body })
export const apiPut = <T>(url: string, body: unknown) => api<T>(url, { method: 'PUT', body })
export const apiDelete = <T>(url: string) => api<T>(url, { method: 'DELETE' })
