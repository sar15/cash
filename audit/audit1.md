Now I have all the data. Here is the comprehensive report.

---

# CashFlowIQ Codebase Comprehensive Report

## Key Reference: Paise Standard (from GEMINI.md)

> ALL monetary values in the database, API, and engine MUST be stored and processed as INTEGER PAISE.
> - 1 Lakh = 10,000,000 paise
> - 1 Crore = 100,000,000,000 paise
> - Division by 100 happens ONCE, in the UI display component only
> - NO `amount / 100` inside a calculation loop
> - All arithmetic stays in paise integers

---

## 1. src/lib/engine/ (41 files)

### 1.1 src/lib/engine/index.ts
- **What it does:** Main orchestrator. `runForecastEngine()` evaluates all value rules, applies timing profiles, overlays micro-forecasts, runs three-way integration, then runs the compliance engine. `runFullForecastEngine()` is a convenience wrapper.
- **Exports:** `runForecastEngine`, `runFullForecastEngine`, `ForecastEngineOptions`, `EngineResult`, `ForecastMicroForecastItem`
- **Complete?** YES - fully functional orchestrator
- **Proper TS types?** YES
- **Paise standard?** PARTIAL VIOLATION - Line 90: `const salaryForecast = [...(accountForecasts['exp-1'] ?? Array(forecastMonths.length).fill(0))]` and the `deriveSalaryForecast` function duplicates logic from `compliance/index.ts`. Also, `buildForecastPeriods()` does string parsing with `20${yearLabel}` which is fragile (Y2K-style bug for years > 2099, though unlikely). Line 83: `applyBaselineAdjustment` uses `Math.round((value * (100 + adjustmentPct)) / 100)` which is correct paise arithmetic.
- **Bugs/issues:** (1) `deriveSalaryForecast` is duplicated in `compliance/index.ts` - DRY violation. (2) `demoData` is hardcoded as the data source - no way to pass in real data, making this engine untestable with non-demo datasets. (3) `buildForecastPeriods` does `Number('20' + yearLabel)` which assumes 2-digit years and prefix "20" - breaks for 2000-2009 years.
- **Tests?** NO dedicated test for index.ts orchestrator (the scenario engine.test.ts exercises it indirectly)

### 1.2 src/lib/engine/value-rules/types.ts
- **What it does:** Defines all value rule type interfaces: `RollingAvgConfig`, `GrowthConfig`, `DirectEntryConfig`, `SameLastYearConfig`, plus `ForecastContext` and `ValueRuleEvaluator` generic type.
- **Exports:** `ValueRuleType`, `BaseValueRuleConfig`, `RollingAvgConfig`, `GrowthConfig`, `DirectEntryConfig`, `SameLastYearConfig`, `AnyValueRuleConfig`, `ForecastContext`, `ValueRuleEvaluator`
- **Complete?** YES
- **Proper TS types?** YES - well-typed discriminated union
- **Paise standard?** YES - documented in comments "1 historical array of paise"
- **Bugs/issues:** `GrowthConfig.monthlyGrowthRate` is typed as `number` (float like 0.05) which is fine for a percentage rate, not a monetary value. `DirectEntryConfig.entries` allows `null` entries - well-documented.
- **Tests?** N/A (types file)

### 1.3 src/lib/engine/value-rules/same-last-year.ts
- **What it does:** Implements `evaluateSameLastYear` - mirrors values from exactly 12 months prior in historical data.
- **Exports:** `evaluateSameLastYear`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - returns raw historical values (already in paise), no division
- **Bugs/issues:** Minor: The `console.warn` on line 18 and the self-referencing logic on lines 23-30 (looking back into own `results` array for forecasts > 12 months out) has a subtle control flow issue. The `continue` on line 29 skips `results.push(0)` on line 32, but the `if (targetIdx >= historyLen)` check on line 23 is inside the `else` branch of `targetIdx >= 0 && targetIdx < historyLen`, so if `targetIdx < 0`, it falls through to the outer `if (targetIdx >= historyLen)` check (which is false for negative), then to `results.push(0)`. This is actually correct but confusing.
- **Tests?** YES - 3 test cases (normal, insufficient data, partial match)

### 1.4 src/lib/engine/value-rules/rolling-avg.ts
- **What it does:** Implements `evaluateRollingAvg` - flat-line forecast using the average of the last N historical months.
- **Exports:** `evaluateRollingAvg`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - `Math.round(sum / actualLookback)` preserves integer paise
- **Bugs/issues:** None
- **Tests?** YES - 4 test cases (normal, insufficient lookback, zero data, zero values)

### 1.5 src/lib/engine/value-rules/growth.ts
- **What it does:** Implements `evaluateGrowth` - compounds growth from the last historical month.
- **Exports:** `evaluateGrowth`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - `Math.round(currentValue)` each step; compounds on rounded value
- **Bugs/issues:** Minor design choice: compounds on the **rounded** value (line 26: `currentValue = roundedValue`), which means rounding errors accumulate differently than if compounding on the float. This is actually the safer paise-standard approach. The comment on line 22-25 acknowledges this tradeoff.
- **Tests?** YES - 3 test cases (normal growth, zero data, negative growth)

