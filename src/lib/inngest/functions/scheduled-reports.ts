import { inngest } from '@/lib/inngest/client'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

/**
 * Monthly scheduled report delivery — runs on 1st of each month at 9am IST
 * Sends a summary email to companies with reminder_config.enabled = true
 */
export const scheduledMonthlyReport = inngest.createFunction(
  {
    id: 'scheduled-monthly-report',
    name: 'Monthly Report Delivery',
    triggers: [{ cron: 'TZ=Asia/Kolkata 0 9 1 * *' }],
  },
  async ({ step }) => {
    if (!resend) {
      return { skipped: true, reason: 'Resend not configured' }
    }

    const configs = await step.run('fetch-reminder-configs', async () => {
      return db.query.reminderConfig.findMany({
        where: eq(schema.reminderConfig.enabled, true),
      })
    })

    const activeConfigs = configs.filter(c => c.alertEmail)
    let sent = 0

    for (const config of activeConfigs) {
      const company = await step.run(`load-company-${config.companyId}`, async () => {
        return db.query.companies.findFirst({
          where: eq(schema.companies.id, config.companyId),
        })
      })

      if (!company || !config.alertEmail) continue

      // Get cached forecast result
      const forecastResult = await step.run(`load-forecast-${config.companyId}`, async () => {
        return db.query.forecastResults.findFirst({
          where: eq(schema.forecastResults.companyId, config.companyId),
        })
      })

      if (!forecastResult) continue

      let metrics: { closingCash?: number; totalRevenue?: number; totalNetIncome?: number } = {}
      try {
        metrics = JSON.parse(forecastResult.metrics) as typeof metrics
      } catch { /* ignore */ }

      const formatINR = (paise: number) => {
        const lakhs = paise / 10_000_000
        return `₹${lakhs.toFixed(1)}L`
      }

      const now = new Date()
      const monthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

      await step.run(`send-report-${config.companyId}`, async () => {
        await resend!.emails.send({
          from: FROM,
          to: config.alertEmail!,
          subject: `${company.name} — Monthly Forecast Summary · ${monthName}`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
    <div style="background:#0F172A;padding:24px 32px;">
      <span style="color:white;font-size:16px;font-weight:700;">CashFlowIQ</span>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F172A;">Monthly Summary</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#64748B;">${company.name} · ${monthName}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
        <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:16px;">
          <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:#059669;">Cash Position</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0F172A;font-family:monospace;">${metrics.closingCash ? formatINR(metrics.closingCash) : '—'}</p>
        </div>
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;">
          <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:#2563EB;">Revenue</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0F172A;font-family:monospace;">${metrics.totalRevenue ? formatINR(metrics.totalRevenue) : '—'}</p>
        </div>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;">
          <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:#64748B;">Net Income</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0F172A;font-family:monospace;">${metrics.totalNetIncome ? formatINR(metrics.totalNetIncome) : '—'}</p>
        </div>
      </div>
      <a href="https://cashflowiq.in/dashboard" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
        View Full Forecast →
      </a>
    </div>
    <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
      <p style="margin:0;font-size:12px;color:#94A3B8;">CashFlowIQ · <a href="https://cashflowiq.in/settings" style="color:#2563EB;">Manage preferences</a></p>
    </div>
  </div>
</body>
</html>`,
        })
        sent++
      })
    }

    return { processed: activeConfigs.length, sent }
  }
)
