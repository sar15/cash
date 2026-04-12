I have now read every relevant file in the project. Here is the comprehensive audit report.

---

# CashFlowIQ Engine Audit Report

## Executive Summary

The project has a solid architectural foundation with well-separated concerns and test coverage for each engine. However, the audit reveals **18 specific code issues**, ranging from critical bugs (floating-point in micro-forecasts, aggregate-vs-per-employee compliance calculations) to design gaps (no indirect-method CF statement, no cash-as-plug enforcement in compliance layer). Below is the detailed analysis per component.

---

## 1. GST ENGINE

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/gst.ts`
**Test:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/gst.test.ts`

### Completeness: COMPLETE (for monthly filing)

### Correct Implementation of Indian Rules:
| Rule | Status | Detail |
|---|---|---|
| 20th of following month | PASS | `getFollowingMonthDueDate(period, 20)` at line 92 |
| CGST+SGST intra-state | PASS | Lines 76-84 split output/input GST |
| IGST inter-state | PASS | Lines 84/88 assign full amount to IGST |
| ITC carry-forward as receivable | PASS | `closingReceivable` tracked at line 60, asset on BS |

### Issues Found:

**ISSUE G1 -- CGST/SGST split uses `Math.floor` for CGST, extra paise silently assigned to SGST (lines 76-77)**
```typescript
const splitOutput = supplyType === 'intra-state' ? Math.floor(outputGST / 2) : 0;
// ...
outputSGST: supplyType === 'intra-state' ? outputGST - splitOutput : 0,
```
When `outputGST` is odd, CGST gets the floor and SGST gets the ceiling. While the total is correct, this asymmetry is undocumented and could confuse auditors. Same issue on input side (lines 77, 87-88).

**ISSUE G2 -- `supplyType` is hardcoded to `'intra-state'` in the orchestrator**
File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/index.ts`, line 243:
```typescript
supplyType: 'intra-state',
```
The `GSTForecastInput` interface supports `'inter-state'`, but the orchestrator never passes it through from configuration. A company with inter-state sales will get wrong GST splits.

**ISSUE G3 -- GST cash timing doesn't follow the revenue timing profile**
In `gst.ts` line 54, `outputGST = multiplyByPct(revenue, outputRatePct)`, and line 62, `operatingCashDelta += outputGST - inputGST`. The GST cash is assumed to flow in the recognition month. But if the revenue timing profile is 30/70 (same-month/next-month), the GST collected from customers should follow the same pattern. Currently, the full GST cash is recognized in the invoice month regardless of when customers actually pay.

**ISSUE G4 -- `taxablePurchases` mapped to `cogs` only**
File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/index.ts`, line 239:
```typescript
taxablePurchases: rawIntegrationResults.map((month) => month.pl.cogs),
```
Operating expenses that have GST (e.g., contractor services u/s 194C) are excluded from ITC calculation. Only COGS generates ITC. This understates input tax credit for businesses with taxable operating expenses.

### Edge Cases:
- **Zero revenue month**: Handled via `taxableRevenue[index] ?? 0` (line 52). PASS.
- **Negative GST (ITC > output)**: Creates receivable asset, not negative payable (lines 59-60). PASS.
- **Payment period outside forecast range**: `paymentIndex === undefined` means no payment adjustment is recorded (lines 67-72). The payable remains on the BS forever -- a minor gap, but acceptable for 12-month forecasts.

---

## 2. TDS ENGINE

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/tds.ts`
**Test:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/tds.test.ts`

### Completeness: COMPLETE (salary TDS only; no contractor/professional/rent TDS)

### Correct Implementation of Indian Rules:
| Rule | Status | Detail |
|---|---|---|
| 7th of following month | PASS | `getFollowingMonthDueDate(period, 7)` at line 140 |
| New regime AY 2026-27 slabs | PASS | Slabs at lines 31-39 are correct paise values |
| Standard deduction Rs.75,000 | PASS | `7_500_000` paise at line 26 |
| Section 87A rebate up to Rs.12L | PASS | Lines 66-68 return 0 if `taxableIncome <= 120_000_000` |
| 4% Health & Education Cess | PASS | Line 70 |
| Marginal relief near threshold | PASS | Lines 71-75 |

