'use client'

import { Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Filing {
  id: string
  name: string
  dueDate: string // ISO date
  status: 'upcoming' | 'due_today' | 'overdue' | 'filed'
  clientName?: string
  amount?: string
}

interface ComplianceWidgetProps {
  filings: Filing[]
  showClientName?: boolean
}

const statusConfig = {
  upcoming: {
    icon: Clock,
    color: 'text-[#2563EB]',
    bg: 'bg-[#EFF6FF]',
    border: 'border-[#BFDBFE]',
    label: 'Upcoming',
  },
  due_today: {
    icon: AlertTriangle,
    color: 'text-[#D97706]',
    bg: 'bg-[#FFFBEB]',
    border: 'border-[#FDE68A]',
    label: 'Due Today',
  },
  overdue: {
    icon: AlertTriangle,
    color: 'text-[#DC2626]',
    bg: 'bg-[#FEF2F2]',
    border: 'border-[#FECACA]',
    label: 'Overdue',
  },
  filed: {
    icon: CheckCircle2,
    color: 'text-[#059669]',
    bg: 'bg-[#ECFDF5]',
    border: 'border-[#A7F3D0]',
    label: 'Filed',
  },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function ComplianceWidget({ filings, showClientName }: ComplianceWidgetProps) {
  const sorted = [...filings].sort((a, b) => {
    const priority = { overdue: 0, due_today: 1, upcoming: 2, filed: 3 }
    const diff = priority[a.status] - priority[b.status]
    if (diff !== 0) return diff
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  const displayFilings = sorted.slice(0, 5)

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Upcoming Compliance</p>
          <p className="text-xs text-[#64748B]">Nearest statutory filings and their status.</p>
        </div>
        <Calendar className="h-4 w-4 text-[#94A3B8]" />
      </div>

      <div className="space-y-2">
        {displayFilings.map((filing) => {
          const config = statusConfig[filing.status]
          const Icon = config.icon
          const days = daysUntil(filing.dueDate)

          return (
            <div
              key={filing.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors duration-[80ms]',
                config.border,
                config.bg
              )}
            >
              <div className={cn('rounded-lg p-1.5', config.bg)}>
                <Icon className={cn('h-4 w-4', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-[#0F172A]">
                  {filing.name}
                </p>
                {showClientName && filing.clientName && (
                  <p className="text-xs text-[#64748B]">{filing.clientName}</p>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className={cn('text-xs font-semibold', config.color)}>
                  {formatDate(filing.dueDate)}
                </span>
                {filing.status !== 'filed' && (
                  <span
                    className={cn(
                      'mt-0.5 text-[10px]',
                      days < 0
                        ? 'text-[#DC2626]'
                        : days === 0
                          ? 'text-[#D97706]'
                          : 'text-[#94A3B8]'
                    )}
                  >
                    {days < 0
                      ? `${Math.abs(days)}d overdue`
                      : days === 0
                        ? 'TODAY'
                        : `in ${days}d`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filings.length > 5 && (
        <button className="mt-3 w-full rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] py-2 text-xs font-medium text-[#475569] transition-colors duration-[80ms] hover:border-[#D1D5DB] hover:text-[#0F172A]">
          View all {filings.length} filings →
        </button>
      )}
    </div>
  )
}
