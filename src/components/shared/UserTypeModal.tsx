'use client'

import { useEffect, useState } from 'react'
import { Building2, Briefcase, ArrowRight, CheckCircle2, TrendingUp, Users, BarChart3, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProfileStore } from '@/stores/profile-store'

export type UserType = 'business_owner' | 'ca_firm'

interface UserTypeModalProps {
  onSelect: (type: UserType) => void
}

export function UserTypeModal({ onSelect }: UserTypeModalProps) {
  const [selected, setSelected] = useState<UserType | null>(null)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white p-4">
      {/* Full-screen takeover — not a modal overlay */}
      <div className="w-full max-w-3xl">
        {/* Logo */}
        <div className="mb-10 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#059669]">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0F172A]">CashFlowIQ</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
            How will you use CashFlowIQ?
          </h1>
          <p className="mt-3 text-base text-[#64748B]">
            We&apos;ll show you the features that matter most for your workflow.
          </p>
        </div>

        {/* Two big cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* SME Card */}
          <button
            onClick={() => setSelected('business_owner')}
            className={cn(
              'group relative overflow-hidden rounded-2xl border-2 p-8 text-left transition-all duration-200',
              selected === 'business_owner'
                ? 'border-[#059669] bg-[#ECFDF5] shadow-lg shadow-emerald-100'
                : 'border-[#E2E8F0] bg-white hover:border-[#059669]/40 hover:shadow-md'
            )}
          >
            {selected === 'business_owner' && (
              <div className="absolute right-4 top-4">
                <CheckCircle2 className="h-5 w-5 text-[#059669]" />
              </div>
            )}
            <div className={cn(
              'mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-colors',
              selected === 'business_owner' ? 'bg-[#059669] text-white' : 'bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#ECFDF5] group-hover:text-[#059669]'
            )}>
              <Building2 className="h-7 w-7" />
            </div>
            <h2 className={cn('text-xl font-semibold', selected === 'business_owner' ? 'text-[#059669]' : 'text-[#0F172A]')}>
              Business Owner
            </h2>
            <p className="mt-1 text-sm font-medium text-[#94A3B8]">SME · Startup · Manufacturer</p>
            <p className="mt-3 text-sm leading-6 text-[#64748B]">
              I manage one company and want to understand my cash position, plan for growth, and stay on top of compliance.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                { icon: TrendingUp, text: 'Cash runway & burn rate at a glance' },
                { icon: BarChart3, text: '12-month P&L, Balance Sheet, Cash Flow' },
                { icon: ClipboardCheck, text: 'GST, TDS, PF/ESI due dates' },
                { icon: Users, text: 'Model hires, loans, new clients' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-2.5">
                  <item.icon className={cn('h-3.5 w-3.5 shrink-0', selected === 'business_owner' ? 'text-[#059669]' : 'text-[#94A3B8]')} />
                  <span className="text-xs text-[#475569]">{item.text}</span>
                </li>
              ))}
            </ul>
          </button>

          {/* CA Card */}
          <button
            onClick={() => setSelected('ca_firm')}
            className={cn(
              'group relative overflow-hidden rounded-2xl border-2 p-8 text-left transition-all duration-200',
              selected === 'ca_firm'
                ? 'border-[#2563EB] bg-[#EFF6FF] shadow-lg shadow-blue-100'
                : 'border-[#E2E8F0] bg-white hover:border-[#2563EB]/40 hover:shadow-md'
            )}
          >
            {selected === 'ca_firm' && (
              <div className="absolute right-4 top-4">
                <CheckCircle2 className="h-5 w-5 text-[#2563EB]" />
              </div>
            )}
            <div className={cn(
              'mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-colors',
              selected === 'ca_firm' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#EFF6FF] group-hover:text-[#2563EB]'
            )}>
              <Briefcase className="h-7 w-7" />
            </div>
            <h2 className={cn('text-xl font-semibold', selected === 'ca_firm' ? 'text-[#2563EB]' : 'text-[#0F172A]')}>
              CA / CFO
            </h2>
            <p className="mt-1 text-sm font-medium text-[#94A3B8]">Chartered Accountant · Finance Professional</p>
            <p className="mt-3 text-sm leading-6 text-[#64748B]">
              I manage multiple clients and need portfolio-level visibility, consolidated compliance tracking, and board-ready reports.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                { icon: Users, text: 'Multi-client portfolio dashboard' },
                { icon: ClipboardCheck, text: 'Cross-client compliance calendar' },
                { icon: BarChart3, text: 'Branded PDF reports under your firm' },
                { icon: TrendingUp, text: 'Consolidated due date tracking' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-2.5">
                  <item.icon className={cn('h-3.5 w-3.5 shrink-0', selected === 'ca_firm' ? 'text-[#2563EB]' : 'text-[#94A3B8]')} />
                  <span className="text-xs text-[#475569]">{item.text}</span>
                </li>
              ))}
            </ul>
          </button>
        </div>

        {/* CTA */}
        <div className="mt-8">
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold transition-all duration-200',
              selected
                ? selected === 'business_owner'
                  ? 'bg-[#059669] text-white hover:bg-[#047857] shadow-lg shadow-emerald-200'
                  : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-lg shadow-blue-200'
                : 'bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed'
            )}
          >
            {selected ? (
              <>
                Continue as {selected === 'business_owner' ? 'Business Owner' : 'CA / CFO'}
                <ArrowRight className="h-5 w-5" />
              </>
            ) : (
              'Select your role to continue'
            )}
          </button>
          <p className="mt-3 text-center text-xs text-[#94A3B8]">
            You can change this anytime in Settings → Account Type
          </p>
        </div>
      </div>
    </div>
  )
}

/** Hook to get/set user type with localStorage */
export function useUserType() {
  const profile = useProfileStore((s) => s.profile)
  const isLoading = useProfileStore((s) => s.isLoading)
  const load = useProfileStore((s) => s.load)
  const setUserType = useProfileStore((s) => s.setUserType)

  useEffect(() => {
    if (!profile && !isLoading) {
      void load()
    }
  }, [profile, isLoading, load])

  const selectType = async (type: UserType) => {
    await setUserType(type)
  }

  return {
    userType: profile?.userType ?? null,
    // hasChecked = true once we've finished the first load attempt (loading done)
    hasChecked: !isLoading,
    selectType,
  }
}
