Here are the complete findings for all requested files:

---

## 1. `src/proxy.ts` -- FOUND

**Path:** `/Users/sarhanak/Documents/CashFlowIQ/src/proxy.ts`

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/forecast(.*)',
  '/scenarios(.*)',
  '/data(.*)',
  '/settings(.*)',
  '/reports(.*)',
  '/compliance(.*)',
  '/accounts(.*)',
  '/api/((?!webhooks).*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

---

## 2. `src/middleware.ts` -- DOES NOT EXIST

No file at `src/middleware.ts` was found. The Clerk middleware is instead defined in `src/proxy.ts` (shown above).

---

## 3. Clerk-Related Files

There are **no dedicated Clerk provider or middleware files** (e.g., `src/middleware.ts`, `src/lib/clerk*`, etc.). Clerk integration exists in these files:

- **`src/proxy.ts`** -- This is the primary Clerk middleware file (shown above). It imports `clerkMiddleware` and `createRouteMatcher` from `@clerk/nextjs/server` and defines protected routes.
- **`src/app/api/micro-forecasts/route.ts`** -- Uses `auth` from `@clerk/nextjs/server` for authentication.
- **`src/app/api/micro-forecasts/[id]/route.ts`** -- Uses `auth` from `@clerk/nextjs/server` for authentication.
- **`src/lib/db/company-context.ts`** -- References `clerkUserId` for user-company mapping.
- **`src/lib/db/schema.ts`** -- Defines `clerkUserId` column on the `companies` table.

---

## 4. Micro-Forecasts API Routes

### `src/app/api/micro-forecasts/route.ts` -- FOUND

**Path:** `/Users/sarhanak/Documents/CashFlowIQ/src/app/api/micro-forecasts/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, schema } from '@/lib/db';
import { resolveCompanyForUser } from '@/lib/db/company-context';
import { eq } from 'drizzle-orm';

interface MicroForecastLinePayload {
  accountId?: string | null;
  futureAccountName?: string | null;
  futureAccountType?: string | null;
  ruleType?: string | null;
  config?: string | Record<string, unknown> | null;
  timingProfileId?: string | null;
}

interface MicroForecastPayload {
  companyId?: string;
  name: string;
  category: string;
  isActive?: boolean;
  startMonth: string;
  endMonth?: string | null;
  wizardConfig?: string | Record<string, unknown>;
  sortOrder?: number;
  lines?: MicroForecastLinePayload[];
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');

    const company = await resolveCompanyForUser(userId, companyId);
    if (!company) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const forecasts = await db.query.microForecasts.findMany({
      where: eq(schema.microForecasts.companyId, company.id),
      orderBy: (mf, { asc }) => [asc(mf.sortOrder)]
    });

    const forecastIds = forecasts.map(f => f.id);
    
    const lines =
      forecastIds.length > 0
        ? await db.query.microForecastLines.findMany({
            where: (mfl, { inArray }) => inArray(mfl.microForecastId, forecastIds)
          })
        : [];

    const result = forecasts.map(f => ({
      ...f,
      lines: lines.filter(l => l.microForecastId === f.id)
    }));

    return NextResponse.json({
      companyId: company.id,
      forecasts: result,
    });
  } catch (error) {
    console.error('[MICRO_FORECASTS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const body = (await req.json()) as MicroForecastPayload;
    const { companyId, name, category, isActive, startMonth, endMonth, wizardConfig, sortOrder, lines } = body;

    const company = await resolveCompanyForUser(userId, companyId);
    if (!company) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Insert micro-forecast
    const [newForecast] = await db.insert(schema.microForecasts).values({
      companyId: company.id,
      name,
      category,
      isActive: isActive ?? true,
      startMonth,
      endMonth,
      wizardConfig: typeof wizardConfig === 'string' ? wizardConfig : JSON.stringify(wizardConfig || {}),
      sortOrder: sortOrder ?? 0
    }).returning();

    // Insert lines if any
    const insertedLines =
      lines && lines.length > 0
        ? await db.insert(schema.microForecastLines).values(
            lines.map((l) => ({
              microForecastId: newForecast.id,
              accountId: l.accountId,
              futureAccountName: l.futureAccountName,
              futureAccountType: l.futureAccountType,
              ruleType: l.ruleType || 'direct_entry',
              config: typeof l.config === 'string' ? l.config : JSON.stringify(l.config || {}),
              timingProfileId: l.timingProfileId
            }))
          ).returning()
        : [];

    return NextResponse.json({
      companyId: company.id,
      forecast: { ...newForecast, lines: insertedLines },
    });
  } catch (error) {
    console.error('[MICRO_FORECASTS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
```

