# Implementation Plan: Account Mapping UI

## Overview

Implement the Human-in-the-Loop account mapping layer in four incremental phases: DB schema + migration, API layer, preview pipeline changes, and frontend components. Property-based tests (fast-check) are placed immediately after the code they validate.

## Tasks

- [x] 1. Extend DB schema and generate migration
  - Add `accountMappings` table definition to `src/lib/db/schema.ts` with all columns, unique index, and company index
  - Add `accountMappings: many(accountMappings)` to `companiesRelations`
  - Add `accountMappingsRelations` export linking back to `companies`
  - Run `npx drizzle-kit generate` to produce the migration SQL file
  - Verify the generated SQL matches the migration spec in the design document
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 6.3_

- [x] 2. Implement DB query helpers
  - [x] 2.1 Create `src/lib/db/queries/account-mappings.ts` with `getMappingsForCompany` returning `Map<rawLedgerName, { standardAccountId, skipped }>`
    - Use Drizzle `select` filtered by `companyId`
    - _Requirements: 2.2, 3.1_

  - [x] 2.2 Implement `upsertMappings` in the same file
    - Use Drizzle `insert ... onConflictDoUpdate` targeting the unique index
    - Update `updatedAt` on conflict
    - Return count of rows affected
    - _Requirements: 1.2, 1.4, 2.1, 2.6_

  - [ ]* 2.3 Write property test for upsert uniqueness invariant (Property 1)
    - **Property 1: Upsert uniqueness invariant**
    - Use fast-check to generate arbitrary sequences of upserts for the same `(companyId, rawLedgerName)` pair with varying `standardAccountId` values; assert exactly one row exists after each sequence holding the last value
    - Use in-memory SQLite via `better-sqlite3` for isolation
    - **Validates: Requirements 1.2, 1.4**

  - [ ]* 2.4 Write property test for saved mapping round-trip (Property 2)
    - **Property 2: Saved mapping round-trip**
    - Use fast-check to generate arbitrary `(rawLedgerName, standardAccountId)` pairs; upsert then call `getMappingsForCompany` and assert the returned map contains the same value
    - **Validates: Requirements 1.1, 3.2**

- [x] 3. Extend `MatchType` and update server-account-mapper
  - Add `'saved'` and `'skipped'` to the `ServerAccountMatchType` union in `src/lib/import/server-account-mapper.ts`
  - Export the updated type so downstream consumers can reference it
  - _Requirements: 3.2, 3.3_

- [x] 4. Update `buildImportPreview` to apply saved mappings
  - [x] 4.1 Add optional `companyId` parameter to `buildImportPreview` in `src/lib/server/imports.ts`
    - Load saved mappings via `getMappingsForCompany` when `companyId` is provided; use empty Map otherwise
    - _Requirements: 3.1, 3.5, 7.1_

  - [x] 4.2 Apply saved mappings inside the per-row loop before calling `mapServerAccountDetailed`
    - If `saved.skipped` → return sentinel with `matchType: 'skipped'`
    - If `saved.standardAccountId` → return row with `matchType: 'saved'`, `confidence: 1.0`
    - Otherwise fall through to existing auto-mapper logic unchanged
    - Extend the `.filter()` to exclude `matchType === 'skipped'` rows
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.3 Write property test: preview applies saved mappings (Property 3)
    - **Property 3: Preview applies saved mappings**
    - Mock `getMappingsForCompany`; use fast-check to generate arbitrary ledger names with non-null `standardAccountId`; assert returned row has `matchType === 'saved'` and `confidence === 1.0`
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 4.4 Write property test: skipped rows excluded from preview (Property 4)
    - **Property 4: Skipped rows excluded from preview**
    - Mock `getMappingsForCompany`; use fast-check to generate arbitrary ledger names with `skipped: true`; assert no row for that name appears in the returned array
    - **Validates: Requirements 3.3**

  - [ ]* 4.5 Write property test: no saved mappings → identical behavior (Property 5)
    - **Property 5: No saved mappings → identical to current behavior**
    - Use fast-check to generate arbitrary file buffers (or fixture files); assert `buildImportPreview(buffer, undefined, companyId)` with zero saved mappings produces the same result as `buildImportPreview(buffer)`
    - **Validates: Requirements 3.5, 7.1**

- [x] 5. Update `POST /api/import/parse` to pass `companyId`
  - In `src/app/api/import/parse/route.ts`, extract `company.id` from the authenticated session and pass it as the third argument to `buildImportPreview`
  - _Requirements: 3.1, 6.2_

- [x] 6. Implement `GET /POST /api/import/mappings` route
  - [x] 6.1 Create `src/app/api/import/mappings/route.ts` with Zod schemas (`mappingEntrySchema`, `postMappingsSchema`) matching the design
    - _Requirements: 2.1, 2.2, 2.6_

  - [x] 6.2 Implement `GET` handler: validate `companyId` query param, verify ownership via `requireOwnedCompany` / `requireAccessibleCompany`, call `getMappingsForCompany`, return serialised array
    - Return HTTP 403 on ownership mismatch
    - _Requirements: 2.2, 2.4, 6.1_

  - [x] 6.3 Implement `POST` handler: parse body with Zod, verify company ownership, validate each `standardAccountId` against `STANDARD_INDIAN_COA`, call `upsertMappings`, return `{ saved: N }`
    - Return HTTP 403 on ownership mismatch; HTTP 422 on unknown COA ID or batch > 500
    - Store `skipped: true` entries with `standardAccountId: null`
    - _Requirements: 2.1, 2.3, 2.5, 2.6, 2.7, 6.1_

  - [ ]* 6.4 Write property test: authorization invariant (Property 6)
    - **Property 6: Authorization invariant**
    - Mock auth to return a user owning company A; use fast-check to generate arbitrary company IDs that are not A; assert both GET and POST return HTTP 403
    - **Validates: Requirements 2.3, 2.4, 6.1**

  - [ ]* 6.5 Write property test: invalid COA ID rejected (Property 7)
    - **Property 7: Invalid COA ID rejected**
    - Use fast-check to generate arbitrary strings not present in `STANDARD_INDIAN_COA`; assert POST returns HTTP 422
    - **Validates: Requirements 2.5**

