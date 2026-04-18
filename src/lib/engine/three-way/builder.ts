/**
 * Three-Way Financial Integration Engine — Schedule III / AS 3 compliant
 *
 * Phase 2: Full Schedule III (Division I) P&L, Balance Sheet, and AS 3
 * Cash Flow Statement.
 *
 * Key design decisions:
 * 1. Two-step tax computation: PBT first → compliance engine → PAT
 *    (avoids circularity: compliance needs PBT, engine needs tax)
 * 2. All existing fields preserved for backward compat with compliance engine
 * 3. Cash is the BS plug: Assets = Liabilities + Equity (enforced every month)
 * 4. Working capital items use TARGET BALANCES as inputs; engine computes deltas
 *    for AS 3 CF statement (users think in balances, not flows)
 * 5. All amounts in PAISE (integer arithmetic, no float drift)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4: Balance Validation Warnings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A balance validation warning — surfaces in the UI as a non-blocking alert.
 * Never throws; the engine always returns results even with warnings.
 */
export interface BalanceWarning {
  /** Month index (0-based) */
  monthIndex: number
  /** Month label e.g. 'Apr-25' (if available) */
  monthLabel?: string
  /** Which check failed */
  check: 'bs_balance' | 'cf_cash' | 're_check'
  /** Human-readable description */
  message: string
  /** Magnitude of the discrepancy in paise */
  discrepancyPaise: number
}

/** Tolerance: 1 paise — integer arithmetic should be exact, but allow for rounding */
const BALANCE_TOLERANCE_PAISE = 1

// ─────────────────────────────────────────────────────────────────────────────
// Opening Balances
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opening balances for Month 0 of the forecast.
 *
 * CRITICAL: Every BS item that is NOT cash, equity, or debt must have an
 * opening balance. If it starts at zero but the user has a non-zero historical
 * balance, Month 1 will show a false CF swing.
 *
 * Phase 1 added the new optional fields. Phase 2 consumes them.
 */
export interface OpeningBalances {
  // ── Core (required) ──────────────────────────────────────────────────────
  cash: number
  ar: number                  // trade receivables
  ap: number                  // trade payables
  equity: number              // share capital (face value)
  retainedEarnings: number

  // ── Non-current assets ───────────────────────────────────────────────────
  fixedAssets?: number        // PPE gross block
  accDepreciation?: number    // accumulated depreciation on PPE
  intangibles?: number        // intangible assets gross block
  accAmortisation?: number    // accumulated amortisation on intangibles

  // ── Current assets ───────────────────────────────────────────────────────
  inventories?: number        // raw materials, WIP, FG, stock-in-trade
  stLoansAdvances?: number    // prepaid, security deposits, GST ITC, advance tax
  otherCurrentAssets?: number

  // ── Liabilities ──────────────────────────────────────────────────────────
  debt?: number               // total debt (split into lt/st below if provided)
  ltBorrowings?: number       // long-term borrowings (maturity > 12 months)
  stBorrowings?: number       // short-term borrowings (OD, CC, working capital)
  otherCurrentLiabilities?: number
  stProvisions?: number

  // ── Equity ───────────────────────────────────────────────────────────────
  securitiesPremium?: number
  generalReserve?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Input
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monthly inputs to the three-way engine.
 *
 * Working capital items (inventories, stLoansAdvances, etc.) use TARGET
 * BALANCES — the engine computes the delta for the CF statement.
 * This matches how CAs think: "GST receivable stays at ₹12L" not "GST
 * receivable changes by ₹0 this month."
 *
 * P&L sub-classifications (Schedule III mandatory lines):
 * - revenueFromOps: Revenue from Operations (products + services + other ops)
 * - otherIncome: Other Income (interest received, dividend, misc)
 * - employeeBenefits: Employee Benefits Expense (mandatory separate line)
 * - financeCosts: Finance Costs (interest on borrowings — mandatory separate)
 * - depreciation: Depreciation on PPE
 * - amortisation: Amortisation of intangibles
 * - otherExpenses: Other Expenses (rent, utilities, repairs, insurance, etc.)
 * - exceptionalItems: Exceptional Items (one-off, material)
 */
export interface MonthlyInput {
  // ── P&L Revenue ──────────────────────────────────────────────────────────
  revenue: number             // total revenue (revenueFromOps + otherIncome)
  cashIn: number              // cash collected from customers
  revenueFromOps?: number     // Schedule III Line I (defaults to revenue)
  otherIncome?: number        // Schedule III Line II

