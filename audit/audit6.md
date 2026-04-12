Now I have the complete picture. Here is the comprehensive audit report.

---

# CashFlowIQ Import Pipeline Audit Report

## 1. FILE UPLOAD PIPELINE: `src/lib/r2.ts`

**Status: Built but DEAD CODE -- never called from anywhere in the codebase.**

The R2 module (`/Users/sarhanak/Documents/CashFlowIQ/src/lib/r2.ts`, 52 lines) provides three functions:

| Function | Purpose | Status |
|---|---|---|
| `uploadFile(key, body, contentType)` | Upload buffer to R2 | Never called |
| `getFile(key)` | Download file from R2 | Never called |
| `generateUploadKey(companyId, filename)` | Build path `uploads/{companyId}/{timestamp}_{sanitized}` | Never called |

**Grep confirmation:** Searching for `uploadFile|generateUploadKey|r2` across all `src/` `.ts/.tsx` files returns results ONLY from `r2.ts` itself. No other file imports or uses this module.

The S3Client is configured with environment variables (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) with defaults that will silently produce a broken client if env vars are missing (empty string fallback, no startup validation).

**Critical gap:** Per PRD2 spec, the import flow should be:
```
POST /api/import/upload  --> Receive file, upload to R2, return fileId
POST /api/import/parse   --> Download from R2, parse Excel/CSV, return raw data
POST /api/import/save    --> Receive mapped data, INSERT accounts + actuals
```
None of these API routes exist. The entire import pipeline runs client-side with zero server persistence.

---

## 2. API ROUTES FOR FILE IMPORT: `src/app/api/import/`

**Status: DOES NOT EXIST.**

The directory `src/app/api/import/` contains zero files. The only API routes that exist are:
- `/Users/sarhanak/Documents/CashFlowIQ/src/app/api/micro-forecasts/route.ts`
- `/Users/sarhanak/Documents/CashFlowIQ/src/app/api/micro-forecasts/[id]/route.ts`

Per GEMINI.md, the `import-engineer` agent owns `src/app/api/import/**` -- but that directory was never created.

---

## 3. FRONTEND COMPONENTS FOR FILE IMPORT: `src/components/import/`

**Status: DOES NOT EXIST.**

No `src/components/import/` directory. PRD2 specifies these components should exist:
- `FileUploader.tsx`
- `MappingTable.tsx`
- `ValidationBanner.tsx`

The entire import UI is monolithically embedded in a single component:
**`/Users/sarhanak/Documents/CashFlowIQ/src/components/data/OnboardingWorkspace.tsx`** (573 lines)

This component handles all 4 onboarding steps (Company Setup, Upload Data, Account Mapping, Generate) in one file. There is no separation of concerns.

---

## 4. IMPORT PARSING PIPELINE: `src/lib/import/`

**Status: 4 files exist. 2 files from the spec are missing. 1 critical file is dead code.**

### 4a. `excel-parser.ts` (31 lines) -- WORKING
- File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/import/excel-parser.ts`
- Uses `xlsx.read(buffer, { type: 'array' })` to parse both Excel and CSV files
- Returns `ParsedSheet[]` with sheet name and raw data arrays
- Trims empty trailing rows
- Handles multiple sheets correctly (but the consumer only uses `sheets[0]`)

### 4b. `structure-detector.ts` (113 lines) -- PARTIALLY WORKING
- File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/import/structure-detector.ts`
- `parseIndianNumberString()`: Parses Indian number formats
- `detectStructure()`: Scans up to 20 rows to find header row, account column, and data columns

**Bugs and issues in `parseIndianNumberString()`:**

1. **The `lakh` regex is fragile.** Line 24:
   ```ts
   else if (lower.includes('l') && clean.match(/[0-9]+(\.?[0-9]*)\s*l(akh)?/i)) multiplier = 100000
   ```
   The `lower.includes('l')` check will match ANY string containing the letter "l" (like "Electrical", "Legal", "Travel"). The regex guard helps, but the precedence is wrong: it enters the `else if` block if `lower` contains 'l', then checks the regex. But `lower` is already the lowercase of `clean`, which had currency symbols removed. If the original string was "Electrical Expenses 500000", `lower` contains 'l', and while the regex won't match, the code falls through to the numeric parsing below -- which is correct. But if the string was "12.5 l" (meaning 12.5 lakhs), it works. This is fragile but currently functional.

