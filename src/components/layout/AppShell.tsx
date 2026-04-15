"use client"

import { useUIStore } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import { AppSidebar } from "./AppSidebar"
import { AppTopbar } from "./AppTopbar"
import { UserTypeModal, useUserType } from "@/components/shared/UserTypeModal"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore()
  const { userType, hasChecked, selectType } = useUserType()

  return (
    <div className="relative flex min-h-screen">
      <AppSidebar />
      <div
        className={cn(
          "sidebar-transition relative z-10 flex flex-1 flex-col",
          "lg:ml-[240px]",
          sidebarCollapsed && "lg:ml-[64px]"
        )}
      >
        <AppTopbar />
        <main className="mt-14 flex-1 px-4 py-5 page-transition sm:px-5 sm:py-5 lg:px-6">
          {children}
        </main>
      </div>

      {/* Show user type modal on first login */}
      {hasChecked && !userType && (
        <UserTypeModal onSelect={selectType} />
      )}
    </div>
  )
}
