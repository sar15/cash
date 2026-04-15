import { inngest } from '@/lib/inngest/client'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sendComplianceReminder } from '@/lib/email/send'

const COMPLIANCE_SCHEDULE = [
  { type: 'GST R-3B', dayOfMonth: 20, label: 'GST R-3B Payment' },
  { type: 'TDS Deposit', dayOfMonth: 7, label: 'TDS Deposit' },
  { type: 'PF/ESI', dayOfMonth: 15, label: 'PF/ESI Deposit' },
  { type: 'GST R-1', dayOfMonth: 11, label: 'GST R-1 Filing' },
]

function getDaysUntil(dayOfMonth: number): number {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
  const target = thisMonth > today ? thisMonth : nextMonth
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Inngest v4: createFunction takes (options, handler) — trigger is inside options
export const complianceRemindersCron = inngest.createFunction(
  {
    id: 'compliance-reminders-daily',
    name: 'Daily Compliance Reminders',
    triggers: [{ cron: 'TZ=Asia/Kolkata 0 8 * * *' }],
  },
  async ({ step }) => {
    // Only process companies with reminders enabled and a valid email
    const configs = await step.run('fetch-reminder-configs', async () => {
      return db.query.reminderConfig.findMany({
        where: eq(schema.reminderConfig.enabled, true),
      })
    })

    const activeConfigs = configs.filter(c => c.alertEmail && c.enabled)
    let sent = 0

    for (const config of activeConfigs) {
      const company = await step.run(`load-company-${config.companyId}`, async () => {
        return db.query.companies.findFirst({
          where: eq(schema.companies.id, config.companyId),
        })
      })

      if (!company || !config.alertEmail) continue

      for (const obligation of COMPLIANCE_SCHEDULE) {
        const daysUntil = getDaysUntil(obligation.dayOfMonth)
        const reminderDays = config.reminderDays ?? 3

        // Send at configured threshold and always at 1 day before
        if (daysUntil === reminderDays || daysUntil === 1) {
          await step.run(`send-${config.companyId}-${obligation.type}-${daysUntil}d`, async () => {
            const today = new Date()
            const dueDate = new Date(today.getFullYear(), today.getMonth(), obligation.dayOfMonth)
            const dueDateStr = `${String(dueDate.getDate()).padStart(2,'0')}/${String(dueDate.getMonth()+1).padStart(2,'0')}/${dueDate.getFullYear()}`

            await sendComplianceReminder({
              to: config.alertEmail!,
              companyName: company.name,
              obligationType: obligation.label,
              dueDate: dueDateStr,
              daysUntil,
            })
            sent++
          })
        }
      }
    }

    return { processed: activeConfigs.length, remindersSent: sent }
  }
)
