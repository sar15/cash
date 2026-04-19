'use client'

/**
 * Annual Statement View
 * 
 * Displays Schedule III-compliant annual financial statements
 * with two columns: Current Year | Prior Year
 */

import { useRef, useImperativeHandle, forwardRef } from 'react'
import type { AnnualStatement } from '@/lib/reports/annual-aggregator'
import { AnnualPLStatement } from './AnnualPLStatement'
import { AnnualBSStatement } from './AnnualBSStatement'
import { AnnualCFStatement } from './AnnualCFStatement'
import { NotesPanel, type NotesPanelHandle } from './NotesPanel'

export interface AnnualStatementViewProps {
  currentYear: AnnualStatement
  priorYear: AnnualStatement | null
  priorYearDataSource?: 'actuals' | 'mixed' | 'forecast'
  companyId: string
  scenarioId?: string | null
  periodKey: string
  priorPeriodKey?: string
  userRole?: 'owner' | 'editor' | 'viewer'
  forecastUpdatedAt?: string | null
  onNotesChange?: () => void
}

/** Handle exposed to parent for flushing all three NotesPanels before PDF export */
export interface AnnualStatementViewHandle {
  flushAllNotes: () => Promise<void>
  getAllNotes: () => { pl: string; bs: string; cf: string }
}

export const AnnualStatementView = forwardRef<AnnualStatementViewHandle, AnnualStatementViewProps>(
  function AnnualStatementView(
    {
      currentYear,
      priorYear,
      priorYearDataSource = 'forecast',
      companyId,
      scenarioId,
      periodKey,
      priorPeriodKey,
      userRole = 'viewer',
      forecastUpdatedAt,
      onNotesChange,
    },
    ref
  ) {
    const plNotesRef = useRef<NotesPanelHandle>(null)
    const bsNotesRef = useRef<NotesPanelHandle>(null)
    const cfNotesRef = useRef<NotesPanelHandle>(null)

    // Expose flush + get to parent
    useImperativeHandle(ref, () => ({
      flushAllNotes: async () => {
        await Promise.all([
          plNotesRef.current?.flushPendingSaves(),
          bsNotesRef.current?.flushPendingSaves(),
          cfNotesRef.current?.flushPendingSaves(),
        ])
      },
      getAllNotes: () => ({
        pl: plNotesRef.current?.getUserNotes() ?? '',
        bs: bsNotesRef.current?.getUserNotes() ?? '',
        cf: cfNotesRef.current?.getUserNotes() ?? '',
      }),
    }))

    return (
      <div className="space-y-12 p-6">
        {/* P&L Statement */}
        <section>
          <AnnualPLStatement
            current={currentYear.pl}
            prior={priorYear?.pl ?? null}
            priorDataSource={priorYearDataSource}
            currentPeriodLabel={periodKey}
            priorPeriodLabel={priorPeriodKey ?? 'Prior Year'}
          />
          <NotesPanel
            ref={plNotesRef}
            companyId={companyId}
            scenarioId={scenarioId}
            statementType="PL"
            periodKey={periodKey}
            userRole={userRole}
            forecastUpdatedAt={forecastUpdatedAt}
          />
        </section>

        {/* Balance Sheet */}
        <section>
          <AnnualBSStatement
            current={currentYear.bs}
            prior={priorYear?.bs ?? null}
            priorDataSource={priorYearDataSource}
            currentPeriodLabel={periodKey}
            priorPeriodLabel={priorPeriodKey ?? 'Prior Year'}
          />
          <NotesPanel
            ref={bsNotesRef}
            companyId={companyId}
            scenarioId={scenarioId}
            statementType="BS"
            periodKey={periodKey}
            userRole={userRole}
            forecastUpdatedAt={forecastUpdatedAt}
          />
        </section>

        {/* Cash Flow Statement */}
        <section>
          <AnnualCFStatement
            current={currentYear.cf}
            prior={priorYear?.cf ?? null}
            priorDataSource={priorYearDataSource}
            currentPeriodLabel={periodKey}
            priorPeriodLabel={priorPeriodKey ?? 'Prior Year'}
          />
          <NotesPanel
            ref={cfNotesRef}
            companyId={companyId}
            scenarioId={scenarioId}
            statementType="CF"
            periodKey={periodKey}
            userRole={userRole}
            forecastUpdatedAt={forecastUpdatedAt}
          />
        </section>
      </div>
    )
  }
)
