# Design Document: Schedule III Annual Statements & Notes/MD&A

## Overview

This design document specifies the technical implementation for adding Schedule III-compliant annual financial statements and Management Discussion & Analysis (MD&A) notes across CashFlowIQ. The feature consists of two major components:

1. **Annual Statements** — A two-column (Current Year | Prior Year) Schedule III view of P&L, Balance Sheet, and Cash Flow, surfaced in the Forecast page, Reports page, and PDF exports
2. **Notes/MD&A** — A commentary system with auto-generated summaries and role-gated editing

The engine (`three-way/builder.ts`) already produces Schedule III-compliant `ThreeWayMonth` objects. This feature aggregates those monthly results into annual statements and adds the persistence and UI layers for CA commentary.

---

## System Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ ForecastClient (existing)                                    │
│  ├─ ViewSwitcher (modified: add 'annual' tab)               │
│  ├─ ForecastGrid (existing: monthly view)                   │
│  └─ AnnualStatementView (NEW)                               │
│      ├─ AnnualPLStatement (NEW)                             │
│      │   └─ NotesPanel (NEW)                                │
│      ├─ AnnualBSStatement (NEW)                             │
│      │   └─ NotesPanel (NEW)                                │
│      └─ AnnualCFStatement (NEW)                             │
│          └─ NotesPanel (NEW)                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ReportsPage (modified)                                       │
│  ├─ PDF Download (existing)                                 │
│  └─ Annual Statements Tab (NEW)                             │
│      └─ AnnualStatementView (reused)                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DashboardPage (modified)                                     │
│  └─ Use profitAfterTax, revenueFromOps instead of aliases   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────────┐
│ ThreeWayMonth[]  │ (12 months from engine)
│ (already exists) │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ aggregateAnnual(months: ThreeWayMonth[])                 │
│  - P&L: sum 12 months                                    │
│  - BS: last month closing                                │
│  - CF: sum 12 months                                     │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ AnnualStatement { currentYear, priorYear, metadata }     │
└────────┬─────────────────────────────────────────────────┘
         │
         ├──────────────────────────────────────────────────┐
         │                                                   │
         ▼                                                   ▼
┌────────────────────┐                          ┌──────────────────────┐
│ AnnualStatementView│                          │ PDFGenerator         │
│ (on-screen)        │                          │ (export)             │
└────────────────────┘                          └──────────────────────┘
         │                                                   │
         ▼                                                   ▼
┌────────────────────┐                          ┌──────────────────────┐
│ NotesPanel         │◄─────────────────────────│ Financial Commentary │
│ (read/write)       │                          │ (read-only in PDF)   │
└────────┬───────────┘                          └──────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│ scenario_notes table                                       │
│  - autoSummary (generated on-demand)                       │
│  - userNotes (CA edits)                                    │
└────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### New Table: `scenario_notes`

```typescript
// src/lib/db/schema.ts

export const scenarioNotes = sqliteTable(
  'scenario_notes',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    scenarioId: text('scenario_id').references(() => scenarios.id, {
      onDelete: 'set null',
    }), // null = base case
    statementType: text('statement_type').notNull(), // 'PL' | 'BS' | 'CF'
    periodKey: text('period_key').notNull(), // e.g. "FY25-26" — soft reference
    autoSummary: text('auto_summary').notNull().default('[]'), // JSON array of strings
    autoSummaryGeneratedAt: text('auto_summary_generated_at'), // ISO timestamp
    userNotes: text('user_notes').notNull().default(''), // markdown
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
    updatedBy: text('updated_by').notNull(), // Clerk user ID
  },
  (table) => [
    uniqueIndex('idx_scenario_notes_unique').on(
      table.companyId,
      table.scenarioId,
      table.statementType,
      table.periodKey
    ),
    index('idx_scenario_notes_company_period').on(table.companyId, table.periodKey),
  ]
)

export const scenarioNotesRelations = relations(scenarioNotes, ({ one }) => ({
  company: one(companies, {
    fields: [scenarioNotes.companyId],
    references: [companies.id],
  }),
  scenario: one(scenarios, {
    fields: [scenarioNotes.scenarioId],
    references: [scenarios.id],
  }),
}))
```

### Migration

```sql
-- Migration: add scenario_notes table
CREATE TABLE scenario_notes (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scenario_id TEXT REFERENCES scenarios(id) ON DELETE SET NULL,
  statement_type TEXT NOT NULL CHECK(statement_type IN ('PL', 'BS', 'CF')),
  period_key TEXT NOT NULL,
  auto_summary TEXT NOT NULL DEFAULT '[]',
  auto_summary_generated_at TEXT,
  user_notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_scenario_notes_unique 
  ON scenario_notes(company_id, scenario_id, statement_type, period_key);

CREATE INDEX idx_scenario_notes_company_period 
  ON scenario_notes(company_id, period_key);
```