### `src/app/api/micro-forecasts/[id]/route.ts` -- FOUND

**Path:** `/Users/sarhanak/Documents/CashFlowIQ/src/app/api/micro-forecasts/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface MicroForecastLinePayload {
  accountId?: string | null;
  futureAccountName?: string | null;
  futureAccountType?: string | null;
  ruleType?: string | null;
  config?: string | Record<string, unknown> | null;
  timingProfileId?: string | null;
}

interface MicroForecastPatchPayload {
  name?: string;
  category?: string;
  isActive?: boolean;
  startMonth?: string;
  endMonth?: string | null;
  wizardConfig?: string | Record<string, unknown>;
  sortOrder?: number;
  lines?: MicroForecastLinePayload[];
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const body = (await req.json()) as MicroForecastPatchPayload;
    const { name, category, isActive, startMonth, endMonth, wizardConfig, sortOrder, lines } = body;

    // Verify ownership
    const forecast = await db.query.microForecasts.findFirst({
      where: eq(schema.microForecasts.id, id)
    });

    if (!forecast) return new NextResponse('Not found', { status: 404 });

    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, forecast.companyId)
    });

    if (!company || company.clerkUserId !== userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Update
    const [updated] = await db.update(schema.microForecasts).set({
      name,
      category,
      isActive,
      startMonth,
      endMonth,
      wizardConfig: typeof wizardConfig === 'string' ? wizardConfig : JSON.stringify(wizardConfig || {}),
      sortOrder
    }).where(eq(schema.microForecasts.id, id)).returning();

    // Handling lines is tricky: simple approach is delete all and insert new ones
    if (lines !== undefined) {
      await db.delete(schema.microForecastLines).where(eq(schema.microForecastLines.microForecastId, id));
      
      if (lines.length > 0) {
        const linesToInsert = lines.map((l) => ({
          microForecastId: id,
          accountId: l.accountId,
          futureAccountName: l.futureAccountName,
          futureAccountType: l.futureAccountType,
          ruleType: l.ruleType || 'direct_entry',
          config: typeof l.config === 'string' ? l.config : JSON.stringify(l.config || {}),
          timingProfileId: l.timingProfileId
        }));
        await db.insert(schema.microForecastLines).values(linesToInsert);
      }
    }

    const finalLines = await db.query.microForecastLines.findMany({
      where: eq(schema.microForecastLines.microForecastId, id)
    });

    return NextResponse.json({ ...updated, lines: finalLines });
  } catch (error) {
    console.error('[MICRO_FORECASTS_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const forecast = await db.query.microForecasts.findFirst({
      where: eq(schema.microForecasts.id, id)
    });

    if (!forecast) return new NextResponse('Not found', { status: 404 });

    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, forecast.companyId)
    });

    if (!company || company.clerkUserId !== userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    await db.delete(schema.microForecasts).where(eq(schema.microForecasts.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[MICRO_FORECASTS_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
```

---

## 5. `src/lib/db/company-context.ts` -- FOUND

**Path:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/db/company-context.ts`

```ts
import { eq } from 'drizzle-orm';

import { db, schema } from '@/lib/db';

export async function getOrCreatePrimaryCompanyForUser(clerkUserId: string) {
  const existingCompany = await db.query.companies.findFirst({
    where: eq(schema.companies.clerkUserId, clerkUserId),
    orderBy: (companies, { asc }) => [asc(companies.createdAt)],
  });

  if (existingCompany) {
    return existingCompany;
  }

  const [createdCompany] = await db
    .insert(schema.companies)
    .values({
      clerkUserId,
      name: 'Patel Engineering Works',
      industry: 'manufacturing',
      fyStartMonth: 4,
      currency: 'INR',
      numberFormat: 'lakhs',
    })
    .returning();

  return createdCompany;
}

