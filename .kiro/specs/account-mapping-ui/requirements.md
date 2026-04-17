# Requirements Document

## Introduction

CashFlowIQ users upload raw Tally XML or Excel exports whose ledger names are informal and company-specific (e.g. "Diwali Sweets", "Cash to Raju", "Raju Bhai Commission"). The backend auto-mapper already handles well-known names via exact, alias, keyword, and fuzzy matching, but unmapped rows are silently skipped and there is no mechanism to persist user corrections for future uploads.

This feature adds a Human-in-the-Loop Account Mapping layer: a review UI shown between file upload and final import, backed by a persistent `account_mappings` table that stores company-specific raw-name → standard-account resolutions. On subsequent uploads the saved mappings are applied before the auto-mapper runs, so users never have to re-map the same ledger name twice.

## Glossary

- **Mapping_UI**: The frontend review screen shown after file parse and before final import.
- **Account_Mappings_Table**: The `account_mappings` database table that persists `(companyId, rawLedgerName) → standardAccountId` pairs.
- **Saved_Mapping**: A row in the Account_Mappings_Table created or updated by a user action.
- **Auto_Mapper**: The existing `mapServerAccountDetailed` function in `server-account-mapper.ts`.
- **Preview_Pipeline**: The `buildImportPreview` function in `imports.ts` that parses a file and produces per-row mapping results.
- **Standard_COA**: The `STANDARD_INDIAN_COA` array in `indian-coa.ts` — the fixed list of standard Indian chart-of-accounts categories.
- **Confidence_Threshold**: The value 0.6 below which an auto-mapped row is flagged for human review.
- **Skipped_Row**: A row the user has explicitly marked as not relevant to the forecast (e.g. "Suspense Account").
- **Parse_API**: `POST /api/import/parse` — returns per-row mapping results including `matchType` and `confidence`.
- **Mappings_API**: New `POST /api/import/mappings` and `GET /api/import/mappings` endpoints.
- **Save_API**: Existing `POST /api/import/save` — finalises the import into the database.
- **Company**: A tenant in the system identified by `companyId`; all saved mappings are scoped to a Company.

---

## Requirements

### Requirement 1: Persist Custom Account Mappings

**User Story:** As a business owner, I want my manual ledger-name corrections to be remembered, so that I don't have to re-map the same names every time I upload a new file.

#### Acceptance Criteria

1. THE Account_Mappings_Table SHALL store each Saved_Mapping as a tuple of `(companyId, rawLedgerName, standardAccountId, skipped, createdAt, updatedAt)`.
2. THE Account_Mappings_Table SHALL enforce a unique constraint on `(companyId, rawLedgerName)` so that each raw name has exactly one resolution per Company.
3. THE Account_Mappings_Table SHALL cascade-delete all rows belonging to a Company when that Company is deleted.
4. WHEN a Saved_Mapping already exists for a `(companyId, rawLedgerName)` pair and a new value is submitted, THE Account_Mappings_Table SHALL update the existing row rather than insert a duplicate.
5. THE Account_Mappings_Table SHALL record `createdAt` and `updatedAt` timestamps for every row using UTC datetime.

---

### Requirement 2: Mappings API — Save and Retrieve

**User Story:** As a frontend client, I want API endpoints to save and retrieve custom mappings per company, so that the Mapping_UI can persist user decisions and reload them on the next session.

#### Acceptance Criteria

1. THE Mappings_API SHALL expose `POST /api/import/mappings` to upsert one or more Saved_Mappings for the authenticated user's Company.
2. THE Mappings_API SHALL expose `GET /api/import/mappings?companyId=<id>` to return all Saved_Mappings for the authenticated user's Company.
3. WHEN a `POST /api/import/mappings` request is received, THE Mappings_API SHALL reject requests where `companyId` does not belong to the authenticated user, returning HTTP 403.
4. WHEN a `GET /api/import/mappings` request is received, THE Mappings_API SHALL reject requests where `companyId` does not belong to the authenticated user, returning HTTP 403.
5. WHEN a `POST /api/import/mappings` request body contains a `standardAccountId` that does not exist in the Standard_COA, THE Mappings_API SHALL return HTTP 422 with a descriptive error message.
6. THE Mappings_API SHALL accept a batch of up to 500 mapping entries in a single `POST` request.
7. WHEN a mapping entry has `skipped: true`, THE Mappings_API SHALL store the row with a null `standardAccountId` and `skipped = true`.

---

### Requirement 3: Preview Pipeline Applies Saved Mappings First

**User Story:** As a returning user, I want my previously saved mappings to be applied automatically when I upload a new file, so that already-resolved ledger names don't appear as unmapped again.

#### Acceptance Criteria

1. WHEN `buildImportPreview` is called with a `companyId`, THE Preview_Pipeline SHALL query the Account_Mappings_Table for all Saved_Mappings belonging to that Company before invoking the Auto_Mapper.
2. WHEN a raw ledger name has a Saved_Mapping with a non-null `standardAccountId`, THE Preview_Pipeline SHALL set `matchType` to `'saved'` and `confidence` to `1.0` for that row, bypassing the Auto_Mapper entirely.
3. WHEN a raw ledger name has a Saved_Mapping with `skipped: true`, THE Preview_Pipeline SHALL set `matchType` to `'skipped'` and exclude that row from the import rows returned to the client.
4. WHEN a raw ledger name has no Saved_Mapping, THE Preview_Pipeline SHALL fall through to the existing Auto_Mapper logic unchanged.
5. THE Preview_Pipeline SHALL NOT alter its behaviour for companies that have no Saved_Mappings, preserving full backward compatibility with existing users.

