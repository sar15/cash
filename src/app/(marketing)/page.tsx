import Link from 'next/link'
import { ArrowRight, CheckCircle2, BarChart2, ShieldCheck, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-950 to-slate-950" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              The next generation of SME forecasting is here
            </div>
            
            <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
              Understand your cash flow.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Model the future.</span>
            </h1>
            
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              Stop surviving on spreadsheets. CashFlowIQ gives Indian SMEs and CAs dynamic, intelligent financial 
              forecasting, automatic GST & TDS compliance calendars, and powerful scenario modeling.
            </p>
            
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/sign-up" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 px-8 text-sm font-semibold text-white transition-all hover:bg-emerald-500 hover:scale-105 active:scale-95">
                Start your free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#features" className="inline-flex h-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-8 text-sm font-semibold text-white transition-all hover:bg-slate-800">
                How it works
              </Link>
            </div>
          </div>

          {/* Simple App Preview */}
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-2 backdrop-blur shadow-2xl">
              <div className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden relative" style={{ aspectRatio: '16/9' }}>
                <div className="absolute inset-0 flex flex-col">
                  {/* Mock Navbar */}
                  <div className="h-12 border-b border-slate-800 flex items-center px-4 gap-4">
                    <div className="w-3 h-3 rounded-full bg-red-500/20" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/20" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/20" />
                    <div className="ml-4 h-4 w-32 rounded bg-slate-800" />
                  </div>
                  {/* Mock Content */}
                  <div className="flex-1 p-8 grid grid-cols-4 gap-6">
                    <div className="col-span-1 space-y-4">
                      <div className="h-24 rounded-lg border border-slate-800 bg-slate-900/50" />
                      <div className="h-24 rounded-lg border border-slate-800 bg-slate-900/50" />
                      <div className="h-24 rounded-lg border border-slate-800 bg-slate-900/50" />
                    </div>
                    <div className="col-span-3 rounded-lg border border-slate-800 bg-slate-900/50 p-6 flex flex-col justify-end">
                      {/* Mock Chart Bars */}
                      <div className="flex items-end gap-4 h-48">
                        {[40, 60, 45, 80, 50, 90, 75, 110].map((h, i) => (
                          <div key={i} className="w-full bg-emerald-500/20 rounded-t-sm border-t border-emerald-500/50" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section id="features" className="py-24 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-white tracking-tight sm:text-4xl">Everything you need to predict cash flow</h2>
            <p className="mt-4 text-slate-400">Not just another dashboard. A robust forecasting engine.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <BarChart2 className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Scenario Modeling</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Automatically run multiple scenarios (Base, Best, Worst) simultaneously and compare cash runways side-by-side with dynamic micro-adjustments.
              </p>
            </div>
            
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <Zap className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Micro-Forecast Events</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                A new hire&apos;s CTC, acquiring a new loan, buying a fixed asset. The engine computes depreciation, interest, EPF, and taxes for you automatically.
              </p>
            </div>
            
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                <ShieldCheck className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Compliance & Tax Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Tired of GST/TDS shock? Our engine derives expected outward/inward tax liabilities from your sales/ops forecasts and generates an interactive compliance due-date calendar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CA Persona Section */}
      <section className="py-24 bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white sm:text-4xl leading-tight">
                Built specifically for Chartered Accountants & Fractional CFOs
              </h2>
              <p className="mt-6 text-lg text-slate-400">
                Switching contexts sucks. Managing deadlines across 50 clients is impossible. 
                Our platform introduces the CA-Persona specifically designed for firms.
              </p>
              
              <ul className="mt-8 space-y-4">
                {[
                  'Multi-tenant Portfolio Dashboard with health indicators',
                  'Aggregated cross-client Due Date Calendars',
                  'Automated email reminders ahead of compliance filings',
                  'Branded PDF report exports under your Firm’s logo'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 opacity-20 blur-xl" />
              <div className="relative rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-700" />
                      <div>
                        <div className="h-4 w-24 rounded bg-slate-600 mb-1" />
                        <div className="h-3 w-32 rounded bg-slate-700" />
                      </div>
                    </div>
                    <div className="h-6 w-16 rounded-full bg-emerald-500/20" />
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-700" />
                      <div>
                        <div className="h-4 w-24 rounded bg-slate-600 mb-1" />
                        <div className="h-3 w-32 rounded bg-slate-700" />
                      </div>
                    </div>
                    <div className="h-6 w-16 rounded-full bg-amber-500/20" />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-700" />
                      <div>
                        <div className="h-4 w-24 rounded bg-slate-600 mb-1" />
                        <div className="h-3 w-32 rounded bg-slate-700" />
                      </div>
                    </div>
                    <div className="h-6 w-16 rounded-full bg-red-500/20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-900/20" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-5xl">Stop guessing. Start forecasting.</h2>
          <p className="mt-6 text-xl text-slate-400">Join top CFOs and founders mastering their runway today.</p>
          <div className="mt-10">
            <Link href="/sign-up" className="inline-flex h-14 items-center justify-center rounded-full bg-emerald-600 px-10 text-lg font-semibold text-white transition-all hover:bg-emerald-500 hover:scale-105 active:scale-95">
              Create an Account
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
