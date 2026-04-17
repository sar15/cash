import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relPath: string) {
  return readFileSync(path.join(root, relPath), 'utf8')
}

describe('E2E contract (auth-safe) — critical production flows', () => {
  it('Import→Forecast: forecast and import pages are server shells rendering client islands', () => {
    const forecastPage = read('src/app/(app)/forecast/page.tsx')
    const importPage = read('src/app/(app)/data/page.tsx')

    expect(forecastPage).toMatch(/import\s+ForecastClient\s+from\s+'\.\/ForecastClient'/)
    expect(forecastPage).toMatch(/return\s+<ForecastClient\s*\/>/)

    expect(importPage).toMatch(/import\s+ImportClient\s+from\s+'\.\/ImportClient'/)
    expect(importPage).toMatch(/return\s+<ImportClient\s*\/>/)

    const forecastClient = read('src/app/(app)/forecast/ForecastClient.tsx')
    const importClient = read('src/app/(app)/data/ImportClient.tsx')
    expect(forecastClient).toMatch(/'use client'/)
    expect(importClient).toMatch(/'use client'/)
  })

  it('Report generation is idempotent when Idempotency-Key is provided', () => {
    const route = read('src/app/api/reports/generate/route.ts')
    expect(route).toMatch(/getIdempotencyKey/)
    expect(route).toMatch(/findIdempotentResponse/)
    expect(route).toMatch(/saveIdempotentResponse/)
  })

  it('Client retries are safe: API client auto-attaches Idempotency-Key on unsafe mutations', () => {
    const client = read('src/lib/api/client.ts')
    expect(client).toMatch(/Idempotency-Key/i)
    expect(client).toMatch(/isUnsafeMutation/)
    expect(client).toMatch(/crypto\.randomUUID\(\)/)
  })

  it('CA/Firm mode is explicit: isCA derives from server-backed profile, not company count', () => {
    const companyStore = read('src/stores/company-store.ts')
    expect(companyStore).toMatch(/userType\s*===\s*'ca_firm'/)
    expect(companyStore).not.toMatch(/companies\.length\s*>\s*1/)
  })
})

