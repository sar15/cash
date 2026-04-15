import { type NextRequest, NextResponse } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonError } from '@/lib/api/helpers'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/export/full?companyId=
 *
 * Returns a complete JSON export of all company data:
 * - Company profile
 * - Chart of accounts
 * - Monthly actuals
 * - Value rules
 * - Timing profiles
 * - Compliance config
 * - Scenarios + overrides
 * - Micro-forecasts + lines
 * - Audit log (last 200 entries)
 *
 * Used for: data portability, backup, CA handoff
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const companyId = ctx.companyId

    const [
      company,
      accounts,
      actuals,
      valueRules,
      timingProfiles,
      complianceConfig,
      quickMetrics,
      scenarios,
      microForecasts,
      auditLog,
      reminderConfig,
    ] = await Promise.all([
      db.query.companies.findFirst({ where: eq(schema.companies.id, companyId) }),
      db.query.accounts.findMany({ where: eq(schema.accounts.companyId, companyId), orderBy: (a, { asc }) => [asc(a.sortOrder)] }),
      db.query.monthlyActuals.findMany({ where: eq(schema.monthlyActuals.companyId, companyId), orderBy: (a, { asc }) => [asc(a.period)] }),
      db.query.valueRules.findMany({ where: eq(schema.valueRules.companyId, companyId) }),
      db.query.timingProfiles.findMany({ where: eq(schema.timingProfiles.companyId, companyId) }),
      db.query.complianceConfig.findFirst({ where: eq(schema.complianceConfig.companyId, companyId) }),
      db.query.quickMetricsConfig.findFirst({ where: eq(schema.quickMetricsConfig.companyId, companyId) }),
      db.query.scenarios.findMany({ where: eq(schema.scenarios.companyId, companyId), with: { overrides: true } }),
      db.query.microForecasts.findMany({ where: eq(schema.microForecasts.companyId, companyId), with: { lines: true } }),
      db.query.auditLog.findMany({ where: eq(schema.auditLog.companyId, companyId), orderBy: (l, { desc }) => [desc(l.createdAt)], limit: 200 }),
      db.query.reminderConfig.findFirst({ where: eq(schema.reminderConfig.companyId, companyId) }),
    ])

    if (!company) return jsonError('Company not found', 404)

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      company: {
        id: company.id,
        name: company.name,
        pan: company.pan,
        gstin: company.gstin,
        industry: company.industry,
        fyStartMonth: company.fyStartMonth,
        currency: company.currency,
        numberFormat: company.numberFormat,
      },
      accounts,
      actuals,
      valueRules,
      timingProfiles,
      complianceConfig,
      quickMetrics,
      scenarios,
      microForecasts,
      reminderConfig,
      auditLog,
    }

    const filename = `cashflowiq-export-${company.name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return jsonError('Failed to export data', 500)
  }
}
