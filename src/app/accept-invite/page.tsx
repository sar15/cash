'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAccept = async () => {
    if (!token) {
      setError('Invite token is missing.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/company-invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(
          typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Unable to accept invitation.'
        )
        return
      }

      const companyId =
        typeof payload === 'object' && payload && 'companyId' in payload && typeof payload.companyId === 'string'
          ? payload.companyId
          : null

      router.push(companyId ? `/dashboard?companyId=${encodeURIComponent(companyId)}` : '/dashboard')
    } catch {
      setError('Unable to accept invitation right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-6 py-16">
      <div className="w-full rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
          CashFlowIQ
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[#0F172A]">
          Accept company invitation
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#64748B]">
          Accept this invitation with the same email address that received it. If you are not signed in yet,
          sign in first and then reopen this link.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleAccept}
          disabled={isSubmitting || !token}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Accepting...' : 'Accept invitation'}
        </button>
      </div>
    </main>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-6 py-16">
        <div className="w-full rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          </div>
        </div>
      </main>
    }>
      <AcceptInviteContent />
    </Suspense>
  )
}