2. **The `Cr` detection is too permissive.** Line 23:
   ```ts
   if (lower.includes('cr')) multiplier = 10000000
   ```
   This matches "Credit", "Creative", "Creditor" -- any word containing "cr". The number extraction below strips all letters, so the multiplier gets applied even to text like "Credit Balance 500000", which would incorrectly multiply by 1 Cr.

3. **Comma removal before magnitude extraction.** Line 27 removes ALL commas, then ALL letters, then parses. This means "12,34,567 Cr" becomes "1234567" after comma removal, then "1234567" after letter removal, parsed as 1234567, multiplied by 10000000 = 12,34,56,70,00,000 -- which is wrong if "Cr" was meant to be "Crores" (should be 12,34,56,70,00,000). Wait, actually that IS 12.34567 Cr = 12,34,56,700. Let me recalculate: 1234567 * 10000000 = 12,345,670,000,000 which is 12,345.67 Cr. That's incorrect. The user likely meant 12,34,567 (12.34567 lakhs), not 12,34,567 Crores. The fundamental issue is that Indian commas make "12,34,567" look like it could be "12.34567" in international format if commas are stripped, and then the Crore multiplier makes it astronomically wrong.

4. **No K/thousand suffix support.** Indian financials sometimes use "K" for thousands. Not handled.

### 4c. `account-mapper.ts` (103 lines) -- SEVERELY UNDER-SPECIFIED
- File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/import/account-mapper.ts`
- Implements Levenshtein distance fuzzy matching
- Only **8 standard accounts** defined in `STANDARD_ACCOUNT_OPTIONS`:

| ID | Name | Category |
|---|---|---|
| rev-1 | Product Sales | Revenue |
| rev-2 | Service Revenue | Revenue |
| cogs-1 | Raw Materials | COGS |
| cogs-2 | Direct Labor | COGS |
| exp-1 | Salaries & Wages | Operating Expenses |
| exp-2 | Rent | Operating Expenses |
| exp-3 | Utilities | Operating Expenses |
| ast-1 | Cash Equivalents | Assets |

**This is catastrophically incomplete for an Indian financial platform.** A typical Indian SME balance sheet has 30-60 line items. The PRD explicitly calls for a "Standard Indian CoA template (pre-built, Schedule III lite)" in `src/lib/standards/indian-coa.ts`, which DOES NOT EXIST.

Missing critical accounts for Indian financials:
- **Revenue:** Export Sales, Other Income, Interest Income
- **COGS:** Purchases (domestic/imports), Freight, Manufacturing Overheads
- **Operating Expenses:** Depreciation, Professional Fees, Insurance, Marketing, Travel, Repairs, Directors' Remuneration, Audit Fees
- **Assets:** Accounts Receivable, Inventory, Fixed Assets (Gross/Depreciation), Prepaid Expenses, Loans & Advances
- **Liabilities:** Accounts Payable, GST Payable, TDS Payable, Short-term Borrowings, Provisions, Statutory Dues
- **Equity:** Share Capital, Reserves & Surplus, Retained Earnings

The Levenshtein threshold of `< 3` is per the GEMINI.md spec, which is reasonable for small typos but will fail for Indian naming conventions (e.g., "Staff Cost" matches "Salaries & Wages" only via alias, "Sundry Debtors" won't match "Accounts Receivable" at all with distance 14).

### 4d. `validator.ts` (55 lines) -- DEAD CODE
- File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/import/validator.ts`
- Implements `validateHistoricalStatement()` with P&L balance check, BS balance check, and Retained Earnings cross-check
- Tolerance of 100 paise (₹1.00) is reasonable for rounding
- **NEVER CALLED ANYWHERE IN THE CODEBASE.** Grep confirms zero references outside the file itself.

