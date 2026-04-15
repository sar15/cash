import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { complianceRemindersCron } from '@/lib/inngest/functions/compliance-reminders'
import { recomputeForecast } from '@/lib/inngest/functions/recompute-forecast'
import { scheduledMonthlyReport } from '@/lib/inngest/functions/scheduled-reports'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    complianceRemindersCron,
    recomputeForecast,
    scheduledMonthlyReport,
  ],
})