---

## API Design

### GET `/api/notes`

**Query params:**
- `companyId` (required)
- `scenarioId` (optional, null = base case)
- `statementType` (required: 'PL' | 'BS' | 'CF')
- `periodKey` (required: e.g. "FY25-26")

**Response:**
```typescript
{
  autoSummary: string[], // JSON-parsed array
  autoSummaryGeneratedAt: string | null, // ISO timestamp
  userNotes: string,
  updatedAt: string,
  updatedBy: string
}
```

**Status codes:**
- 200: Success
- 401: Unauthenticated
- 403: Not a company member
- 404: No notes found (return empty defaults)

---

### PUT `/api/notes`

**Body:**
```typescript
{
  companyId: string,
  scenarioId?: string | null,
  statementType: 'PL' | 'BS' | 'CF',
  periodKey: string,
  userNotes: string // PLAIN TEXT ONLY (no Markdown) for v1 — ensures 1:1 PDF parity
}
```

**Response:**
```typescript
{
  success: true,
  updatedAt: string
}
```

**Status codes:**
- 200: Success
- 401: Unauthenticated
- 403: Not a company member or role = 'viewer'
- 400: Invalid request body

**Implementation Note:** The `userNotes` field is plain text only (no Markdown support in v1). This guarantees that what the CA types in the textarea renders identically in the PDF via `doc.text()` without needing a Markdown → PDF parser.

---

### POST `/api/notes/generate-summary`

**Body:**
```typescript
{
  companyId: string,
  scenarioId?: string | null,
  statementType: 'PL' | 'BS' | 'CF',
  periodKey: string
}
```

**Response:**
```typescript
{
  autoSummary: string[], // generated bullets
  generatedAt: string // ISO timestamp
}
```

**Status codes:**
- 200: Success
- 401: Unauthenticated
- 403: Not a company member or role = 'viewer'
- 500: Engine error

---

## Core Functions

### `generatePeriodKey()`

**Location:** `src/lib/utils/date-utils.ts`

**Signature:**
```typescript
/**
 * Generate a deterministic period key for a financial year.
 * Format: FY{YY}-{YY} (e.g. "FY25-26" for Apr 2025 - Mar 2026)
 * 
 * @param fyStartMonth - Financial year start month (1-12, where 1 = Jan, 4 = Apr)
 * @param currentYear - The year the FY starts in (e.g. 2025)
 * @returns Period key string (e.g. "FY25-26")
 */
export function generatePeriodKey(fyStartMonth: number, currentYear: number): string {
  const startYY = currentYear % 100
  const endYY = (currentYear + 1) % 100
  return `FY${String(startYY).padStart(2, '0')}-${String(endYY).padStart(2, '0')}`
}

// Example usage:
// generatePeriodKey(4, 2025) → "FY25-26" (Apr 2025 - Mar 2026)
// generatePeriodKey(1, 2025) → "FY25-26" (Jan 2025 - Dec 2025)
```

**CRITICAL:** Every component and API route that reads or writes `scenario_notes.periodKey` MUST use this function. Never construct the period key string manually.

---

### `aggregateAnnual()`

**Location:** `src/lib/reports/annual-aggregator.ts`

**Signature:**
```typescript
export interface AnnualStatement {
  pl: {
    revenueFromOps: number
    otherIncome: number
    totalRevenue: number
    cogs: number
    employeeBenefits: number
    financeCosts: number
    depreciation: number
    amortisation: number
    otherExpenses: number
    totalExpenses: number
    profitBeforeExceptional: number
    exceptionalItems: number
    profitBeforeTax: number
    taxExpense: number
    profitAfterTax: number
  }
  bs: {
    // All fields from ThreeWayMonth.bs (last month)
    cash: number
    tradeReceivables: number
    netPPE: number
    // ... (all BS fields)
  }
  cf: {
    netOperatingCF: number
    netInvestingCF: number
    netFinancingCF: number
    netCashFlow: number
    operatingIndirect: {
      profitBeforeTax: number
      addDepreciation: number
      // ... (all operatingIndirect fields summed)
    }
    // ... (all CF fields summed)
  }
  metadata: {
    monthCount: number
    periodLabel: string // e.g. "FY 25-26"
  }
}

export function aggregateAnnual(months: ThreeWayMonth[]): AnnualStatement
```