  // ── P&L Expenses ─────────────────────────────────────────────────────────
  cogs: number                // total COGS (materials + stock-in-trade)
  cogsPaid: number            // cash paid for COGS
  expense: number             // total OpEx (excl. finance costs & depreciation)
  expensePaid: number         // cash paid for OpEx
  employeeBenefits?: number   // Schedule III Line IV(d) — subset of expense
  financeCosts?: number       // Schedule III Line IV(e) — interest accrued
  financeCostsPaid?: number   // actual interest paid (for CF financing section)
  depreciation?: number       // PPE depreciation
  amortisation?: number       // intangible amortisation
  otherExpenses?: number      // residual expenses (subset of expense)
  exceptionalItems?: number   // Schedule III Line VII

  // ── Capital & Debt ───────────────────────────────────────────────────────
  assetPurchases?: number     // PPE capex
  intangiblePurchases?: number // intangible capex
  proceedsFromAssetSale?: number
  newDebt?: number            // new borrowings raised
  debtRepayment?: number      // borrowings repaid
  dividendsPaid?: number      // dividends declared and paid
  newShareCapital?: number    // fresh equity raised (face value)
  newSecuritiesPremium?: number // premium on fresh equity

  // ── Working Capital TARGET BALANCES (engine computes deltas) ─────────────
  // If not provided, engine assumes balance unchanged from prior month.
  inventoriesBalance?: number
  stLoansAdvancesBalance?: number
  otherCurrentAssetsBalance?: number
  otherCurrentLiabilitiesBalance?: number
  stProvisionsBalance?: number

  // ── Tax (injected by compliance engine in two-step sequence) ─────────────
  taxExpense?: number         // current + deferred tax (from compliance engine)
  incomeTaxPaid?: number      // actual tax paid (advance tax + self-assessment)
}

// ─────────────────────────────────────────────────────────────────────────────
// ThreeWayMonth — output per month
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete Schedule III / AS 3 output for one forecast month.
 *
 * All existing fields are preserved for backward compatibility with the
 * compliance engine (ComplianceAdjustedMonth extends ThreeWayMonth).
 *
 * New fields are additive — no existing consumer breaks.
 */
export interface ThreeWayMonth {
  // ── Statement of Profit & Loss (Schedule III Part II) ────────────────────
  pl: {
    // ── Existing fields (backward compat) ──────────────────────────────────
    revenue: number             // total revenue (= revenueFromOps + otherIncome)
    cogs: number                // total COGS
    grossProfit: number         // revenue - cogs (management metric, not Sch III line)
    expense: number             // total OpEx (excl. finance costs & depreciation)
    depreciation: number        // PPE depreciation
    netIncome: number           // alias for profitAfterTax (backward compat)

    // ── Schedule III additions ──────────────────────────────────────────────
    /** Line I: Revenue from Operations */
    revenueFromOps: number
    /** Line II: Other Income */
    otherIncome: number
    /** Line III: Total Revenue (I + II) */
    totalRevenue: number
    /** Line IV(d): Employee Benefits Expense — mandatory separate line */
    employeeBenefits: number
    /** Line IV(e): Finance Costs — mandatory separate line */
    financeCosts: number
    /** Line IV(f): Amortisation of Intangibles */
    amortisation: number
    /** Line IV(g): Other Expenses */
    otherExpenses: number
    /** Line IV: Total Expenses */
    totalExpenses: number
    /** Line V: Profit Before Exceptional Items & Tax */
    profitBeforeExceptional: number
    /** Line VI: Exceptional Items */
    exceptionalItems: number
    /** Line VII: Profit Before Tax */
    profitBeforeTax: number
    /** Line VIII: Tax Expense (current + deferred) */
    taxExpense: number
    /** Line IX: Profit After Tax */
    profitAfterTax: number
  }

