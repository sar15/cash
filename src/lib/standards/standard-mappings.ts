/**
 * Schedule III (Division I — AS Companies) & AS 3 Standard Mapping Taxonomy
 *
 * These constants define the canonical standardMapping values used to classify
 * accounts for Schedule III P&L, Balance Sheet, and AS 3 Cash Flow rendering.
 *
 * Design decisions:
 * - Stored as TEXT in the DB (SQLite has no native ENUM)
 * - Validated at the application layer via TypeScript union type
 * - Adding new values requires zero DB migrations
 * - Every value maps to exactly one line item in Schedule III / AS 3
 *
 * Phase 1: Constants + types only. Engine consumption happens in Phase 2.
 */

// ─────────────────────────────────────────────────────────────────────────────
// P&L — Revenue (Schedule III Part II, Line I & II)
// ─────────────────────────────────────────────────────────────────────────────

/** Sale of Products (including excise duty) — Schedule III Line I(a) */
export const SM_REV_OPS_PRODUCTS = 'revenue.operations.products' as const

/** Sale of Services — Schedule III Line I(b) */
export const SM_REV_OPS_SERVICES = 'revenue.operations.services' as const

/** Other Operating Revenue (scrap sales, export incentives, etc.) — Schedule III Line I(c) */
export const SM_REV_OPS_OTHER = 'revenue.operations.other' as const

/** Interest Income — Schedule III Line II(a) */
export const SM_REV_OTHER_INTEREST = 'revenue.other.interest' as const

/** Dividend Income — Schedule III Line II(b) */
export const SM_REV_OTHER_DIVIDEND = 'revenue.other.dividend' as const

/** Other Non-Operating Income (profit on asset sale, misc receipts) — Schedule III Line II(c) */
export const SM_REV_OTHER_MISC = 'revenue.other.misc' as const

// ─────────────────────────────────────────────────────────────────────────────
// P&L — Expenses (Schedule III Part II, Line IV — mandatory line items)
// ─────────────────────────────────────────────────────────────────────────────

/** Cost of Materials Consumed — Schedule III Line IV(a) */
export const SM_EXP_MATERIALS = 'expense.materials_consumed' as const

/** Purchases of Stock-in-Trade — Schedule III Line IV(b) */
export const SM_EXP_STOCK_IN_TRADE = 'expense.stock_in_trade' as const

/**
 * Changes in Inventories of FG / WIP / Stock-in-Trade — Schedule III Line IV(c)
 * Positive = inventory decrease (cash inflow effect); Negative = inventory buildup
 */
export const SM_EXP_INVENTORY_CHANGES = 'expense.inventory_changes' as const

/**
 * Employee Benefits Expense — Schedule III Line IV(d) MANDATORY separate line
 * Includes: salaries, wages, PF contribution, ESI, gratuity, staff welfare
 */
export const SM_EXP_EMPLOYEE_BENEFITS = 'expense.employee_benefits' as const

/**
 * Finance Costs — Schedule III Line IV(e) MANDATORY separate line
 * Includes: interest on borrowings, bank charges, loan processing fees
 * Note: In AS 3 CF, this is added back in Operating and paid in Financing
 */
export const SM_EXP_FINANCE_COSTS = 'expense.finance_costs' as const

/** Depreciation on PPE — Schedule III Line IV(f) */
export const SM_EXP_DEPRECIATION = 'expense.depreciation' as const

/** Amortisation of Intangible Assets — Schedule III Line IV(f) (combined with depreciation) */
export const SM_EXP_AMORTISATION = 'expense.amortisation' as const

/**
 * Other Expenses — Schedule III Line IV(g) catch-all
 * Includes: rent, utilities, repairs, insurance, professional fees, marketing, travel, audit fees
 */
export const SM_EXP_OTHER = 'expense.other' as const

/**
 * Exceptional Items — Schedule III Line VII
 * One-off, material items outside ordinary business (restructuring, impairment, etc.)
 */
export const SM_EXP_EXCEPTIONAL = 'expense.exceptional' as const

// ─────────────────────────────────────────────────────────────────────────────
// Balance Sheet — Non-Current Assets (Schedule III Part I, Assets Section)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property, Plant & Equipment (gross block) — Schedule III Non-Current Assets (a)
 * Engine computes net PPE = gross - accumulated depreciation
 */
export const SM_ASSET_PPE = 'asset.ppe' as const

/**
 * Intangible Assets (gross) — Schedule III Non-Current Assets (e)
 * Includes: software, IP, goodwill, patents, trademarks
 * Engine computes net = gross - accumulated amortisation
 */