### 1.6 src/lib/engine/value-rules/direct-entry.ts
- **What it does:** Implements `evaluateDirectEntry` - returns user-specified monthly values, padding with 0.
- **Exports:** `evaluateDirectEntry`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - `Math.round(val)` applied to entries
- **Bugs/issues:** None
- **Tests?** YES - 2 test cases (normal entry with padding, null entries)

### 1.7 src/lib/engine/timing-profiles/types.ts
- **What it does:** Defines timing profile types (`ReceivablesTimingProfile`, `PayablesTimingProfile`) with month_0 through month_6 ratios and bad_debt. Includes `validateTimingProfile` to verify ratios sum to 1.0.
- **Exports:** `TimingProfileType`, `BaseTimingProfile`, `ReceivablesTimingProfile`, `PayablesTimingProfile`, `AnyTimingProfileConfig`, `validateTimingProfile`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** N/A (this is ratio-based, not monetary)
- **Bugs/issues:** The month ratios are `number` (float) which is correct for percentages. `validateTimingProfile` uses epsilon comparison (0.001) which is reasonable.
- **Tests?** Tested indirectly via calculator.test.ts

### 1.8 src/lib/engine/timing-profiles/calculator.ts
- **What it does:** `applyTimingProfile()` converts accrual-based forecasts to cash-flow-based using timing ratios. Computes opening AR/AP balance from uncollected historical values, then iterates forward producing cash flows and running balances.
- **Exports:** `applyTimingProfile`, `TimingProfileResult`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** PARTIAL CONCERN - Lines 42-43: `openingBalance += historicalValues[i] * uncollectedFraction` multiplies paise by a float, then rounds at the end (line 47). Line 68: `cashCollected += allValues[targetMonthIndex] * profileArray[p]` multiplies paise by float percentages. This introduces intermediate floating-point, but each is rounded before being stored. This is acceptable per paise standard as long as the final values are integers (they are via `Math.round`).
- **Bugs/issues:** The `openingBalance` calculation (lines 32-43) and the `cashCollected` calculation (lines 65-68) are done independently. For the first forecast month, they should reconcile: openingBalance + revenue[0] - cashFlows[0] = balances[0]. Because of independent rounding of openingBalance vs cashFlows, there could be a 1-paise discrepancy in the balance calculation. The test doesn't catch this because it doesn't check balance reconciliation with high precision.
- **Tests?** YES - 4 test cases (no carryover, historical carryover, bad debt, invalid profile)

### 1.9 src/lib/engine/scenarios/types.ts
- **What it does:** Defines `ScenarioDefinition` with baseline adjustments, timing profile overrides, and micro-forecast toggles.
- **Exports:** `BaselineAdjustmentOverride`, `TimingProfileOverride`, `MicroForecastToggleOverride`, `ScenarioDefinition`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** N/A (configuration types)
- **Bugs/issues:** None
- **Tests?** Tested via engine.test.ts

### 1.10 src/lib/engine/scenarios/engine.ts
- **What it does:** `runScenarioForecastEngine()` applies scenario overrides (baseline adjustments, timing profile overrides, micro-forecast toggles) and delegates to `runForecastEngine()`.
- **Exports:** `runScenarioForecastEngine`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - passes through to main engine
- **Bugs/issues:** Uses `JSON.parse(JSON.stringify(...))` for deep cloning (lines 18-19 and 41-43) which is slow but acceptable for the data sizes involved. The `demoTimingProfiles` fallback on line 77 means if no custom profiles are provided, it always uses demo data.
- **Tests?** YES - 3 test cases (baseline adjustment, timing override, micro-forecast toggle) - all verify three-way balance

### 1.11 src/lib/engine/three-way/builder.ts
- **What it does:** Core three-way integration engine. `runThreeWayIntegration()` takes opening balances and monthly inputs, produces P&L, CF, and BS for each month. Cash is the "plug" (calculated last).
- **Exports:** `OpeningBalances`, `MonthlyInput`, `ThreeWayMonth`, `runThreeWayIntegration`
- **Complete?** YES - this is the heart of the system
- **Proper TS types?** YES
- **Paise standard?** YES - all values remain as integers throughout. No floating-point division.
- **Bugs/issues:** (1) Line 77: `const investingCashFlow = -(input.assetPurchases || 0) || 0` - this double-negation is correct but confusing; it ensures a negative number for outflows. (2) The `depreciation` is subtracted from `grossProfit - input.expense` (line 73) but depreciation is NOT included in the `expense` field, which is correct accounting. However, there's no separate BS line for accumulated depreciation impact on retained earnings through netIncome - this IS handled because netIncome flows into retainedEarnings (line 82). (3) Missing: No `investments` or `otherAssets` BS tracking.
- **Tests?** YES - 2 test cases (balanced model, negative cash/overdraft). Could use more edge cases.

### 1.12 src/lib/engine/micro-forecasts/overlay.ts
- **What it does:** `overlayMicroForecast()` merges a micro-forecast's PL and cash impacts onto baseline MonthlyInputs. Returns a new array (non-mutating).
- **Exports:** `overlayMicroForecast`, `MicroForecast`, `MicroForecastLine`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES
- **Bugs/issues:** (1) Line 46: For `Debt` category, `expensePaid` is set to `plImpact` (interest expense), which assumes interest is always paid in the same month. This is a simplification. (2) Line 41: For `Assets` category, `depreciation` is set to `plImpact` and `assetPurchases` to `cashImpact`, which is a semantic mismatch - `plImpacts` for assets means depreciation (P&L), `cashImpacts` means capex (CF). This works but the naming is confusing.
- **Tests?** YES - 1 test case (salary overlay with three-way balance verification)

