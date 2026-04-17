import { SignIn } from "@clerk/nextjs"
import Link from "next/link"
import { IndianRupee } from "lucide-react"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:justify-between border-r border-[#E2E8F0] bg-[#F8FAFC] p-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A]">
            <IndianRupee className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-[#0F172A]">CashFlowIQ</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#64748B]">Financial Operations</span>
        </div>

        <div className="space-y-10">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-[#0F172A] leading-[1.1]">
              Know your cash.<br />
              <span className="text-[#94A3B8]">Plan your future.</span>
            </h2>
            <p className="mt-4 text-base leading-7 text-[#64748B]">
              Three-way integrated forecasting with GST, TDS, and PF/ESI compliance built in.
            </p>
          </div>

          <div className="space-y-4">
            {[
              'P&L → Balance Sheet → Cash Flow, always balanced',
              'Scenario modeling with real engine runs',
              'GST, TDS, PF/ESI compliance calendar',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
                <p className="text-sm text-[#475569]">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#94A3B8]">© {new Date().getFullYear()} CashFlowIQ · For Indian SMEs & CAs</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0F172A]">
              <IndianRupee className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-[#0F172A]">CashFlowIQ</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Welcome back</h1>
            <p className="mt-1.5 text-sm text-[#64748B]">Sign in to continue forecasting.</p>
          </div>

          <SignIn
            fallbackRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 p-0 bg-transparent",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "w-full border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC] rounded-lg h-10 text-sm font-medium transition-colors duration-75",
                socialButtonsBlockButtonText: "font-medium",
                dividerLine: "bg-[#E2E8F0]",
                dividerText: "text-[#94A3B8] text-xs bg-white px-2",
                formFieldLabel: "text-xs font-semibold text-[#374151] mb-1.5",
                formFieldInput: "w-full border border-[#E2E8F0] bg-white text-[#0F172A] rounded-lg h-10 px-3 text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 outline-none transition-colors",
                formButtonPrimary: "w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg h-10 text-sm font-semibold transition-colors duration-75 shadow-sm",
                footerActionLink: "text-[#2563EB] hover:text-[#1D4ED8] font-medium",
                identityPreviewText: "text-[#0F172A] text-sm",
                identityPreviewEditButton: "text-[#2563EB]",
                formFieldErrorText: "text-[#DC2626] text-xs mt-1",
                alertText: "text-sm",
                alert: "rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3",
              },
            }}
          />

          <p className="mt-6 text-center text-sm text-[#94A3B8]">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="font-semibold text-[#2563EB] hover:text-[#1D4ED8]">
              Start free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
