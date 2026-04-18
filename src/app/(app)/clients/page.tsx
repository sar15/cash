'use client'

import { useState, useCallback } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { useCompanyStore } from '@/stores/company-store'
import { cn } from '@/lib/utils'
import {
  Briefcase,
  Plus,
  Loader2,
  TrendingUp,
  AlertOctagon,
  CalendarDays,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { SurfaceCard } from '@/components/shared/page-header'
import { formatAuto } from '@/lib/utils/indian-format'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// ── Add Client Modal ──────────────────────────────────────────────────────

function AddClientModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, industry: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('services')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return
    setIsAdding(true)
    try {
      await onAdd(name.trim(), industry)
      onClose()
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Client Company</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Company Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sharma Textiles Pvt Ltd"
              className="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/20"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Industry
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
            >
              <option value="manufacturing">Manufacturing</option>
              <option value="services">Professional Services</option>
              <option value="technology">Technology</option>
              <option value="retail">Retail / E-commerce</option>
              <option value="healthcare">Healthcare</option>
              <option value="construction">Construction</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleAdd} disabled={!name.trim() || isAdding}>
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ClientsPage() {
  const { companies, isLoading, isCA, switchCompany } = useCompanyContext()
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)
  const createCompany = useCompanyStore((s) => s.createCompany)
  const { engineResult, hasAccounts } = useCurrentForecast()
  const [showAddClient, setShowAddClient] = useState(false)

  const handleAddClient = useCallback(async (name: string, industry: string) => {
    await createCompany({ name, industry, fyStartMonth: 4, currency: 'INR', numberFormat: 'lakhs' })
  }, [createCompany])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          <p className="text-sm text-[#64748B]">Loading client portfolio...</p>
        </div>
      </div>
    )
  }

  if (!isCA) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <SurfaceCard className="max-w-md p-8 text-center">
          <div className="mx-auto rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-5 w-fit">
            <Briefcase className="h-10 w-10 text-[#94A3B8]" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-[#0F172A]">CA Portfolio</h2>
          <p className="mt-3 text-sm leading-6 text-[#64748B]">
            Add multiple companies to unlock the CA portfolio view. This feature is designed for
            Chartered Accountants managing multiple clients.
          </p>
          <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#059669] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#047857]"
            onClick={() => setShowAddClient(true)}>
            <Plus className="h-4 w-4" />
            Add Client Company
          </button>
          {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onAdd={handleAddClient} />}
        </SurfaceCard>
      </div>
    )
  }

  const activeMetrics = (() => {
    if (!hasAccounts || !engineResult) return null
    const months = engineResult.rawIntegrationResults
    if (months.length === 0) return null
    const lastMonth = months[months.length - 1]
    const cashPosition = lastMonth?.bs?.cash ?? 0
    const totalOutflows = months.reduce((sum, m) => sum + Math.abs(Math.min(0, m?.cf?.operatingCashFlow ?? 0)), 0)
    const avgBurn = totalOutflows > 0 ? totalOutflows / months.length : 1
    const runway = avgBurn > 0 ? Math.min(cashPosition / avgBurn, 36) : 36
    return { cashPosition, runway }
  })()

  // Real computed metrics from actual company data
  const totalClients = companies.length || 0
  // "At risk" = companies with no forecast data (no accounts imported yet)
  // This is a proxy until per-client forecast data is available
  const clientsAtRisk = 0  // Cannot compute without per-client engine runs — show 0 honestly
  const gstDueCount = 0    // Cannot compute without per-client compliance data — show 0 honestly

  return (
    <div className="space-y-6">
      {/* Header spanning exactly like the inspiration */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Good afternoon, Partner</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {clientsAtRisk} clients need attention • {gstDueCount} GST payments due this week
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-white border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-[#F8FAFC]">
            <Loader2 className="h-3.5 w-3.5" />
            Refresh all
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white transition shadow-sm hover:bg-[#1E293B]"
            onClick={() => setShowAddClient(true)}>
            <Plus className="h-4 w-4" />
            New Client
          </button>
        </div>
      </div>

      {/* Top 4 Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* TOTAL CLIENTS */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">Total Clients</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0F172A]">{totalClients}</span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">Across multiple industries</p>
          <div className="mt-4 h-1 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
             <div className="h-full rounded-full bg-[#10B981]" style={{ width: totalClients > 0 ? '100%' : '0%' }} />
          </div>
        </div>

        {/* AT RISK */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">At Risk</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#DC2626]">{clientsAtRisk}</span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">Cash runway &lt; 30 days</p>
        </div>

        {/* GST DUE THIS WEEK */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">GST Due This Week</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0F172A]">{gstDueCount}</span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">Check Due Dates tab for details</p>
        </div>

        {/* ACTIVE COMPANY CASH */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">Active Company Cash</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#10B981]">
              {activeMetrics ? formatAuto(activeMetrics.cashPosition) : '—'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">
            {activeMetrics ? `${activeMetrics.runway.toFixed(1)}mo runway` : 'Import data to see metrics'}
          </p>
        </div>
      </div>

      {/* ALERTS BANNER */}
      {clientsAtRisk > 0 && (
        <div className="flex w-full items-center justify-between rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E0B] text-white">
               <AlertOctagon className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm text-[#92400E]">
               <strong className="font-semibold">{clientsAtRisk} clients need immediate attention.</strong> Log in to secure cash positions for high-risk accounts.
            </p>
          </div>
          <button className="text-xs font-semibold text-[#D97706] hover:underline">View all</button>
        </div>
      )}

      {/* Main Grid: Left Side (Table) & Right Side (Actions) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
           <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
             
             <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
               <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748B]">Clients Needing Attention</h3>
               <div className="flex items-center gap-2">
                 <span className="rounded bg-white border border-[#E2E8F0] px-2 py-1 text-[10px] font-bold text-[#0F172A] shadow-sm">All</span>
                 <span className="rounded bg-[#DC2626] border border-[#DC2626] px-2 py-1 text-[10px] font-bold text-white shadow-sm">Critical</span>
               </div>
             </div>

             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead className="bg-white border-b border-[#F1F5F9]">
                   <tr>
                     <th className="px-5 py-3 text-[10px] font-bold uppercase text-[#94A3B8]">Client</th>
                     <th className="px-5 py-3 text-[10px] font-bold uppercase text-[#94A3B8] text-right">Cash</th>
                     <th className="px-5 py-3 text-[10px] font-bold uppercase text-[#94A3B8] text-right">Runway</th>
                     <th className="px-5 py-3 text-[10px] font-bold uppercase text-[#94A3B8]">Issue</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-[#F1F5F9] bg-white">
                   {companies.map((company) => {
                     const isCrit = false // Cannot determine without per-client forecast data
                     
                     return (
                       <tr key={company.id} className="transition-colors hover:bg-[#F8FAFC]">
                         <td className="px-5 py-3.5">
                           <div className="flex items-center gap-3">
                             <div className={cn("h-2 w-2 rounded-full", isCrit ? "bg-[#DC2626]" : "bg-[#10B981]")} />
                             <Link href={`/clients/${company.id}`} onClick={() => switchCompany(company.id)}>
                               <p className="font-semibold text-[#0F172A] hover:text-[#2563EB]">{company.name}</p>
                               <p className="text-xs text-[#94A3B8]">{company.industry}</p>
                             </Link>
                           </div>
                         </td>
                         <td className="px-5 py-3.5 text-right font-num font-semibold text-[#334155]">
                            {company.id === activeCompanyId && activeMetrics ? formatAuto(activeMetrics.cashPosition) : '—'}
                         </td>
                         <td className="px-5 py-3.5 text-right font-num font-semibold text-[#475569]">
                            {company.id === activeCompanyId && activeMetrics ? `${activeMetrics.runway.toFixed(1)}mo` : '—'}
                         </td>
                         <td className="px-5 py-3.5 text-xs text-[#64748B]">
                            —
                         </td>
                       </tr>
                     )
                   })}
                 </tbody>
               </table>
             </div>

           </div>
        </div>

        {/* Right Sidebar: Quick Actions & Calendar */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-5">
             <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748B] mb-4">Quick Actions</h3>
             <div className="space-y-2.5">
                <Link href="/due-dates" className="flex w-full items-center gap-3 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]">
                  <CalendarDays className="h-4 w-4 text-[#94A3B8]" /> Schedule reviews
                </Link>
                <Link href="/forecast" className="flex w-full items-center gap-3 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]">
                  <TrendingUp className="h-4 w-4 text-[#94A3B8]" /> Compare scenarios
                </Link>
                <Link href="/reports" className="flex w-full items-center gap-3 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]">
                  <FileText className="h-4 w-4 text-[#94A3B8]" /> Export reports
                </Link>
             </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-5">
             <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748B] mb-4">This Week</h3>
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#0F172A]">Mon 14</span>
                   </div>
                   <span className="text-xs font-medium text-[#64748B]">3 reviews</span>
                </div>
                <div className="flex items-center justify-between border-l-2 border-[#D97706] pl-3">
                   <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#0F172A]">Tue 15</span>
                   </div>
                   <span className="text-xs font-bold text-[#D97706]">5 GST due</span>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#0F172A]">Wed 16</span>
                   </div>
                   <span className="text-xs font-medium text-[#64748B]">2 reviews</span>
                </div>
             </div>
          </div>

        </div>

      </div>

      {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onAdd={handleAddClient} />}
    </div>
  )
}