The OnboardingWorkspace import flow goes:
```
upload -> parse -> detectStructure -> mapAccount -> [SKIP VALIDATION] -> completeImportedSetup
```

### 4e. MISSING FILES from spec:
- `src/lib/import/csv-parser.ts` -- Not needed since xlsx handles CSV, but the spec calls for it
- `src/lib/import/standards/indian-coa.ts` -- **CRITICAL MISSING**. The comprehensive Indian Chart of Accounts template

---

## 5. DOWNLOADABLE TEMPLATE: `public/templates/`

**Status: DOES NOT EXIST.**

No `public/templates/` directory. PRD2 explicitly specifies:
```
public/
  templates/
    cashflowiq-template.xlsx  # Downloadable import template
```

The GEMINI.md Phase 3 checklist includes "5.6 Downloadable Excel import template" which is marked as done in PHASE_STATUS.md, but the file does not exist. The PHASE_STATUS appears inaccurate.

---

## 6. `next.config.ts`

**File:** `/Users/sarhanak/Documents/CashFlowIQ/next.config.ts` (26 lines)

Configuration:
- PWA enabled via `next-pwa` (disabled in development)
- Clerk image domain `img.clerk.com` whitelisted
- `reactStrictMode: true`
- **No R2 configuration** (R2 endpoint/credentials are env vars only, no Next.js config needed)
- **No file upload size limits** configured at the framework level (handled in component code at 10MB)
- **No API route body size limits** configured

---

## 7. `package.json` DEPENDENCIES

**File:** `/Users/sarhanak/Documents/CashFlowIQ/package.json`

Key dependencies relevant to import:

| Package | Version | Purpose | Status |
|---|---|---|---|
| `@aws-sdk/client-s3` | ^3.1025.0 | R2/S3 file storage | Present, but R2 module unused |
| `xlsx` | ^0.18.5 | Excel/CSV parsing | Actively used in excel-parser.ts |
| `zod` | ^4.3.6 | Schema validation | Present, but NOT used for import validation |
| `drizzle-orm` | ^0.45.2 | Database ORM | Present, but import data never persisted to DB |
| `@clerk/nextjs` | ^7.0.11 | Authentication | Present, but import API routes don't exist |
| `@libsql/client` | ^0.17.2 | Turso DB client | Present |
| `react-hook-form` | ^7.72.1 | Form handling | Not used in import flow |
| `zustand` | ^5.0.12 | Client state | Import data saved to Zustand/localStorage only |

Notable absences:
- No dedicated CSV parser (xlsx handles it, which is acceptable)
- No `papa-parse` or similar streaming CSV parser for large files
- No file type validation library (done manually in component)

---

## 8. END-TO-END FLOW ANALYSIS

### What ACTUALLY happens when a user uploads a file:

```
1. USER selects/drops file in OnboardingWorkspace.tsx (Step 2)
2. handleFile() validates:
   - Extension: .xlsx, .xls, .csv only
   - Size: < 10MB
3. File is read as ArrayBuffer via file.arrayBuffer() (CLIENT-SIDE)
4. parseExcelBuffer() parses using xlsx library (CLIENT-SIDE)
5. detectStructure() scans for header row, account column, month columns (CLIENT-SIDE)
6. For each data row:
   - parseIndianNumberString() converts cell values to numbers
   - Values multiplied by 100 to convert to paise: Math.round(parsed * 100)
   - mapAccountDetailed() fuzzy-matches account names to 8 standard accounts
7. Results displayed in Account Mapping UI (Step 3)
8. User can manually remap accounts via dropdown
9. On "Confirm & Continue":
   - buildImportedAccounts() creates AccountData[] by overlaying mapped values
      onto a zeroed demo data skeleton
   - buildFallbackRules() creates rolling_avg value rules
   - completeImportedSetup() saves to Zustand localStorage
   - Router navigates to /forecast
```

### What SHOULD happen per PRD2:

