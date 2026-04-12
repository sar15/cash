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
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="label-xs mb-1">{eyebrow}</p>
        ) : null}
        <h1 className="text-lg font-semibold text-[#0F172A]">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-[#64748B]">{description}</p>
        ) : null}
        {badges ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div>
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
}

const badgeStyles = {
  default: 'border-[#E5E7EB] bg-[#F8FAFC] text-[#475569]',
  success: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
  warning: 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
  danger: 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
}

export function HeaderBadge({ label, tone = 'default' }: HeaderBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium',
      badgeStyles[tone]
    )}>
      {label}
    </span>
  )
}

interface SurfaceCardProps {
  children: ReactNode
  className?: string
}

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <div className={cn(
      'surface rounded-md border border-[#E5E7EB] bg-white p-4',
      className
    )}>
      {children}
    </div>
  )
}
