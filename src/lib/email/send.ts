import { Resend } from 'resend'
import { withRetry, withTimeout } from '@/lib/server/resilience'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// Use configured from address only — no fallback to test domain
const FROM = process.env.RESEND_FROM_EMAIL ?? ''
const EMAIL_TIMEOUT_MS = 8_000

async function sendEmailWithResilience(payload: Parameters<Resend['emails']['send']>[0]) {
  if (!resend) return
  await withRetry(
    () => withTimeout(resend.emails.send(payload), EMAIL_TIMEOUT_MS, 'Email send'),
    3
  )
}

export interface ComplianceReminderData {
  to: string
  companyName: string
  obligationType: string  // 'GST R-3B' | 'TDS Deposit' | 'PF/ESI'
  dueDate: string         // 'DD/MM/YYYY'
  daysUntil: number
  amount?: number         // paise — optional, shown if available
}

export interface WelcomeEmailData {
  to: string
  name?: string
}

export interface ImportSuccessData {
  to: string
  companyName: string
  accountsCount: number
  periodsCount: number
}

export async function sendComplianceReminder(data: ComplianceReminderData) {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Email] RESEND_API_KEY not configured — compliance reminder NOT sent to', data.to)
    } else {
      console.log('[Email] Resend not configured — skipping compliance reminder to', data.to)
    }
    return
  }

  const urgency = data.daysUntil <= 1 ? '🚨 URGENT: ' : data.daysUntil <= 3 ? '⚠️ ' : ''
  const subject = `${urgency}${data.obligationType} due in ${data.daysUntil} day${data.daysUntil === 1 ? '' : 's'} — ${data.companyName}`

  await sendEmailWithResilience({
    from: FROM,
    to: data.to,
    subject,
    html: buildComplianceReminderHtml(data),
  })
}

export async function sendWelcomeEmail(data: WelcomeEmailData) {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Email] RESEND_API_KEY not configured — welcome email NOT sent to', data.to)
    } else {
      console.log('[Email] Resend not configured — skipping welcome email to', data.to)
    }
    return
  }

  await sendEmailWithResilience({
    from: FROM,
    to: data.to,
    subject: 'Welcome to CashFlowIQ — your 12-month forecast is ready',
    html: buildWelcomeHtml(data),
  })
}

export async function sendImportSuccessEmail(data: ImportSuccessData) {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Email] RESEND_API_KEY not configured — import success email NOT sent to', data.to)
    } else {
      console.log('[Email] Resend not configured — skipping import success email to', data.to)
    }
    return
  }

  await sendEmailWithResilience({
    from: FROM,
    to: data.to,
    subject: `Import complete — ${data.accountsCount} accounts, ${data.periodsCount} months imported`,
    html: buildImportSuccessHtml(data),
  })
}

// ── HTML templates (inline styles for email client compatibility) ──────────

function buildComplianceReminderHtml(data: ComplianceReminderData): string {
  const urgencyColor = data.daysUntil <= 1 ? '#DC2626' : data.daysUntil <= 3 ? '#D97706' : '#2563EB'
  const amountLine = data.amount
    ? `<p style="margin:8px 0;font-size:14px;color:#334155;">Estimated amount: <strong style="font-family:monospace;">₹${(data.amount / 100).toLocaleString('en-IN')}</strong></p>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
    <!-- Header -->
    <div style="background:#0F172A;padding:24px 32px;display:flex;align-items:center;gap:12px;">
      <div style="background:#059669;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:16px;font-weight:bold;">₹</span>
      </div>
      <span style="color:white;font-size:16px;font-weight:700;letter-spacing:-0.02em;">CashFlowIQ</span>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <div style="background:${urgencyColor}15;border:1px solid ${urgencyColor}40;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${urgencyColor};">
          ${data.daysUntil <= 1 ? 'Due Tomorrow' : `Due in ${data.daysUntil} Days`}
        </p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0F172A;">${data.obligationType}</p>
      </div>
      <p style="margin:0 0 8px;font-size:14px;color:#64748B;">Company</p>
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0F172A;">${data.companyName}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#64748B;">Due Date</p>
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0F172A;">${data.dueDate}</p>
      ${amountLine}
      <div style="margin-top:24px;padding-top:24px;border-top:1px solid #E2E8F0;">
        <a href="https://cashflowiq.in/compliance" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          View Compliance Calendar →
        </a>
      </div>
    </div>
    <!-- Footer -->
    <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
      <p style="margin:0;font-size:12px;color:#94A3B8;">
        You're receiving this because you enabled compliance reminders in CashFlowIQ.
        <a href="https://cashflowiq.in/settings" style="color:#2563EB;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildWelcomeHtml(data: WelcomeEmailData): string {
  const greeting = data.name ? `Hi ${data.name},` : 'Welcome,'
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
    <div style="background:#0F172A;padding:24px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="background:#059669;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:16px;font-weight:bold;">₹</span>
        </div>
        <span style="color:white;font-size:16px;font-weight:700;">CashFlowIQ</span>
      </div>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0F172A;">${greeting}</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#64748B;line-height:1.6;">
        Your CashFlowIQ account is ready. Upload your P&amp;L and Balance Sheet to get a 12-month three-way forecast with GST, TDS, and PF/ESI compliance — in minutes.
      </p>
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;">Get started in 3 steps</p>
        <p style="margin:0 0 8px;font-size:14px;color:#334155;">1. Upload your Excel P&amp;L or Balance Sheet</p>
        <p style="margin:0 0 8px;font-size:14px;color:#334155;">2. Review the auto-mapped chart of accounts</p>
        <p style="margin:0;font-size:14px;color:#334155;">3. See your 12-month forecast instantly</p>
      </div>
      <a href="https://cashflowiq.in/data" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
        Import your financials →
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#94A3B8;">
        Or <a href="https://cashflowiq.in/dashboard" style="color:#2563EB;">try with sample data</a> to explore the platform first.
      </p>
    </div>
    <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
      <p style="margin:0;font-size:12px;color:#94A3B8;">CashFlowIQ · Three-way forecasting for Indian businesses</p>
    </div>
  </div>
</body>
</html>`
}

function buildImportSuccessHtml(data: ImportSuccessData): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
    <div style="background:#0F172A;padding:24px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="background:#059669;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:16px;font-weight:bold;">₹</span>
        </div>
        <span style="color:white;font-size:16px;font-weight:700;">CashFlowIQ</span>
      </div>
    </div>
    <div style="padding:32px;">
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#059669;">Import Complete</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0F172A;">${data.companyName}</p>
      </div>
      <p style="margin:0 0 8px;font-size:14px;color:#64748B;">Accounts imported</p>
      <p style="margin:0 0 16px;font-size:24px;font-weight:700;font-family:monospace;color:#0F172A;">${data.accountsCount}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#64748B;">Months of history</p>
      <p style="margin:0 0 24px;font-size:24px;font-weight:700;font-family:monospace;color:#0F172A;">${data.periodsCount}</p>
      <a href="https://cashflowiq.in/forecast" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
        View your forecast →
      </a>
    </div>
    <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
      <p style="margin:0;font-size:12px;color:#94A3B8;">CashFlowIQ · Three-way forecasting for Indian businesses</p>
    </div>
  </div>
</body>
</html>`
}