export async function resolveCompanyForUser(clerkUserId: string, companyId?: string | null) {
  if (!companyId) {
    return getOrCreatePrimaryCompanyForUser(clerkUserId);
  }

  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, companyId),
  });

  if (!company || company.clerkUserId !== clerkUserId) {
    return null;
  }

  return company;
}
```

---

## 6. `src/lib/db/schema.ts` -- FOUND

**Path:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/db/schema.ts`

```ts
import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ============================================================
// COMPANIES (Clerk manages users — no users table needed)
// ============================================================
export const companies = sqliteTable('companies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkUserId: text('clerk_user_id').notNull(),
  name: text('name').notNull(),
  pan: text('pan'),
  gstin: text('gstin'),
  industry: text('industry').default('general'),
  fyStartMonth: integer('fy_start_month').default(4), // April = 4
  currency: text('currency').default('INR'),
  numberFormat: text('number_format').default('lakhs'), // lakhs | crores | millions
  logoUrl: text('logo_url'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_companies_user').on(table.clerkUserId),
])

// ============================================================
// CHART OF ACCOUNTS
// ============================================================
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: text('code'),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  level: integer('level').default(0), // 0=group, 1=account, 2=sub-account
  accountType: text('account_type').notNull(), // revenue | expense | asset | liability | equity
  standardMapping: text('standard_mapping'),
  isGroup: integer('is_group', { mode: 'boolean' }).default(false),
  sortOrder: integer('sort_order').default(0),
}, (table) => [
  index('idx_accounts_company').on(table.companyId, table.sortOrder),
])

// ============================================================
// MONTHLY ACTUALS (historical data — amounts in PAISE)
// ============================================================
export const monthlyActuals = sqliteTable('monthly_actuals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  period: text('period').notNull(), // '2024-04-01' (first day of month)
  amount: integer('amount').notNull(), // IN PAISE — ₹12,34,567.89 → 123456789
}, (table) => [
  uniqueIndex('idx_actuals_unique').on(table.companyId, table.accountId, table.period),
  index('idx_actuals_company_period').on(table.companyId, table.period),
])

// ============================================================
// VALUE RULES (forecast configuration)
// ============================================================
export const valueRules = sqliteTable('value_rules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  scenarioId: text('scenario_id'), // NULL = baseline
  ruleType: text('rule_type').notNull(), // rolling_avg | growth | smart_pred | same_last_year | formula | direct_entry | baseline_adjustment
  config: text('config').notNull().default('{}'), // JSON: rule-specific parameters
  sortOrder: integer('sort_order').default(0),
}, (table) => [
  uniqueIndex('idx_value_rules_unique').on(table.companyId, table.accountId, table.scenarioId),
])

// ============================================================
// TIMING PROFILES
// ============================================================
export const timingProfiles = sqliteTable('timing_profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  profileType: text('profile_type').notNull(), // receivables | payables | deferred | prepaid
  config: text('config').notNull().default('{}'), // JSON: { "month_0": 0.30, "month_1": 0.40, ... }
  autoDerived: integer('auto_derived', { mode: 'boolean' }).default(false),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
})

// ============================================================
// MICRO-FORECASTS (business events)
// ============================================================
export const microForecasts = sqliteTable('micro_forecasts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(), // hire | asset | loan | revenue | marketing | equity | custom
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  startMonth: text('start_month').notNull(), // '2025-08-01'
  endMonth: text('end_month'), // NULL = ongoing
  wizardConfig: text('wizard_config').notNull().default('{}'), // JSON: all wizard inputs
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const microForecastLines = sqliteTable('micro_forecast_lines', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  microForecastId: text('micro_forecast_id').notNull().references(() => microForecasts.id, { onDelete: 'cascade' }),
  accountId: text('account_id'),
  futureAccountName: text('future_account_name'),
  futureAccountType: text('future_account_type'), // revenue | expense | asset | liability | equity
  ruleType: text('rule_type').default('direct_entry'),
  config: text('config').notNull().default('{}'), // JSON: { "flat": 80000 }
  timingProfileId: text('timing_profile_id'),
})

// ============================================================
// SCENARIOS
// ============================================================
export const scenarios = sqliteTable('scenarios', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  parentId: text('parent_id'), // NULL = inherits from baseline
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const scenarioOverrides = sqliteTable('scenario_overrides', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  scenarioId: text('scenario_id').notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
  targetType: text('target_type').notNull(), // value_rule | timing_profile | micro_toggle
  targetId: text('target_id'),
  config: text('config').notNull().default('{}'), // JSON: the override specification
})

// ============================================================
// COMPLIANCE CONFIGURATION
// ============================================================
export const complianceConfig = sqliteTable('compliance_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().unique(),
  gstType: text('gst_type').default('regular'), // regular | qrmp
  gstRate: real('gst_rate').default(18.0), // Percentage, not money — REAL is fine
  itcPct: real('itc_pct').default(85.0), // % of input GST claimed
  gstFrequency: text('gst_frequency').default('monthly'),
  tdsRegime: text('tds_regime').default('new'),
  tdsSections: text('tds_sections').default('{}'), // JSON: section-specific rates
  taxRate: real('tax_rate').default(25.17), // Effective tax rate percentage
  pfApplicable: integer('pf_applicable', { mode: 'boolean' }).default(true),
  esiApplicable: integer('esi_applicable', { mode: 'boolean' }).default(true),
})

// ============================================================
// FORECAST RESULTS (cached for persistence)
// ============================================================
export const forecastResults = sqliteTable('forecast_results', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  scenarioId: text('scenario_id'), // NULL = baseline
  plData: text('pl_data').notNull().default('{}'), // JSON
  bsData: text('bs_data').notNull().default('{}'), // JSON
  cfData: text('cf_data').notNull().default('{}'), // JSON
  compliance: text('compliance').notNull().default('{}'), // JSON
  metrics: text('metrics').notNull().default('{}'), // JSON
  version: integer('version').default(1),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_forecast_company_scenario').on(table.companyId, table.scenarioId),
])

// ============================================================
// QUICK METRICS CONFIGURATION
// ============================================================
export const quickMetricsConfig = sqliteTable('quick_metrics_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text('company_id').notNull().unique(),
  metric1: text('metric_1').default('cash_on_hand'),
  metric2: text('metric_2').default('net_income'),
  metric3: text('metric_3').default('gross_margin_pct'),
  metric4: text('metric_4').default('working_capital_gap'),
  metric5: text('metric_5').default(''),
  threshold: text('threshold').default('{}'), // JSON: { "cash_on_hand": { "min": 500000 } }
})
```