### 1.13 src/lib/engine/micro-forecasts/wizards/revenue.ts
- **What it does:** Generates a Revenue micro-forecast from client name, monthly amount, start month, GST rate.
- **Exports:** `generateRevenueMicroForecast`, `RevenueWizardInputs`
- **Complete?** MOSTLY - works but has a noted simplification
- **Proper TS types?** YES
- **Paise standard?** YES - monthlyAmount is in paise
- **Bugs/issues:** (1) Line 29: `cashImpacts[i] = inputs.monthlyAmount` assumes 100% immediate cash collection. The comment says "For MVP" but this means the revenue wizard ignores timing profiles entirely. (2) `gstRate` parameter is accepted but **completely unused** - the wizard does not generate GST cash impacts. This is a significant omission for Indian compliance.
- **Tests?** YES - 1 test case (basic revenue generation)

### 1.14 src/lib/engine/micro-forecasts/wizards/new-hire.ts
- **What it does:** Generates a New Hire micro-forecast with split cash timing: net salary paid same month, statutory payments (PF/ESI/TDS) paid next month.
- **Exports:** `generateNewHireMicroForecast`, `NewHireWizardInputs`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - monthlyCTC in paise
- **Bugs/issues:** The `netSalaryPct`/`statutoryPct` split is a simplification. In reality, PF/ESI are employer costs ON TOP of CTC, not deducted from CTC. The statutory percentage represents the employee's TDS+PF deduction from gross salary, not the employer's matching contribution. This is a domain logic issue that could cause incorrect compliance calculations downstream.
- **Tests?** YES - 1 test case (with three-way balance verification)

### 1.15 src/lib/engine/micro-forecasts/wizards/asset.ts
- **What it does:** Generates an Asset Purchase micro-forecast with straight-line depreciation and immediate capex outflow.
- **Exports:** `generateAssetMicroForecast`, `AssetWizardInputs`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - purchaseAmount and salvageValue in paise
- **Bugs/issues:** (1) Depreciation starts in the **same month** as purchase (line 30), but many Indian companies start depreciation from the next month. This should be configurable. (2) No partial-month depreciation for mid-month purchases. (3) Rounding: `Math.round((purchaseAmount - salvageValue) / usefulLifeMonths)` means the total depreciation over the life may not equal `(purchaseAmount - salvageValue)` exactly - there could be a few paise difference due to rounding.
- **Tests?** YES - 1 test case (with three-way balance verification)

### 1.16 src/lib/engine/micro-forecasts/wizards/loan.ts
- **What it does:** Generates a Loan micro-forecast with reducing-balance interest and equal principal repayment.
- **Exports:** `generateLoanMicroForecast`, `LoanWizardInputs`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - principalAmount in paise
- **Bugs/issues:** (1) Cash impact in the start month is `+principalAmount - monthlyPrincipal` (line 31-42), which means the drawdown AND first repayment happen in month 1. Some loans disburse in full and start repayment the next month. (2) Equal principal repayment (`monthlyPrincipal = Math.round(principalAmount / termMonths)`) means the last payment may be slightly different due to rounding, but the code doesn't account for a "balloon" adjustment on the final month. (3) `remainingPrincipal` could go slightly negative due to rounding.
- **Tests?** YES - 1 test case (with three-way balance verification)

### 1.17 src/lib/engine/compliance/types.ts
- **What it does:** Defines compliance adjustment types (`ComplianceMonthAdjustment`, `ComplianceOpeningBalances`, `ComplianceAdjustedMonth`), plus `createZeroAdjustment` factory and `mergeComplianceAdjustments` utility.
- **Exports:** `ComplianceMonthAdjustment`, `ComplianceOpeningBalances`, `ComplianceAdjustedMonth`, `createZeroAdjustment`, `mergeComplianceAdjustments`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - all monetary fields are integers
- **Bugs/issues:** None
- **Tests?** Tested indirectly via individual compliance tests

### 1.18 src/lib/engine/compliance/index.ts
- **What it does:** Master compliance orchestrator. `buildComplianceForecast()` runs GST, TDS, Advance Tax, and PF/ESI engines, merges adjustments, applies them to the three-way model, builds calendar events with cash snapshots, and generates shortfall alerts.
- **Exports:** `buildComplianceForecast`, `ComplianceResult`, `ComplianceCalendarEvent`, `ComplianceAlert`, `ComplianceEventType`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES
- **Bugs/issues:** (1) `deriveSalaryForecast` (lines 57-79) is **duplicated** from `engine/index.ts` - DRY violation. (2) `attachCashSnapshots` calculates `runningCash` starting from `integrationResults[index].bs.cash + periodEvents.reduce(...)` which adds back the event amounts to get "cash before any events". This assumes all events for a period have already been deducted from the BS cash, which is correct because `applyComplianceAdjustments` already ran.
- **Tests?** YES - 1 test case (events, alerts, shortfall detection, three-way balance)