  // ── Cash Flow Statement (AS 3 — Indirect Method) ─────────────────────────
  cf: {
    // ── Existing fields (backward compat) ──────────────────────────────────
    cashIn: number
    cashOut: number
    operatingCashFlow: number   // = netOperatingCF
    investingCashFlow: number   // = netInvestingCF
    financingCashFlow: number   // = netFinancingCF
    netCashFlow: number
    indirect: {
      netIncome: number         // = profitBeforeTax (AS 3 starts from PBT)
      depreciation: number
      changeInAR: number
      changeInAP: number
    }

    // ── AS 3 additions ──────────────────────────────────────────────────────
    /** A. Operating Activities */
    operatingIndirect: {
      profitBeforeTax: number
      addDepreciation: number
      addAmortisation: number
      addFinanceCosts: number           // add back accrued finance costs
      lessOtherIncome: number           // deduct other income (received separately)
      changeInInventories: number       // negative = buildup (cash out)
      changeInTradeReceivables: number
      changeInSTLoansAdvances: number   // prepaid, GST ITC, security deposits
      changeInOtherCurrentAssets: number
      changeInTradePayables: number
      changeInOtherCurrentLiabilities: number
      changeInSTProvisions: number
      cashFromOperations: number        // sum of above
      lessIncomeTaxPaid: number         // actual tax paid
    }
    netOperatingCF: number

    /** B. Investing Activities */
    purchaseOfPPE: number
    purchaseOfIntangibles: number
    proceedsFromAssetSale: number
    netInvestingCF: number

    /** C. Financing Activities */
    proceedsFromBorrowings: number
    repaymentOfBorrowings: number
    financeCostsPaid: number
    dividendsPaid: number
    proceedsFromShareIssue: number
    netFinancingCF: number

    openingCash: number
    closingCash: number               // must equal bs.cash
  }

