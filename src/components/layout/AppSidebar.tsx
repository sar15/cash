"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui-store"
import { useCompanyStore } from "@/stores/company-store"
import { useCurrentForecast } from "@/hooks/use-current-forecast"
import {
  LayoutDashboard,
  TrendingUp,
  FileSpreadsheet,
  Upload,
  Settings,
  ClipboardCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  GitCompareArrows,
  CalendarClock,
  Briefcase,
  ChevronDown,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  caOnly?: boolean
}

const caPrimaryNav: NavItem[] = [
  { label: "Portfolio", href: "/clients", icon: Briefcase, caOnly: true },
  { label: "Due Dates", href: "/due-dates", icon: CalendarClock, caOnly: true },
]

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Forecast", href: "/forecast", icon: TrendingUp },
  { label: "Scenarios", href: "/scenarios", icon: GitCompareArrows },
  { label: "Compliance", href: "/compliance", icon: ClipboardCheck },
  { label: "Data Import", href: "/data", icon: Upload },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Accounts", href: "/accounts", icon: FileSpreadsheet },
  { label: "Settings", href: "/settings", icon: Settings },
]

function CompanySwitcher({ collapsed }: { collapsed: boolean }) {
  const companies = useCompanyStore((s) => s.companies)
  const activeCompany = useCompanyStore((s) => s.activeCompany())
  const setActiveCompany = useCompanyStore((s) => s.setActiveCompany)
  const isCA = useCompanyStore((s) => s.isCA())

  if (!activeCompany || companies.length <= 1) return null

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <div className="mx-3 my-2 flex h-8 w-8 items-center justify-center rounded bg-[#ECFDF5] text-xs font-bold text-[#059669]">
            {activeCompany.name.charAt(0)}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {activeCompany.name}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="mx-3 my-2">
      <div className="relative">
        <select
          value={activeCompany.id}
          onChange={(e) => setActiveCompany(e.target.value)}
          className="w-full appearance-none rounded border border-[#E5E7EB] bg-white py-2 pl-3 pr-8 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
      </div>
      {isCA && (
        <p className="mt-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-[#059669]">
          CA Mode
        </p>
      )}
    </div>
  )
}

function BalanceCheckWidget() {
  const { engineResult } = useCurrentForecast()
  const months = engineResult?.rawIntegrationResults ?? []
  const lastMonth = months[months.length - 1]
  
  if (!lastMonth) return null

  const balanceDelta = Math.abs(
    (lastMonth.bs.totalAssets ?? 0) -
    ((lastMonth.bs.totalLiabilities ?? 0) + (lastMonth.bs.totalEquity ?? 0))
  )
  const isBalanced = balanceDelta <= 1

  return (
    <div className="mx-3 border-t border-[#E5E7EB] px-1 py-3">
      <div className="balance-check space-y-1">
        <div className="flex items-center gap-1.5">
          <span>P&L → BS</span>
          <span className={isBalanced ? "text-[#059669]" : "text-[#DC2626]"}>
            {isBalanced ? "✓" : "✗"}
          </span>
          <span className="text-[#94A3B8]">•</span>
          <span>A = L + E</span>
          <span className={isBalanced ? "text-[#059669]" : "text-[#DC2626]"}>
            Δ ₹{Math.round(balanceDelta / 100)}
          </span>
        </div>
        <div className="text-[10px] text-[#94A3B8]">
          Paise • {months.length} months
        </div>
      </div>
    </div>
  )
}

function SidebarNav({
  collapsed,
  pathname,
  onNavigate,
  isCA,
}: {
  collapsed: boolean
  pathname: string
  onNavigate?: () => void
  isCA: boolean
}) {
  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const isActive =
        pathname === item.href || pathname.startsWith(item.href + "/")
      const Icon = item.icon

      const link = (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors duration-[80ms]",
            isActive
              ? "bg-[#F1F5F9] text-[#0F172A] font-semibold"
              : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
          )}
        >
          <Icon
            className={cn(
              "h-[16px] w-[16px] shrink-0",
              isActive
                ? "text-[#059669]"
                : "text-[#94A3B8] group-hover:text-[#475569]"
            )}
          />
          {!collapsed && (
            <span className="sidebar-transition truncate">{item.label}</span>
          )}
        </Link>
      )

      if (collapsed) {
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger>{link}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        )
      }

      return link
    })

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 thin-scrollbar">
      {isCA && (
        <>
          {renderItems(caPrimaryNav)}
          <div className="my-3 border-t border-[#E5E7EB]" />
        </>
      )}
      {renderItems(mainNav)}
    </nav>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    sidebarCollapsed,
    toggleSidebar,
  } = useUIStore()

  const isCA = useCompanyStore((s) => s.isCA())

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sidebar-transition fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-[#E5E7EB] bg-[#F8FAFC] lg:flex",
          sidebarCollapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b border-[#E5E7EB] px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#059669] text-white">
            <IndianRupee className="h-4 w-4" />
          </div>
          {!sidebarCollapsed && (
            <div className="sidebar-transition flex flex-col">
              <span className="text-sm font-bold tracking-tight text-[#0F172A]">
                CashFlowIQ
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-[#94A3B8]">
                {isCA ? "CA Practice" : "Forecasting"}
              </span>
            </div>
          )}
        </div>

        <CompanySwitcher collapsed={sidebarCollapsed} />

        <SidebarNav
          collapsed={sidebarCollapsed}
          pathname={pathname}
          isCA={isCA}
        />

        {/* Balance check — always visible, proof not a feature */}
        {!sidebarCollapsed && <BalanceCheckWidget />}

        {/* Collapse toggle */}
        <div className="border-t border-[#E5E7EB] p-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center gap-2 rounded px-3 py-1.5 text-xs text-[#94A3B8] transition-colors duration-[80ms] hover:bg-[#F1F5F9] hover:text-[#475569]"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[280px] border-[#E5E7EB] bg-[#F8FAFC] p-0 text-[#0F172A] sm:max-w-[280px]"
        >
          <SheetHeader className="border-b border-[#E5E7EB] px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#059669] text-white">
                <IndianRupee className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                <SheetTitle className="text-sm font-bold tracking-tight text-[#0F172A]">
                  CashFlowIQ
                </SheetTitle>
                <span className="text-[10px] font-medium uppercase tracking-widest text-[#94A3B8]">
                  {isCA ? "CA Practice" : "Forecasting"}
                </span>
              </div>
            </div>
          </SheetHeader>
          <CompanySwitcher collapsed={false} />
          <SidebarNav
            collapsed={false}
            pathname={pathname}
            isCA={isCA}
            onNavigate={() => setMobileSidebarOpen(false)}
          />
          <BalanceCheckWidget />
        </SheetContent>
      </Sheet>
    </>
  )
}