### 1.19 src/lib/engine/compliance/gst.ts
- **What it does:** GST compliance engine. Calculates output GST on revenue, input GST on purchases with ITC percentage, carries forward excess ITC as receivable, schedules payment on 20th of following month. Handles intra-state (CGST+SGST) and inter-state (IGST) splits.
- **Exports:** `calculateGSTForecast`, `GSTForecastResult`, `GSTForecastMonth`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - uses `multiplyByPct` from utils/math
- **Bugs/issues:** (1) Line 62: `adjustments[index].operatingCashDelta += outputGST - inputGST` adds the net GST to operating cash. But GST collected is NOT operating cash - it's a liability that goes to the government. The `operatingCashDelta` here represents the net GST collected minus ITC claimed, which flows through AR/AP. The actual cash outflow happens when GST is paid (lines 70-71). This seems intentional but the naming is confusing. (2) Line 64: `adjustments[index].gstPayableDelta += netPayable` - this adds the full netPayable as a payable in the accrual month, then reverses it in the payment month (lines 70-71). This is correct. (3) The ITC calculation uses a flat `inputTaxCreditPct` on total input GST, which is a simplification. Real ITC may vary by expense category.
- **Tests?** YES - 1 test case (intra-state split, ITC carry-forward, payment scheduling, three-way balance)

### 1.20 src/lib/engine/compliance/tds.ts
- **What it does:** Salary TDS engine. Calculates annual tax using AY 2026-27 new regime slabs, allocates pro-rata across months, schedules deposit on 7th of following month. Includes rebate under section 87A and marginal relief.
- **Exports:** `calculateSalaryTDSForecast`, `SalaryTDSForecastResult`, `SalaryTDSForecastMonth`
- **Complete?** YES - impressively detailed
- **Proper TS types?** YES
- **Paise standard?** YES - uses BigInt for pro-rata allocation to avoid rounding errors
- **Bugs/issues:** (1) The slab thresholds (lines 32-38) are in paise: e.g., `40_000_000` = 4,00,000 rupees in paise. This seems low - 4 lakh is the first slab for the new regime AY 2026-27. Actually under the new regime AY 2025-26, the first slab is 0-4 lakh at 0%, then 4-8 lakh at 5%, etc. The values look correct. (2) `REBATE_THRESHOLD = 120_000_000` = 12 lakh rupees in paise. The section 87A rebate for AY 2025-26 new regime is for taxable income up to 12 lakh. Correct. (3) The `allocateProRata` function (lines 80-109) uses BigInt arithmetic for precision, which is excellent. (4) Line 126: `adjustments[index].apReclassification += salaryTDS` - this reclassifies TDS from AP to a separate `tdsPayable` line, which is correct accounting.
- **Tests?** YES - 1 test case (new regime calculation, pro-rata allocation, payment timing, three-way balance)

### 1.21 src/lib/engine/compliance/advance-tax.ts
- **What it does:** Advance tax engine. Calculates annual estimated tax from projected PBT, schedules quarterly installments on Jun 15 (15%), Sep 15 (45%), Dec 15 (75%), Mar 15 (100%).
- **Exports:** `calculateAdvanceTaxForecast`, `AdvanceTaxForecastResult`, `AdvanceTaxInstallment`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - uses `multiplyByPct`
- **Bugs/issues:** (1) The `ADVANCE_TAX_SCHEDULE` maps month numbers (6=Jun, 9=Sep, 12=Dec, 3=Mar) to cumulative percentages. This is correct per Indian tax law. (2) Advance tax is booked as an **asset** (`advanceTaxAssetDelta`) not a liability, because it's a prepayment of tax. This is correct accounting. (3) The installment amount is calculated as `requiredCumulative - cumulativePaid` which means if PBT changes month-to-month, the schedule stays based on the total annual projection. This is correct.
- **Tests?** YES - 1 test case (quarterly schedule, BS asset booking, three-way balance)

### 1.22 src/lib/engine/compliance/pf-esi.ts
- **What it does:** PF/ESI compliance engine. Calculates employer PF (12% of basic), employer ESI (3.25%), employee ESI (0.75%) with ESI eligibility threshold (Rs 21,000/month). Schedules deposit on 15th of following month.
- **Exports:** `calculatePFESIForecast`, `PFESIForecastResult`, `PFESIForecastMonth`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - `DEFAULT_ESI_THRESHOLD = 2_100_000` = Rs 21,000 in paise
- **Bugs/issues:** (1) Line 49: `esiEligible = grossSalary <= esiThreshold` checks if monthly gross salary is below the threshold. This is correct - ESI applies only to employees earning Rs 21,000 or below per month. (2) Line 56: `employerStatutoryExpense` is accrued as an additional P&L expense (via `adjustments[index].employerExpenseAccrual`), which is correct - employer PF/ESI are employer costs. (3) Line 59: Employee ESI is reclassified from AP to `esiPayable`, which is correct - it's withheld from the employee's salary.
- **Tests?** YES - 2 test cases (normal PF/ESI accrual and payment, ESI above threshold exclusion)

