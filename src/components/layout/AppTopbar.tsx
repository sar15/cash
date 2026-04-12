"use client"

import { UserButton } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import { useUIStore } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import { Bell, Building2, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCompanyStore } from "@/stores/company-store"

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

function getFinancialYearLabel(fyStartMonth: number) {
  const today = new Date()
  const month = today.getMonth() + 1
  const startYear = month >= fyStartMonth ? today.getFullYear() : today.getFullYear() - 1
  const endYear = startYear + 1

  return `FY ${startYear}-${String(endYear).slice(-2)}`
}

export function AppTopbar() {
  const { setMobileSidebarOpen, sidebarCollapsed } = useUIStore()
  const pathname = usePathname()
  const company = useCompanyStore((state) => state.activeCompany())
  const isCA = useCompanyStore((state) => state.isCA())
  const pageMeta = getPageMeta(pathname)
  const fyLabel = getFinancialYearLabel(company?.fyStartMonth ?? 4)

  return (
    <header
      className={cn(
        "sidebar-transition fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b border-[#E5E7EB] bg-white/80 px-4 backdrop-blur-sm sm:px-5",
        "left-0 lg:left-[240px]",
        sidebarCollapsed && "lg:left-[68px]"
      )}
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="hidden min-w-0 sm:block">
          <div className="text-sm font-semibold text-[#0F172A]">{pageMeta.title}</div>
          <div className="truncate text-xs text-[#94A3B8]">{pageMeta.description}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 lg:flex">
          <Building2 className="h-3.5 w-3.5 text-[#94A3B8]" />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-[#0F172A]">
              {company?.name ?? "Loading"}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
              {fyLabel} {isCA ? "• CA" : ""}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="relative rounded border border-[#E5E7EB] bg-white p-1.5 text-[#94A3B8] transition-colors duration-[80ms] hover:border-[#D1D5DB] hover:text-[#475569]"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="h-5 w-px bg-[#E5E7EB]" />

        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-7 w-7",
            },
          }}
        />
      </div>
    </header>
  )
}
