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
  X,
  TrendingUp,
  AlertOctagon,
  CalendarDays,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { SurfaceCard } from '@/components/shared/page-header'
import { formatAuto } from '@/lib/utils/indian-format'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0F172A]">Add Client Company</h2>
          <button onClick={onClose} className="rounded p-1 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#475569]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">Company Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Textiles Pvt Ltd"
              className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20" autoFocus />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">Industry</label>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none">
              <option value="manufacturing">Manufacturing</option>
              <option value="services">Professional Services</option>
              <option value="technology">Technology</option>
              <option value="retail">Retail / E-commerce</option>
              <option value="healthcare">Healthcare</option>
              <option value="construction">Construction</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button onClick={handleAdd} disabled={!name.trim() || isAdding}
            className="w-full rounded-lg bg-[#059669] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-40">
            {isAdding ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
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

  // Mock global data for the pro dashboard design
  const totalClients = companies.length || 0
  const clientsAtRisk = totalClients > 0 ? Math.floor(totalClients * 0.2) + 1 : 0
  const gstDueCount = totalClients > 0 ? Math.floor(totalClients * 0.4) : 0

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
            <span className="inline-flex items-center rounded bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#059669]">
              ↑ 2 New
            </span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">Across multiple industries</p>
          <div className="mt-4 h-1 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
             <div className="h-full w-3/4 rounded-full bg-[#10B981]" />
          </div>
        </div>

        {/* AT RISK */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">At Risk</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#DC2626]">{clientsAtRisk}</span>
            <span className="inline-flex items-center rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[10px] font-bold text-[#DC2626]">
              ↑ 1
            </span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">Cash runway &lt; 30 days</p>
          <div className="mt-4 h-1 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
             <div className="h-full w-1/4 rounded-full bg-[#DC2626]" />
          </div>
        </div>

        {/* GST DUE THIS WEEK */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">GST Due This Week</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0F172A]">{gstDueCount}</span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">Action required by 20th</p>
        </div>

        {/* AVG HEALTH SCORE */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">Avg Health Score</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#10B981]">82<span className="text-sm text-[#94A3B8] font-medium">/100</span></span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">↑ 4 points vs last month</p>
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
                   {companies.map((company, index) => {
                     const isCrit = index < clientsAtRisk
                     // Use a stable seed based on index to avoid impure Math.random() during render
                     const runwayDisplay = isCrit ? `${((index % 3) * 0.7 + 0.3).toFixed(1)}m` : '8.4m'
                     
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
                            {company.id === activeCompanyId && activeMetrics ? formatAuto(activeMetrics.cashPosition) : `₹${(index % 9) * 10 + 10}.0L`}
                         </td>
                         <td className={cn("px-5 py-3.5 text-right font-num font-semibold", isCrit ? "text-[#DC2626]" : "text-[#475569]")}>
                            {runwayDisplay}
                         </td>
                         <td className="px-5 py-3.5 text-xs text-[#64748B]">
                            {isCrit ? 'Critical cash buffer' : '—'}
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
                <button className="flex w-full items-center gap-3 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]">
                  <CalendarDays className="h-4 w-4 text-[#94A3B8]" /> Schedule reviews
                </button>
                <button className="flex w-full items-center gap-3 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]">
                  <TrendingUp className="h-4 w-4 text-[#94A3B8]" /> Compare scenarios
                </button>
                <button className="flex w-full items-center gap-3 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]">
                  <FileText className="h-4 w-4 text-[#94A3B8]" /> Export reports
                </button>
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