---

## 7. `drizzle.config.ts` -- FOUND

**Path:** `/Users/sarhanak/Documents/CashFlowIQ/drizzle.config.ts`

```ts
import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
```

---

## 8. `src/lib/db/index.ts` -- FOUND

**Path:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/db/index.ts`

```ts
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const db = drizzle(client, { schema })

export { schema }
```

---

## Summary Table

| # | File | Status | Absolute Path |
|---|------|--------|---------------|
| 1 | `src/proxy.ts` | FOUND | `/Users/sarhanak/Documents/CashFlowIQ/src/proxy.ts` |
| 2 | `src/middleware.ts` | NOT FOUND | N/A |
| 3 | Clerk-related files | No dedicated provider/middleware files; Clerk is used in `src/proxy.ts` (middleware) and API routes via `auth()` | See above |
| 4a | `src/app/api/micro-forecasts/route.ts` | FOUND | `/Users/sarhanak/Documents/CashFlowIQ/src/app/api/micro-forecasts/route.ts` |
| 4b | `src/app/api/micro-forecasts/[id]/route.ts` | FOUND | `/Users/sarhanak/Documents/CashFlowIQ/src/app/api/micro-forecasts/[id]/route.ts` |
| 5 | `src/lib/db/company-context.ts` | FOUND | `/Users/sarhanak/Documents/CashFlowIQ/src/lib/db/company-context.ts` |
| 6 | `src/lib/db/schema.ts` | FOUND | `/Users/sarhanak/Documents/CashFlowIQ/src/lib/db/schema.ts` |
| 7 | `drizzle.config.ts` | FOUND | `/Users/sarhanak/Documents/CashFlowIQ/drizzle.config.ts` |
| 8 | `src/lib/db/index.ts` | FOUND | `/Users/sarhanak/Documents/CashFlowIQ/src/lib/db/index.ts` |

**Key observation:** There is no `src/middleware.ts`. The Clerk middleware is defined in `src/proxy.ts` instead, which is an unconventional location -- Next.js normally expects middleware at `src/middleware.ts` or `middleware.ts` at the project root. The `proxy.ts` file would need to be either renamed or re-exported from a `middleware.ts` file for Next.js to pick it up automatically.