**Algorithm:**
1. Validate input: `months.length > 0`
2. For P&L: sum all flow fields across 12 months
3. For BS: take the last month's closing balances
4. For CF: sum all flow fields across 12 months
5. Return `AnnualStatement` with metadata

---

### `resolvePriorYear()`

**Location:** `src/lib/reports/prior-year-resolver.ts`

**Signature:**
```typescript
export interface PriorYearResult {
  months: ThreeWayMonth[]
  dataSource: 'actuals' | 'mixed' | 'forecast'
  actualsCount: number
}

export async function resolvePriorYear(
  companyId: string,
  currentForecastStartDate: string, // YYYY-MM-01
  accounts: Account[],
  forecastMonthLabels: string[]
): Promise<PriorYearResult>
```

**Algorithm:**
1. Compute prior year period: subtract 12 months from `currentForecastStartDate`
2. Query `monthlyActuals` for those 12 months
3. Count how many months have actuals
4. If 12 months: return `{ months: buildFromActuals(), dataSource: 'actuals', actualsCount: 12 }`
5. If 0 months: run forecast engine for prior 12 months, return `{ months, dataSource: 'forecast', actualsCount: 0 }`
6. If partial: combine actuals + forecast, return `{ months, dataSource: 'mixed', actualsCount: N }`

---

### `buildAutoSummary()`

**Location:** `src/lib/reports/auto-summary.ts`

**Signature:**
```typescript
export function buildAutoSummary(
  statementType: 'PL' | 'BS' | 'CF',
  annual: AnnualStatement,
  priorAnnual: AnnualStatement | null
): string[]
```

**Algorithm (P&L):**
```typescript
const bullets: string[] = []

// Revenue growth
if (priorAnnual) {
  const growth = ((annual.pl.revenueFromOps - priorAnnual.pl.revenueFromOps) / priorAnnual.pl.revenueFromOps) * 100
  bullets.push(`Revenue grew ${growth.toFixed(1)}% year-over-year`)
}

// Gross margin
const grossMargin = ((annual.pl.revenueFromOps - annual.pl.cogs) / annual.pl.revenueFromOps) * 100
bullets.push(`Gross margin is ${grossMargin.toFixed(1)}%`)

// PAT margin
const patMargin = (annual.pl.profitAfterTax / annual.pl.totalRevenue) * 100
bullets.push(`PAT margin is ${patMargin.toFixed(1)}%`)

return bullets
```

**Algorithm (BS):**
```typescript
const bullets: string[] = []

bullets.push(`Closing cash: ${formatAuto(annual.bs.cash)}`)
bullets.push(`Total debt: ${formatAuto(annual.bs.ltBorrowings + annual.bs.stBorrowings)}`)

const debtToEquity = (annual.bs.ltBorrowings + annual.bs.stBorrowings) / annual.bs.totalShareholdersEquity
bullets.push(`Debt-to-equity ratio: ${debtToEquity.toFixed(2)}`)

return bullets
```

**Algorithm (CF):**
```typescript
const bullets: string[] = []

bullets.push(`Net operating cash flow: ${formatAuto(annual.cf.netOperatingCF)}`)
bullets.push(`Net investing cash flow: ${formatAuto(annual.cf.netInvestingCF)}`)
bullets.push(`Net financing cash flow: ${formatAuto(annual.cf.netFinancingCF)}`)

return bullets
```

---

## Component Designs

### `AnnualStatementView`

**Location:** `src/components/reports/AnnualStatementView.tsx`

**Props:**
```typescript
interface AnnualStatementViewProps {
  currentYear: AnnualStatement
  priorYear: AnnualStatement
  priorYearDataSource: 'actuals' | 'mixed' | 'forecast'
  companyId: string
  scenarioId?: string | null
  periodKey: string
  onNotesChange?: () => void
}
```

**Structure:**
```tsx
<div className="space-y-8">
  <AnnualPLStatement 
    current={currentYear.pl} 
    prior={priorYear.pl}
    priorDataSource={priorYearDataSource}
  />
  <NotesPanel 
    companyId={companyId}
    scenarioId={scenarioId}
    statementType="PL"
    periodKey={periodKey}
  />
  
  <AnnualBSStatement 
    current={currentYear.bs} 
    prior={priorYear.bs}
    priorDataSource={priorYearDataSource}
  />
  <NotesPanel 
    companyId={companyId}
    scenarioId={scenarioId}
    statementType="BS"
    periodKey={periodKey}
  />
  
  <AnnualCFStatement 
    current={currentYear.cf} 
    prior={priorYear.cf}
    priorDataSource={priorYearDataSource}
  />
  <NotesPanel 
    companyId={companyId}
    scenarioId={scenarioId}
    statementType="CF"
    periodKey={periodKey}
  />
</div>
```

