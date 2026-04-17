'use client'

import { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

export function Toast() {
  const { toast, clearToast } = useUIStore()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clearToast, 3500)
    return () => clearTimeout(t)
  }, [toast, clearToast])

  if (!toast) return null

  const config = {
    success: {
      icon: CheckCircle2,
      bg: 'bg-[color:var(--cfiq-green-bg)] border-[color:var(--cfiq-green-border)]',
      text: 'text-foreground',
      icon_color: 'text-[color:var(--cfiq-green)]',
    },
    error: {
      icon: AlertTriangle,
      bg: 'bg-[color:var(--cfiq-red-bg)] border-[color:var(--cfiq-red-border)]',
      text: 'text-foreground',
      icon_color: 'text-[color:var(--cfiq-red)]',
    },
    info: {
      icon: Info,
      bg: 'bg-[color:var(--cfiq-blue-bg)] border-[color:var(--cfiq-blue-border)]',
      text: 'text-foreground',
      icon_color: 'text-[color:var(--cfiq-blue)]',
    },
  }

  const c = config[toast.type]
  const Icon = c.icon

  return (
    <div className="fixed bottom-5 right-5 z-[100] animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg shadow-black/5',
        c.bg
      )}>
        <Icon className={cn('h-4 w-4 shrink-0', c.icon_color)} />
        <p className={cn('text-sm font-medium', c.text)}>{toast.message}</p>
        <button
          onClick={clearToast}
          aria-label="Dismiss toast"
          className={cn('ml-2 rounded p-0.5 opacity-60 hover:opacity-100', c.text)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
