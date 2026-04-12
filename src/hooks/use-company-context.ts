/**
 * useCompanyContext — Central company context hook
 *
 * Every page and API-calling component should use this hook.
 * It ensures the active company is loaded and provides the companyId.
 * Auto-loads all dependent stores when the company changes.
 */
'use client'

import { useEffect, useCallback } from 'react'
import { useCompanyStore } from '@/stores/company-store'
import { useAccountsStore } from '@/stores/accounts-store'
import { useActualsStore } from '@/stores/actuals-store'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
import { useScenarioStore } from '@/stores/scenario-store'
import { useMicroForecastStore } from '@/stores/micro-forecast-store'

export function useCompanyContext() {
  const {
    activeCompanyId,
    companies,
    isLoading: companiesLoading,
    loadCompanies,
    setActiveCompany,
    activeCompany,
    isCA,
  } = useCompanyStore()

  const loadAccounts = useAccountsStore((s) => s.load)
  const loadActuals = useActualsStore((s) => s.load)
  const loadConfig = useForecastConfigStore((s) => s.load)
  const loadScenarios = useScenarioStore((s) => s.load)
  const loadMicroForecasts = useMicroForecastStore((s) => s.loadItems)

  // Load companies on mount
  useEffect(() => {
    if (companies.length === 0 && !companiesLoading) {
      void loadCompanies()
    }
  }, [companies.length, companiesLoading, loadCompanies])

  // When activeCompanyId changes, reload dependent stores
  useEffect(() => {
    if (!activeCompanyId) return
    void loadAccounts(activeCompanyId)
    void loadActuals(activeCompanyId)
    void loadConfig(activeCompanyId)
    void loadScenarios(activeCompanyId)
    void loadMicroForecasts(activeCompanyId, true)
  }, [activeCompanyId, loadAccounts, loadActuals, loadConfig, loadScenarios, loadMicroForecasts])

  const switchCompany = useCallback(
    (id: string) => {
      setActiveCompany(id)
    },
    [setActiveCompany]
  )

  return {
    companyId: activeCompanyId,
    company: activeCompany(),
    companies,
    isCA: isCA(),
    isLoading: companiesLoading,
    switchCompany,
  }
}
