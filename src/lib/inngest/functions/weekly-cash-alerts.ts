/**
 * Weekly Cash Alert Email
 *
 * Runs every Monday at 8 AM IST.
 * Scans forecast results for companies with:
 *   1. Projected cash balance < 0 in the next 3 months
 *   2. Accounts payable > accounts receivable + cash (liquidity squeeze)
 *
 * Sends a proactive alert email if either condition is detected.
 */
import { inngest } from '@/lib/inngest/client'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

interface BSMonth {
  cash?: number
  ar?: number
  ap?: number
}

interface CashAlert {
  type: 'negative_cash' | 'liquidity_squeeze'
  month: string
  cashBalance: number
  detail: string
}

function detectAlerts(
  bsMonths: BSMonth[],
  forecastMonths: string[]
): CashAlert[] {
  const alerts: CashAlert[] = []
  const next3 = bsMonths.slice(0, 3)

  next3.forEach((month, i) => {
    const cash = month?.cash ?? 0
    const ar = month?.ar ?? 0
    const ap = month?.ap ?? 0
    const label = forecastMonths[i] ?? `Month ${i + 1}`

    if (cash < 0) {
      alerts.push({
        type: 'negative_cash',
        month: label,
        cashBalance: cash,
        detail: `Projected cash balance drops to ₹${(cash / 100).toLocaleString('en-IN')} in ${label}`,
      })
    }

    if (ap > ar + cash && ap > 0) {
      alerts.push({
        type: 'liquidity_squeeze',
        month: label,
        cashBalance: cash,
        detail: `Payables (₹${(ap / 100).toLocaleString('en-IN')}) exceed cash + receivables (₹${((ar + cash) / 100).toLocaleString('en-IN')}) in ${label}`,
      })
    }
  })

  return alerts
}

function formatINR(paise: number): string {
  const abs = Math.abs(paise)
  if (abs >= 10_000_000) return `₹${(paise / 10_000_000).toFixed(1)}Cr`
  if (abs >= 100_000) return `₹${(paise / 100_000).toFixed(1)}L`
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function buildAlertEmailHtml(
  companyName: string,
  alerts: CashAlert[],
  metrics: { closingCash: number; totalRevenue: number; runway: number }
): string {
  const alertRows = alerts.map(a => `
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:12px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#DC2626;text-transform:uppercase;letter-spacing:0.06em;">
        ${a.type === 'negative_cash' ? '⚠️ Negative Cash Projected' : '⚠️ Liquidity Squeeze'}
      </p>
      <p style="margin:6px 0 0;font-size:14px;color:#334155;">${a.detail}</p>
    </div>`).join('')

  const runwayText = metrics.runway >= 36 ? '36+ months' : `${metrics.runway.toFixed(1)} months`

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
    <div style="background:#0F172A;padding:24px 32px;">
      <span style="color:white;font-size:16px;font-weight:700;">CashFlowIQ</span>
      <span style="color:#94A3B8;font-size:13px;margin-left:12px;">Weekly Cash Alert</span>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0F172A;">Cash Risk Detected</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#64748B;">${companyName} · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;">
          <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:#94A3B8;">Cash Position</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0F172A;font-family:monospace;">${formatINR(metrics.closingCash)}</p>
        </div>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;">
          <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:#94A3B8;">Runway</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0F172A;font-family:monospace;">${runwayText}</p>
        </div>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;">
          <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:#94A3B8;">Revenue</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0F172A;font-family:monospace;">${formatINR(metrics.totalRevenue)}</p>
        </div>
      </div>

      <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#0F172A;">Issues detected in next 3 months:</p>
      ${alertRows}

      <div style="margin-top:24px;padding-top:24px;border-top:1px solid #E2E8F0;">
        <a href="https://cashflowiq.in/forecast" style="display:inline-block;background:#DC2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          Review Forecast Now →
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
      <p style="margin:0;font-size:12px;color:#94A3B8;">
        CashFlowIQ weekly alerts · <a href="https://cashflowiq.in/settings" style="color:#2563EB;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export const weeklyCashAlerts = inngest.createFunction(
  {
    id: 'weekly-cash-alerts',
    name: 'Weekly Cash Risk Alerts',
    triggers: [{ cron: 'TZ=Asia/Kolkata 0 8 * * 1' }], // Every Monday 8 AM IST
  },
  async ({ step }) => {
    if (!resend) {
      return { skipped: true, reason: 'Resend not configured' }
    }

    // Load all companies with reminders enabled and an alert email
    const configs = await step.run('fetch-reminder-configs', async () => {
      return db.query.reminderConfig.findMany({
        where: eq(schema.reminderConfig.enabled, true),
      })
    })

    const activeConfigs = configs.filter(c => c.alertEmail)
    let alertsSent = 0
    let companiesChecked = 0

    for (const config of activeConfigs) {
      const company = await step.run(`load-company-${config.companyId}`, async () => {
        return db.query.companies.findFirst({
          where: eq(schema.companies.id, config.companyId),
        })
      })

      if (!company || !config.alertEmail) continue
      companiesChecked++

      const forecastResult = await step.run(`load-forecast-${config.companyId}`, async () => {
        return db.query.forecastResults.findFirst({
          where: eq(schema.forecastResults.companyId, config.companyId),
        })
      })

      if (!forecastResult || forecastResult.status !== 'ready') continue

      // Parse cached forecast data
      let bsMonths: BSMonth[] = []
      let forecastMonths: string[] = []
      let metrics: { closingCash: number; totalRevenue: number; totalNetIncome: number; forecastMonths?: string[] } = {
        closingCash: 0, totalRevenue: 0, totalNetIncome: 0,
      }

      try {
        const bsData = JSON.parse(forecastResult.bsData) as { months?: BSMonth[] }
        bsMonths = bsData.months ?? []
        metrics = JSON.parse(forecastResult.metrics) as typeof metrics
        forecastMonths = metrics.forecastMonths ?? []
      } catch { continue }

      const alerts = detectAlerts(bsMonths, forecastMonths)
      if (alerts.length === 0) continue // No issues — no email needed

      // Calculate runway from metrics
      const closingCash = metrics.closingCash ?? 0
      const avgMonthlyBurn = bsMonths.length > 0
        ? bsMonths.reduce((sum, m) => sum + Math.abs(Math.min(0, (m?.cash ?? 0))), 0) / bsMonths.length
        : 0
      const runway = avgMonthlyBurn > 0 ? Math.min(closingCash / avgMonthlyBurn, 36) : 36

      await step.run(`send-alert-${config.companyId}`, async () => {
        await resend!.emails.send({
          from: FROM,
          to: config.alertEmail!,
          subject: `⚠️ Cash Risk Alert — ${company.name} · ${alerts.length} issue${alerts.length > 1 ? 's' : ''} detected`,
          html: buildAlertEmailHtml(company.name, alerts, {
            closingCash,
            totalRevenue: metrics.totalRevenue ?? 0,
            runway,
          }),
        })
        alertsSent++
      })
    }

    return { companiesChecked, alertsSent }
  }
)