### 1.23 src/lib/engine/compliance/apply.ts
- **What it does:** `applyComplianceAdjustments()` takes raw three-way months and compliance adjustments, produces `ComplianceAdjustedMonth` objects with updated P&L, CF, and BS figures. Tracks running balances for all compliance accounts.
- **Exports:** `applyComplianceAdjustments`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES
- **Bugs/issues:** (1) Line 60: `const adjustedAp = month.bs.ap - runningBalances.reclassifiedAp` - AP is reduced by reclassified amounts (TDS and employee ESI moved to separate payable lines). This is correct. (2) Line 64-69: Total assets include `gstReceivable` and `advanceTaxPaid` (prepaid tax), which is correct. (3) Line 70-76: Total liabilities include `gstPayable`, `tdsPayable`, `pfPayable`, `esiPayable`. Correct. (4) The function is complex with many running totals but appears mathematically sound. Each test verifies `assertThreeWayBalances` which confirms the output is balanced.
- **Tests?** No dedicated test file; tested via gst.test.ts, tds.test.ts, advance-tax.test.ts, pf-esi.test.ts

### 1.24 src/lib/engine/compliance/periods.ts
- **What it does:** Utility functions for period/date manipulation: `buildPeriodIndexMap`, `parsePeriod`, `formatDate`, `getFollowingMonthDueDate`, `getFollowingMonthPeriod`.
- **Exports:** `buildPeriodIndexMap`, `parsePeriod`, `formatDate`, `getFollowingMonthDueDate`, `getFollowingMonthPeriod`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** N/A
- **Bugs/issues:** None - straightforward date utilities
- **Tests?** No dedicated test file; tested indirectly

### 1.25 src/lib/engine/compliance/test-helpers.ts
- **What it does:** Shared test utilities: `lakh()` and `rupees()` helpers for creating paise values in tests, `assertThreeWayBalances()` for verifying the balance law.
- **Exports:** `lakh`, `rupees`, `assertThreeWayBalances`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - `lakh(1.5)` = 1,50,00,000 paise (1.5 lakh in paise), `rupees(50_000)` = 50,00,000 paise (50,000 rupees in paise)
- **Bugs/issues:** `rupees()` function name is misleading - it takes a rupee amount and converts TO paise. Should arguably be called `rupeesToPaise()` or similar.
- **Tests?** N/A (test helper)

---

## 2. src/lib/db/ (3 files)

### 2.1 src/lib/db/schema.ts
- **What it does:** Complete Drizzle ORM schema for SQLite/Turso. Defines 11 tables: `companies`, `accounts`, `monthlyActuals`, `valueRules`, `timingProfiles`, `microForecasts`, `microForecastLines`, `scenarios`, `scenarioOverrides`, `complianceConfig`, `forecastResults`, `quickMetricsConfig`.
- **Exports:** All table definitions
- **Complete?** YES - comprehensive schema covering all engine concepts
- **Proper TS types?** YES - uses Drizzle's typed column definitions
- **Paise standard?** PARTIAL - `monthlyActuals.amount` is `integer('amount').notNull()` with comment "IN PAISE" (CORRECT). BUT `complianceConfig.gstRate`, `itcPct`, `taxRate` are `real` (float) which is acceptable for percentages but risks floating-point issues. No monetary amounts use `real`.
- **Bugs/issues:** (1) `complianceConfig` uses `real` for rates - acceptable for percentages but could use integer basis points instead for consistency. (2) `valueRules.config` and `timingProfiles.config` are JSON text columns - no validation at DB level. (3) `forecastResults` stores entire P&L/BS/CF as JSON text - this is a caching mechanism, which is fine but could get stale. (4) `quickMetricsConfig.threshold` is JSON text for flexible thresholds. (5) Missing: No `uploads` or `import_sessions` table for tracking file uploads.
- **Tests?** NO

### 2.2 src/lib/db/index.ts
- **What it does:** Database connection setup. Creates a libsql client and Drizzle instance.
- **Exports:** `db`, `schema`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** N/A
- **Bugs/issues:** Uses environment variables `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` with fallback to `file:local.db`. The fallback is useful for local development but could silently use a local DB if env vars are misconfigured in production.
- **Tests?** NO

### 2.3 src/lib/db/company-context.ts
- **What it does:** Company resolution functions: `getOrCreatePrimaryCompanyForUser()` finds or creates a company for a Clerk user. `resolveCompanyForUser()` verifies company ownership.
- **Exports:** `getOrCreatePrimaryCompanyForUser`, `resolveCompanyForUser`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** N/A
- **Bugs/issues:** (1) Line 18: Hardcodes `'Patel Engineering Works'` as default company name when creating a new company. This should be a user-provided name. (2) `resolveCompanyForUser` correctly enforces company isolation (line 39: `company.clerkUserId !== clerkUserId`). (3) No error handling for database connection failures.
- **Tests?** NO

---

## 3. src/lib/import/ (4 files)

### 3.1 src/lib/import/validator.ts
- **What it does:** Validates P&L and Balance Sheet balance from parsed import data. Checks: P&L net profit ties out, BS assets = liabilities + equity, retained earnings reconciliation.
- **Exports:** `validateHistoricalStatement`, `BalanceValidationResult`, `StatementData`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** ASSUMED - the function works on raw numbers with tolerance of 100 (line 31). This assumes inputs are already in paise. Tolerance of 100 paise = 1 rupee, which is reasonable for import validation.
- **Bugs/issues:** (1) The tolerance of 100 (paise) = 1 rupee seems large. If data is in paise, a 100-paise tolerance means the P&L can be off by 1 rupee before flagging. This might be too generous for financial data. (2) Only validates one period at a time - no multi-period cross-validation.
- **Tests?** NO