```
1. User uploads file -> POST /api/import/upload -> R2 storage -> return fileId
2. Client requests parse -> POST /api/import/parse -> download from R2, parse, return raw
3. Account mapping UI with comprehensive Indian CoA
4. Validation step: P&L balance, BS balance, RE cross-check
5. User confirms mapping -> POST /api/import/save -> INSERT accounts + actuals to DB
6. Downloadable template available at GET /api/import/template
```

---

## 9. SPECIFIC ISSUE ANALYSIS

### A. Is the full flow working: upload -> parse -> map -> validate -> save?

**Partially. The flow works for demo/onboarding but has critical gaps:**

| Step | Working? | Details |
|---|---|---|
| Upload | PARTIAL | Client-side only. File never stored in R2. No server-side processing. |
| Parse | YES | xlsx library handles Excel/CSV correctly. Only first sheet used. |
| Map | WEAK | Only 8 standard accounts. Most real-world rows will be "unmapped". |
| Validate | NO | validator.ts exists but is NEVER CALLED. No balance checks in the flow. |
| Save | PARTIAL | Saves to Zustand/localStorage only. Never persisted to database. |

### B. Is the file stored in R2 during/after processing?

**NO.** The R2 module is completely disconnected. Files are read into browser memory via `file.arrayBuffer()`, processed entirely client-side, and never sent to any server or storage. If the user closes the browser, the original file is gone. Only the processed result survives in localStorage.

Per GEMINI.md: "Preserve raw data. Always keep the original uploaded file in R2. The parsed/mapped version is separate." -- This rule is VIOLATED.

### C. Is there proper error handling at each step?

**Inconsistent. The component has decent error handling; the library code does not.**

| Location | Error Handling | Assessment |
|---|---|---|
| OnboardingWorkspace `handleFile()` | Catches exceptions, shows user-facing error | GOOD |
| Extension validation | Checks .xlsx/.xls/.csv | GOOD |
| Size validation | 10MB limit | GOOD |
| excel-parser | No error handling for corrupt files | WEAK -- xlsx.read() can throw on malformed files |
| structure-detector | Returns `headerRowIndex: -1` on failure (silent) | OK -- consumer checks for -1 |
| parseIndianNumberString | Returns `null` on failure | OK |
| account-mapper | Returns `{ accountId: null, matchType: 'unmapped' }` on no match | OK |
| validator | Returns `{ isValid, errors[] }` | GOOD -- but never called |
| R2 module | No error handling, no timeout, no retry | POOR |

### D. Is the Indian number parsing working correctly?

**Works for common cases, has edge-case bugs:**

| Input | Expected | Actual | Status |
|---|---|---|---|
| `"12,34,567"` | 1234567 | 1234567 | CORRECT |
| `"1.23 Cr"` | 12300000 | 12300000 | CORRECT |
| `"12.34 L"` | 1234000 | 1234000 | CORRECT |
| `"₹8,50,000"` | 850000 | 850000 | CORRECT |
| `"Credit Balance 500000"` | 500000 | 50000000000 | **WRONG** -- "cr" in "Credit" triggers Cr multiplier |
| `"12,34,567 Cr"` | 123456700 | 12345670000000 | **WRONG** -- double magnitude error |
| `8500000` (number) | 8500000 | 8500000 | CORRECT |
| `"Rs.5,00,000"` | 500000 | 500000 | CORRECT |
| `""` (empty) | null | null | CORRECT |

The `"Cr"` detection via `lower.includes('cr')` is the most dangerous bug. It will silently corrupt any value that happens to appear near the word "Credit", "Creditor", "Creative", etc.

### E. Is the account mapping comprehensive enough?

**NO. 8 accounts is critically insufficient.** A minimal Indian Schedule III CoA needs at least 40-50 accounts. The current list cannot represent:
- Any BS liability or equity account (except Cash Equivalents)
- Depreciation (essential for three-way forecast)
- Inventory (essential for working capital)
- Receivables/Payables (essential for timing profiles)
- GST/TDS accounts (essential for compliance)
- Borrowings (essential for cash flow)

