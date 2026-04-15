'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'shimmer rounded-md',
        className
      )}
    />
  )
}

/** Full-page loading skeleton for dashboard-style pages */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-md border border-[#E5E7EB] bg-white px-4 py-3 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-md border border-[#E5E7EB] bg-white p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="rounded-md border border-[#E5E7EB] bg-white p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Table skeleton for forecast grid */
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#E5E7EB]">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
            <th className="px-4 py-2 text-left"><Skeleton className="h-3 w-24" /></th>
            {[...Array(cols)].map((_, i) => (
              <th key={i} className="px-2 py-2"><Skeleton className="mx-auto h-3 w-12" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <tr key={i} className="border-b border-[#F1F5F9]">
              <td className="px-4 py-2"><Skeleton className="h-3 w-32" /></td>
              {[...Array(cols)].map((_, j) => (
                <td key={j} className="px-2 py-2"><Skeleton className="mx-auto h-3 w-14" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Card grid skeleton for clients/portfolio page */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Skeleton className="h-2 w-10" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-2 w-12" />
              <Skeleton className="h-4 w-14" />
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      ))}
    </div>
  )
}
