import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function getActualsForCompany(
  companyId: string,
  options?: { startPeriod?: string; endPeriod?: string }
) {
  const whereClauses = [eq(schema.monthlyActuals.companyId, companyId)]
  
  if (options?.startPeriod) {
    whereClauses.push(gte(schema.monthlyActuals.period, options.startPeriod))
  }
  if (options?.endPeriod) {
    whereClauses.push(lte(schema.monthlyActuals.period, options.endPeriod))
  }

  return db.query.monthlyActuals.findMany({
    where: and(...whereClauses),
    orderBy: (actuals, { asc }) => [asc(actuals.period)],
  })
}

export async function getActualsByPeriod(companyId: string, period: string) {
  return db.query.monthlyActuals.findMany({
    where: and(
      eq(schema.monthlyActuals.companyId, companyId),
      eq(schema.monthlyActuals.period, period)
    ),
  })
}

export async function upsertActuals(
  companyId: string,
  actuals: Array<{ accountId: string; period: string; amount: number }>
) {
  return db.transaction(async (tx) => {
    const results = []
    for (const actual of actuals) {
      const [result] = await tx
        .insert(schema.monthlyActuals)
        .values({ companyId, ...actual })
        .onConflictDoUpdate({
          target: [
            schema.monthlyActuals.companyId,
            schema.monthlyActuals.accountId,
            schema.monthlyActuals.period,
          ],
          set: { amount: actual.amount },
        })
        .returning()
      results.push(result)
    }
    return results
  })
}
