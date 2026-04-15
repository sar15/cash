import { AppShell } from "@/components/layout/AppShell"
import { Toast } from "@/components/shared/Toast"
import { ErrorBoundary } from "@/components/shared/ErrorBoundary"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <Toast />
    </AppShell>
  )
}
