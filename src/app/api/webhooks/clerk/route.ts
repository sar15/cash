import { type NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { and, eq } from 'drizzle-orm'

import { db, schema } from '@/lib/db'
import { inngest } from '@/lib/inngest/client'

interface ClerkUserCreatedEvent {
  type: 'user.created'
  data: {
    id: string
    email_addresses: Array<{ email_address: string; id: string }>
    first_name?: string | null
    last_name?: string | null
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Webhook] CLERK_WEBHOOK_SECRET not configured — webhook request rejected')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }
    // Dev: skip silently
    return NextResponse.json({ received: true })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await request.text()

  let event: ClerkUserCreatedEvent
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const primaryEmail = event.data.email_addresses[0]?.email_address
    if (primaryEmail) {
      const [delivery] = await db
        .insert(schema.webhookDeliveries)
        .values({
          provider: 'clerk',
          eventId: svixId,
        })
        .onConflictDoNothing({
          target: [schema.webhookDeliveries.provider, schema.webhookDeliveries.eventId],
        })
        .returning()

      if (!delivery) {
        return NextResponse.json({ received: true, duplicate: true })
      }

      const name = [event.data.first_name, event.data.last_name].filter(Boolean).join(' ')
      try {
        await inngest.send({
          name: 'user/signed.up',
          data: {
            clerkUserId: event.data.id,
            email: primaryEmail,
            name: name || undefined,
          },
        })
      } catch (error) {
        await db
          .delete(schema.webhookDeliveries)
          .where(and(
            eq(schema.webhookDeliveries.provider, 'clerk'),
            eq(schema.webhookDeliveries.eventId, svixId)
          ))
        throw error
      }
    }
  }

  return NextResponse.json({ received: true })
}
