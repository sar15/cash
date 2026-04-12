'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useCompanyStore } from '@/stores/company-store'
import { useCompanyContext } from '@/hooks/use-company-context'
import { ArrowLeft, Settings, Upload, TrendingUp, FileText } from 'lucide-react'
import Link from 'next/link'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'

export default function ClientDetailPage() {
  const params = useParams()
  const clientId = params.clientId as string
  const { switchCompany } = useCompanyContext()
  const company = useCompanyStore((s) =>
    s.companies.find((c) => c.id === clientId)
  )

  // Auto-switch to this client's company on mount
  useEffect(() => {
    if (clientId) switchCompany(clientId)
  }, [clientId, switchCompany])

  if (!company) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-slate-400">Client not found</p>
      </div>
    )
  }

  const quickActions = [
    { label: 'View Forecast', href: '/forecast', icon: TrendingUp, color: 'bg-emerald-600 hover:bg-emerald-500' },
    { label: 'Upload Data', href: '/data', icon: Upload, color: 'bg-blue-600 hover:bg-blue-500' },
    { label: 'Generate Report', href: '/reports', icon: FileText, color: 'bg-amber-600 hover:bg-amber-500' },
    { label: 'Settings', href: '/settings', icon: Settings, color: 'bg-slate-600 hover:bg-slate-500' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client detail"
        title={company.name}
        description="Use the same forecasting, compliance, and reporting workflows here, already scoped to this client company."
        badges={
          <>
            <HeaderBadge label={company.industry} />
            {company.pan ? <HeaderBadge label={company.pan} /> : null}
            {company.gstin ? <HeaderBadge label={company.gstin} /> : null}
          </>
        }
        actions={
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to portfolio
          </Link>
        }
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`flex flex-col items-center gap-2 rounded-xl p-4 text-white transition-colors ${action.color}`}
          >
            <action.icon className="h-6 w-6" />
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Placeholder for client-specific dashboard */}
      <SurfaceCard className="p-8 text-center">
        <p className="text-sm text-slate-400">
          Client dashboard loads the same forecast/compliance data as the
          main app — just scoped to this company ({company.name}).
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Use the quick actions above to navigate to forecasting, data import, or reports.
        </p>
      </SurfaceCard>
    </div>
  )
}
