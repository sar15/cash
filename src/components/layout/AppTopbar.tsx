"use client"

import { UserButton } from "@clerk/nextjs"
import { useUIStore } from "@/stores/ui-store"
import { Menu, Bell, CheckCheck, IndianRupee } from "lucide-react"
import { useCompanyStore } from "@/stores/company-store"
import { useEffect, useState, useRef } from "react"
import { apiGet, apiPost } from "@/lib/api/client"
import { cn } from "@/lib/utils"

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
    const fetch = async () => {
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
    void fetch()
    const interval = setInterval(() => void fetch(), 5 * 60_000) // poll every 5 min
    return () => { cancelled = true; clearInterval(interval) }
  }, [companyId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const markAllRead = async () => {
    await apiPost(`/api/notifications/read-all?companyId=${companyId}`, {}).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })))
    setUnreadCount(0)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] transition-colors duration-75 hover:border-[#CBD5E1] hover:text-[#0F172A]"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-sm font-semibold text-[#0F172A]">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="mx-auto h-6 w-6 text-[#CBD5E1]" />
                <p className="mt-2 text-sm text-[#94A3B8]">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={cn("border-b border-[#F1F5F9] px-4 py-3 transition-colors hover:bg-[#F8FAFC]", !n.readAt && "bg-[#EFF6FF]")}>
                  <p className={cn("text-xs font-semibold", !n.readAt ? "text-[#0F172A]" : "text-[#475569]")}>{n.title}</p>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function AppTopbar() {
  const { setMobileSidebarOpen } = useUIStore()
  const company = useCompanyStore((s) => s.activeCompany())

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-[#E2E8F0] bg-white px-4">
      {/* Left */}
      <div className="flex items-center gap-4">
        {/* Mobile menu */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] transition-colors hover:border-[#CBD5E1] hover:text-[#0F172A] lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Logo — desktop only (sidebar has it too, but topbar needs it for collapsed state) */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0F172A]">
            <IndianRupee className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-[#0F172A]">CashFlowIQ</span>
        </div>

        {/* Company badge */}
        {company?.name && (
          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">Company</span>
            <span className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-xs font-semibold text-[#0F172A]">
              {company.name}
            </span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {company?.id && <NotificationBell companyId={company.id} />}

        <div className="h-5 w-px bg-[#E2E8F0]" />

        <UserButton
          appearance={{
            elements: {
              rootBox: { width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" },
              avatarBox: { width: "32px", height: "32px", borderRadius: "8px" },
              userButtonAvatarBox: { width: "32px", height: "32px", borderRadius: "8px" },
              userButtonPopoverCard: {
                zIndex: 99999,
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05)",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
              },
            },
          }}
        />
      </div>
    </header>
  )
}
