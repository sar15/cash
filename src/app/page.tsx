import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Factory,
  IndianRupee,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  GitCompareArrows,
  ClipboardCheck,
} from 'lucide-react'

export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A] selection:bg-[#2563EB] selection:text-white">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] shadow-sm">
              <IndianRupee className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-[#0F172A]">CashFlowIQ</span>
              <span className="ml-2 hidden text-[10px] font-medium uppercase tracking-[0.2em] text-[#64748B] sm:inline">
                Financial Operations
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm font-medium text-[#64748B] hover:text-[#0F172A]">
              Sign in
            </Link>
            <Link href="/sign-up"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0F172A] px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02]">
              Start free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white px-6 py-24 lg:py-32 border-b border-[#E2E8F0]">
        {/* Subtle grid background */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#F1F5F9_1px,transparent_1px),linear-gradient(to_bottom,#F1F5F9_1px,transparent_1px)] bg-[size:32px_32px] opacity-60" />
        
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-1.5 text-xs font-semibold text-[#2563EB]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3B82F6] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2563EB]"></span>
            </span>
            Built for Indian SMEs & CAs
          </div>

          <h1 className="mt-8 text-5xl font-bold tracking-tight text-[#0F172A] sm:text-7xl leading-[1.1]">
            Financial clarity <br />
            <span className="text-[#94A3B8]">without the chaos.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#64748B]">
            Upload your P&L and Balance Sheet. Get a 12-month three-way forecast with GST, TDS, and PF compliance auto-calculated in seconds. Stop guessing your cash flow.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[#1D4ED8] hover:shadow-[0_0_24px_rgba(37,99,235,0.4)]">
              Start your forecast
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/sign-up?demo=1"
              className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-8 py-3.5 text-sm font-semibold text-[#0F172A] shadow-sm transition-all hover:bg-[#F8FAFC]">
              Explore sample data
            </Link>
          </div>
        </div>

        {/* Mock dashboard preview */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-b from-[#2563EB]/20 to-transparent blur-2xl" />
          <div className="relative overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_20px_40px_-12px_rgba(15,23,42,0.1)]">
            
            <div className="flex h-12 items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#E2E8F0]" />
                  <div className="h-3 w-3 rounded-full bg-[#E2E8F0]" />
                  <div className="h-3 w-3 rounded-full bg-[#E2E8F0]" />
                </div>
                <div className="h-4 w-64 rounded bg-[#E2E8F0]" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 p-6 bg-[#F8FAFC]">
              {[
                { label: 'Cash Runway', value: '14.2m', highlight: true },
                { label: 'Net Position', value: '₹42.1L', highlight: false },
                { label: 'Burn Rate', value: '₹3.1L', highlight: false },
                { label: 'Current Ratio', value: '2.4', highlight: false },
              ].map((m, i) => (
                <div key={i} className={`rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm ${m.highlight ? 'ring-2 ring-[#2563EB] ring-offset-2' : ''}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B]">{m.label}</p>
                  <p className={`mt-2 font-mono text-2xl font-semibold tracking-tight ${m.highlight ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{m.value}</p>
                </div>
              ))}
            </div>
            
            <div className="border-t border-[#E2E8F0] bg-white p-6">
              <div className="h-[200px] w-full flex items-end gap-2">
                {[45, 55, 65, 80, 95, 85, 75, 90, 100, 85, 70, 60].map((h, i) => (
                  <div key={i} className="relative flex-1 group">
                    <div className="absolute bottom-full mb-2 hidden w-full justify-center group-hover:flex">
                      <span className="rounded bg-[#0F172A] px-2 py-1 text-[10px] text-white">Month {i+1}</span>
                    </div>
                    <div className="rounded-t-sm transition-all duration-300 hover:bg-[#2563EB]" style={{ height: `${h}%`, backgroundColor: h >= 80 ? '#2563EB' : '#94A3B8' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-[#F8FAFC] py-24 border-b border-[#E2E8F0]">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
             <h2 className="text-3xl font-bold tracking-tight text-[#0F172A]">Engineered for exactness.</h2>
             <p className="mt-4 text-lg text-[#64748B]">Automated compliance bounds and Schedule III alignments natively integrated.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: BarChart3,
                title: '3-Way Deep Sync',
                body: 'P&L, Balance Sheet, and Cash Flow permanently bound to India-standard logic routines.',
              },
              {
                icon: GitCompareArrows,
                title: 'N-Tier Scenarios',
                body: 'Spin off parallel dimensions. Test assumptions against infinite baselines instantly.',
              },
              {
                icon: ClipboardCheck,
                title: 'Compliance Layer',
                body: 'Embedded GST, TDS, Setup rules running invisibly under every cell of data.',
              },
              {
                icon: TrendingUp,
                title: 'Dynamic Workflows',
                body: 'Insert loans, hires, asset purchases, and watch 250 rows recalibrate in real time.',
              },
              {
                icon: ShieldCheck,
                title: 'Surgical Accuracy',
                body: 'No approximations. Actual double-entry math backing every single forecast projection.',
              },
              {
                icon: IndianRupee,
                title: 'Native Formatting',
                body: 'Lakhs, Crores, April-March FY bounds — an interface meant for India-first operations.',
              },
            ].map((f) => (
               <div key={f.title} className="group rounded-xl border border-[#E2E8F0] bg-white p-8 transition-shadow hover:shadow-md">
                 <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#2563EB] group-hover:bg-[#EFF6FF]">
                   <f.icon className="h-5 w-5" />
                 </div>
                 <h3 className="text-lg font-semibold text-[#0F172A]">{f.title}</h3>
                 <p className="mt-2 text-sm leading-6 text-[#64748B]">{f.body}</p>
               </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Whom ── */}
      <section className="bg-white py-24 border-b border-[#E2E8F0]">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F172A] text-white">
                <Factory className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-[#0F172A]">Operators & Founders</h3>
              <p className="mt-4 text-[#64748B] leading-relaxed">
                Skip the spreadsheet engineering. Understand burn-rate instantly, drag-and-drop new employee scenarios, and see EXACTLY what week your reserve hits critical.
              </p>
              <ul className="mt-8 space-y-4">
                {['Instantly parse runway capacity', 'Model micro-events (hiring, loans)', 'Prevent blindside tax liabilities'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium text-[#475569]">
                    <CheckCircle2 className="h-4 w-4 text-[#2563EB]" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2563EB] text-white">
                <BriefcaseBusiness className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-[#0F172A]">CFOs & CAs</h3>
              <p className="mt-4 text-[#64748B] leading-relaxed">
                Scale your advisory wing. Manage infinite client bases via segmented portfolio modes, cross-check total compliance load, and generate highly branded, sterile PDF reports.
              </p>
              <ul className="mt-8 space-y-4">
                {['Multi-client portfolio tracking', 'Cross-ledger compliance syncing', 'Board-ready aesthetic exports'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium text-[#475569]">
                    <CheckCircle2 className="h-4 w-4 text-[#2563EB]" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[#0F172A] py-24 text-center">
        <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Take control of your data.</h2>
        <p className="mx-auto mt-4 max-w-xl text-[#94A3B8]">Deploy world-class financial projections instantly without writing a single spreadsheet formula.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/sign-up" className="rounded-md bg-[#2563EB] px-8 py-3.5 font-semibold text-white transition-colors hover:bg-[#1D4ED8]">
            Get Started
          </Link>
          <Link href="/sign-up?demo=1" className="rounded-md border border-white/20 bg-white/5 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-white/10">
            View Sample Book
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white py-10 border-t border-[#E2E8F0]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#0F172A]">
              <IndianRupee className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#0F172A]">CashFlowIQ</span>
          </div>
          <p className="text-xs text-[#94A3B8]">© {new Date().getFullYear()} CashFlowIQ Inc.</p>
        </div>
      </footer>
    </main>
  )
}
