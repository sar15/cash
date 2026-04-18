import {
  SM_REV_OPS_PRODUCTS,
  SM_REV_OPS_SERVICES,
  SM_REV_OPS_OTHER,
  SM_REV_OTHER_INTEREST,
  SM_EXP_MATERIALS,
  SM_EXP_STOCK_IN_TRADE,
  SM_EXP_EMPLOYEE_BENEFITS,
  SM_EXP_DEPRECIATION,
  SM_EXP_OTHER,
  SM_ASSET_CASH,
  SM_ASSET_TRADE_REC,
  SM_ASSET_INVENTORIES,
  SM_ASSET_PPE,
  SM_ASSET_ST_LOANS,
  SM_LIAB_TRADE_PAY,
  SM_LIAB_GST_PAYABLE,
  SM_LIAB_TDS_PAYABLE,
  SM_LIAB_OTHER_C,
  SM_LIAB_ST_BORROWINGS,
  SM_LIAB_LT_BORROWINGS,
  SM_EQ_SHARE_CAPITAL,
  SM_EQ_RETAINED_EARNINGS,
  type StandardMapping,
} from './standard-mappings'

export type StandardStatementCategory =
  | 'Revenue'
  | 'COGS'
  | 'Operating Expenses'
  | 'Assets'
  | 'Liabilities'
  | 'Equity'

export type StandardAccountType = 'revenue' | 'expense' | 'asset' | 'liability' | 'equity'

export interface StandardIndianAccount {
  id: string
  name: string
  category: StandardStatementCategory
  accountType: StandardAccountType
  /** Schedule III / AS 3 standard mapping — used by Phase 2 engine */
  standardMapping: StandardMapping
  aliases: string[]
}

