'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api/client'
import { PageHeader, SurfaceCard } from '@/components/shared/page-header'

type Diagnostics = {
  ts: string
  env: { nodeEnv: string }
  features: Record<string, boolean>
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<Diagnostics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiGet<{ diagnostics: Diagnostics }>('/api/diagnostics')
        if (!cancelled) setData(res.diagnostics)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load diagnostics')
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Diagnostics"
        description="Feature flags and integration health for this deployment."
      />

      <SurfaceCard className="space-y-4">
        {error ? (
          <div className="rounded-md border border-[color:var(--cfiq-red-border)] bg-[color:var(--cfiq-red-bg)] p-3 text-sm text-foreground">
            {error}
          </div>
        ) : null}

        {!data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              Updated: <span className="font-num">{new Date(data.ts).toLocaleString()}</span> · Environment:{' '}
              <span className="font-semibold">{data.env.nodeEnv}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(data.features).map(([k, v]) => (
                <div key={k} className="rounded-md border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{k}</span>
                    <span className={v ? 'text-positive text-xs font-semibold' : 'text-muted-foreground text-xs font-semibold'}>
                      {v ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
              For $0/month deployments, it’s normal for optional features (email/jobs/storage) to be disabled. Core forecasting works without them.
            </div>
          </>
        )}
      </SurfaceCard>
    </div>
  )
}

