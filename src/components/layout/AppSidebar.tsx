"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui-store"
import { useCompanyStore } from "@/stores/company-store"
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
  GitCompareArrows,
  CalendarClock,
  Briefcase,
  ChevronDown,
  IndianRupee,
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
}

const caPrimaryNav: NavItem[] = [
  { label: "Portfolio", href: "/clients", icon: Briefcase },
  { label: "Due Dates", href: "/due-dates", icon: CalendarClock },
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

  if (!activeCompany || companies.length <= 1) return null

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <div className="mx-auto my-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[#0F172A] text-xs font-bold text-white">
            {activeCompany.name.charAt(0)}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{activeCompany.name}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="px-3 py-2">
      <div className="relative">
        <select
          value={activeCompany.id}
          onChange={(e) => setActiveCompany(e.target.value)}
          className="w-full appearance-none rounded-lg border border-[#E2E8F0] bg-white py-2 pl-3 pr-8 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/10 transition-colors"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
      </div>
    </div>
  )
}

function NavItems({
  items,
  collapsed,
  pathname,
  onNavigate,
}: {
  items: NavItem[]
  collapsed: boolean
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
        const Icon = item.icon

        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-75",
              collapsed && "justify-center px-2",
              isActive
                ? "bg-[#0F172A] text-white"
                : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-[#94A3B8] group-hover:text-[#0F172A]")} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        )

        if (collapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger>{link}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
            </Tooltip>
          )
        }

        return link
      })}
    </>
  )
}

function SidebarContent({
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
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 thin-scrollbar">
      {isCA && (
        <>
          {!collapsed && (
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">CA Practice</p>
          )}
          <NavItems items={caPrimaryNav} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />
          <div className="my-3 mx-1 h-px bg-[#E2E8F0]" />
        </>
      )}
      {!collapsed && (
        <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">
          {isCA ? "Workspace" : "Navigation"}
        </p>
      )}
      <NavItems items={mainNav} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />
    </nav>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { mobileSidebarOpen, setMobileSidebarOpen, sidebarCollapsed, toggleSidebar } = useUIStore()
  const isCA = useCompanyStore((s) => s.isCA())
  const { userType } = useUserType()
  const showCAFeatures = isCA || userType === "ca_firm"

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sidebar-transition fixed left-0 top-14 z-20 hidden h-[calc(100vh-56px)] flex-col border-r border-[#E2E8F0] bg-white lg:flex",
          sidebarCollapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {/* Logo area */}
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 border-b border-[#E2E8F0] px-4 py-3.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0F172A]">
              <IndianRupee className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-[#0F172A]">CashFlowIQ</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#94A3B8]">Financial Operations</p>
            </div>
          </div>
        )}

        <CompanySwitcher collapsed={sidebarCollapsed} />

        <SidebarContent collapsed={sidebarCollapsed} pathname={pathname} isCA={showCAFeatures} />

        {/* Collapse toggle */}
        <div className="border-t border-[#E2E8F0] p-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#94A3B8] transition-colors duration-75 hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[280px] border-[#E2E8F0] bg-white p-0 sm:max-w-[280px]">
          <SheetHeader className="border-b border-[#E2E8F0] px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0F172A]">
                <IndianRupee className="h-3.5 w-3.5 text-white" />
              </div>
              <SheetTitle className="text-sm font-bold tracking-tight text-[#0F172A]">CashFlowIQ</SheetTitle>
            </div>
          </SheetHeader>
          <CompanySwitcher collapsed={false} />
          <SidebarContent
            collapsed={false}
            pathname={pathname}
            isCA={showCAFeatures}
            onNavigate={() => setMobileSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
