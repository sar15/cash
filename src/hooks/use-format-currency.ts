/**
 * useFormatCurrency — Indian formatting hook
 *
 * Wraps the utils/indian-format functions for React components.
 * All values are in paise (integer), formatted to display in lakhs/crores.
 */
'use client'

import { useCallback } from 'react'
import { useCompanyStore } from '@/stores/company-store'
import {
  formatAuto as formatAutoUtil,
  formatRupees as formatRupeesUtil,
} from '@/lib/utils/indian-format'

export function paise2rupees(paise: number): number {
  return paise / 100
}

export function formatRupees(paise: number): string {
  return formatRupeesUtil(paise, false)
}

export function formatCompact(paise: number): string {
  return formatAutoUtil(paise)
}

export function useFormatCurrency() {
  const numberFormat = useCompanyStore((s) => s.activeCompany()?.numberFormat ?? 'lakhs')

  const format = useCallback(
    (paise: number) => formatCompact(paise),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [numberFormat]
  )

  const formatFull = useCallback(
    (paise: number) => formatRupees(paise),
    []
  )

  return { format, formatFull, formatRupees, formatCompact }
}
