import { type NextRequest } from 'next/server'
import { resolveAuthedCompany, isErrorResponse, jsonOk, jsonError } from '@/lib/api/helpers'
import * as companyQueries from '@/lib/db/queries/companies'

// GET /api/reports/branding — Get company branding for PDF reports
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthedCompany(request)
    if (isErrorResponse(ctx)) return ctx

    const company = await companyQueries.getCompanyById(ctx.companyId)
    if (!company) return jsonError('Company not found', 404)

    return jsonOk({
      branding: {
        companyName: company.name,
        pan: company.pan,
        gstin: company.gstin,
        industry: company.industry,
        currency: company.currency,
        numberFormat: company.numberFormat,
        logoUrl: company.logoUrl,
      },
    })
  } catch {
    return jsonError('Failed to fetch branding', 500)
  }
}
