'use client'

import { useState, useEffect } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react'
import { PageHeader, HeaderBadge, SurfaceCard } from '@/components/shared/page-header'
import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'

interface BankReconciliation {
  id: string
  period: string
  status: 'unreconciled' | 'reconciled' | 'variance'
  bookClosingBalancePaise: number | null
  bankClosingBalancePaise: number | null
  variancePaise: number | null
  reconciledAt: string | null
  notes: string | null
}

export default function ReconciliationPage() {
  const { company, companyId } = useCompanyContext()
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([])
  const [isLoading, setIsLoading] = useState(!!companyId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bankBalance, setBankBalance] = useState('')

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/reconciliations?companyId=${companyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { reconciliations?: BankReconciliation[] } | null) => {
        if (data?.reconciliations) setReconciliations(data.reconciliations)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [companyId])

  const handleReconcile = async (reconId: string) => {
    const balancePaise = Math.round(parseFloat(bankBalance) * 100)
    if (isNaN(balancePaise)) return

    try {
      const response = await fetch(`/api/reconciliations/${reconId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankClosingBalancePaise: balancePaise }),
      })

      if (response.ok) {
        const data = await response.json()
        setReconciliations((prev) =>
          prev.map((r) =>
            r.id === reconId
              ? {
                  ...r,
                  bankClosingBalancePaise: balancePaise,
                  variancePaise: data.variancePaise,
                  status: data.status,
                  reconciledAt: new Date().toISOString(),
                }
              : r
          )
        )
        setEditingId(null)
        setBankBalance('')
      }
    } catch (error) {
      console.error('Reconciliation failed:', error)
    }
  }

  const formatPeriod = (period: string) => {
    const date = new Date(period)
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  }

  const summary = {
    total: reconciliations.length,
    reconciled: reconciliations.filter((r) => r.status === 'reconciled').length,
    variance: reconciliations.filter((r) => r.status === 'variance').length,
    unreconciled: reconciliations.filter((r) => r.status === 'unreconciled')
      .length,
    totalVariance: reconciliations.reduce(
      (sum, r) => sum + Math.abs(r.variancePaise ?? 0),
      0
    ),
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          <p className="text-sm text-[#94A3B8]">Loading reconciliations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reconciliation"
        title="Bank Reconciliation"
        description={`Match book balances with bank statements for ${company?.name ?? 'company'}`}
        badges={
          <>
            <HeaderBadge label={`${summary.total} periods`} />
            {summary.variance > 0 && (
              <HeaderBadge
                label={`${summary.variance} with variance`}
                tone="warning"
              />
            )}
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <SurfaceCard>
          <p className="text-xs text-[#94A3B8]">Total Periods</p>
          <p className="mt-1 font-num text-2xl font-semibold text-[#0F172A]">
            {summary.total}
          </p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-xs text-[#94A3B8]">Reconciled</p>
          <p className="mt-1 font-num text-2xl font-semibold text-[#059669]">
            {summary.reconciled}
          </p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-xs text-[#94A3B8]">With Variance</p>
          <p className="mt-1 font-num text-2xl font-semibold text-[#D97706]">
            {summary.variance}
          </p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-xs text-[#94A3B8]">Total Variance</p>
          <p className="mt-1 font-num text-2xl font-semibold text-[#DC2626]">
            {formatAuto(summary.totalVariance)}
          </p>
        </SurfaceCard>
      </div>

      {/* Reconciliation Table */}
      <SurfaceCard>
        <div className="overflow-x-auto">
          <table className="fin-table w-full">
            <thead>
              <tr>
                <th className="w-8 text-left" />
                <th className="text-left">Period</th>
                <th>Book Balance</th>
                <th>Bank Balance</th>
                <th>Variance</th>
                <th className="text-left">Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {reconciliations.map((recon) => (
                <tr key={recon.id} className="hover-row">
                  <td className="!text-center">
                    <span
                      className={cn(
                        'health-dot',
                        recon.status === 'reconciled' && 'health-dot-green',
                        recon.status === 'variance' && 'health-dot-amber',
                        recon.status === 'unreconciled' && 'health-dot-red'
                      )}
                    />
                  </td>
                  <td className="!font-sans text-sm font-medium text-[#0F172A]">
                    {formatPeriod(recon.period)}
                  </td>
                  <td className="font-semibold">
                    {recon.bookClosingBalancePaise !== null
                      ? formatAuto(recon.bookClosingBalancePaise)
                      : '—'}
                  </td>
                  <td>
                    {editingId === recon.id ? (
                      <input
                        type="number"
                        value={bankBalance}
                        onChange={(e) => setBankBalance(e.target.value)}
                        placeholder="Enter bank balance"
                        className="w-32 rounded border border-[#2563EB] bg-white px-2 py-1 text-sm focus:outline-none"
                        autoFocus
                      />
                    ) : recon.bankClosingBalancePaise !== null ? (
                      formatAuto(recon.bankClosingBalancePaise)
                    ) : (
                      <span className="text-[#94A3B8]">—</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'font-semibold',
                      recon.variancePaise !== null &&
                        Math.abs(recon.variancePaise) > 100 &&
                        'text-[#DC2626]',
                      recon.variancePaise !== null &&
                        Math.abs(recon.variancePaise) <= 100 &&
                        'text-[#059669]'
                    )}
                  >
                    {recon.variancePaise !== null
                      ? formatAuto(Math.abs(recon.variancePaise))
                      : '—'}
                  </td>
                  <td className="!font-sans">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium',
                        recon.status === 'reconciled' &&
                          'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
                        recon.status === 'variance' &&
                          'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
                        recon.status === 'unreconciled' &&
                          'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                      )}
                    >
                      {recon.status === 'reconciled' && (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {recon.status === 'variance' && (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {recon.status === 'reconciled'
                        ? 'Reconciled'
                        : recon.status === 'variance'
                        ? 'Variance'
                        : 'Unreconciled'}
                    </span>
                  </td>
                  <td className="!font-sans text-right">
                    {editingId === recon.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleReconcile(recon.id)}
                          className="btn-press inline-flex items-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-1 text-[11px] font-medium text-[#059669] transition-colors duration-[80ms] hover:bg-[#D1FAE5]"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setBankBalance('')
                          }}
                          className="btn-press rounded border border-[#E2E8F0] px-2 py-1 text-[11px] font-medium text-[#64748B] transition-colors duration-[80ms] hover:border-[#CBD5E1]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : recon.status === 'unreconciled' ? (
                      <button
                        onClick={() => setEditingId(recon.id)}
                        className="btn-press inline-flex items-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-1 text-[11px] font-medium text-[#059669] transition-colors duration-[80ms] hover:bg-[#D1FAE5]"
                      >
                        <DollarSign className="h-3 w-3" />
                        Reconcile
                      </button>
                    ) : (
                      <span className="text-xs text-[#94A3B8]">
                        {recon.reconciledAt &&
                          new Date(recon.reconciledAt).toLocaleDateString(
                            'en-IN',
                            { day: 'numeric', month: 'short' }
                          )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {reconciliations.length === 0 && (
          <div className="py-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-[#CBD5E1]" />
            <p className="mt-3 text-sm font-medium text-[#0F172A]">
              No reconciliations found
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Reconciliation records will appear after importing actuals
            </p>
          </div>
        )}
      </SurfaceCard>
    </div>
  )
}