### 3.2 src/lib/import/excel-parser.ts
- **What it does:** Parses Excel/CSV files using the `xlsx` library into arrays of arrays.
- **Exports:** `parseExcelBuffer`, `ParsedSheet`
- **Complete?** YES - minimal but functional
- **Proper TS types?** YES
- **Paise standard?** N/A - returns raw data, no conversion yet
- **Bugs/issues:** (1) `sheet_to_json` with `header: 1` returns `unknown[][]` - type safety is lost at the cell level. This is expected for a raw parser. (2) Trailing empty row trimming is good. (3) No error handling for corrupted files.
- **Tests?** NO

### 3.3 src/lib/import/structure-detector.ts
- **What it does:** Detects the structure of a parsed Excel sheet - finds header row, account name column, data columns, and month labels. Also includes `parseIndianNumberString()` for parsing Indian-formatted numbers.
- **Exports:** `detectStructure`, `parseIndianNumberString`, `ColumnMap`
- **Complete?** PARTIALLY - basic detection works but fragile
- **Proper TS types?** YES
- **Paise standard?** VIOLATION - `parseIndianNumberString` returns numbers in rupees (not paise). For example, "12.34 Cr" returns `12.34 * 10000000 = 123400000` which is 1,23,40,00,000 rupees, NOT paise. There's no conversion to paise.
- **Bugs/issues:** (1) MAJOR: `parseIndianNumberString` doesn't convert to paise. "12,34,567" returns 1234567 (rupees), not 123456700 (paise). This will break the paise standard downstream. (2) The Lakh regex on line 24 is fragile: `clean.match(/[0-9]+(\.?[0-9]*)\s*l(akh)?/i)` - could match strings like "12val" incorrectly. (3) Line 27: `clean.replace(/[a-z]/gi, '')` removes ALL letters, including from strings like "12.34Cr" which works, but also from malformed strings. (4) The header detection (lines 43-74) is reasonable but could fail on non-standard formats. (5) Fallback detection (lines 77-109) is creative but unreliable.
- **Tests?** NO

### 3.4 src/lib/import/account-mapper.ts
- **What it does:** Maps raw account names to standard account IDs using exact match, alias match, or Levenshtein distance fuzzy matching.
- **Exports:** `mapAccount`, `mapAccountDetailed`, `levenshtein`, `STANDARD_ACCOUNT_OPTIONS`, `StandardAccountOption`, `AccountMappingResult`, `AccountMatchType`
- **Complete?** PARTIALLY - functional but limited
- **Proper TS types?** YES
- **Paise standard?** N/A
- **Bugs/issues:** (1) `STANDARD_ACCOUNT_OPTIONS` has only 8 accounts, which is very limited for real Indian SMEs. The GEMINI.md mentions `src/lib/standards/indian-coa.ts` which doesn't exist yet. (2) Levenshtein threshold of 3 (line 94) is per GEMINI.md spec, but this is quite aggressive - "Rent" and "Rant" would match. (3) No category-aware matching - the mapper doesn't use sheet context (P&L vs BS) to disambiguate.
- **Tests?** NO

---

## 4. src/lib/compliance/ - EMPTY DIRECTORY

This top-level directory does not exist. All compliance code is under `src/lib/engine/compliance/`.

---

## 5. src/lib/pdf/ - EMPTY DIRECTORY

No files found. Per GEMINI.md, this is owned by the `frontend-specialist` agent and is Phase 5 scope. Not yet built.

---

## 6. src/lib/utils/ (3 files)

### 6.1 src/lib/utils/math.ts
- **What it does:** Safe paise arithmetic helpers: `sumPaise`, `multiplyByPct`, `calculatePct`, `applyGrowth`, `rollingAverage`, `isBalanced`.
- **Exports:** `sumPaise`, `multiplyByPct`, `calculatePct`, `applyGrowth`, `rollingAverage`, `isBalanced`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - `multiplyByPct(paise, pct)` returns `Math.round(paise * pct / 100)`, all functions maintain integer outputs
- **Bugs/issues:** (1) `sumPaise` does `Math.round(a)` on each element before summing, which is redundant if inputs are already integers but safe. (2) `calculatePct` returns a float (not rounded to integer) because it's a display utility, not a financial calculation. This is fine. (3) `applyGrowth` is not used by the growth value rule (which has its own implementation) - potential DRY issue.
- **Tests?** NO

### 6.2 src/lib/utils/indian-format.ts
- **What it does:** Indian number formatting - the ONLY place where paise-to-rupees conversion happens. `formatRupees`, `formatLakhs`, `formatCrores`, `formatAuto`, `parseToRupees`, `formatDateIndian`.
- **Exports:** `formatRupees`, `formatLakhs`, `formatCrores`, `formatAuto`, `parseToRupees`, `formatDateIndian`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - this is the designated conversion layer
- **Bugs/issues:** (1) Line 10: `PAISE_PER_CRORE = 100_000_000_0` - this has a trailing zero making it 10,000,000,000 (10 billion). 1 Crore = 1,00,00,000 rupees x 100 paise = 10,000,000,000 paise. The value is correct but the formatting `100_000_000_0` is unusual (trailing `_0`). It should be `10_000_000_000`. (2) `parseToRupees` is misnamed - it returns PAISE, not rupees. Line 90 comment says "Parse an Indian-formatted string back to paise" but the function name says `parseToRupees`. This is a naming bug that could cause confusion. (3) `formatRupees` shows negative amounts in parentheses (accounting convention) which is good. (4) `formatRupees` with `showDecimals = true` only shows decimals when they're non-zero, which is a nice touch.
- **Tests?** NO

