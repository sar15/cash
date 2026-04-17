# Bugfix Requirements Document

## Introduction

The `/api/import/save` route returns a 500 "Internal Error" when a user attempts to publish their import on the final step of the import wizard. The failure occurs with any dataset that includes new accounts to insert.

**Root cause (confirmed from Vercel logs):** The route's batch account insert uses `onConflictDoUpdate` targeting `(company_id, name)`, but the corresponding unique index `idx_accounts_company_name` was **never applied to the live Turso database** via a migration. The index exists in `src/lib/db/schema.ts` but is absent from all migration files in `drizzle/`. Turso/libSQL rejects the `ON CONFLICT (company_id, name)` clause with `Failed query` because the constraint it references does not exist, causing the entire transaction to fail and the route to return 500.

The bug blocks users from completing the import wizard entirely, making historical actuals unavailable for forecasting.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits an import payload containing any new accounts via `POST /api/import/save` THEN the server returns HTTP 500 with body `{ "error": "Internal Error" }` and the Vercel log shows `Failed query: insert into "accounts" ... on conflict ("accounts"."company_id", "accounts"."name") do update set ...`.

1.2 WHEN the 500 occurs THEN no accounts or actuals are saved to the database (the transaction rolls back entirely), leaving the user's ledger unchanged.

1.3 WHEN the 500 occurs THEN the idempotency slot that was reserved at the start of the request is deleted in the catch block, so the user can retry — but each retry also fails with 500.

1.4 WHEN the route executes the batch account insert with `onConflictDoUpdate` targeting `(company_id, name)` THEN Turso/libSQL rejects the query because the unique index `idx_accounts_company_name` does not exist in the live database — it was defined in `schema.ts` but never included in any migration file under `drizzle/`.

### Expected Behavior (Correct)

2.1 WHEN a user submits an import payload containing new accounts THEN the system SHALL persist all accounts and actuals successfully and return HTTP 200.

2.2 WHEN the import completes successfully THEN the system SHALL return the `{ companyId, createdAccounts, updatedAccounts, savedActuals }` response shape so the UI wizard can advance to the success step.

2.3 WHEN two concurrent imports attempt to insert the same account name for the same company THEN the `ON CONFLICT (company_id, name) DO UPDATE` clause SHALL resolve the race without error.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits a small import payload (e.g., ≤ 50 actuals) THEN the system SHALL CONTINUE TO process it synchronously and return HTTP 200 with the full result in a single response.

3.2 WHEN an idempotency key is provided and the import has already completed THEN the system SHALL CONTINUE TO return the cached HTTP 200 response without re-processing.

3.3 WHEN an idempotency key is provided and a concurrent duplicate request arrives THEN the system SHALL CONTINUE TO return HTTP 409 to the duplicate request.

3.4 WHEN `replaceExisting` is `true` THEN the system SHALL CONTINUE TO delete all existing actuals for the company before inserting the new ones, within the same atomic operation.

3.5 WHEN the import succeeds THEN the system SHALL CONTINUE TO fire the `forecast/config.updated` Inngest event, mark the forecast stale, write the audit log, and create the import-complete notification.

3.6 WHEN the import succeeds and a `fileKey` is present THEN the system SHALL CONTINUE TO delete the uploaded file from R2 storage after the data is persisted.

3.7 WHEN `requireOwnedCompany` fails (wrong owner or company not found) THEN the system SHALL CONTINUE TO return HTTP 401 or 404 without processing the import.

3.8 WHEN the request body fails Zod schema validation THEN the system SHALL CONTINUE TO return HTTP 422 with a validation error before any DB work is attempted.

3.9 WHEN an account name in the actuals list does not match any account in the import payload THEN the system SHALL CONTINUE TO throw a 422 `Unknown account for actual` error and roll back the entire operation.

---

## Bug Condition Pseudocode

**Bug Condition Function** — identifies requests that trigger the failure:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ImportSaveRequest
  OUTPUT: boolean

  // The bug triggers whenever the import includes at least one account
  // that does not already exist in the DB (i.e., toInsert.length > 0).
  // The onConflictDoUpdate clause references idx_accounts_company_name,
  // which is missing from the live DB, so ANY insert with new accounts fails.

  RETURN X.accounts.length > 0
    AND liveDB does NOT have uniqueIndex idx_accounts_company_name
         ON accounts(company_id, name)
END FUNCTION
```

**Property: Fix Checking**

```pascal
// After applying the migration, all imports with new accounts must succeed
FOR ALL X WHERE X.accounts.length > 0 DO
  response ← importSaveRoute'(X)
  ASSERT response.status = 200
  ASSERT allAccountsPersisted(X, db)
  ASSERT allActualsPersisted(X, db)
END FOR
```

**Property: Preservation Checking**

```pascal
// Imports where all accounts already exist (toInsert = []) were not affected
// by the bug and must continue to work identically after the fix
FOR ALL X WHERE allAccountsAlreadyExist(X, db) DO
  ASSERT importSaveRoute(X) = importSaveRoute'(X)
END FOR
```
