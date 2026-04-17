import { db } from '@/lib/db'
import { gstFilings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import type { ComplianceResult } from '@/lib/engine/compliance'
import { todayISTString } from '@/lib/utils/ist'

/**
 * Auto-populate GST filings from compliance engine result
 */
export async function populateGSTFilings(
  companyId: string,
  complianceResult: ComplianceResult
) {
  const filings: Array<{
    companyId: string
    period: string
    returnType: 'GSTR-1' | 'GSTR-3B'
    status: 'pending' | 'filed' | 'overdue'
    dueDate: string
    amountPaise: number
  }> = []

  // Generate filings from GST forecast result
  if (!complianceResult.gst?.months) return 0

  complianceResult.gst.months.forEach((month) => {
    const period = month.period // YYYY-MM-01
    const gstPayable = month.netPayable ?? 0

    if (gstPayable === 0) return // Skip months with no GST

    // GSTR-1 due on 11th of next month
    const gstr1DueDate = new Date(period)
    gstr1DueDate.setMonth(gstr1DueDate.getMonth() + 1)
    gstr1DueDate.setDate(11)

    // GSTR-3B due on 20th of next month
    const gstr3bDueDate = new Date(period)
    gstr3bDueDate.setMonth(gstr3bDueDate.getMonth() + 1)
    gstr3bDueDate.setDate(20)

    // Use IST today — Vercel runs UTC, India is UTC+5:30
    const todayStr = todayISTString()
    const getStatus = (dueDate: Date) => {
      const dueDateStr = dueDate.toISOString().split('T')[0]
      return dueDateStr < todayStr ? 'overdue' : 'pending'
    }

    filings.push({
      companyId,
      period,
      returnType: 'GSTR-1',
      status: getStatus(gstr1DueDate),
      dueDate: gstr1DueDate.toISOString().split('T')[0],
      amountPaise: 0, // GSTR-1 is informational
    })

    filings.push({
      companyId,
      period,
      returnType: 'GSTR-3B',
      status: getStatus(gstr3bDueDate),
      dueDate: gstr3bDueDate.toISOString().split('T')[0],
      amountPaise: gstPayable,
    })
  })

  // Upsert filings (insert or update if exists)
  for (const filing of filings) {
    const existing = await db.query.gstFilings.findFirst({
      where: and(
        eq(gstFilings.companyId, filing.companyId),
        eq(gstFilings.period, filing.period),
        eq(gstFilings.returnType, filing.returnType)
      ),
    })

    if (existing) {
      // Update only if not already filed
      if (existing.status !== 'filed') {
        await db
          .update(gstFilings)
          .set({
            status: filing.status,
            dueDate: filing.dueDate,
            amountPaise: filing.amountPaise,
          })
          .where(eq(gstFilings.id, existing.id))
      }
    } else {
      // Insert new filing
      await db.insert(gstFilings).values({
        id: crypto.randomUUID(),
        ...filing,
      })
    }
  }

  return filings.length
}

/**
 * Get all GST filings for a company
 */
export async function getGSTFilings(companyId: string) {
  return db.query.gstFilings.findMany({
    where: eq(gstFilings.companyId, companyId),
    orderBy: (filings, { desc }) => [desc(filings.period)],
  })
}

/**
 * Mark a filing as filed
 */
export async function markFilingAsFiled(
  filingId: string,
  referenceNumber?: string
) {
  await db
    .update(gstFilings)
    .set({
      status: 'filed',
      filedAt: new Date().toISOString(),
      referenceNumber,
    })
    .where(eq(gstFilings.id, filingId))
}