---

### Requirement 4: Mapping UI — Review Screen

**User Story:** As a business owner, I want to see a clear review screen after uploading a file, so that I can correct or skip any ledger names the system couldn't confidently map before the data is imported.

#### Acceptance Criteria

1. WHEN the Parse_API response is received, THE Mapping_UI SHALL render a two-column table where the left column shows the raw ledger name and the right column shows a dropdown pre-filled with the auto-mapped Standard_COA category (or blank if `matchType` is `'unmapped'`).
2. THE Mapping_UI SHALL highlight rows where `matchType` is `'unmapped'` OR `confidence` is below 0.6 with a distinct visual indicator (e.g. amber background or warning icon) to draw the user's attention.
3. THE Mapping_UI SHALL display the `matchType` and `confidence` score for each row so the user can assess auto-mapper reliability.
4. THE Mapping_UI SHALL provide a "Skip" option in each row's dropdown that marks the row as a Skipped_Row, visually striking through the raw name.
5. THE Mapping_UI SHALL provide a bulk-action control that allows the user to select multiple rows via checkboxes and assign all selected rows to a single Standard_COA category in one action.
6. THE Mapping_UI SHALL provide a "Save & Import" button that is enabled only when all highlighted rows (unmapped or low-confidence) have been either assigned a category or marked as Skip.
7. WHEN the "Save & Import" button is clicked, THE Mapping_UI SHALL first call `POST /api/import/mappings` to persist all user-assigned and skipped rows, then call `POST /api/import/save` to complete the import.
8. WHEN the `POST /api/import/mappings` call fails, THE Mapping_UI SHALL display an inline error message and SHALL NOT proceed to call `POST /api/import/save`.
9. THE Mapping_UI SHALL allow the user to proceed without reviewing rows that already have `matchType` of `'exact'`, `'alias'`, or `'saved'` with `confidence` ≥ 0.6, as these are considered reliably mapped.
10. THE Mapping_UI SHALL display a summary count of "X rows need review" at the top of the screen so the user knows the scope of work before starting.

---

### Requirement 5: Standard COA Dropdown

**User Story:** As a user reviewing mappings, I want the category dropdown to show all standard Indian COA options grouped by section, so that I can quickly find the right category without scrolling through a flat list.

#### Acceptance Criteria

1. THE Mapping_UI SHALL populate each row's dropdown with all entries from the Standard_COA, grouped by `category` (Revenue, COGS, Operating Expenses, Assets, Liabilities, Equity).
2. THE Mapping_UI SHALL display both the account `name` and `category` in each dropdown option so the user can distinguish accounts with similar names.
3. THE Mapping_UI SHALL include a "Skip (exclude from forecast)" option as the first item in the dropdown, visually separated from the Standard_COA entries.
4. WHEN a user types in the dropdown search field, THE Mapping_UI SHALL filter options by matching the typed text against both the account `name` and its `aliases` from the Standard_COA.

---

### Requirement 6: Tenant Isolation for Saved Mappings

**User Story:** As a SaaS operator, I want each company's saved mappings to be completely isolated, so that one company's ledger corrections never affect another company's import results.

#### Acceptance Criteria

1. THE Mappings_API SHALL scope all read and write operations to the `companyId` extracted from the authenticated session, never accepting a caller-supplied `companyId` that the authenticated user does not own.
2. WHEN the Preview_Pipeline queries Saved_Mappings, THE Preview_Pipeline SHALL filter exclusively by the `companyId` passed to `buildImportPreview`, ensuring no cross-company data leakage.
3. THE Account_Mappings_Table SHALL include `companyId` as part of the primary lookup index to ensure query isolation at the database level.

---

### Requirement 7: Backward Compatibility — Existing Import Pipeline

**User Story:** As an existing CashFlowIQ user with clean, well-mapped data, I want my import workflow to remain unchanged, so that the new mapping feature doesn't slow down or break my current process.

#### Acceptance Criteria

1. WHEN `buildImportPreview` is called without a `companyId` (e.g. from an unauthenticated context or legacy call), THE Preview_Pipeline SHALL skip the Saved_Mappings lookup and proceed with Auto_Mapper logic only.
2. WHEN all rows in a parse result have `matchType` of `'exact'` or `'alias'` and `confidence` ≥ 0.6, THE Mapping_UI SHALL display a "Looks good — no review needed" state and allow the user to proceed directly to import without interacting with the mapping table.
3. THE Save_API (`POST /api/import/save`) request schema SHALL remain unchanged; the Mapping_UI SHALL call `POST /api/import/mappings` as a separate prior step rather than bundling mapping data into the save payload.
4. IF the Mappings_API is unavailable, THEN THE Mapping_UI SHALL allow the user to proceed with the import using only the auto-mapped values, displaying a non-blocking warning that custom mappings could not be saved.