### Issues Found:

**ISSUE T1 (CRITICAL) -- TDS is calculated on AGGREGATE salary, not per-employee**
The engine receives `projectedGrossSalaries: number[]` (total monthly salary for all employees) and calculates tax on the ANNUAL AGGREGATE. For a company with 10 employees each earning Rs.10L/year, the aggregate is Rs.1Cr, and the engine applies the 30% slab to the full amount. In reality, each employee is taxed individually at lower slabs. This will **massively overstate TDS** for any company with more than one employee.

The `allocateProRata` function (lines 80-109) distributes the over-estimated annual tax across months proportional to each month's salary, but the underlying annual tax amount is wrong.

**ISSUE T2 -- `apReclassification` accumulates without reversal**
In `tds.ts` line 126: `adjustments[index].apReclassification += salaryTDS`. In `apply.ts` line 45: `runningBalances.reclassifiedAp += adjustment.apReclassification`. This grows cumulatively every month. It works ONLY because the base model's AP also grows cumulatively when `expensePaid < expense`. If the base model pays full salary (expensePaid = expense), AP = 0, and subtracting `reclassifiedAp` would make AP negative, breaking the balance sheet.

The TDS test avoids this by setting `expensePaid = monthlyGrossSalary - tds.months[index].salaryTDS` (test line 43), which pre-accounts for TDS withholding. But the engine itself does not enforce or document this requirement.

**ISSUE T3 -- No old regime support**
The `configuration.ts` schema has `tdsRegime: z.enum(['new'])`, so old regime is not an option. For FY 2025-26, employees can still opt for the old regime. This is an acceptable MVP limitation but should be documented.

**ISSUE T4 -- Only salary TDS (Section 192) is implemented**
Sections 194C (contractors), 194J (professionals), 194I (rent), 194H (commission) are not implemented. Acceptable for MVP.

---

## 3. ADVANCE TAX ENGINE

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/advance-tax.ts`
**Test:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/advance-tax.test.ts`

### Completeness: COMPLETE

### Correct Implementation of Indian Rules:
| Rule | Status | Detail |
|---|---|---|
| Jun 15 = 15% | PASS | Line 26: `[6, { day: 15, cumulativePct: 15 }]` |
| Sep 15 = 45% | PASS | Line 27: `[9, { day: 15, cumulativePct: 45 }]` |
| Dec 15 = 75% | PASS | Line 28: `[12, { day: 15, cumulativePct: 75 }]` |
| Mar 15 = 100% | PASS | Line 29: `[3, { day: 15, cumulativePct: 100 }]` |
| Installment = cumulative - previous | PASS | Line 55: `installmentAmount = requiredCumulative - cumulativePaid` |

### Issues Found:

**ISSUE A1 (BUG) -- Loss months treated as zero, overstating annual profit**
File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/index.ts`, line 252:
```typescript
projectedProfitBeforeTax: rawIntegrationResults.map((month) => Math.max(0, month.pl.netIncome)),
```
Each month's loss is floored to zero BEFORE summing for the annual total. A company with Rs.10L profit in 6 months and Rs.5L loss in 6 months should have Rs.5L annual profit, but the engine calculates Rs.10L (all loss months zeroed out). This overstates advance tax by 2x in this example.

The fix should compute `annualProjectedProfitBeforeTax` first from the full monthly values, then apply `Math.max(0, annualTotal)` once.

**ISSUE A2 -- No minimum threshold for advance tax**
Under Indian tax law, advance tax is only payable if the total tax liability exceeds Rs.10,000. The engine doesn't check this. For companies with small profits, advance tax installments would be generated unnecessarily.

**ISSUE A3 -- Advance tax is recorded as an asset, never reversed**
The `advanceTaxPaid` accumulates as a balance sheet asset. In reality, advance tax should be offset against the final tax liability when the return is filed. Within a 12-month forecast, there's no mechanism to reverse this. This is acceptable for MVP but means the BS overstates assets.

---

## 4. PF/ESI ENGINE

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/pf-esi.ts`
**Test:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/pf-esi.test.ts`

### Completeness: COMPLETE

### Correct Implementation of Indian Rules:
| Rule | Status | Detail |
|---|---|---|
| 15th of following month | PASS | `getFollowingMonthDueDate(period, 15)` at line 80 |
| Employer PF = 12% of basic | PASS | Line 48: `multiplyByPct(basicSalary, 12)` |
| Employer ESI = 3.25% | PASS | Line 50 |
| Employee ESI = 0.75% | PASS | Line 51 |
| ESI threshold Rs.21,000 | PASS | Line 49: `grossSalary <= esiThreshold` |
| Basic = 50% of gross (default) | PASS | Line 39 |

### Issues Found:

**ISSUE P1 (CRITICAL) -- ESI threshold checked on AGGREGATE salary, not per-employee**
Line 49: `const esiEligible = grossSalary <= esiThreshold;`

`grossSalary` is the total monthly salary for ALL employees. For a company with 10 employees each earning Rs.15,000/month (all ESI-eligible), the aggregate is Rs.1,50,000, which exceeds the Rs.21,000 threshold, and the engine incorrectly sets `esiEligible = false`. This means **ESI is never calculated for any company with more than 1-2 employees**, which is the opposite of reality.

The test passes only because it uses very small salary amounts (Rs.20,000 total, which is below Rs.21,000).

**ISSUE P2 -- No PF wage ceiling (Rs.15,000/month basic)**
Employer PF is calculated as 12% of the full basic salary, with no cap at Rs.15,000/month. Under EPF rules, the statutory minimum employer contribution is 12% of basic up to Rs.15,000/month (i.e., max Rs.1,800/month). For employees with higher basic, the employer CAN contribute more, but the statutory minimum is capped. The engine overstates PF for high-salary employees.

**ISSUE P3 -- Same `apReclassification` accumulation issue as TDS**
Line 59: `adjustments[index].apReclassification += employeeESI`. Same cumulative-growth concern as TDS Issue T2.

---

## 5. THREE-WAY INTEGRATOR

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/three-way/builder.ts`
**Test:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/three-way/builder.test.ts`

### Completeness: FUNCTIONAL but has design gaps

### Issues Found:

**ISSUE TW1 (DESIGN GAP) -- Cash is computed from cash flow, NOT as the accounting plug**
GEMINI.md Rule 2 states: "Cash is ALWAYS the 'plug' in Balance Sheet calculation -- calculated LAST after all other BS items."

The current implementation (line 90):
```typescript
currentBalances.cash += netCashFlow;
```
This computes cash from cash flows. While mathematically equivalent to `Cash = L + E - NonCashAssets` when there are no rounding errors, it does NOT enforce the balance. If any intermediate rounding error occurs, `totalAssets != totalLiabilities + totalEquity` and there's no plug to absorb it.

The GEMINI.md-compliant approach would be:
```typescript
currentBalances.cash = currentBalances.ap + currentBalances.debt
    + currentBalances.equity + currentBalances.retainedEarnings
    - currentBalances.ar - netFixedAssets;