export const SM_ASSET_INTANGIBLE = 'asset.intangible' as const

/** Capital Work-in-Progress — Schedule III Non-Current Assets (b) */
export const SM_ASSET_CWIP = 'asset.cwip' as const

/** Long-term Investments — Schedule III Non-Current Assets Financial Assets (i) */
export const SM_ASSET_INVESTMENTS_NC = 'asset.investments.noncurrent' as const

/** Deferred Tax Asset (net) — Schedule III Non-Current Assets (i) */
export const SM_ASSET_DEFERRED_TAX = 'asset.deferred_tax' as const

/** Long-term Loans & Advances — Schedule III Non-Current Assets (j) */
export const SM_ASSET_LT_LOANS = 'asset.lt_loans_advances' as const

/** Other Non-Current Assets — Schedule III Non-Current Assets (j) */
export const SM_ASSET_OTHER_NC = 'asset.other_noncurrent' as const

// ─────────────────────────────────────────────────────────────────────────────
// Balance Sheet — Current Assets (Schedule III Part I, Assets Section)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inventories — Schedule III Current Assets (a)
 * Includes: raw materials, WIP, finished goods, stock-in-trade, stores & spares
 * CRITICAL: Must have opening balance from importer to avoid Month 0 CF swing
 */
export const SM_ASSET_INVENTORIES = 'asset.inventories' as const

/**
 * Trade Receivables — Schedule III Current Assets Financial Assets (ii)
 * Formerly "Accounts Receivable" / "Sundry Debtors"
 */
export const SM_ASSET_TRADE_REC = 'asset.trade_receivables' as const

/**
 * Cash & Cash Equivalents — Schedule III Current Assets Financial Assets (iii)
 * Includes: cash in hand, bank current accounts, demand deposits < 3 months
 */
export const SM_ASSET_CASH = 'asset.cash' as const

/**
 * Bank Balances other than Cash Equivalents — Schedule III Current Assets Financial Assets (iv)
 * Includes: FDs > 3 months, margin money, earmarked balances
 */
export const SM_ASSET_BANK_OTHER = 'asset.bank_other' as const

/** Short-term Investments — Schedule III Current Assets Financial Assets (i) */
export const SM_ASSET_INVESTMENTS_C = 'asset.investments.current' as const

/**
 * Short-term Loans & Advances — Schedule III Current Assets (v) / Other Current Assets
 * Includes: prepaid expenses, security deposits, GST Input Tax Credit (ITC), advance tax
 * CRITICAL: Delta of this account flows into AS 3 Operating CF working capital adjustments
 */
export const SM_ASSET_ST_LOANS = 'asset.st_loans_advances' as const

/**
 * Other Current Assets — Schedule III Current Assets (d)
 * Catch-all for current assets not fitting above categories
 * CRITICAL: Delta flows into AS 3 Operating CF working capital adjustments
 */
export const SM_ASSET_OTHER_C = 'asset.other_current' as const

// ─────────────────────────────────────────────────────────────────────────────
// Balance Sheet — Equity (Schedule III Part I, Equity & Liabilities Section)
// ─────────────────────────────────────────────────────────────────────────────

/** Share Capital (face value of issued shares) — Schedule III Equity (a) */
export const SM_EQ_SHARE_CAPITAL = 'equity.share_capital' as const

/**
 * Securities Premium Reserve — Schedule III Other Equity
 * Premium received on share issuance above face value
 * Closing = Opening + New Share Premium (not affected by PAT or dividends)
 */
export const SM_EQ_SECURITIES_PREMIUM = 'equity.securities_premium' as const

/** General Reserve — Schedule III Other Equity */
export const SM_EQ_GENERAL_RESERVE = 'equity.general_reserve' as const

/**
 * Retained Earnings / P&L Balance — Schedule III Other Equity
 * Closing = Opening + PAT - Dividends Paid
 * NOT simply equal to PAT (dividends and prior period adjustments affect this)
 */
export const SM_EQ_RETAINED_EARNINGS = 'equity.retained_earnings' as const

// ─────────────────────────────────────────────────────────────────────────────
// Balance Sheet — Non-Current Liabilities (Schedule III Part I)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Long-term Borrowings (maturity > 12 months) — Schedule III Non-Current Liabilities (a)(i)
 * Includes: term loans from banks, debentures, long-term deposits
 */
export const SM_LIAB_LT_BORROWINGS = 'liability.lt_borrowings' as const

