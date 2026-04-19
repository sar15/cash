'use client'

/**
 * Notes Panel Component
 * 
 * Displays and manages MD&A notes for financial statements.
 * Features:
 * - Auto-generated summary bullets (read-only)
 * - User-editable notes (plain text)
 * - Debounced save (1000ms)
 * - Immediate save on blur
 * - Role-gated editing (editors/owners only)
 * - Stale warning when forecast changes
 */

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { useUser } from '@clerk/nextjs'

export interface NotesPanelProps {
  companyId: string
  scenarioId?: string | null
  statementType: 'PL' | 'BS' | 'CF'
  periodKey: string
  userRole?: 'owner' | 'editor' | 'viewer'
  forecastUpdatedAt?: string | null
}

/** Ref handle exposed to parent for flushing pending saves before PDF export */
export interface NotesPanelHandle {
  flushPendingSaves: () => Promise<void>
  getUserNotes: () => string
}

interface NotesData {
  autoSummary: string[]
  autoSummaryGeneratedAt: string | null
  userNotes: string
  updatedAt: string
  updatedBy: string
}

export const NotesPanel = forwardRef<NotesPanelHandle, NotesPanelProps>(function NotesPanel({
  companyId,
  scenarioId,
  statementType,
  periodKey,
  userRole = 'viewer',
  forecastUpdatedAt,
}: NotesPanelProps, ref) {
  const { user } = useUser()
  const [isExpanded, setIsExpanded] = useState(false)
  const [notes, setNotes] = useState<NotesData | null>(null)
  const [userNotes, setUserNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Keep a stable ref to the latest userNotes for use in flush
  const userNotesRef = useRef(userNotes)
  useEffect(() => { userNotesRef.current = userNotes }, [userNotes])

  // Check if user can edit (owner or editor)
  const canEdit = userRole === 'owner' || userRole === 'editor'

  // Check if summary is stale
  const isStale = !!(
    notes?.autoSummaryGeneratedAt &&
    forecastUpdatedAt &&
    new Date(forecastUpdatedAt) > new Date(notes.autoSummaryGeneratedAt)
  )

  // Expose flush handle to parent (for PDF export)
  useImperativeHandle(ref, () => ({
    flushPendingSaves: async () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        debouncedSaveRef.current = null
        await saveNotesInternal(userNotesRef.current)
      }
    },
    getUserNotes: () => userNotesRef.current,
  }))

  const fetchNotes = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        companyId,
        statementType,
        periodKey,
      })
      if (scenarioId) {
        params.set('scenarioId', scenarioId)
      }

      const response = await fetch(`/api/notes?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch notes')
      }

      const data = await response.json()
      setNotes(data)
      setUserNotes(data.userNotes)
    } catch (error) {
      console.error('Failed to fetch notes:', error)
      setSaveError('Failed to load notes')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch notes on mount
  useEffect(() => {
    fetchNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, scenarioId, statementType, periodKey])

  // Auto-expand if notes exist
  useEffect(() => {
    if (notes && (notes.autoSummary.length > 0 || notes.userNotes.length > 0)) {
      setIsExpanded(true)
    }
  }, [notes])
  const saveNotesInternal = async (notesText: string) => {
    if (!canEdit) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Company-Id': companyId },
        body: JSON.stringify({
          scenarioId: scenarioId || null,
          statementType,
          periodKey,
          userNotes: notesText,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save notes')
      }

      const data = await response.json()
      
      // Update notes state with new updatedAt
      setNotes(prev => prev ? {
        ...prev,
        userNotes: notesText,
        updatedAt: data.updatedAt,
        updatedBy: user?.id ?? prev.updatedBy,
      } : null)
    } catch (error) {
      console.error('Failed to save notes:', error)
      setSaveError('Failed to save notes. Your changes are preserved.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleNotesChange = (value: string) => {
    setUserNotes(value)
    
    // Clear existing debounce timer
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
    }
    
    // Set new debounce timer (1000ms)
    debouncedSaveRef.current = setTimeout(() => {
      saveNotesInternal(value)
    }, 1000)
  }

  const handleBlur = () => {
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
      debouncedSaveRef.current = null
    }
    saveNotesInternal(userNotesRef.current)
  }

  const handleGenerateSummary = async () => {
    if (!canEdit) return

    setIsGenerating(true)
    setSaveError(null)

    try {
      const response = await fetch('/api/notes/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Company-Id': companyId },
        body: JSON.stringify({
          scenarioId: scenarioId || null,
          statementType,
          periodKey,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate summary')
      }

      const data = await response.json()
      
      // Update notes state with new auto-summary (NEVER touches userNotes)
      setNotes(prev => prev ? {
        ...prev,
        autoSummary: data.autoSummary,
        autoSummaryGeneratedAt: data.generatedAt,
        updatedAt: data.generatedAt,
        updatedBy: user?.id ?? prev.updatedBy,
      } : null)
    } catch (error) {
      console.error('Failed to generate summary:', error)
      setSaveError('Failed to generate summary')
    } finally {
      setIsGenerating(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
      }
    }
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <div className="h-3 w-3 animate-spin rounded-full border border-[#94A3B8] border-t-transparent" />
          Loading notes...
        </div>
      </div>
    )
  }

  // Collapsed state
  if (!isExpanded) {
    return (
      <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 text-xs text-[#64748B] transition-colors hover:text-[#0F172A]"
        >
          <span>💬</span>
          <span>Add Commentary</span>
          <span className="text-[#94A3B8]">[+]</span>
        </button>
      </div>
    )
  }

  // Expanded state
  return (
    <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
          Financial Commentary
        </h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-xs text-[#94A3B8] transition-colors hover:text-[#64748B]"
        >
          [−]
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Auto-generated summary */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-[#334155]">
              Key Metrics
            </label>
            {canEdit && (
              <button
                onClick={handleGenerateSummary}
                disabled={isGenerating}
                className={cn(
                  'rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors',
                  isGenerating
                    ? 'border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]'
                    : 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]'
                )}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-1">
                    <div className="h-2 w-2 animate-spin rounded-full border border-[#94A3B8] border-t-transparent" />
                    Generating...
                  </span>
                ) : (
                  'Generate'
                )}
              </button>
            )}
          </div>

          {/* Stale warning */}
          {isStale && (
            <div className="mb-2 rounded border border-[#FDE68A] bg-[#FFFBEB] px-2 py-1.5 text-[10px] text-[#92400E]">
              ⚠️ Forecast numbers have changed since this summary was generated.
              <button
                onClick={handleGenerateSummary}
                disabled={isGenerating}
                className="ml-1 font-semibold underline hover:no-underline"
              >
                Regenerate
              </button>
            </div>
          )}

          {/* Auto-summary bullets */}
          {notes && notes.autoSummary.length > 0 ? (
            <ul className="space-y-1 rounded border border-[#E2E8F0] bg-white px-3 py-2">
              {notes.autoSummary.map((bullet, idx) => (
                <li key={idx} className="text-xs text-[#334155]">
                  <span className="mr-1.5 text-[#94A3B8]">•</span>
                  {bullet}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#94A3B8]">
              No auto-generated summary yet.
              {canEdit && ' Click "Generate" to create one.'}
            </div>
          )}

          {notes?.autoSummaryGeneratedAt && (
            <p className="mt-1 text-[9px] text-[#94A3B8]">
              Generated {new Date(notes.autoSummaryGeneratedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Right: User notes */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="user-notes" className="text-xs font-semibold text-[#334155]">
              Your Notes
            </label>
            {isSaving && (
              <span className="flex items-center gap-1 text-[9px] text-[#94A3B8]">
                <div className="h-2 w-2 animate-spin rounded-full border border-[#94A3B8] border-t-transparent" />
                Saving...
              </span>
            )}
          </div>

          {canEdit ? (
            <textarea
              id="user-notes"
              ref={textareaRef}
              value={userNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              onBlur={handleBlur}
              placeholder="Add your commentary here (plain text)..."
              className="h-32 w-full resize-none rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
          ) : (
            <div className="h-32 overflow-y-auto rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#334155]">
              {userNotes || (
                <span className="text-[#94A3B8]">No notes added yet.</span>
              )}
            </div>
          )}

          {saveError && (
            <p className="mt-1 text-[9px] text-[#DC2626]">{saveError}</p>
          )}

          {!canEdit && (
            <p className="mt-1 text-[9px] text-[#94A3B8]">
              Read-only: You need editor or owner role to edit notes.
            </p>
          )}
        </div>
      </div>
    </div>
  )
})