```
Then verify `|cash - (previousCash + netCashFlow)| <= 1` as a sanity check.

**ISSUE TW2 (DESIGN GAP) -- No indirect method cash flow statement**
GEMINI.md states: "Projected Cash Flow Statement - Indirect Method". The current implementation uses the **direct method**:
```typescript
const operatingCashFlow = input.cashIn - input.cogsPaid - input.expensePaid;
```

The indirect method should derive operating CF as:
1. Net Income
2. + Depreciation (non-cash add-back)
3. - Increase in AR (or + decrease)
4. + Increase in AP (or - decrease)
5. = Operating Cash Flow

The current output only has `operatingCashFlow` as a single number with no reconciliation schedule. When compliance adjustments add employer PF/ESI expense (non-cash in accrual month) and then subtract cash in the payment month, the indirect method is essential to bridge the gap.

**ISSUE TW3 -- `cashOut` only includes operating cash outflows**
Line 107: `cashOut: input.cogsPaid + input.expensePaid`. This excludes investing outflows (asset purchases) and financing outflows (debt repayment). So `cashIn - cashOut != netCashFlow`, which is misleading for any consumer that expects `cashIn - cashOut = netCashFlow`.

**ISSUE TW4 -- Confusing double-fallback in investing cash flow**
Line 77: `const investingCashFlow = -(input.assetPurchases || 0) || 0;`
The trailing `|| 0` is redundant because `-(anything || 0)` is never `NaN` or `undefined`. It also obscures the intent: is the author guarding against `assetPurchases = NaN`? If so, `Math.round` or explicit validation would be clearer.

**ISSUE TW5 -- No `depreciation` reflected in cash flow but affects P&L and BS**
Depreciation reduces net income and accumulated depreciation reduces net fixed assets, but the indirect method reconciliation (depreciation add-back) is missing. This means the direct-method operating CF is correct in absolute terms, but the presentation violates the GEMINI.md requirement for the indirect method.

**What works correctly:**
- Balance sheet equation holds (tested with `|totalAssets - (totalLiabilities + totalEquity)| <= 1`)
- Cash flow equation holds (tested with `|cash - (openingCash + netCF)| <= 1`)
- Negative cash (overdraft) is allowed -- tested at builder.test.ts line 77
- AR and AP accumulate correctly from timing differences

---

## 6. COMPLIANCE APPLY LAYER

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/apply.ts`

### Issues Found:

**ISSUE AP1 -- Cash is NOT the plug in the compliance-adjusted BS**
After compliance adjustments, `adjustedCash = month.bs.cash + runningBalances.cumulativeCashDelta` (line 59). Then `adjustedTotalAssets` and `adjustedTotalLiabilities + adjustedTotalEquity` are computed independently. There is no plug to absorb rounding drift. If any rounding error accumulates, the balance sheet will break.

A safer approach: compute `adjustedTotalLiabilities` and `adjustedTotalEquity` first, then compute `adjustedCash = adjustedTotalLiabilities + adjustedTotalEquity - (AR + netFixedAssets + gstReceivable + advanceTaxPaid)`, then verify against the cash-flow-derived value.

**ISSUE AP2 -- PF/ESI employer expense reduces operating CF through retained earnings but doesn't add back**
When employer PF/ESI is accrued, `adjustedNetIncome` decreases (line 58) and `adjustedRetainedEarnings` decreases (line 61-62). But `operatingCashFlow` is only adjusted by `netCashDelta` (line 93), which doesn't include the non-cash employer expense in the accrual month. So in the accrual month, operating CF is unchanged (correct for direct method), but net income drops. The indirect method would add back the non-cash expense, but this reconciliation is missing.

**ISSUE AP3 -- `operatingCashDelta` is shared between GST and the general model**
The GST engine sets `operatingCashDelta = outputGST - inputGST` (gst.ts line 62). This is the net GST cash collected from customers minus paid to suppliers. But this treats GST cash as operating cash flow, which is correct for the direct method. However, under the indirect method, GST collected should be part of "changes in working capital" (GST payable/receivable changes), not a separate operating cash adjustment.

---

## 7. SCENARIO ENGINE

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/scenarios/engine.ts`
**Test:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/scenarios/engine.test.ts`

### Completeness: COMPLETE