  // ── Balance Sheet (Schedule III Part I — Equity & Liabilities first) ─────
  bs: {
    // ── Existing fields (backward compat) ──────────────────────────────────
    cash: number
    ar: number                        // = tradeReceivables
    fixedAssets: number               // = ppe gross
    accDepreciation: number           // = accDepreciationPPE
    totalAssets: number
    ap: number                        // = tradePayables
    debt: number                      // = ltBorrowings + stBorrowings
    totalLiabilities: number
    equity: number                    // = shareCapital
    retainedEarnings: number
    totalEquity: number

    // ── Schedule III additions ──────────────────────────────────────────────
    /** Equity & Liabilities */
    shareCapital: number
    securitiesPremium: number
    generalReserve: number
    totalShareholdersEquity: number   // shareCapital + securitiesPremium + generalReserve + retainedEarnings

    ltBorrowings: number
    stBorrowings: number
    otherCurrentLiabilities: number
    stProvisions: number
    totalNonCurrentLiabilities: number
    totalCurrentLiabilities: number

    /** Assets */
    netPPE: number                    // ppe - accDepreciationPPE
    intangibles: number               // gross intangibles
    accAmortisation: number
    netIntangibles: number            // intangibles - accAmortisation
    totalNonCurrentAssets: number

    inventories: number
    tradeReceivables: number          // = ar
    stLoansAdvances: number
    otherCurrentAssets: number
    totalCurrentAssets: number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the three-way integration for all forecast months.
 *
 * Two-step tax sequence (avoids circularity):
 *   Step A: Compute P&L down to PBT (taxExpense = 0 initially)
 *   Step B: Caller (compliance engine) injects taxExpense via input.taxExpense
 *           on a second pass, then PAT and BS close correctly.
 *
 * In practice, the compliance engine runs AFTER this function and overlays
 * tax via ComplianceAdjustedMonth. The taxExpense field in MonthlyInput
 * allows a future two-pass architecture without breaking the current one.
 *
 * Returns both the monthly results AND any balance warnings (Phase 4).
 * Warnings are non-blocking — results are always returned.
 */
export function runThreeWayIntegration(
  opening: OpeningBalances,
  inputs: MonthlyInput[],
  monthLabels?: string[]
): ThreeWayMonth[] {
  const { results } = runThreeWayIntegrationWithWarnings(opening, inputs, monthLabels)
  return results
}

/**
 * Same as runThreeWayIntegration but also returns balance warnings.
 * Use this when you need to surface validation issues in the UI.
 */
export function runThreeWayIntegrationWithWarnings(
  opening: OpeningBalances,
  inputs: MonthlyInput[],
  monthLabels?: string[]
): { results: ThreeWayMonth[]; warnings: BalanceWarning[] } {
  const result: ThreeWayMonth[] = []
  const warnings: BalanceWarning[] = []

  // ── Mutable running balances ──────────────────────────────────────────────
  const bal = {
    cash:                    opening.cash ?? 0, // will be overwritten by plug each month
    ar:                      opening.ar ?? 0,
    ap:                      opening.ap ?? 0,
    equity:                  opening.equity ?? 0,
    retainedEarnings:        opening.retainedEarnings ?? 0,
    fixedAssets:             opening.fixedAssets ?? 0,
    accDepreciation:         opening.accDepreciation ?? 0,
    intangibles:             opening.intangibles ?? 0,
    accAmortisation:         opening.accAmortisation ?? 0,
    inventories:             opening.inventories ?? 0,
    stLoansAdvances:         opening.stLoansAdvances ?? 0,
    otherCurrentAssets:      opening.otherCurrentAssets ?? 0,
    // Debt: prefer explicit lt/st split; fall back to legacy debt field
    ltBorrowings:            opening.ltBorrowings ?? (opening.debt ?? 0),
    stBorrowings:            opening.stBorrowings ?? 0,
    otherCurrentLiabilities: opening.otherCurrentLiabilities ?? 0,
    stProvisions:            opening.stProvisions ?? 0,
    securitiesPremium:       opening.securitiesPremium ?? 0,
    generalReserve:          opening.generalReserve ?? 0,
  }

  // Opening cash for first month CF statement.
  // Use the BS plug formula to derive the true opening cash from all other
  // opening balances — this ensures CF and BS stay reconciled from Month 1.
  // If we used opening.cash directly, any inconsistency in the opening
  // balance set would cause a permanent CF/BS divergence.
  const openingNetPPE         = (opening.fixedAssets ?? 0) - (opening.accDepreciation ?? 0)
  const openingNetIntangibles = (opening.intangibles ?? 0) - (opening.accAmortisation ?? 0)
  const openingTotalDebt      = (opening.ltBorrowings ?? opening.debt ?? 0) + (opening.stBorrowings ?? 0)
  const openingTotalEquity    =
    (opening.equity ?? 0)
    + (opening.securitiesPremium ?? 0)
    + (opening.generalReserve ?? 0)
    + (opening.retainedEarnings ?? 0)
  const openingTotalLiabilities =
    openingTotalDebt
    + (opening.ap ?? 0)
    + (opening.otherCurrentLiabilities ?? 0)
    + (opening.stProvisions ?? 0)
  const openingPlugCash =
    openingTotalEquity
    + openingTotalLiabilities
    - (opening.ar ?? 0)
    - openingNetPPE
    - openingNetIntangibles
    - (opening.inventories ?? 0)
    - (opening.stLoansAdvances ?? 0)
    - (opening.otherCurrentAssets ?? 0)

  // prevCash tracks the plug cash of the prior month for the CF opening balance
  let prevCash = openingPlugCash

  for (const input of inputs) {
    // ── Snapshot prior-month working capital balances ─────────────────────
    const prevAR          = bal.ar
    const prevAP          = bal.ap
    const prevInventories = bal.inventories
    const prevSTLoans     = bal.stLoansAdvances
    const prevOtherCA     = bal.otherCurrentAssets
    const prevOtherCL     = bal.otherCurrentLiabilities
    const prevSTProvisions = bal.stProvisions

    // ── Step A: P&L down to PBT ───────────────────────────────────────────

    // Revenue split
    const revenueFromOps = input.revenueFromOps ?? input.revenue
    const otherIncome    = input.otherIncome ?? (input.revenue - revenueFromOps)
    const totalRevenue   = revenueFromOps + otherIncome

    // COGS
    const cogs      = input.cogs
    const grossProfit = revenueFromOps - cogs   // management metric

    // Expense sub-classifications
    const depreciation      = input.depreciation ?? 0
    const amortisation      = input.amortisation ?? 0
    const financeCosts      = input.financeCosts ?? 0
    const employeeBenefits  = input.employeeBenefits ?? 0
    const exceptionalItems  = input.exceptionalItems ?? 0
    // otherExpenses = total expense minus the named sub-lines
    // (employee benefits and finance costs are already inside input.expense)
    const otherExpenses = input.otherExpenses ??
      Math.max(0, input.expense - employeeBenefits - financeCosts)

    const totalExpenses = cogs + input.expense + depreciation + amortisation + exceptionalItems
    const profitBeforeExceptional = totalRevenue - (cogs + input.expense + depreciation + amortisation)
    const profitBeforeTax = profitBeforeExceptional - exceptionalItems

    // Step B: Tax (injected by compliance engine; zero on first pass)
    const taxExpense     = input.taxExpense ?? 0
    const profitAfterTax = profitBeforeTax - taxExpense

    // netIncome = profitAfterTax (backward compat alias)
    const netIncome = profitAfterTax

    // ── CF: Capital & Debt flows ──────────────────────────────────────────
    const assetPurchases       = input.assetPurchases ?? 0
    const intangiblePurchases  = input.intangiblePurchases ?? 0
    const proceedsFromSale     = input.proceedsFromAssetSale ?? 0
    const debtInflow           = input.newDebt ?? 0
    const debtOutflow          = input.debtRepayment ?? 0
    const financeCostsPaid     = input.financeCostsPaid ?? financeCosts // default: paid = accrued
    const incomeTaxPaid        = input.incomeTaxPaid ?? 0
    const dividendsPaid        = input.dividendsPaid ?? 0
    const newShareCapital      = input.newShareCapital ?? 0
    const newSecuritiesPremium = input.newSecuritiesPremium ?? 0

    // ── BS: Update running balances ───────────────────────────────────────

    // Retained earnings: Opening + PAT - Dividends
    bal.retainedEarnings += profitAfterTax - dividendsPaid

    // PPE
    bal.fixedAssets    += assetPurchases
    bal.accDepreciation += depreciation

    // Intangibles
    bal.intangibles    += intangiblePurchases
    bal.accAmortisation += amortisation

    // Trade receivables: accrual basis (revenue - cash collected)
    bal.ar += (revenueFromOps - input.cashIn)

    // Trade payables: accrual basis (COGS + expense - cash paid)
    bal.ap += (cogs + input.expense) - (input.cogsPaid + input.expensePaid)

    // Debt
    bal.ltBorrowings += debtInflow - debtOutflow
    // stBorrowings unchanged unless explicitly provided
    if (input.newDebt !== undefined || input.debtRepayment !== undefined) {
      // Simple model: all new debt goes to LT, all repayment from LT
      // Phase 3 can add explicit lt/st split inputs
    }

    // Equity
    bal.equity             += newShareCapital
    bal.securitiesPremium  += newSecuritiesPremium

    // Working capital: use target balances if provided, else unchanged
    bal.inventories             = input.inventoriesBalance             ?? bal.inventories
    bal.stLoansAdvances         = input.stLoansAdvancesBalance         ?? bal.stLoansAdvances
    bal.otherCurrentAssets      = input.otherCurrentAssetsBalance      ?? bal.otherCurrentAssets
    bal.otherCurrentLiabilities = input.otherCurrentLiabilitiesBalance ?? bal.otherCurrentLiabilities
    bal.stProvisions            = input.stProvisionsBalance            ?? bal.stProvisions

    // ── AS 3 CF: Working capital deltas ──────────────────────────────────
    // Assets: increase = cash outflow (negative); decrease = cash inflow (positive)
    const changeInInventories             = prevInventories - bal.inventories
    const changeInTradeReceivables        = prevAR          - bal.ar
    const changeInSTLoansAdvances         = prevSTLoans     - bal.stLoansAdvances
    const changeInOtherCurrentAssets      = prevOtherCA     - bal.otherCurrentAssets
    // Liabilities: increase = cash inflow (positive); decrease = cash outflow (negative)
    const changeInTradePayables           = bal.ap          - prevAP
    const changeInOtherCurrentLiabilities = bal.otherCurrentLiabilities - prevOtherCL
    const changeInSTProvisions            = bal.stProvisions - prevSTProvisions

    const cashFromOperations =
      profitBeforeTax
      + depreciation
      + amortisation
      + financeCosts           // add back accrued finance costs
      - otherIncome            // deduct other income (received in investing)
      + changeInInventories
      + changeInTradeReceivables
      + changeInSTLoansAdvances
      + changeInOtherCurrentAssets
      + changeInTradePayables
      + changeInOtherCurrentLiabilities
      + changeInSTProvisions

    const netOperatingCF  = cashFromOperations - incomeTaxPaid
    const netInvestingCF  = proceedsFromSale - assetPurchases - intangiblePurchases
    const netFinancingCF  = debtInflow - debtOutflow - financeCostsPaid - dividendsPaid + newShareCapital + newSecuritiesPremium

    const netCashFlow = netOperatingCF + netInvestingCF + netFinancingCF

    // ── Cash as the BS PLUG ───────────────────────────────────────────────
    // Cash = Total Equity + Total Liabilities - All Other Assets
    // This enforces Assets = Liabilities + Equity exactly.
    const netPPE         = bal.fixedAssets - bal.accDepreciation
    const netIntangibles = bal.intangibles - bal.accAmortisation
    const totalDebt      = bal.ltBorrowings + bal.stBorrowings
    const totalEquity    = bal.equity + bal.securitiesPremium + bal.generalReserve + bal.retainedEarnings
    const totalLiabilities =
      totalDebt
      + bal.ap
      + bal.otherCurrentLiabilities
      + bal.stProvisions

    const plugCash =
      totalEquity
      + totalLiabilities
      - bal.ar
      - netPPE
      - netIntangibles
      - bal.inventories
      - bal.stLoansAdvances
      - bal.otherCurrentAssets

    bal.cash = plugCash

    // ── Totals ────────────────────────────────────────────────────────────
    const totalNonCurrentAssets = netPPE + netIntangibles
    const totalCurrentAssets    =
      bal.cash
      + bal.ar
      + bal.inventories
      + bal.stLoansAdvances
      + bal.otherCurrentAssets
    const totalAssets = totalNonCurrentAssets + totalCurrentAssets

    const totalNonCurrentLiabilities = bal.ltBorrowings
    const totalCurrentLiabilities    =
      bal.stBorrowings
      + bal.ap
      + bal.otherCurrentLiabilities
      + bal.stProvisions

    // ── Legacy CF fields (backward compat with compliance engine) ─────────
    const operatingCashFlow = netOperatingCF
    const investingCashFlow = netInvestingCF
    const financingCashFlow = netFinancingCF
    const totalCashOut      = input.cogsPaid + input.expensePaid + assetPurchases + intangiblePurchases + debtOutflow + financeCostsPaid + dividendsPaid

    // ── Phase 4: Balance Validation ───────────────────────────────────────
    // These are warnings, not errors. The engine always returns results.
    const monthIdx = result.length
    const label = monthLabels?.[monthIdx]

    // Check 1: BS balance — Total Assets === Total Equity + Total Liabilities
    // (Should always pass since cash is the plug, but validates the plug math)
    const bsDiscrepancy = Math.abs(totalAssets - (totalEquity + totalLiabilities))
    if (bsDiscrepancy > BALANCE_TOLERANCE_PAISE) {
      warnings.push({
        monthIndex: monthIdx,
        monthLabel: label,
        check: 'bs_balance',
        message: `Balance Sheet does not balance: Assets=${totalAssets} ≠ Equity+Liabilities=${totalEquity + totalLiabilities}`,
        discrepancyPaise: bsDiscrepancy,
      })
    }

    // Check 2: CF closing cash === BS cash
    const cfCashDiscrepancy = Math.abs(bal.cash - (prevCash + netCashFlow))
    if (cfCashDiscrepancy > BALANCE_TOLERANCE_PAISE) {
      warnings.push({
        monthIndex: monthIdx,
        monthLabel: label,
        check: 'cf_cash',
        message: `CF closing cash (${prevCash + netCashFlow}) ≠ BS cash (${bal.cash})`,
        discrepancyPaise: cfCashDiscrepancy,
      })
    }

    // Check 3: RE check — Closing RE = Opening RE + PAT - Dividends
    // (opening RE for this month = bal.retainedEarnings before this month's update)
    // We already updated bal.retainedEarnings above, so check against expected
    const expectedRE = (result.length === 0 ? opening.retainedEarnings : result[result.length - 1].bs.retainedEarnings) + profitAfterTax - dividendsPaid
    const reDiscrepancy = Math.abs(bal.retainedEarnings - expectedRE)
    if (reDiscrepancy > BALANCE_TOLERANCE_PAISE) {
      warnings.push({
        monthIndex: monthIdx,
        monthLabel: label,
        check: 're_check',
        message: `Retained Earnings: expected ${expectedRE}, got ${bal.retainedEarnings}`,
        discrepancyPaise: reDiscrepancy,
      })
    }

    result.push({
      pl: {
        // Backward compat
        revenue:    input.revenue,
        cogs,
        grossProfit,
        expense:    input.expense,
        depreciation,
        netIncome,
        // Schedule III
        revenueFromOps,
        otherIncome,
        totalRevenue,
        employeeBenefits,
        financeCosts,
        amortisation,
        otherExpenses,
        totalExpenses,
        profitBeforeExceptional,
        exceptionalItems,
        profitBeforeTax,
        taxExpense,
        profitAfterTax,
      },
      cf: {
        // Backward compat
        cashIn:           input.cashIn + debtInflow,
        cashOut:          totalCashOut,
        operatingCashFlow,
        investingCashFlow,
        financingCashFlow,
        netCashFlow,
        indirect: {
          netIncome:    profitBeforeTax,  // AS 3 starts from PBT, not PAT
          depreciation,
          changeInAR:   changeInTradeReceivables,
          changeInAP:   changeInTradePayables,
        },
        // AS 3
        operatingIndirect: {
          profitBeforeTax,
          addDepreciation:               depreciation,
          addAmortisation:               amortisation,
          addFinanceCosts:               financeCosts,
          lessOtherIncome:               -otherIncome,
          changeInInventories,
          changeInTradeReceivables,
          changeInSTLoansAdvances,
          changeInOtherCurrentAssets,
          changeInTradePayables,
          changeInOtherCurrentLiabilities,
          changeInSTProvisions,
          cashFromOperations,
          lessIncomeTaxPaid:             -incomeTaxPaid,
        },
        netOperatingCF,
        purchaseOfPPE:         -assetPurchases,
        purchaseOfIntangibles: -intangiblePurchases,
        proceedsFromAssetSale: proceedsFromSale,
        netInvestingCF,
        proceedsFromBorrowings: debtInflow,
        repaymentOfBorrowings:  -debtOutflow,
        financeCostsPaid:       -financeCostsPaid,
        dividendsPaid:          -dividendsPaid,
        proceedsFromShareIssue: newShareCapital + newSecuritiesPremium,
        netFinancingCF,
        openingCash: prevCash,
        closingCash: bal.cash,
      },
      bs: {
        // Backward compat
        cash:             bal.cash,
        ar:               bal.ar,
        fixedAssets:      bal.fixedAssets,
        accDepreciation:  bal.accDepreciation,
        totalAssets,
        ap:               bal.ap,
        debt:             totalDebt,
        totalLiabilities,
        equity:           bal.equity,
        retainedEarnings: bal.retainedEarnings,
        totalEquity,
        // Schedule III
        shareCapital:             bal.equity,
        securitiesPremium:        bal.securitiesPremium,
        generalReserve:           bal.generalReserve,
        totalShareholdersEquity:  totalEquity,
        ltBorrowings:             bal.ltBorrowings,
        stBorrowings:             bal.stBorrowings,
        otherCurrentLiabilities:  bal.otherCurrentLiabilities,
        stProvisions:             bal.stProvisions,
        totalNonCurrentLiabilities,
        totalCurrentLiabilities,
        netPPE,
        intangibles:              bal.intangibles,
        accAmortisation:          bal.accAmortisation,
        netIntangibles,
        totalNonCurrentAssets,
        inventories:              bal.inventories,
        tradeReceivables:         bal.ar,
        stLoansAdvances:          bal.stLoansAdvances,
        otherCurrentAssets:       bal.otherCurrentAssets,
        totalCurrentAssets,
      },
    })

    prevCash = bal.cash
  }

  return { results: result, warnings }
}
