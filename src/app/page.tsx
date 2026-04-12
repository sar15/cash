import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Factory,
  IndianRupee,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.12),_transparent_38%),linear-gradient(180deg,_#f8fbfb_0%,_#ffffff_48%,_#f7f9fb_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6 sm:px-8">
        <header className="flex items-center justify-between py-4">
          <div>
            <div className="text-lg font-semibold tracking-tight">CashFlowIQ</div>
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Built for Indian businesses
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Start Free Forecast
            </Link>
          </div>
        </header>

        <section className="grid flex-1 gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
              <Sparkles className="h-3.5 w-3.5" />
              3-statement forecasting
            </div>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Stop Guessing Your Cash Flow
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              3-statement integrated forecasting for Indian businesses
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Start Free Forecast
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              No credit card. Upload your Excel. See your forecast in 2 minutes.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top_right,_rgba(15,118,110,0.16),_transparent_40%)]" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_100px_-48px_rgba(15,23,42,0.5)]">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Cash on Hand', '₹6.4L', 'Healthy'],
                  ['Net Cash Flow', '(₹1.8L)', 'Watch'],
                  ['Working Capital Gap', '₹12.5L', 'Alert'],
                  ['Gross Margin', '24.2%', 'Stable'],
                ].map(([label, value, state]) => (
                  <div key={label} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
                    <div className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{state}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-3xl border border-slate-200 px-5 py-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Compliance-aware alerts
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                    Cash drops below ₹5L in October before GST clears.
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
                    Working capital gap is closing across the plan.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Features</div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              {
                title: 'Three-Way Forecast',
                body: 'P&L, Balance Sheet, Cash Flow that always balance',
                icon: BarChart3,
              },
              {
                title: 'Event-Based Planning',
                body: 'Model hires, purchases, loans, new clients',
                icon: IndianRupee,
              },
              {
                title: 'Compliance Aware',
                body: 'GST, TDS, Advance Tax due dates with cash impact',
                icon: ShieldCheck,
              },
            ].map((feature) => (
              <article key={feature.title} className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-6 shadow-sm">
                <feature.icon className="h-6 w-6 text-emerald-700" />
                <h2 className="mt-4 text-xl font-semibold">{feature.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-10">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">For Whom</div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'SME Owners',
                body: "Know if you can pay next month's bills",
                icon: Factory,
              },
              {
                title: 'Startup Founders',
                body: 'Track runway and plan fundraising',
                icon: BriefcaseBusiness,
              },
              {
                title: 'Chartered Accountants',
                body: 'Deliver advisory reports in minutes',
                icon: ShieldCheck,
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
                <item.icon className="h-5 w-5 text-slate-900" />
                <div className="mt-4 text-lg font-semibold">{item.title}</div>
                <div className="mt-2 text-sm text-slate-600">{item.body}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-auto flex flex-col gap-3 border-t border-slate-200 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>Built for Indian businesses</div>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy policy
          </Link>
        </footer>
      </div>
    </main>
  );
}
