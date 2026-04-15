import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'cashflowiq',
  name: 'CashFlowIQ',
})

// Typed event definitions
export type Events = {
  'forecast/config.updated': {
    data: { companyId: string; changeType: string }
  }
  'import/completed': {
    data: { companyId: string; accountsCount: number; periodsCount: number }
  }
  'compliance/reminder.check': {
    data: { companyId: string }
  }
  'user/signed.up': {
    data: { clerkUserId: string; email: string; name?: string }
  }
}
