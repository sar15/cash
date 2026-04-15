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
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-[#0F172A]">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#64748B]">{description}</p>
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
  default: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]',
  success: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
  warning: 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
  danger:  'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
}

const dotStyles = {
  default: 'bg-[#94A3B8]',
  success: 'bg-[#059669]',
  warning: 'bg-[#D97706]',
  danger:  'bg-[#DC2626]',
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
      'surface rounded-[10px] border border-[#E2E8F0] bg-white',
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
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
      {children}
    </p>
  )
}

/** Divider */
export function Divider({ className }: { className?: string }) {
  return <div className={cn('my-4 h-px bg-[#E2E8F0]', className)} />
}
