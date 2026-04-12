'use client'

import { Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Filing {
  id: string
  name: string
  dueDate: string // ISO date
  status: 'upcoming' | 'due_today' | 'overdue' | 'filed'
  clientName?: string // for CA persona
  amount?: string // estimated amount
}

interface ComplianceWidgetProps {
  filings: Filing[]
  showClientName?: boolean // CA persona shows client name
}

const statusConfig = {
  upcoming: {
    icon: Clock,
    color: 'text-sky-300',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/15',
    label: 'Upcoming',
  },
  due_today: {
    icon: AlertTriangle,
    color: 'text-amber-300',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/15',
    label: 'Due Today',
  },
  overdue: {
    icon: AlertTriangle,
    color: 'text-rose-300',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
    label: 'Overdue',
  },
  filed: {
    icon: CheckCircle2,
    color: 'text-emerald-300',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/15',
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
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.2)] backdrop-blur">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Upcoming Compliance</p>
          <p className="text-xs text-slate-400">Nearest statutory filings and their status.</p>
        </div>
        <Calendar className="h-4 w-4 text-slate-400" />
      </div>

      <div className="space-y-3">
        {displayFilings.map((filing) => {
          const config = statusConfig[filing.status]
          const Icon = config.icon
          const days = daysUntil(filing.dueDate)

          return (
            <div
              key={filing.id}
              className={cn(
                'hover-lift flex items-center gap-3 rounded-2xl border p-3.5 transition-colors',
                config.border,
                filing.status === 'overdue'
                  ? 'bg-rose-400/5'
                  : 'bg-white/5 hover:bg-white/8'
              )}
            >
              <div className={cn('rounded-xl p-2', config.bg)}>
                <Icon className={cn('h-4 w-4', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {filing.name}
                </p>
                {showClientName && filing.clientName && (
                  <p className="text-xs text-slate-500">{filing.clientName}</p>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                    config.bg,
                    config.color
                  )}
                >
                  {formatDate(filing.dueDate)}
                </span>
                {filing.status !== 'filed' && (
                  <span
                    className={cn(
                      'mt-0.5 text-[10px]',
                      days < 0
                        ? 'text-rose-300'
                        : days === 0
                          ? 'text-amber-300'
                          : 'text-slate-500'
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
        <button className="mt-4 w-full rounded-2xl border border-white/8 bg-white/5 py-2.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
          View all {filings.length} filings →
        </button>
      )}
    </div>
  )
}