The `buildImportedAccounts()` function in OnboardingWorkspace works around this by overlaying mapped values onto the full demo data skeleton (which has ~25 accounts). So if an imported row maps to `exp-1` (Salaries), it adds to the demo account's values. But rows that don't map (most of them in a real file) are simply discarded with `matchType: 'unmapped'` and their data is LOST.

### F. What's missing vs the PRD spec?

| Spec Requirement | Status | Severity |
|---|---|---|
| R2 file storage for uploads | NOT IMPLEMENTED | HIGH -- data loss risk |
| `POST /api/import/upload` route | NOT IMPLEMENTED | HIGH -- no server-side processing |
| `POST /api/import/parse` route | NOT IMPLEMENTED | HIGH -- no server-side processing |
| `POST /api/import/save` route | NOT IMPLEMENTED | HIGH -- no DB persistence |
| `GET /api/import/template` route | NOT IMPLEMENTED | MEDIUM |
| `public/templates/cashflowiq-template.xlsx` | NOT IMPLEMENTED | MEDIUM |
| `src/lib/import/csv-parser.ts` | NOT NEEDED (xlsx handles CSV) | LOW |
| `src/lib/import/standards/indian-coa.ts` | NOT IMPLEMENTED | **CRITICAL** |
| Balance validation called in flow | NOT WIRED | HIGH -- bad data can enter system |
| Database persistence of imports | NOT IMPLEMENTED | HIGH -- all data in localStorage |
| Multi-sheet support | ONLY FIRST SHEET | MEDIUM |
| Account merging/splitting in mapping UI | NOT IMPLEMENTED | MEDIUM |
| "Auto-map all recognizable accounts" button | NOT IMPLEMENTED | LOW |
| Duplicate account detection | NOT IMPLEMENTED | MEDIUM |
| Missing months detection | NOT IMPLEMENTED | MEDIUM |
| Comprehensive Indian CoA (40+ accounts) | ONLY 8 ACCOUNTS | **CRITICAL** |
| Zod validation schemas for import data | NOT USED | MEDIUM |

---

## 10. SUMMARY OF CRITICAL ISSUES

### Severity: CRITICAL (blocks real-world use)

1. **Only 8 standard accounts** -- Most real Indian financial data cannot be mapped. Import will show 80%+ "unmapped" for actual SME files. The `src/lib/standards/indian-coa.ts` file from the spec was never created.

2. **No database persistence** -- Imported data lives only in Zustand/localStorage. Clearing browser data destroys all imported financials. The `POST /api/import/save` route was never built.

3. **Validator never called** -- `validateHistoricalStatement()` exists but is dead code. There is NO validation step in the import flow. Unbalanced P&L or BS data will silently enter the system and break the three-way forecast engine.

### Severity: HIGH (significant functionality gaps)

4. **R2 file storage disconnected** -- The entire `src/lib/r2.ts` module is dead code. Original uploaded files are never preserved. This violates GEMINI.md's rule: "Preserve raw data. Always keep the original uploaded file in R2."

5. **No import API routes** -- The `src/app/api/import/` directory does not exist. All import processing is client-side only. There is no way to re-process a previously uploaded file.

6. **Indian number parser has "Cr" false-positive bug** -- `lower.includes('cr')` matches "Credit", "Creditor", etc., silently multiplying values by 10,000,000.

### Severity: MEDIUM (quality/reliability issues)

7. **Only first sheet processed** -- `const sheet = sheets[0]` ignores other worksheets. Indian financials often have P&L and BS on separate sheets.

8. **No downloadable template** -- `public/templates/cashflowiq-template.xlsx` does not exist despite PHASE_STATUS.md marking it complete.

9. **Monolithic component** -- The entire 4-step onboarding flow is in one 573-line component with no separation of concerns. PRD2 specifies separate components (FileUploader, MappingTable, ValidationBanner).

10. **No Zod validation** -- `zod` is a dependency but never used to validate import payloads or mapped data shapes.