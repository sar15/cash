import { BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-emerald-500/30">
      <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white hover:text-emerald-400">CashFlowIQ</span>
          </div>
          <nav className="hidden gap-6 sm:flex">
            <Link href="#features" className="text-sm font-medium text-slate-300 hover:text-white">Features</Link>
            <Link href="#benefits" className="text-sm font-medium text-slate-300 hover:text-white">Benefits</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm font-medium text-slate-300 hover:text-white">
              Log in
            </Link>
            <Link href="/sign-up" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-emerald-500" />
              <span className="text-lg font-bold text-white">CashFlowIQ</span>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} CashFlowIQ Inc. All rights reserved. Built for Indian SMEs & CAs.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