### Correct Implementation:
- Baseline adjustments: percentage multiplier applied post-value-rule (line 78-84 in index.ts). PASS.
- Timing profile overrides: deep-cloned and replaced (lines 34-47). PASS.
- Micro-forecast toggles: items can be enabled/disabled per scenario (lines 49-65). PASS.
- Three-way balance verified in all three test cases. PASS.

### Issues Found:

**ISSUE S1 -- Default timing profiles always come from demo data**
Line 77: `timingProfiles: applyTimingOverrides(timingProfiles ?? demoTimingProfiles, scenario)`. If no timing profiles are provided, demo profiles are used. This is fine for demo mode but would silently use wrong profiles for a real company if the caller forgets to pass them.

**ISSUE S2 -- No validation that scenario results differ from baseline**
When a scenario has no active adjustments (empty baseline adjustments, no timing overrides, all micro-forecasts active), the result is identical to baseline. The engine doesn't warn about this. Minor issue.

**ISSUE S3 -- Deep clone uses `JSON.parse(JSON.stringify(...))`**
Lines 19 and 41 use `JSON.parse(JSON.stringify(...))` for deep cloning. This loses `undefined` values, `Date` objects, and any non-JSON-serializable data. For the current data structures (plain objects with numbers and strings), this works, but it's fragile.

---

## 8. MICRO-FORECAST OVERLAY ENGINE

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/micro-forecasts/overlay.ts`
**Test:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/micro-forecasts/overlay.test.ts`

### Completeness: COMPLETE

### Correct Cascade: P&L -> BS -> CF
The overlay modifies `MonthlyInput`, which is fed into `runThreeWayIntegration`. The three-way integrator then cascades: P&L values drive net income, net income drives retained earnings, cash flows drive cash, AR/AP changes drive balance sheet. PASS.

### Issues Found:

**ISSUE M1 (CRITICAL BUG) -- New Hire wizard uses floating-point multiplication, violating paise integer rule**
File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/micro-forecasts/wizards/new-hire.ts`, lines 32-33:
```typescript
cashImpacts[i] += inputs.monthlyCTC * inputs.netSalaryPct;   // FLOAT!
cashImpacts[i + 1] += inputs.monthlyCTC * inputs.statutoryPct; // FLOAT!
```
`monthlyCTC` is an integer (paise), but `netSalaryPct` (e.g., 0.8) and `statutoryPct` (e.g., 0.2) are floats. The product can produce a non-integer, violating the GEMINI.md Rule 1: "ALL monetary values in the database, API, and engine MUST be stored and processed as INTEGER PAISE."

Example: `12345678 * 0.8 = 9876542.4` -- not an integer!

Fix: Use `Math.round(inputs.monthlyCTC * inputs.netSalaryPct)` or use `multiplyByPct` with integer percentages.

**ISSUE M2 -- Revenue wizard assumes 100% immediate cash collection**
File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/micro-forecasts/wizards/revenue.ts`, lines 28-29:
```typescript
cashImpacts[i] = inputs.monthlyAmount; // 100% immediate collection
```
The comment says "For MVP, assuming 100% immediate cash collection." But the revenue account likely has a timing profile (e.g., 70/30 same-month/next-month). The micro-forecast bypasses the timing profile, creating a disconnect: the baseline revenue follows the timing profile, but the incremental micro-forecast revenue is collected immediately. This overstating cash inflow in the recognition month.