### 6.3 src/lib/utils/date-utils.ts
- **What it does:** Indian Financial Year date utilities: FY labels, FY start/end dates, period generation, month labels, period formatting, FY membership checks.
- **Exports:** `getFYLabel`, `getFYStart`, `getFYEnd`, `generatePeriods`, `getMonthLabel`, `formatPeriod`, `isPeriodInFY`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** N/A
- **Bugs/issues:** None - straightforward and correct. `generatePeriods` is used by compliance tests and works correctly.
- **Tests?** NO

---

## 7. src/lib/standards/ - EMPTY DIRECTORY

Per GEMINI.md, this should contain `indian-coa.ts` (Indian Chart of Accounts). Not yet built. The `account-mapper.ts` has a minimal `STANDARD_ACCOUNT_OPTIONS` array (8 accounts) that serves as a temporary substitute.

---

## 8. src/lib/ Top-Level Files (4 files)

### 8.1 src/lib/utils.ts
- **What it does:** shadcn/ui utility - `cn()` function combining `clsx` and `tailwind-merge`.
- **Exports:** `cn`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** N/A
- **Bugs/issues:** None - standard shadcn boilerplate
- **Tests?** NO (and not needed)

### 8.2 src/lib/r2.ts
- **What it does:** Cloudflare R2 (S3-compatible) file upload/download client using AWS SDK.
- **Exports:** `uploadFile`, `getFile`, `generateUploadKey`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** N/A
- **Bugs/issues:** (1) Line 41: `@ts-expect-error` for ReadableStream from AWS SDK - this is a known typing issue. (2) No presigned URL generation for secure file access. (3) No file size limits. (4) `generateUploadKey` uses `Date.now()` which could cause collisions under high concurrency. (5) No error handling for missing environment variables.
- **Tests?** NO

