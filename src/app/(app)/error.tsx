'use client'

import { useEffect } from 'react'

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App segment error', error)
  }, [error])

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Unable to load this page</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Please retry. If this keeps happening, contact support.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
