"use client"

import { UserButton } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import { useUIStore } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import { Building2, Menu, CheckCheck, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCompanyStore } from "@/stores/company-store"
import { useUserType } from "@/components/shared/UserTypeModal"
import { useEffect, useState, useRef } from "react"
import { apiGet, apiPost } from "@/lib/api/client"

const pageTitleMap: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Dashboard",
    description: "Cash position, runway, compliance at a glance",
  },
  "/forecast": {
    title: "Forecast",
    description: "P&L, balance sheet, and cash flow grid",
  },
  "/scenarios": {
    title: "Scenarios",
    description: "Stress-test assumptions before you commit",
  },
  "/compliance": {
    title: "Compliance",
    description: "GST, TDS, PF/ESI, advance tax tracking",
  },
  "/data": {
    title: "Import",
    description: "Upload, map, and publish financials",
  },
  "/reports": {
    title: "Reports",
    description: "Board-ready exports with your brand",
  },
  "/accounts": {
    title: "Accounts",
    description: "Chart of accounts and mapping",
  },
  "/settings": {
    title: "Settings",
    description: "Company profile and tax defaults",
  },
  "/clients": {
    title: "Portfolio",
    description: "Client overview for CA practice",
  },
  "/due-dates": {
    title: "Due Dates",
    description: "Cross-client compliance deadlines",
  },
}

function getPageMeta(pathname: string) {
  const match = Object.entries(pageTitleMap).find(([path]) =>
    pathname === path || pathname.startsWith(`${path}/`)
  )

  return (
    match?.[1] ?? {
      title: "CashFlowIQ",
      description: "Financial forecasting for Indian SMEs",
    }
  )
}

interface Notification {
  id: string
  type: string
  title: string
  body: string
  actionUrl?: string | null
  readAt?: string | null
  createdAt?: string | null
}

function NotificationBell({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const fetchNotifications = async () => {
      try {
        const data = await apiGet<{ notifications: Notification[]; unreadCount: number }>(
          `/api/notifications?companyId=${companyId}`
        )
        if (!cancelled) {
          setNotifications(data.notifications ?? [])
          setUnreadCount(data.unreadCount ?? 0)
        }
      } catch { /* silent */ }
    }
    void fetchNotifications()
    const interval = setInterval(() => { void fetchNotifications() }, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [companyId])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await apiPost(`/api/notifications/read-all?companyId=${companyId}`, {}).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })))
    setUnreadCount(0)
  }

  const typeIcon: Record<string, string> = {
    compliance_due: '⚠️',
    import_complete: '✅',
    rule_changed: '⚙️',
    scenario_activated: '🎯',
    general: '💬',
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative rounded border border-[#E5E7EB] bg-white p-1.5 text-[#94A3B8] transition-colors duration-[80ms] hover:border-[#D1D5DB] hover:text-[#475569]"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[#E2E8F0] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-sm font-semibold text-[#0F172A]">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto thin-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[#94A3B8]">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'border-b border-[#F1F5F9] px-4 py-3 transition-colors hover:bg-[#F8FAFC]',
                    !n.readAt && 'bg-[#EFF6FF]'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-base">{typeIcon[n.type] ?? '💬'}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-xs font-semibold', !n.readAt ? 'text-[#0F172A]' : 'text-[#475569]')}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">{n.body}</p>
                      {n.createdAt && (
                        <p className="mt-1 text-[10px] text-[#94A3B8]">
                          {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
function getFinancialYearLabel(fyStartMonth: number) {
  const today = new Date()
  const month = today.getMonth() + 1
  const startYear = month >= fyStartMonth ? today.getFullYear() : today.getFullYear() - 1
  const endYear = startYear + 1

  return `FY ${startYear}-${String(endYear).slice(-2)}`
}

export function AppTopbar() {
  const { setMobileSidebarOpen } = useUIStore()
  const company = useCompanyStore((state) => state.activeCompany())
  const isCA = useCompanyStore((state) => state.isCA())
  const { userType } = useUserType()
  const showCABadge = isCA || userType === 'ca'
  const fyLabel = getFinancialYearLabel(company?.fyStartMonth ?? 4)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4">
      {/* LEFT: Brand */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0F172A] text-white shadow-sm ring-1 ring-black/5">
            <span className="text-sm font-bold tracking-tighter">C<span className="text-[#38BDF8]">IQ</span></span>
          </div>
          <div className="hidden flex-col sm:flex">
            <span className="text-[13px] font-bold tracking-tight text-[#0F172A]">
              CashFlowIQ
            </span>
          </div>
        </div>
        
        <div className="hidden h-5 w-px bg-[#E2E8F0] sm:block" />

        {/* Search Bar matching inspiration */}
        <div className="hidden lg:block relative w-[320px]">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-4 w-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full rounded-md border-0 bg-[#F1F5F9] py-1.5 pl-9 pr-3 text-sm text-[#0F172A] ring-1 ring-inset ring-[#E2E8F0] placeholder:text-[#94A3B8] focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#2563EB]"
            placeholder="Search clients, jump to page..."
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <span className="inline-flex items-center rounded border border-[#E2E8F0] px-1.5 font-sans text-[10px] font-medium text-[#94A3B8]">
              ⌘K
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="hidden items-center gap-4 text-xs font-medium text-[#64748B] lg:flex">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#10B981]" />
            <span>Sync</span>
          </div>
          <span>•</span>
          <span>43ms</span>
        </div>

        <div className="hidden h-5 w-px bg-[#E2E8F0] lg:block" />

        {company?.id && <NotificationBell companyId={company.id} />}

        <div className="h-5 w-px bg-[#E5E7EB]" />

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] ring-1 ring-[#E2E8F0]">
          <UserButton
            appearance={{
              elements: {
                rootBox: { width: "32px", height: "32px", display: "flex", flexShrink: 0 },
                avatarBox: { width: "32px", height: "32px", borderRadius: "9999px" },
                userButtonAvatarBox: { width: "32px", height: "32px", borderRadius: "9999px" },
                userButtonPopoverCard: { 
                  zIndex: 99999,
                  maxWidth: "320px", 
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px"
                },
                userPreviewSecondaryIdentifier: { color: "#64748B" }
              },
            }}
          />
        </div>
      </div>
    </header>
  )
}