---

### `NotesPanel`

**Location:** `src/components/reports/NotesPanel.tsx`

**Props:**
```typescript
interface NotesPanelProps {
  companyId: string
  scenarioId?: string | null
  statementType: 'PL' | 'BS' | 'CF'
  periodKey: string
  onBeforePDFExport?: () => Promise<void> // flush pending saves before export
}
```

**State:**
```typescript
const [isExpanded, setIsExpanded] = useState(false)
const [autoSummary, setAutoSummary] = useState<string[]>([]) // SEPARATE from userNotes
const [userNotes, setUserNotes] = useState('') // SEPARATE from autoSummary
const [isSaving, setIsSaving] = useState(false)
const [isGenerating, setIsGenerating] = useState(false)
const [staleWarning, setStaleWarning] = useState(false)
const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null)
```

**Behavior:**
1. On mount: fetch notes from `/api/notes`
2. If notes exist: auto-expand
3. If forecast updated after `autoSummaryGeneratedAt`: show stale warning
4. On "Generate Summary" click: POST to `/api/notes/generate-summary`, update **only** `autoSummary` state (never touches `userNotes`)
5. On user notes change: 
   - Debounced save (1000ms) to `/api/notes` (optimistic update)
   - **CRITICAL:** On `onBlur` of textarea, immediately flush any pending debounced save
6. On `onBeforePDFExport` call: flush any pending debounced save, wait for completion
7. Role gating: if viewer, render as read-only

**Data Loss Prevention:**
```typescript
const handleNotesChange = (value: string) => {
  setUserNotes(value)
  
  // Clear existing debounce timer
  if (debouncedSaveRef.current) {
    clearTimeout(debouncedSaveRef.current)
  }
  
  // Set new debounce timer
  debouncedSaveRef.current = setTimeout(() => {
    saveNotes(value)
  }, 1000)
}

const handleBlur = () => {
  // Immediate save on blur
  if (debouncedSaveRef.current) {
    clearTimeout(debouncedSaveRef.current)
    debouncedSaveRef.current = null
  }
  saveNotes(userNotes)
}

const flushPendingSaves = async () => {
  if (debouncedSaveRef.current) {
    clearTimeout(debouncedSaveRef.current)
    debouncedSaveRef.current = null
    await saveNotes(userNotes)
  }
}
```

---

## File Changes

### New Files

1. `src/lib/db/schema.ts` — add `scenarioNotes` table
2. `src/lib/utils/date-utils.ts` — add `generatePeriodKey()` utility (CRITICAL: used everywhere)
3. `src/lib/reports/annual-aggregator.ts` — `aggregateAnnual()`
4. `src/lib/reports/prior-year-resolver.ts` — `resolvePriorYear()`
5. `src/lib/reports/auto-summary.ts` — `buildAutoSummary()`
6. `src/components/reports/AnnualStatementView.tsx`
7. `src/components/reports/AnnualPLStatement.tsx`
8. `src/components/reports/AnnualBSStatement.tsx`
9. `src/components/reports/AnnualCFStatement.tsx`
10. `src/components/reports/NotesPanel.tsx`
11. `src/app/api/notes/route.ts` — GET/PUT
12. `src/app/api/notes/generate-summary/route.ts` — POST

### Modified Files

1. `src/components/forecast/ViewSwitcher.tsx` — add `'annual'` to `ViewType`
2. `src/app/(app)/forecast/ForecastClient.tsx` — render `AnnualStatementView` when `activeView === 'annual'`
3. `src/app/(app)/dashboard/page.tsx` — replace `netIncome` with `profitAfterTax`, `revenue` with `revenueFromOps`
4. `src/app/(app)/reports/page.tsx` — add Annual Statements tab
5. `src/lib/reports/pdf-generator.ts` — rewrite to use Schedule III fields, add notes sections
6. `src/lib/reports/management-report.ts` — update to use Schedule III fields

---

## PDF Generator Changes

### Current Structure (Simplified)

```typescript
// Cover page
// P&L page (uses m?.pl?.revenue, m?.pl?.netIncome)
// CF page
// BS page
// Compliance page
```

### New Structure (Schedule III)

