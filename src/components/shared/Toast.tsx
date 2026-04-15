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
      bg: 'bg-[#ECFDF5] border-[#A7F3D0]',
      text: 'text-[#065F46]',
      icon_color: 'text-[#059669]',
    },
    error: {
      icon: AlertTriangle,
      bg: 'bg-[#FEF2F2] border-[#FECACA]',
      text: 'text-[#991B1B]',
      icon_color: 'text-[#DC2626]',
    },
    info: {
      icon: Info,
      bg: 'bg-[#EFF6FF] border-[#BFDBFE]',
      text: 'text-[#1E3A5F]',
      icon_color: 'text-[#2563EB]',
    },
  }

  const c = config[toast.type]
  const Icon = c.icon

  return (
    <div className="fixed bottom-5 right-5 z-[100] animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg',
        c.bg
      )}>
        <Icon className={cn('h-4 w-4 shrink-0', c.icon_color)} />
        <p className={cn('text-sm font-medium', c.text)}>{toast.message}</p>
        <button onClick={clearToast} className={cn('ml-2 rounded p-0.5 opacity-60 hover:opacity-100', c.text)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
