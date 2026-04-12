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
  aliases: string[]
}

export const STANDARD_INDIAN_COA: StandardIndianAccount[] = [
  {
    id: 'rev-product-sales',
    name: 'Product Sales',
    category: 'Revenue',
    accountType: 'revenue',
    aliases: ['sales', 'domestic sales', 'goods sales', 'turnover'],
  },
  {
    id: 'rev-service-revenue',
    name: 'Service Revenue',
    category: 'Revenue',
    accountType: 'revenue',
    aliases: ['service income', 'consulting revenue', 'professional income'],
  },
  {
    id: 'rev-export-sales',
    name: 'Export Sales',
    category: 'Revenue',
    accountType: 'revenue',
    aliases: ['export revenue', 'overseas sales'],
  },
  {
    id: 'rev-other-income',
    name: 'Other Income',
    category: 'Revenue',
    accountType: 'revenue',
    aliases: ['misc income', 'other operating income'],
  },
  {
    id: 'rev-interest-income',
    name: 'Interest Income',
    category: 'Revenue',
    accountType: 'revenue',
    aliases: ['bank interest', 'interest received'],
  },
  {
    id: 'cogs-raw-materials',
    name: 'Raw Materials',
    category: 'COGS',
    accountType: 'expense',
    aliases: ['raw material consumed', 'material consumption'],
  },
  {
    id: 'cogs-purchases',
    name: 'Purchases',
    category: 'COGS',
    accountType: 'expense',
    aliases: ['purchase of stock', 'stock purchases'],
  },
  {
    id: 'cogs-direct-labor',
    name: 'Direct Labor',
    category: 'COGS',
    accountType: 'expense',
    aliases: ['wages', 'factory wages', 'direct wages'],
  },
  {
    id: 'cogs-manufacturing-overheads',
    name: 'Manufacturing Overheads',
    category: 'COGS',
    accountType: 'expense',
    aliases: ['production overheads', 'factory overheads'],
  },
  {
    id: 'cogs-freight-inward',
    name: 'Freight Inward',
    category: 'COGS',
    accountType: 'expense',
    aliases: ['carriage inward', 'inward freight'],
  },
  {
    id: 'exp-salaries',
    name: 'Salaries & Wages',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['staff cost', 'employee benefits expense', 'payroll'],
  },
  {
    id: 'exp-rent',
    name: 'Rent',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['lease rent', 'office rent'],
  },
  {
    id: 'exp-utilities',
    name: 'Utilities',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['electricity', 'power & fuel', 'water charges'],
  },
  {
    id: 'exp-professional-fees',
    name: 'Professional Fees',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['consultancy charges', 'legal fees'],
  },
  {
    id: 'exp-marketing',
    name: 'Marketing & Promotion',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['advertisement', 'advertising', 'sales promotion'],
  },
  {
    id: 'exp-travel',
    name: 'Travel & Conveyance',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['travel expenses', 'conveyance'],
  },
  {
    id: 'exp-repairs',
    name: 'Repairs & Maintenance',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['repairs', 'maintenance'],
  },
  {
    id: 'exp-insurance',
    name: 'Insurance',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['insurance charges', 'insurance premium'],
  },
  {
    id: 'exp-depreciation',
    name: 'Depreciation',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['depreciation expense'],
  },
  {
    id: 'exp-audit-fees',
    name: 'Audit Fees',
    category: 'Operating Expenses',
    accountType: 'expense',
    aliases: ['statutory audit fees'],
  },
  {
    id: 'ast-cash-bank',
    name: 'Cash & Bank',
    category: 'Assets',
    accountType: 'asset',
    aliases: ['cash equivalents', 'bank balance', 'cash in hand'],
  },
  {
    id: 'ast-accounts-receivable',
    name: 'Accounts Receivable',
    category: 'Assets',
    accountType: 'asset',
    aliases: ['trade receivables', 'sundry debtors', 'debtors'],
  },
  {
    id: 'ast-inventory',
    name: 'Inventory',
    category: 'Assets',
    accountType: 'asset',
    aliases: ['closing stock', 'stock in hand'],
  },
  {
    id: 'ast-fixed-assets',
    name: 'Fixed Assets',
    category: 'Assets',
    accountType: 'asset',
    aliases: ['property plant equipment', 'plant & machinery', 'ppe'],
  },
  {
    id: 'ast-gst-receivable',
    name: 'GST Receivable',
    category: 'Assets',
    accountType: 'asset',
    aliases: ['input gst', 'itc receivable', 'input credit'],
  },
  {
    id: 'ast-prepaids',
    name: 'Prepaid Expenses',
    category: 'Assets',
    accountType: 'asset',
    aliases: ['prepaid', 'advances recoverable'],
  },
  {
    id: 'ast-advance-tax',
    name: 'Advance Tax',
    category: 'Assets',
    accountType: 'asset',
    aliases: ['tax paid in advance', 'advance income tax'],
  },
  {
    id: 'liab-accounts-payable',
    name: 'Accounts Payable',
    category: 'Liabilities',
    accountType: 'liability',
    aliases: ['trade payables', 'sundry creditors', 'creditors'],
  },
  {
    id: 'liab-gst-payable',
    name: 'GST Payable',
    category: 'Liabilities',
    accountType: 'liability',
    aliases: ['output gst', 'gst liability'],
  },
  {
    id: 'liab-tds-payable',
    name: 'TDS Payable',
    category: 'Liabilities',
    accountType: 'liability',
    aliases: ['tds payable on salary', 'tax deducted at source'],
  },
  {
    id: 'liab-pf-payable',
    name: 'PF Payable',
    category: 'Liabilities',
    accountType: 'liability',
    aliases: ['provident fund payable', 'epf payable'],
  },
  {
    id: 'liab-esi-payable',
    name: 'ESI Payable',
    category: 'Liabilities',
    accountType: 'liability',
    aliases: ['employee state insurance payable'],
  },
  {
    id: 'liab-short-term-debt',
    name: 'Short-term Debt',
    category: 'Liabilities',
    accountType: 'liability',
    aliases: ['od balance', 'cash credit', 'working capital loan'],
  },
  {
    id: 'liab-long-term-debt',
    name: 'Long-term Debt',
    category: 'Liabilities',
    accountType: 'liability',
    aliases: ['term loan', 'secured loan', 'unsecured loan'],
  },
  {
    id: 'eq-share-capital',
    name: 'Share Capital',
    category: 'Equity',
    accountType: 'equity',
    aliases: ['equity share capital', 'capital account'],
  },
  {
    id: 'eq-retained-earnings',
    name: 'Retained Earnings',
    category: 'Equity',
    accountType: 'equity',
    aliases: ['surplus', 'profit and loss account', 'reserves and surplus'],
  },
]

export type IndianCoAEntry = StandardIndianAccount
export const INDIAN_COA = STANDARD_INDIAN_COA