### 8.3 src/lib/demo-data.ts
- **What it does:** Hardcoded 12-month dataset for "Patel Engineering Works" - 8 accounts with historical values in paise, plus demo value rules and timing profiles.
- **Exports:** `demoData`, `generateDemoData`, `historicalMonths`, `forecastMonths`, `allMonths`, `demoValueRules`, `demoTimingProfiles`, `AccountData`
- **Complete?** YES
- **Proper TS types?** YES
- **Paise standard?** YES - `const LAKH = 10_000_000` (1 lakh in paise). All values are multiples of LAKH.
- **Bugs/issues:** (1) Only 8 accounts defined (2 revenue, 2 COGS, 3 expenses, 1 asset) - no liabilities or equity accounts in the demo data. The three-way builder gets opening balances from `ast-1` which is cash, but there's no demo data for AR, AP, debt, or fixed assets. (2) The demo data has fractional lakhs like `45.2 * LAKH` which results in `452000000` paise = Rs 45,20,000. This is clean. (3) `demoTimingProfiles` only covers 4 accounts (rev-1, rev-2, cogs-1, cogs-2) - exp-1, exp-2, exp-3 have no timing profiles, meaning they're assumed to be paid in the same month.
- **Tests?** NO (but it's test data, so tested indirectly)

### 8.4 src/lib/configuration.ts
- **What it does:** Configuration file import/export using Zod validation. Handles camelCase/snake_case alias normalization, builds export files, parses import files.
- **Exports:** `buildConfigurationFile`, `parseConfigurationFile`, `getConfigurationFilename`, `ExportConfigurationFile`
- **Complete?** YES
- **Proper TS types?** YES - uses Zod inferred types
- **Paise standard?** YES - `minimumCashThreshold` and `receivablesAlertThreshold` are numbers (assumed paise)
- **Bugs/issues:** (1) Line 87: Generic error message `"Something went wrong. Please try again."` when Zod parsing fails - this hides validation errors from the user. Should include specific field errors. (2) The `normalizeConfigurationAliases` function allows both camelCase and snake_case keys, which is user-friendly but could lead to ambiguity if both are present. (3) Type assertions on lines 99-100 (`as Record<string, AnyValueRuleConfig>` etc.) bypass Zod's type narrowing - the Zod schema validates `z.record(z.string(), z.unknown())` but the assertion claims they're typed configs. This could cause runtime errors if the actual data doesn't match.
- **Tests?** NO

---

## Summary Matrix

| File | Complete? | TS Types? | Paise Standard? | Bugs/Issues | Has Tests? |
|------|-----------|-----------|-----------------|-------------|------------|
| **ENGINE** | | | | | |
| engine/index.ts | YES | YES | PARTIAL | Duplicate fn, hardcoded demoData, Y2K-ish year parse | NO |
| value-rules/types.ts | YES | YES | YES | None | N/A |
| value-rules/same-last-year.ts | YES | YES | YES | Minor control flow confusion | YES (3) |
| value-rules/rolling-avg.ts | YES | YES | YES | None | YES (4) |
| value-rules/growth.ts | YES | YES | YES | Rounding compounding tradeoff (documented) | YES (3) |
| value-rules/direct-entry.ts | YES | YES | YES | None | YES (2) |
| timing-profiles/types.ts | YES | YES | N/A | None | Indirect |
| timing-profiles/calculator.ts | YES | YES | PARTIAL | Float intermediates (rounded), potential 1-paise drift | YES (4) |
| scenarios/types.ts | YES | YES | N/A | None | Indirect |
| scenarios/engine.ts | YES | YES | YES | JSON clone, demo fallback | YES (3) |
| three-way/builder.ts | YES | YES | YES | Double negation confusion, missing asset types | YES (2) |
| micro-forecasts/overlay.ts | YES | YES | YES | Debt/Asset semantic naming, interest timing | YES (1) |
| wizards/revenue.ts | MOSTLY | YES | YES | GST rate unused, 100% immediate cash | YES (1) |
| wizards/new-hire.ts | YES | YES | YES | Employer/employee PF split simplification | YES (1) |
| wizards/asset.ts | YES | YES | YES | Same-month depreciation, rounding total | YES (1) |
| wizards/loan.ts | YES | YES | YES | First-month repayment, balloon rounding | YES (1) |
| compliance/types.ts | YES | YES | YES | None | Indirect |
| compliance/index.ts | YES | YES | YES | Duplicated deriveSalaryForecast | YES (1) |
| compliance/gst.ts | YES | YES | YES | operatingCashDelta naming, flat ITC | YES (1) |
| compliance/tds.ts | YES | YES | YES | None (impressively detailed) | YES (1) |
| compliance/advance-tax.ts | YES | YES | YES | None | YES (1) |
| compliance/pf-esi.ts | YES | YES | YES | None | YES (2) |
| compliance/apply.ts | YES | YES | YES | Complex but sound | Indirect |
| compliance/periods.ts | YES | YES | N/A | None | NO |
| compliance/test-helpers.ts | YES | YES | YES | `rupees()` name misleading | N/A |
| **DB** | | | | | |
| db/schema.ts | YES | YES | PARTIAL | `real` for rates (acceptable), no uploads table | NO |
| db/index.ts | YES | YES | N/A | Silent local DB fallback | NO |
| db/company-context.ts | YES | YES | N/A | Hardcoded "Patel Engineering Works" | NO |
| **IMPORT** | | | | | |
| import/validator.ts | YES | YES | ASSUMED | Tolerance may be too generous | NO |
| import/excel-parser.ts | YES | YES | N/A | No error handling | NO |
| import/structure-detector.ts | PARTIAL | YES | VIOLATION | `parseIndianNumberString` returns rupees not paise; fragile regex | NO |
| import/account-mapper.ts | PARTIAL | YES | N/A | Only 8 accounts, no category-aware matching | NO |
| **UTILS** | | | | | |
| utils/math.ts | YES | YES | YES | `applyGrowth` not used by growth rule | NO |
| utils/indian-format.ts | YES | YES | YES | `parseToRupees` misnamed (returns paise), `PAISE_PER_CRORE` formatting | NO |
| utils/date-utils.ts | YES | YES | N/A | None | NO |
| **TOP-LEVEL** | | | | | |
| utils.ts | YES | YES | N/A | None | NO |
| r2.ts | YES | YES | N/A | ts-expect-error, no size limits | NO |
| demo-data.ts | YES | YES | YES | Only 8 accounts, no BS accounts | NO |
| configuration.ts | YES | YES | YES | Generic error, unsafe type assertions | NO |
| **MISSING** | | | | | |
| standards/indian-coa.ts | NOT BUILT | - | - | Referenced in GEMINI.md, doesn't exist | - |
| pdf/ | NOT BUILT | - | - | Phase 5 scope | - |

---

## Critical Findings

### Paise Standard Violations
1. **`import/structure-detector.ts` `parseIndianNumberString()`** returns rupees, NOT paise. Any downstream code consuming this will be off by 100x. This is the most critical bug.
2. **`utils/indian-format.ts` `parseToRupees()`** is misnamed - it returns paise. Could cause developer confusion and double-conversion bugs.

### DRY Violations
1. **`deriveSalaryForecast`** is duplicated between `engine/index.ts` (lines 86-107) and `engine/compliance/index.ts` (lines 57-79).

### Missing Components (per GEMINI.md)
1. **`src/lib/standards/indian-coa.ts`** - Indian Chart of Accounts dictionary. Referenced in GEMINI.md as import-engineer's responsibility. Does not exist.
2. **`src/lib/pdf/`** - PDF report generation. Phase 5 scope, not yet built.
3. **`src/lib/import/csv-parser.ts`** - Referenced in GEMINI.md project map, but CSV parsing is handled by `xlsx` library in `excel-parser.ts`. May be intentional consolidation.

### Test Coverage Gaps
- **17 test files exist**, all within `src/lib/engine/`. 
- **ZERO tests** for: db/, import/, utils/, r2.ts, demo-data.ts, configuration.ts
- The engine is well-tested (all major submodules have tests with three-way balance assertions). Everything else has no test coverage.

### Architectural Concerns
1. **`engine/index.ts` is tightly coupled to `demoData`** - the main `runForecastEngine()` iterates over `demoData` (line 119) and uses `demoValueRules`/`demoTimingProfiles` as defaults. To make this work with real data, the function needs a data source parameter.
2. **No end-to-end test** for the full pipeline (demo data -> engine -> compliance -> formatted output).
3. **The growth value rule has its own compounding logic** rather than using `utils/math.ts` `applyGrowth()` - suggests the utils were written after the engine, or there's a disconnect.