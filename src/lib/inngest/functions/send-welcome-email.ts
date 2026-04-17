import { inngest } from '@/lib/inngest/client'
import { sendWelcomeEmail } from '@/lib/email/send'

export const sendWelcomeEmailOnSignup = inngest.createFunction(
  {
    id: 'send-welcome-email-on-signup',
    name: 'Send Welcome Email On Signup',
    triggers: [{ event: 'user/signed.up' }],
  },
  async ({ event, step }) => {
    await step.run('send-welcome-email', async () => {
      await sendWelcomeEmail({
        to: event.data.email,
        name: event.data.name,
      })
    })

    return { sent: true }
  }
)