**ISSUE M3 -- Asset wizard depreciation starts in the purchase month**
File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/micro-forecasts/wizards/asset.ts`, line 31:
```typescript
if (active && remainingLife > 0) {
    plImpacts[i] = monthlyDepreciation;
```
Both `cashImpacts[i] = purchaseAmount` (capex) and `plImpacts[i] = monthlyDepreciation` are set in the same month. Depreciation typically starts the month AFTER purchase. The test (asset.test.ts line 34) expects `plImpacts[4]` to equal `1 * LAKH`, confirming this behavior. This is a simplification that slightly understates first-month net income.

**ISSUE M4 -- Loan wizard interest is classified as operating expense via `expensePaid`**
File: `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/micro-forecasts/wizards/loan.ts`, lines 38-39, and overlay.ts lines 45-46:
```typescript
combined[m].expense += plImpact;       // Interest as operating expense
combined[m].expensePaid += plImpact;   // Interest paid immediately
```
Under Ind AS 7, interest paid should be classified as a **financing activity**, not operating. The current code puts it in operating CF (via `expensePaid` subtraction from `operatingCashFlow`). This misclassifies cash flows.

**ISSUE M5 -- Loan wizard has no final principal adjustment**
If `principalAmount` is not evenly divisible by `termMonths`, the last month's principal repayment will be slightly off because `monthlyPrincipal = Math.round(inputs.principalAmount / inputs.termMonths)`. After `termMonths` payments, `remainingPrincipal` may not reach exactly zero. There's no catch-up in the final month.

---

## 9. MATH UTILITIES

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/utils/math.ts`

### Issues Found:

**ISSUE MU1 -- `calculatePct` returns float**
Line 21: `return (partPaise / totalPaise) * 100`. This returns a floating-point number, not an integer. While this function is likely used for display (percentage labels), it's in the same module as paise arithmetic functions, which could lead to accidental misuse in engine code. No guard prevents it from being used where an integer is expected.

**ISSUE MU2 -- `rollingAverage` divides then rounds**
Line 34: `Math.round(sum / window.length)`. This is correct for producing an integer, but the intermediate `sum / window.length` is a float. For very large sums (billions of paise), this could lose precision. Using BigInt division would be safer, as done in the TDS `allocateProRata` function.

---

## 10. TIMING PROFILE CALCULATOR

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/timing-profiles/calculator.ts`

### Issues Found:

**ISSUE TP1 -- Opening balance calculation uses floating-point multiplication**
Lines 38-43:
```typescript
let uncollectedFraction = badDebt;
for (let j = monthsAgo + 1; j < profileArray.length; j++) {
    uncollectedFraction += profileArray[j];
}
openingBalance += historicalValues[i] * uncollectedFraction;
```
`historicalValues[i]` is an integer (paise), but `uncollectedFraction` is a float (e.g., 0.3). The product `historicalValues[i] * uncollectedFraction` is a float. The final `Math.round(openingBalance)` at line 47 helps, but intermediate accumulation of floating-point products across 12 historical months could drift.

A more precise approach would multiply first, then divide (integer arithmetic): `Math.round(historicalValues[i] * numerator / denominator)` where the profile fractions are expressed as integers.

**ISSUE TP2 -- Cash collection in the forecast loop also uses floating-point**
Line 68: `cashCollected += allValues[targetMonthIndex] * profileArray[p]`. Same float multiplication issue. The `Math.round(cashCollected)` at line 72 helps, but the same drift concern applies.

---

## 11. COMPLIANCE PERIOD UTILITIES

**File:** `/Users/sarhanak/Documents/CashFlowIQ/src/lib/engine/compliance/periods.ts`

No issues found. The functions correctly:
- Parse `YYYY-MM-01` period strings
- Compute following-month dates
- Format dates with specific day numbers

---

## 12. PASE INTEGER COMPLIANCE SUMMARY

| Component | Paise Throughout? | Violations |
|---|---|---|
| GST engine | YES | None |
| TDS engine | YES | None (uses BigInt for pro-rata) |
| Advance Tax engine | YES | None |
| PF/ESI engine | YES | None |
| Three-way builder | YES | None |
| Scenario engine | YES | None |
| **New Hire wizard** | **NO** | **`monthlyCTC * netSalaryPct` = FLOAT** (ISSUE M1) |
| Revenue wizard | YES | None |
| Asset wizard | YES | None |
| Loan wizard | YES | None (interest uses `Math.round`) |
| Timing profile calculator | **PARTIAL** | Float multiplication with `Math.round` at boundaries (ISSUE TP1, TP2) |
| Indian format utils | YES | Division by 100 ONLY in display layer (correct per Rule 1) |

---

## 13. BALANCE SHEET VERIFICATION (A = L + E) SUMMARY

| Component | Verified? | Mechanism |
|---|---|---|
| Three-way builder | YES | `|totalAssets - (totalLiabilities + totalEquity)| <= 1` in test |
| Compliance apply | YES | `assertThreeWayBalances` in all compliance tests |
| Scenario engine | YES | `assertBalanced` helper in scenario test |
| Micro-forecast overlay | YES | `diff <= 1` in overlay test and wizard tests |
| **Cash as plug** | **NO** | Cash is computed from CF, not from L+E-NonCashAssets (ISSUE TW1, AP1) |

---

## 14. CRITICAL ISSUES SUMMARY (Must Fix)

| # | Issue | Severity | File | Line |
|---|---|---|---|---|
| M1 | New Hire wizard produces non-integer paise via float multiplication | **CRITICAL** | `wizards/new-hire.ts` | 32-33 |
| T1 | TDS calculated on aggregate salary, not per-employee | **CRITICAL** | `tds.ts` | 111-152 |
| P1 | ESI threshold checked on aggregate salary, not per-employee | **CRITICAL** | `pf-esi.ts` | 49 |
| A1 | Loss months zeroed out before annual profit sum, overstating advance tax | **BUG** | `index.ts` | 252 |
| TW2 | No indirect method cash flow statement (required by GEMINI.md) | **DESIGN GAP** | `builder.ts` | 76 |
| TW1 | Cash is not the plug per GEMINI.md Rule 2 | **DESIGN GAP** | `builder.ts` | 90 |

---

## 15. IMPORTANT ISSUES (Should Fix)

| # | Issue | File | Line |
|---|---|---|---|
| G2 | `supplyType` hardcoded to 'intra-state' | `compliance/index.ts` | 243 |
| G3 | GST cash timing doesn't follow revenue timing profile | `compliance/gst.ts` | 62 |
| G4 | `taxablePurchases` mapped to COGS only | `compliance/index.ts` | 239 |
| T2 | `apReclassification` accumulates without reversal; requires base model to pre-account for TDS | `compliance/tds.ts` | 126 |
| P2 | No PF wage ceiling (Rs.15,000/month basic) | `pf-esi.ts` | 48 |
| M2 | Revenue micro-forecast bypasses timing profile (100% immediate collection) | `wizards/revenue.ts` | 29 |
| M4 | Loan interest classified as operating CF instead of financing CF | `overlay.ts` | 45-46 |
| AP1 | Compliance apply layer doesn't use cash as plug | `compliance/apply.ts` | 59 |
| TP1/TP2 | Timing profile calculator uses float multiplication with paise | `calculator.ts` | 38-43, 68 |

---

## 16. MINOR ISSUES (Nice to Fix)

| # | Issue | File | Line |
|---|---|---|---|
| G1 | CGST/SGST split uses `Math.floor` for CGST, extra paise to SGST | `gst.ts` | 76 |
| A2 | No minimum threshold (Rs.10,000) for advance tax | `advance-tax.ts` | -- |
| A3 | Advance tax asset never reversed | `advance-tax.ts` | 58-59 |
| S1 | Default timing profiles always from demo data | `scenarios/engine.ts` | 77 |
| S3 | Deep clone uses JSON.parse/stringify | `scenarios/engine.ts` | 19, 41 |
| M3 | Asset depreciation starts in purchase month | `wizards/asset.ts` | 31 |
| M5 | Loan wizard no final principal adjustment | `wizards/loan.ts` | 19 |
| TW3 | `cashOut` only includes operating outflows | `builder.ts` | 107 |
| TW4 | Redundant `|| 0` in investing cash flow | `builder.ts` | 77 |
| MU1 | `calculatePct` returns float | `math.ts` | 21 |