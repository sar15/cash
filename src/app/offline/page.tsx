'use client'

import { useEffect, useState } from 'react'

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0F172A]">
        <span className="text-2xl font-bold text-[#059669]">₹</span>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-[#0F172A]">You&apos;re offline</h1>
      <p className="mb-8 max-w-sm text-sm text-[#64748B]">
        CashFlowIQ needs an internet connection to load your forecast data. Check your connection and try again.
      </p>
      {isOnline ? (
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-[#059669] px-6 py-3 text-sm font-semibold text-white hover:bg-[#047857]"
        >
          Reconnected — reload
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#64748B]">
          <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
          No connection
        </div>
      )}
    </div>
  )
}
