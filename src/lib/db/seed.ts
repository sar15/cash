/**
 * Database Seed Script
 *
 * FIX audit2 L1: Seed script for populating initial data.
 * usage: npx tsx src/lib/db/seed.ts
 */
import { db, schema } from './index'
import { INDIAN_COA } from '../standards/indian-coa'

async function seed() {
  console.log('[SEED] Starting database seed...')

  // 1. Check if any companies exist
  const existingCompanies = await db.query.companies.findMany()
  if (existingCompanies.length > 0) {
    console.log(`[SEED] Found ${existingCompanies.length} existing company(s). Skipping seed.`)
    return
  }

  // 2. Create a demo company
  const [company] = await db
    .insert(schema.companies)
    .values({
      name: 'Demo Company',
      clerkUserId: 'seed-user',
      industry: 'manufacturing',
      fyStartMonth: 4,
      currency: 'INR',
      numberFormat: 'lakhs',
    })
    .returning()

  console.log(`[SEED] Created company: ${company.name} (${company.id})`)

  // 3. Seed the Indian Chart of Accounts
  const accountValues = INDIAN_COA.map((account, idx) => ({
    companyId: company.id,
    name: account.name,
    accountType: account.accountType,
    sortOrder: idx,
  }))

  await db.insert(schema.accounts).values(accountValues)
  console.log(`[SEED] Inserted ${accountValues.length} accounts from Indian CoA`)

  // 4. Create default compliance config
  await db.insert(schema.complianceConfig).values({
    companyId: company.id,
    gstRate: 18.0,
    itcPct: 85.0,
    taxRate: 25.0,
    supplyType: 'intra-state',
    tdsRegime: 'new',
    tdsSections: JSON.stringify([]),
    pfApplicable: true,
    esiApplicable: true,
  })
  console.log('[SEED] Created default compliance config')

  // 5. Create default quick metrics config
  await db.insert(schema.quickMetricsConfig).values({
    companyId: company.id,
    threshold: JSON.stringify({
      minimumCashThreshold: 50_000_00, // ₹50,000 in paise
      receivablesAlertThreshold: 90, // 90 days
    }),
  })
  console.log('[SEED] Created default quick metrics config')

  console.log('[SEED] ✅ Seed complete')
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[SEED] Failed:', err)
    process.exit(1)
  })