/** Deferred Tax Liability (net) — Schedule III Non-Current Liabilities (c) */
export const SM_LIAB_DEFERRED_TAX = 'liability.deferred_tax' as const

/**
 * Long-term Provisions — Schedule III Non-Current Liabilities (b)
 * Includes: provision for gratuity, leave encashment (long-term portion)
 */
export const SM_LIAB_LT_PROVISIONS = 'liability.lt_provisions' as const

/** Other Non-Current Liabilities — Schedule III Non-Current Liabilities (d) */
export const SM_LIAB_OTHER_NC = 'liability.other_noncurrent' as const

// ─────────────────────────────────────────────────────────────────────────────
// Balance Sheet — Current Liabilities (Schedule III Part I)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Short-term Borrowings (maturity ≤ 12 months) — Schedule III Current Liabilities (a)(i)
 * Includes: OD, cash credit, working capital loans, current portion of term loans
 */
export const SM_LIAB_ST_BORROWINGS = 'liability.st_borrowings' as const

/**
 * Trade Payables — Schedule III Current Liabilities (a)(ii)
 * Formerly "Accounts Payable" / "Sundry Creditors"
 * CRITICAL: Delta flows into AS 3 Operating CF working capital adjustments
 */
export const SM_LIAB_TRADE_PAY = 'liability.trade_payables' as const

/**
 * Other Current Liabilities — Schedule III Current Liabilities (b)
 * Includes: advance from customers, statutory dues (other than tax), accrued expenses
 * CRITICAL: Delta flows into AS 3 Operating CF working capital adjustments
 */
export const SM_LIAB_OTHER_C = 'liability.other_current' as const

/**
 * Short-term Provisions — Schedule III Current Liabilities (c)
 * Includes: provision for bonus, warranty, short-term gratuity
 * CRITICAL: Delta flows into AS 3 Operating CF working capital adjustments
 */
export const SM_LIAB_ST_PROVISIONS = 'liability.st_provisions' as const

/**
 * Current Tax Liabilities (Income Tax Payable) — Schedule III Current Liabilities (d)
 * Computed by compliance engine from PBT × corporate tax rate
 */
export const SM_LIAB_TAX_PAYABLE = 'liability.tax_payable' as const

/**
 * GST Payable — Schedule III Current Liabilities (b) / Other Current Liabilities
 * Computed by compliance engine from revenue × GST rate - ITC
 */
export const SM_LIAB_GST_PAYABLE = 'liability.gst_payable' as const

/**
 * TDS Payable — Schedule III Current Liabilities (b) / Other Current Liabilities
 * Computed by compliance engine
 */
export const SM_LIAB_TDS_PAYABLE = 'liability.tds_payable' as const

// ─────────────────────────────────────────────────────────────────────────────
// Master array — used for validation and UI dropdowns
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_STANDARD_MAPPINGS = [
  // Revenue
  SM_REV_OPS_PRODUCTS,
  SM_REV_OPS_SERVICES,
  SM_REV_OPS_OTHER,
  SM_REV_OTHER_INTEREST,
  SM_REV_OTHER_DIVIDEND,
  SM_REV_OTHER_MISC,
  // Expenses
  SM_EXP_MATERIALS,
  SM_EXP_STOCK_IN_TRADE,
  SM_EXP_INVENTORY_CHANGES,
  SM_EXP_EMPLOYEE_BENEFITS,
  SM_EXP_FINANCE_COSTS,
  SM_EXP_DEPRECIATION,
  SM_EXP_AMORTISATION,
  SM_EXP_OTHER,
  SM_EXP_EXCEPTIONAL,
  // Non-Current Assets
  SM_ASSET_PPE,
  SM_ASSET_INTANGIBLE,
  SM_ASSET_CWIP,
  SM_ASSET_INVESTMENTS_NC,
  SM_ASSET_DEFERRED_TAX,
  SM_ASSET_LT_LOANS,
  SM_ASSET_OTHER_NC,
  // Current Assets
  SM_ASSET_INVENTORIES,
  SM_ASSET_TRADE_REC,
  SM_ASSET_CASH,
  SM_ASSET_BANK_OTHER,
  SM_ASSET_INVESTMENTS_C,
  SM_ASSET_ST_LOANS,
  SM_ASSET_OTHER_C,
  // Equity
  SM_EQ_SHARE_CAPITAL,
  SM_EQ_SECURITIES_PREMIUM,
  SM_EQ_GENERAL_RESERVE,
  SM_EQ_RETAINED_EARNINGS,
  // Non-Current Liabilities
  SM_LIAB_LT_BORROWINGS,
  SM_LIAB_DEFERRED_TAX,
  SM_LIAB_LT_PROVISIONS,
  SM_LIAB_OTHER_NC,
  // Current Liabilities
  SM_LIAB_ST_BORROWINGS,
  SM_LIAB_TRADE_PAY,
  SM_LIAB_OTHER_C,
  SM_LIAB_ST_PROVISIONS,
  SM_LIAB_TAX_PAYABLE,
  SM_LIAB_GST_PAYABLE,
  SM_LIAB_TDS_PAYABLE,
] as const

