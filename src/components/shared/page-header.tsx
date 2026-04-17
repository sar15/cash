'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  badges?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, badges, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
        {badges ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{badges}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

interface HeaderBadgeProps {
  label: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
  dot?: boolean
}

const badgeStyles = {
  default: 'border-border bg-muted text-muted-foreground',
  success: 'border-[color:var(--cfiq-green-border)] bg-[color:var(--cfiq-green-bg)] text-[color:var(--cfiq-green)]',
  warning: 'border-[color:var(--cfiq-amber-border)] bg-[color:var(--cfiq-amber-bg)] text-[color:var(--cfiq-amber)]',
  danger:  'border-[color:var(--cfiq-red-border)] bg-[color:var(--cfiq-red-bg)] text-[color:var(--cfiq-red)]',
}

const dotStyles = {
  default: 'bg-muted-foreground',
  success: 'bg-[color:var(--cfiq-green)]',
  warning: 'bg-[color:var(--cfiq-amber)]',
  danger:  'bg-[color:var(--cfiq-red)]',
}

export function HeaderBadge({ label, tone = 'default', dot }: HeaderBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
      badgeStyles[tone]
    )}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotStyles[tone])} />}
      {label}
    </span>
  )
}

interface SurfaceCardProps {
  children: ReactNode
  className?: string
  noPad?: boolean
}

export function SurfaceCard({ children, className, noPad }: SurfaceCardProps) {
  return (
    <div className={cn(
      'surface rounded-[10px] border border-border bg-card',
      !noPad && 'p-4',
      className
    )}>
      {children}
    </div>
  )
}

/** Section label — consistent section headers inside cards */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  )
}

/** Divider */
export function Divider({ className }: { className?: string }) {
  return <div className={cn('my-4 h-px bg-border', className)} />
}
