'use client'

import { useState } from 'react'
import { Building2, Loader2, ArrowRight, BarChart3 } from 'lucide-react'
import { useCompanyStore } from '@/stores/company-store'

export function CreateCompanyModal() {
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('services')
  const [isAdding, setIsAdding] = useState(false)
  const createCompany = useCompanyStore((s) => s.createCompany)

  const handleAdd = async () => {
    if (!name.trim()) return
    setIsAdding(true)
    try {
      await createCompany({ name: name.trim(), industry, fyStartMonth: 4, currency: 'INR', numberFormat: 'lakhs' })
    } catch (err) {
      console.error(err)
      setIsAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-xl">
        <div className="mb-10 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#059669]">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0F172A]">CashFlowIQ</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
            Set up your company
          </h1>
          <p className="mt-3 text-base text-[#64748B]">
            Let&apos;s get started by adding your primary business details.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#E2E8F0] p-8 text-left bg-white">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#059669]">
            <Building2 className="h-7 w-7" />
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Company Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp Pvt Ltd"
                className="mt-1.5 w-full rounded-lg border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]/20"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-card px-4 py-3 text-base text-foreground focus:border-[#059669] focus:outline-none focus:ring-1 focus:ring-[#059669]/20"
              >
                <option value="manufacturing">Manufacturing</option>
                <option value="services">Professional Services</option>
                <option value="technology">Technology</option>
                <option value="retail">Retail / E-commerce</option>
                <option value="healthcare">Healthcare</option>
                <option value="construction">Construction</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!name.trim() || isAdding}
            className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#059669] py-3.5 text-base font-semibold text-white transition-all duration-200 hover:bg-[#047857] shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Create Company <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