- [ ] 7. Checkpoint — Ensure all tests pass
  - Run `npx vitest --run` and confirm all DB, pipeline, and API tests pass. Ask the user if any questions arise.

- [x] 8. Implement pure helper functions and Zustand store
  - [x] 8.1 Create `src/store/importMappingStore.ts` with the Zustand slice: `overrides`, `selectedRows`, `setOverride`, `setBulkOverride`, `toggleRowSelection`, `selectAll`, `clearSelection`, `reset`
    - _Requirements: 4.1, 4.5_

  - [x] 8.2 Export `canProceed(rows, overrides)` pure function from `src/components/import/AccountMappingReview.tsx` (or a co-located utils file)
    - _Requirements: 4.6_

  - [x] 8.3 Export `needsReview(rows)` pure function from the same file
    - _Requirements: 7.2_

  - [x] 8.4 Export `filterCoaOptions(query, accounts)` pure function from `src/components/import/CoaCombobox.tsx` (or a co-located utils file)
    - _Requirements: 5.4_

  - [ ]* 8.5 Write property test: `canProceed` correctness (Property 8)
    - **Property 8: `canProceed` correctness**
    - Use fast-check to generate arbitrary `PreviewRow[]` and `overrides` maps; assert `canProceed` returns `true` iff every row with `matchType === 'unmapped'` or `confidence < 0.6` has an override with `skipped: true` or non-null `standardAccountId`
    - **Validates: Requirements 4.6**

  - [ ]* 8.6 Write property test: `needsReview` correctness (Property 9)
    - **Property 9: `needsReview` correctness**
    - Use fast-check to generate arrays where every row has `matchType` in `['exact', 'alias', 'saved']` and `confidence >= 0.6`; assert `needsReview` returns `false`
    - **Validates: Requirements 7.2**

  - [ ]* 8.7 Write property test: COA filter completeness (Property 10)
    - **Property 10: COA filter completeness**
    - Use fast-check to generate arbitrary query strings; assert `filterCoaOptions(q, STANDARD_INDIAN_COA)` includes every account whose `name` or any `alias` contains `q` (case-insensitive) and excludes all others
    - **Validates: Requirements 5.4**

- [x] 9. Implement `CoaCombobox` component
  - Create `src/components/import/CoaCombobox.tsx` using shadcn `Popover` + `Command`
  - Group options by `category`; first item is "Skip (exclude from forecast)" separated by a divider
  - Wire search input to `filterCoaOptions`; apply amber ring when `highlightNeeded` is true
  - Accept props: `value`, `skipped`, `onChange`, `highlightNeeded` per the design interface
  - _Requirements: 4.4, 5.1, 5.2, 5.3, 5.4_

- [x] 10. Implement `AccountMappingReview` component
  - [x] 10.1 Create `src/components/import/AccountMappingReview.tsx` with `ReviewSummaryBanner` showing "X rows need review"
    - _Requirements: 4.10_

  - [x] 10.2 Implement `MappingTable` with one `MappingRow` per row: `RawNameCell` (strikethrough when skipped), `MatchTypeBadge`, `ConfidenceBar`, and `CoaCombobox`
    - Highlight rows where `matchType === 'unmapped'` or `confidence < 0.6` with amber background
    - Display `matchType` and `confidence` score per row
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 10.3 Implement `BulkActionBar` with select-all checkbox and bulk-assign `CoaCombobox`; wire to `setBulkOverride` and `selectAll` / `clearSelection` from the store
    - _Requirements: 4.5_

  - [x] 10.4 Implement `ActionFooter` with "Save & Import" button disabled until `canProceed` returns `true`
    - On click: POST to `/api/import/mappings`, then POST to `/api/import/save`
    - On mappings API failure: show inline error banner and do NOT call save
    - On mappings API unavailable: show non-blocking warning toast and allow proceeding with auto-mapped values
    - _Requirements: 4.6, 4.7, 4.8, 7.4_

  - [x] 10.5 Add "Looks good — no review needed" empty state when `needsReview(rows)` returns `false`
    - _Requirements: 7.2_

- [x] 11. Wire `AccountMappingReview` into the import wizard
  - Render `<AccountMappingReview>` after the parse response is received and before the final import step
  - Pass `rows` from parse response and `companyId` from session
  - Call `reset()` on the Zustand store when the wizard is dismissed or restarted
  - _Requirements: 4.1, 4.9_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Run `npx vitest --run` and confirm the full test suite is green. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use fast-check with a minimum of 100 iterations each; tag each with `// Feature: account-mapping-ui, Property N: <property_text>`
- All API errors follow the existing `{ error: string }` shape from `handleRouteError`
- The `POST /api/import/save` request schema is intentionally unchanged; mappings are persisted as a separate prior step
