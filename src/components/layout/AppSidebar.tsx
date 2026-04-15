"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui-store"
import { useCompanyStore } from "@/stores/company-store"
import { useCurrentForecast } from "@/hooks/use-current-forecast"
import { useUserType } from "@/components/shared/UserTypeModal"
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
          <div className="mx-auto my-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[#0F172A] text-xs font-bold text-white shadow-sm transition-transform hover:scale-105">
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
    <div className="px-3 py-2">
      <div className="relative">
        <select
          value={activeCompany.id}
          onChange={(e) => setActiveCompany(e.target.value)}
          className="w-full appearance-none rounded-lg border border-[#E2E8F0] bg-white py-2 pl-3 pr-8 text-xs font-semibold text-[#0F172A] shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] transition-all"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id} className="text-[#0F172A]">
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
      </div>
      {isCA && (
        <p className="mt-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[#0F172A]">
          CA Mode · {companies.length} clients
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
      <div className="balance-check space-y-1 text-[#64748B]">
        <div className="flex items-center gap-1.5">
          <span>P&L → BS</span>
          <span className={isBalanced ? "text-[#10B981]" : "text-[#EF4444]"}>
            {isBalanced ? "✓" : "✗"}
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span>A = L + E</span>
          <span className={isBalanced ? "text-[#10B981]" : "text-[#EF4444]"}>
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
            "group relative flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-all duration-[80ms]",
            isActive
              ? "bg-white text-[#0F172A] shadow-sm ring-1 ring-[#E2E8F0]"
              : "text-[#64748B] hover:bg-white/60 hover:text-[#0F172A]"
          )}
        >
          {/* Active left accent */}
          {isActive && (
            <span className="absolute left-0 top-[8px] bottom-[8px] w-[3px] rounded-r-full bg-[#0F172A]" />
          )}
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              isActive ? "text-[#0F172A]" : "text-[#94A3B8] group-hover:text-[#64748B]"
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
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 thin-scrollbar">
      {isCA && (
        <>
          {!collapsed && (
            <p className="mb-1.5 mt-2 px-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">
              CA Practice
            </p>
          )}
          {renderItems(caPrimaryNav)}
          <div className="my-3 mx-3 h-px bg-[#E2E8F0]" />
        </>
      )}
      {!collapsed && (
          <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
          {isCA ? 'Workspace' : 'Navigation'}
        </p>
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
  const { userType } = useUserType()
  // Show CA features if user selected CA type OR has multiple companies
  const showCAFeatures = isCA || userType === 'ca'

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sidebar-transition fixed left-0 top-14 z-20 hidden h-[calc(100vh-56px)] flex-col border-r border-[#E2E8F0] bg-[#F8FAFC] lg:flex",
          sidebarCollapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        <CompanySwitcher collapsed={sidebarCollapsed} />

        <SidebarNav
          collapsed={sidebarCollapsed}
          pathname={pathname}
          isCA={showCAFeatures}
        />

        {/* Balance check — always visible, proof not a feature */}
        {!sidebarCollapsed && <BalanceCheckWidget />}

        {/* Collapse toggle */}
        <div className="border-t border-[#E2E8F0] p-2 bg-[#F1F5F9]">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-[#64748B] transition-colors duration-[80ms] hover:bg-white hover:text-[#0F172A] hover:shadow-sm ring-1 ring-transparent hover:ring-[#E2E8F0]"
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
          className="w-[280px] border-[#0F172A] bg-[#0F172A] p-0 text-white sm:max-w-[280px]"
        >
          <SheetHeader className="border-b border-white/10 px-4 py-4">
            <div className="flex flex-col text-left">
              <SheetTitle className="text-sm font-bold tracking-tight text-white">
                CashFlowIQ
              </SheetTitle>
              <span className="text-[10px] font-medium uppercase tracking-widest text-[#38BDF8]">
                {showCAFeatures ? "CA Practice" : "Forecasting"}
              </span>
            </div>
          </SheetHeader>
          <CompanySwitcher collapsed={false} />
          <SidebarNav
            collapsed={false}
            pathname={pathname}
            isCA={showCAFeatures}
            onNavigate={() => setMobileSidebarOpen(false)}
          />
          <BalanceCheckWidget />
        </SheetContent>
      </Sheet>
    </>
  )
}