export const STANDARD_INDIAN_COA: StandardIndianAccount[] = [
  // ── Revenue ──────────────────────────────────────────────────────────────
  {
    id: 'rev-product-sales',
    name: 'Product Sales',
    category: 'Revenue',
    accountType: 'revenue',
    standardMapping: SM_REV_OPS_PRODUCTS,
    aliases: ['sales', 'domestic sales', 'goods sales', 'turnover', 'net sales', 'gross sales', 'sales revenue', 'product revenue'],
  },
  {
    id: 'rev-service-revenue',
    name: 'Service Revenue',
    category: 'Revenue',
    accountType: 'revenue',
    standardMapping: SM_REV_OPS_SERVICES,
    aliases: ['service income', 'consulting revenue', 'professional income', 'fees income', 'service charges', 'consulting income'],
  },
  {
    id: 'rev-export-sales',
    name: 'Export Sales',
    category: 'Revenue',
    accountType: 'revenue',
    standardMapping: SM_REV_OPS_PRODUCTS,
    aliases: ['export revenue', 'overseas sales', 'foreign sales', 'export income'],
  },
  {
    id: 'rev-other-income',
    name: 'Other Income',
    category: 'Revenue',
    accountType: 'revenue',
    standardMapping: SM_REV_OPS_OTHER,
    aliases: ['misc income', 'other operating income', 'miscellaneous income', 'sundry income', 'other revenue'],
  },
  {
    id: 'rev-interest-income',
    name: 'Interest Income',
    category: 'Revenue',
    accountType: 'revenue',
    standardMapping: SM_REV_OTHER_INTEREST,
    aliases: ['bank interest', 'interest received', 'interest earned', 'interest on fd', 'interest on deposits'],
  },

  // ── COGS ─────────────────────────────────────────────────────────────────
  {
    id: 'cogs-raw-materials',
    name: 'Raw Materials',
    category: 'COGS',
    accountType: 'expense',
    standardMapping: SM_EXP_MATERIALS,
    aliases: ['raw material consumed', 'material consumption'],
  },
  {
    id: 'cogs-purchases',
    name: 'Purchases',
    category: 'COGS',
    accountType: 'expense',
    standardMapping: SM_EXP_STOCK_IN_TRADE,
    aliases: ['purchase of stock', 'stock purchases'],
  },
  {
    id: 'cogs-direct-labor',
    name: 'Direct Labor',
    category: 'COGS',
    accountType: 'expense',
    standardMapping: SM_EXP_EMPLOYEE_BENEFITS,
    aliases: ['wages', 'factory wages', 'direct wages'],
  },
  {
    id: 'cogs-manufacturing-overheads',
    name: 'Manufacturing Overheads',
    category: 'COGS',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['production overheads', 'factory overheads'],
  },
  {
    id: 'cogs-freight-inward',
    name: 'Freight Inward',
    category: 'COGS',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['carriage inward', 'inward freight'],
  },

  // ── Operating Expenses ───────────────────────────────────────────────────
  {
    id: 'exp-salaries',
    name: 'Salaries & Wages',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_EMPLOYEE_BENEFITS,
    aliases: ['staff cost', 'employee benefits expense', 'payroll'],
  },
  {
    id: 'exp-rent',
    name: 'Rent',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['lease rent', 'office rent'],
  },
  {
    id: 'exp-utilities',
    name: 'Utilities',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['electricity', 'power & fuel', 'water charges'],
  },
  {
    id: 'exp-professional-fees',
    name: 'Professional Fees',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['consultancy charges', 'legal fees'],
  },
  {
    id: 'exp-marketing',
    name: 'Marketing & Promotion',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['advertisement', 'advertising', 'sales promotion'],
  },
  {
    id: 'exp-travel',
    name: 'Travel & Conveyance',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['travel expenses', 'conveyance'],
  },
  {
    id: 'exp-repairs',
    name: 'Repairs & Maintenance',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['repairs', 'maintenance'],
  },
  {
    id: 'exp-insurance',
    name: 'Insurance',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['insurance charges', 'insurance premium'],
  },
  {
    id: 'exp-depreciation',
    name: 'Depreciation',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_DEPRECIATION,
    aliases: ['depreciation expense'],
  },
  {
    id: 'exp-audit-fees',
    name: 'Audit Fees',
    category: 'Operating Expenses',
    accountType: 'expense',
    standardMapping: SM_EXP_OTHER,
    aliases: ['statutory audit fees'],
  },

  // ── Assets ───────────────────────────────────────────────────────────────
  {
    id: 'ast-cash-bank',
    name: 'Cash & Bank',
    category: 'Assets',
    accountType: 'asset',
    standardMapping: SM_ASSET_CASH,
    aliases: ['cash equivalents', 'bank balance', 'cash in hand'],
  },
  {
    id: 'ast-accounts-receivable',
    name: 'Accounts Receivable',
    category: 'Assets',
    accountType: 'asset',
    standardMapping: SM_ASSET_TRADE_REC,
    aliases: ['trade receivables', 'sundry debtors', 'debtors', 'book debts', 'bills receivable', 'debtors control'],
  },
  {
    id: 'ast-inventory',
    name: 'Inventory',
    category: 'Assets',
    accountType: 'asset',
    standardMapping: SM_ASSET_INVENTORIES,
    aliases: ['closing stock', 'stock in hand', 'stock in trade', 'raw material stock', 'finished goods', 'work in progress', 'wip', 'stores and spares'],
  },
  {
    id: 'ast-fixed-assets',
    name: 'Fixed Assets',
    category: 'Assets',
    accountType: 'asset',
    standardMapping: SM_ASSET_PPE,
    aliases: ['property plant equipment', 'plant & machinery', 'ppe', 'tangible assets', 'gross block', 'net block', 'plant and machinery', 'furniture and fixtures', 'office equipment', 'vehicles', 'computers'],
  },
  {
    id: 'ast-gst-receivable',
    name: 'GST Receivable',
    category: 'Assets',
    accountType: 'asset',
    standardMapping: SM_ASSET_ST_LOANS,
    aliases: ['input gst', 'itc receivable', 'input credit', 'gst input tax credit', 'cgst receivable', 'sgst receivable', 'igst receivable'],
  },
  {
    id: 'ast-prepaids',
    name: 'Prepaid Expenses',
    category: 'Assets',
    accountType: 'asset',
    standardMapping: SM_ASSET_ST_LOANS,
    aliases: ['prepaid', 'advances recoverable', 'advance to suppliers', 'advance payments', 'security deposits', 'deposits'],
  },
  {
    id: 'ast-advance-tax',
    name: 'Advance Tax',
    category: 'Assets',
    accountType: 'asset',
    standardMapping: SM_ASSET_ST_LOANS,
    aliases: ['tax paid in advance', 'advance income tax', 'tds receivable', 'tds credit', 'self assessment tax'],
  },

  // ── Liabilities ──────────────────────────────────────────────────────────
  {
    id: 'liab-accounts-payable',
    name: 'Accounts Payable',
    category: 'Liabilities',
    accountType: 'liability',
    standardMapping: SM_LIAB_TRADE_PAY,
    aliases: ['trade payables', 'sundry creditors', 'creditors', 'bills payable', 'creditors control', 'accounts payable control'],
  },
  {
    id: 'liab-gst-payable',
    name: 'GST Payable',
    category: 'Liabilities',
    accountType: 'liability',
    standardMapping: SM_LIAB_GST_PAYABLE,
    aliases: ['output gst', 'gst liability', 'cgst payable', 'sgst payable', 'igst payable', 'gst output tax'],
  },
  {
    id: 'liab-tds-payable',
    name: 'TDS Payable',
    category: 'Liabilities',
    accountType: 'liability',
    standardMapping: SM_LIAB_TDS_PAYABLE,
    aliases: ['tds payable on salary', 'tax deducted at source', 'tds on salary', 'tds on contractors', 'tds on rent'],
  },
  {
    id: 'liab-pf-payable',
    name: 'PF Payable',
    category: 'Liabilities',
    accountType: 'liability',
    standardMapping: SM_LIAB_OTHER_C,
    aliases: ['provident fund payable', 'epf payable', 'pf contribution payable', 'employees pf'],
  },
  {
    id: 'liab-esi-payable',
    name: 'ESI Payable',
    category: 'Liabilities',
    accountType: 'liability',
    standardMapping: SM_LIAB_OTHER_C,
    aliases: ['employee state insurance payable', 'esic payable'],
  },
  {
    id: 'liab-short-term-debt',
    name: 'Short-term Debt',
    category: 'Liabilities',
    accountType: 'liability',
    standardMapping: SM_LIAB_ST_BORROWINGS,
    aliases: ['od balance', 'cash credit', 'working capital loan', 'overdraft', 'bank overdraft', 'cc limit', 'short term loan', 'current portion of long term debt'],
  },
  {
    id: 'liab-long-term-debt',
    name: 'Long-term Debt',
    category: 'Liabilities',
    accountType: 'liability',
    standardMapping: SM_LIAB_LT_BORROWINGS,
    aliases: ['term loan', 'secured loan', 'unsecured loan', 'bank term loan', 'vehicle loan', 'machinery loan', 'long term borrowings', 'debentures'],
  },

  // ── Equity ───────────────────────────────────────────────────────────────
  {
    id: 'eq-share-capital',
    name: 'Share Capital',
    category: 'Equity',
    accountType: 'equity',
    standardMapping: SM_EQ_SHARE_CAPITAL,
    aliases: ['equity share capital', 'capital account'],
  },
  {
    id: 'eq-retained-earnings',
    name: 'Retained Earnings',
    category: 'Equity',
    accountType: 'equity',
    standardMapping: SM_EQ_RETAINED_EARNINGS,
    aliases: ['surplus', 'profit and loss account', 'reserves and surplus'],
  },
]

export type IndianCoAEntry = StandardIndianAccount
export const INDIAN_COA = STANDARD_INDIAN_COA
