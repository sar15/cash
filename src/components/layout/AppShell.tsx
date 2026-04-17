"use client"

import { useUIStore } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import { AppSidebar } from "./AppSidebar"
import { AppTopbar } from "./AppTopbar"
import { UserTypeModal, useUserType } from "@/components/shared/UserTypeModal"
import { useProfileStore } from "@/stores/profile-store"
import { useCompanyStore } from "@/stores/company-store"
import { CreateCompanyModal } from "@/components/shared/CreateCompanyModal"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore()
  const { userType, hasChecked, selectType } = useUserType()
  const profile = useProfileStore((s) => s.profile)
  const companies = useCompanyStore((s) => s.companies)
  const companiesLoading = useCompanyStore((s) => s.isLoading)
  const companiesError = useCompanyStore((s) => s.error)

  // Show create company modal when: loaded, no companies, and not still loading
  const showCreateCompany = !companiesLoading && companies.length === 0 && hasChecked && !!profile && !companiesError

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
          {companiesError && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
              <svg className="h-4 w-4 shrink-0 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-[#991B1B]">
                Could not load your workspace. <button onClick={() => window.location.reload()} className="font-semibold underline">Refresh to try again.</button>
              </p>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Show user type modal only on first login — requires profile to be loaded */}
      {hasChecked && profile && (profile.onboardingCompleted === false || !userType) && (
        <UserTypeModal onSelect={selectType} />
      )}

      {/* Show create company modal when user has no companies */}
      {showCreateCompany && <CreateCompanyModal />}
    </div>
  )
}
