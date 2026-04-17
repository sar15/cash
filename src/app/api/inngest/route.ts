import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { complianceRemindersCron } from '@/lib/inngest/functions/compliance-reminders'
import { cleanupIdempotencyKeys } from '@/lib/inngest/functions/cleanup-idempotency-keys'
import { recomputeForecast } from '@/lib/inngest/functions/recompute-forecast'
import { scheduledMonthlyReport } from '@/lib/inngest/functions/scheduled-reports'
import { weeklyCashAlerts } from '@/lib/inngest/functions/weekly-cash-alerts'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    complianceRemindersCron,
    cleanupIdempotencyKeys,
    recomputeForecast,
    scheduledMonthlyReport,
    weeklyCashAlerts,
  ],
})
