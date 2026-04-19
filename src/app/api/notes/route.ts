import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { scenarioNotes } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { jsonOk, jsonError, resolveAuthedCompany, isErrorResponse } from '@/lib/api/helpers'

/**
 * GET /api/notes
 *
 * Fetch notes for a specific statement, period, and scenario.
 *
 * Query params:
 * - companyId (required)
 * - scenarioId (optional, null = base case)
 * - statementType (required: 'PL' | 'BS' | 'CF')
 * - periodKey (required: e.g. "FY25-26")
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const { searchParams } = new URL(request.url)
    const scenarioId = searchParams.get('scenarioId') || null
    const statementType = searchParams.get('statementType')
    const periodKey = searchParams.get('periodKey')

    if (!statementType || !periodKey) {
      return jsonError('Missing required parameters: statementType, periodKey', 400)
    }

    const notes = await db.query.scenarioNotes.findFirst({
      where: and(
        eq(scenarioNotes.companyId, ctx.companyId),
        scenarioId
          ? eq(scenarioNotes.scenarioId, scenarioId)
          : isNull(scenarioNotes.scenarioId),
        eq(scenarioNotes.statementType, statementType),
        eq(scenarioNotes.periodKey, periodKey)
      ),
    })

    if (!notes) {
      return jsonOk({
        autoSummary: [],
        autoSummaryGeneratedAt: null,
        userNotes: '',
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.userId,
      })
    }

    let autoSummary: string[] = []
    try {
      autoSummary = JSON.parse(notes.autoSummary)
    } catch {
      autoSummary = []
    }

    return jsonOk({
      autoSummary,
      autoSummaryGeneratedAt: notes.autoSummaryGeneratedAt,
      userNotes: notes.userNotes,
      updatedAt: notes.updatedAt,
      updatedBy: notes.updatedBy,
    })
  } catch (error) {
    console.error('GET /api/notes error:', error)
    return jsonError('Failed to fetch notes', 500)
  }
}

/**
 * PUT /api/notes
 *
 * Save user notes for a specific statement, period, and scenario.
 *
 * Body:
 * - companyId (required — also sent as x-company-id header or query param)
 * - scenarioId (optional, null = base case)
 * - statementType (required: 'PL' | 'BS' | 'CF')
 * - periodKey (required: e.g. "FY25-26")
 * - userNotes (required: plain text string)
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    // Viewers are blocked by resolveAuthedCompany for mutations, but double-check
    if (ctx.role === 'viewer' && !ctx.isOwner) {
      return jsonError('Forbidden: Viewers cannot edit notes', 403)
    }

    const body = await request.json()
    const { scenarioId, statementType, periodKey, userNotes } = body

    if (!statementType || !periodKey || userNotes === undefined) {
      return jsonError('Missing required fields: statementType, periodKey, userNotes', 400)
    }

    const now = new Date().toISOString()

    await db
      .insert(scenarioNotes)
      .values({
        companyId: ctx.companyId,
        scenarioId: scenarioId || null,
        statementType,
        periodKey,
        userNotes,
        updatedAt: now,
        updatedBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [
          scenarioNotes.companyId,
          scenarioNotes.scenarioId,
          scenarioNotes.statementType,
          scenarioNotes.periodKey,
        ],
        set: {
          userNotes,
          updatedAt: now,
          updatedBy: ctx.userId,
        },
      })

    return jsonOk({ success: true, updatedAt: now })
  } catch (error) {
    console.error('PUT /api/notes error:', error)
    return jsonError('Failed to save notes', 500)
  }
}
