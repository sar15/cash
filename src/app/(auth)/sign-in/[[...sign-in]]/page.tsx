import { SignIn } from "@clerk/nextjs"
import Link from "next/link"
import { IndianRupee, TrendingUp, ShieldCheck, BarChart3 } from "lucide-react"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen bg-[#FCFCFD]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:justify-between bg-[#0F172A] p-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#059669]">
              <IndianRupee className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">CashFlowIQ</span>
          </div>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#475569]">
            Built for Indian businesses
          </p>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-semibold leading-tight text-white">
              Know your cash.<br />
              Plan your future.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#64748B]">
              Three-way integrated forecasting with GST, TDS, and PF/ESI compliance built in. 
              Upload your P&L and see 12 months of cash flow in minutes.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: BarChart3, text: 'P&L → Balance Sheet → Cash Flow, always balanced' },
              { icon: TrendingUp, text: 'Scenario modeling with real engine runs per scenario' },
              { icon: ShieldCheck, text: 'GST, TDS, PF/ESI compliance calendar with shortfall alerts' },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#059669]/10">
                  <item.icon className="h-3.5 w-3.5 text-[#059669]" />
                </div>
                <p className="text-sm text-[#94A3B8]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#334155]">
          © {new Date().getFullYear()} CashFlowIQ · For Indian SMEs & CAs
        </p>
      </div>

      {/* Right panel — auth */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#059669]">
              <IndianRupee className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-[#0F172A]">CashFlowIQ</span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[#0F172A]">Welcome back</h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Sign in to your account to continue forecasting.
            </p>
          </div>

          <SignIn
            fallbackRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 p-0 bg-transparent",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC] rounded-md h-10 text-sm font-medium",
                dividerLine: "bg-[#E5E7EB]",
                dividerText: "text-[#94A3B8] text-xs",
                formFieldLabel: "text-xs font-semibold uppercase tracking-[0.12em] text-[#475569]",
                formFieldInput: "border-[#E5E7EB] bg-white text-[#0F172A] rounded-md h-10 text-sm focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20",
                formButtonPrimary: "bg-[#0F172A] hover:bg-[#1E293B] rounded-md h-10 text-sm font-semibold",
                footerActionLink: "text-[#059669] hover:text-[#047857] font-medium",
                identityPreviewText: "text-[#0F172A]",
                identityPreviewEditButton: "text-[#059669]",
              },
            }}
          />

          <p className="mt-6 text-center text-sm text-[#94A3B8]">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="font-medium text-[#059669] hover:text-[#047857]">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