/** TypeScript union of all valid standardMapping values */
export type StandardMapping = typeof ALL_STANDARD_MAPPINGS[number]

/** Type guard — returns true if value is a valid StandardMapping */
export function isValidStandardMapping(value: unknown): value is StandardMapping {
  return typeof value === 'string' && (ALL_STANDARD_MAPPINGS as readonly string[]).includes(value)
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic fallback mapping — used by the migration script
// Every account MUST have a standardMapping after Phase 1.
// If heuristics fail, these fallbacks ensure no account leaks out of the engine.
// ─────────────────────────────────────────────────────────────────────────────

export const FALLBACK_BY_ACCOUNT_TYPE: Record<string, StandardMapping> = {
  revenue:   SM_REV_OPS_OTHER,        // shows in Revenue from Operations
  expense:   SM_EXP_OTHER,            // shows in Other Expenses
  asset:     SM_ASSET_OTHER_C,        // shows in Current Assets
  liability: SM_LIAB_OTHER_C,         // shows in Current Liabilities
  equity:    SM_EQ_RETAINED_EARNINGS, // shows in Reserves & Surplus
}

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable labels — used in UI dropdowns and the accounts page
// ─────────────────────────────────────────────────────────────────────────────

export const STANDARD_MAPPING_LABELS: Record<StandardMapping, string> = {
  // Revenue
  [SM_REV_OPS_PRODUCTS]:    'Revenue from Operations — Sale of Products',
  [SM_REV_OPS_SERVICES]:    'Revenue from Operations — Sale of Services',
  [SM_REV_OPS_OTHER]:       'Revenue from Operations — Other Operating Revenue',
  [SM_REV_OTHER_INTEREST]:  'Other Income — Interest Income',
  [SM_REV_OTHER_DIVIDEND]:  'Other Income — Dividend Income',
  [SM_REV_OTHER_MISC]:      'Other Income — Miscellaneous',
  // Expenses
  [SM_EXP_MATERIALS]:       'Cost of Materials Consumed',
  [SM_EXP_STOCK_IN_TRADE]:  'Purchases of Stock-in-Trade',
  [SM_EXP_INVENTORY_CHANGES]: 'Changes in Inventories',
  [SM_EXP_EMPLOYEE_BENEFITS]: 'Employee Benefits Expense',
  [SM_EXP_FINANCE_COSTS]:   'Finance Costs',
  [SM_EXP_DEPRECIATION]:    'Depreciation',
  [SM_EXP_AMORTISATION]:    'Amortisation',
  [SM_EXP_OTHER]:           'Other Expenses',
  [SM_EXP_EXCEPTIONAL]:     'Exceptional Items',
  // Non-Current Assets
  [SM_ASSET_PPE]:           'Property, Plant & Equipment',
  [SM_ASSET_INTANGIBLE]:    'Intangible Assets',
  [SM_ASSET_CWIP]:          'Capital Work-in-Progress',
  [SM_ASSET_INVESTMENTS_NC]:'Long-term Investments',
  [SM_ASSET_DEFERRED_TAX]:  'Deferred Tax Asset',
  [SM_ASSET_LT_LOANS]:      'Long-term Loans & Advances',
  [SM_ASSET_OTHER_NC]:      'Other Non-Current Assets',
  // Current Assets
  [SM_ASSET_INVENTORIES]:   'Inventories',
  [SM_ASSET_TRADE_REC]:     'Trade Receivables',
  [SM_ASSET_CASH]:          'Cash & Cash Equivalents',
  [SM_ASSET_BANK_OTHER]:    'Bank Balances (other than cash equivalents)',
  [SM_ASSET_INVESTMENTS_C]: 'Short-term Investments',
  [SM_ASSET_ST_LOANS]:      'Short-term Loans & Advances',
  [SM_ASSET_OTHER_C]:       'Other Current Assets',
  // Equity
  [SM_EQ_SHARE_CAPITAL]:    'Share Capital',
  [SM_EQ_SECURITIES_PREMIUM]: 'Securities Premium Reserve',
  [SM_EQ_GENERAL_RESERVE]:  'General Reserve',
  [SM_EQ_RETAINED_EARNINGS]:'Retained Earnings',
  // Non-Current Liabilities
  [SM_LIAB_LT_BORROWINGS]:  'Long-term Borrowings',
  [SM_LIAB_DEFERRED_TAX]:   'Deferred Tax Liability',
  [SM_LIAB_LT_PROVISIONS]:  'Long-term Provisions',
  [SM_LIAB_OTHER_NC]:       'Other Non-Current Liabilities',
  // Current Liabilities
  [SM_LIAB_ST_BORROWINGS]:  'Short-term Borrowings',
  [SM_LIAB_TRADE_PAY]:      'Trade Payables',
  [SM_LIAB_OTHER_C]:        'Other Current Liabilities',
  [SM_LIAB_ST_PROVISIONS]:  'Short-term Provisions',
  [SM_LIAB_TAX_PAYABLE]:    'Current Tax Liabilities',
  [SM_LIAB_GST_PAYABLE]:    'GST Payable',
  [SM_LIAB_TDS_PAYABLE]:    'TDS Payable',
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouped for UI dropdowns — grouped by Schedule III section
// ─────────────────────────────────────────────────────────────────────────────

export const STANDARD_MAPPING_GROUPS: Array<{
  group: string
  accountTypes: Array<'revenue' | 'expense' | 'asset' | 'liability' | 'equity'>
  items: StandardMapping[]
}> = [
  {
    group: 'Revenue from Operations',
    accountTypes: ['revenue'],
    items: [SM_REV_OPS_PRODUCTS, SM_REV_OPS_SERVICES, SM_REV_OPS_OTHER],
  },
  {
    group: 'Other Income',
    accountTypes: ['revenue'],
    items: [SM_REV_OTHER_INTEREST, SM_REV_OTHER_DIVIDEND, SM_REV_OTHER_MISC],
  },
  {
    group: 'Cost of Goods Sold',
    accountTypes: ['expense'],
    items: [SM_EXP_MATERIALS, SM_EXP_STOCK_IN_TRADE, SM_EXP_INVENTORY_CHANGES],
  },
  {
    group: 'Operating Expenses',
    accountTypes: ['expense'],
    items: [
      SM_EXP_EMPLOYEE_BENEFITS,
      SM_EXP_FINANCE_COSTS,
      SM_EXP_DEPRECIATION,
      SM_EXP_AMORTISATION,
      SM_EXP_OTHER,
      SM_EXP_EXCEPTIONAL,
    ],
  },
  {
    group: 'Non-Current Assets',
    accountTypes: ['asset'],
    items: [
      SM_ASSET_PPE,
      SM_ASSET_INTANGIBLE,
      SM_ASSET_CWIP,
      SM_ASSET_INVESTMENTS_NC,
      SM_ASSET_DEFERRED_TAX,
      SM_ASSET_LT_LOANS,
      SM_ASSET_OTHER_NC,
    ],
  },
  {
    group: 'Current Assets',
    accountTypes: ['asset'],
    items: [
      SM_ASSET_INVENTORIES,
      SM_ASSET_TRADE_REC,
      SM_ASSET_CASH,
      SM_ASSET_BANK_OTHER,
      SM_ASSET_INVESTMENTS_C,
      SM_ASSET_ST_LOANS,
      SM_ASSET_OTHER_C,
    ],
  },
  {
    group: 'Equity',
    accountTypes: ['equity'],
    items: [
      SM_EQ_SHARE_CAPITAL,
      SM_EQ_SECURITIES_PREMIUM,
      SM_EQ_GENERAL_RESERVE,
      SM_EQ_RETAINED_EARNINGS,
    ],
  },
  {
    group: 'Non-Current Liabilities',
    accountTypes: ['liability'],
    items: [
      SM_LIAB_LT_BORROWINGS,
      SM_LIAB_DEFERRED_TAX,
      SM_LIAB_LT_PROVISIONS,
      SM_LIAB_OTHER_NC,
    ],
  },
  {
    group: 'Current Liabilities',
    accountTypes: ['liability'],
    items: [
      SM_LIAB_ST_BORROWINGS,
      SM_LIAB_TRADE_PAY,
      SM_LIAB_OTHER_C,
      SM_LIAB_ST_PROVISIONS,
      SM_LIAB_TAX_PAYABLE,
      SM_LIAB_GST_PAYABLE,
      SM_LIAB_TDS_PAYABLE,
    ],
  },
]