```typescript
// Cover page (use profitAfterTax, revenueFromOps)
// P&L page (Schedule III line items I–X)
//   → Financial Commentary box (if notes exist)
// BS page (Schedule III structure: Equity & Liabilities, then Assets)
//   → Financial Commentary box (if notes exist)
// CF page (AS 3 indirect method A/B/C)
//   → Financial Commentary box (if notes exist)
// Compliance page
```

### Page Break Logic

```typescript
function renderNotesBox(notes: string, y: number): number {
  const estimatedHeight = calculateTextHeight(notes) + 20 // padding
  const remainingSpace = pageHeight - y
  
  if (remainingSpace < estimatedHeight) {
    doc.addPage()
    y = margin
  }
  
  // Render gray box
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, y, pageWidth - margin * 2, estimatedHeight, 'F')
  
  // Render text
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Financial Commentary', margin + 4, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(notes, margin + 4, y + 12, { maxWidth: pageWidth - margin * 2 - 8 })
  
  return y + estimatedHeight + 10
}
```

---

## State Management

### No New Zustand Store

Notes are fetched on-demand per component and saved via API. No global state needed.

### Existing Stores (No Changes)

- `useForecastConfigStore` — value rules, timing profiles
- `useScenarioStore` — scenarios
- `useMicroForecastStore` — business events
- `useAccountsStore` — chart of accounts
- `useActualsStore` — historical data

---

## Testing Strategy

### Unit Tests

1. `aggregateAnnual()` — verify sum vs. point-in-time semantics
2. `buildAutoSummary()` — verify bullet generation for all statement types
3. `resolvePriorYear()` — verify actuals/mixed/forecast fallback logic

### Integration Tests

1. Annual tab renders without error
2. Notes save and load correctly
3. PDF includes notes sections
4. Role gating enforces viewer read-only

### Manual Testing

1. Generate annual statements for a company with 12 months of actuals
2. Generate annual statements for a company with partial actuals
3. Generate annual statements for a company with no actuals
4. Edit notes as editor, verify viewer cannot edit
5. Generate auto-summary, verify stale warning appears after forecast change
6. Export PDF, verify Schedule III format and notes inclusion

---

## Performance Considerations

1. **Annual aggregation** — O(n) where n = 12 months, negligible
2. **Prior year resolver** — single DB query for `monthlyActuals`, cached by React Query
3. **Notes fetch** — single DB query per statement type, debounced save
4. **PDF generation** — same as current (jsPDF is synchronous, ~500ms for 10-page PDF)

---

## Security Considerations

1. **Role gating** — API enforces `companyMembers.role` check on all write operations
2. **SQL injection** — Drizzle ORM parameterizes all queries
3. **XSS** — User notes are rendered as plain text in PDF, React escapes in UI
4. **CSRF** — Next.js API routes use SameSite cookies

---

## Accessibility

1. **Semantic HTML** — `<table>`, `<th scope="col">`, `<th scope="row">`
2. **ARIA labels** — `aria-label="Schedule III Profit & Loss Statement"` on tables
3. **Keyboard navigation** — `A` key shortcut for Annual tab
4. **Screen reader** — row type announcements (header, subtotal, total)

---

## Deployment

1. **Database migration** — run `drizzle-kit push` to add `scenario_notes` table
2. **Feature flag** — none needed (additive feature, no breaking changes)
3. **Rollback plan** — drop `scenario_notes` table if needed, revert code

---

## Open Questions

None — all design decisions have been made based on the requirements and technical discussion.

---

## Production Gotchas Addressed

### 1. Markdown vs. jsPDF Trap
**Decision:** Plain text only for `userNotes` in v1. No Markdown support. This guarantees 1:1 parity between the textarea and the PDF output via `doc.text()`. Rich text can be added in v2 with a proper Markdown → PDF renderer.

### 2. Debounced Save Data Loss
**Solution:** 
- Debounced save (1000ms) on `onChange`
- Immediate save on `onBlur` of textarea
- `flushPendingSaves()` function called before PDF export
- Export button shows spinner while flushing

### 3. Overwrite UX Friction
**Solution:** `autoSummary` (array of strings) and `userNotes` (plain text) are strictly separate state. Clicking "Regenerate Summary" only updates `autoSummary`. The user's manual notes in `userNotes` are never touched by the regenerate action.

### 4. Deterministic periodKey Generation
**Solution:** Created `generatePeriodKey(fyStartMonth, currentYear)` utility in `date-utils.ts`. Format: `FY{YY}-{YY}` (e.g. `FY25-26`). Every component and API route MUST use this function when reading or writing `scenario_notes.periodKey`. Never construct the string manually.
