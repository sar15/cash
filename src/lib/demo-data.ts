import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types';
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types';

export interface AccountData {
  id: string;
  name: string;
  category: 'Revenue' | 'COGS' | 'Operating Expenses' | 'Assets' | 'Liabilities' | 'Equity';
  historicalValues: number[]; // 12 months, in paise
}

// 1 lakh = 10,000,000 paise
const LAKH = 10_000_000;

export const generateDemoData = (): AccountData[] => {
  return [
    {
      id: "rev-1",
      name: "Product Sales",
      category: "Revenue",
      historicalValues: [
        45.2 * LAKH, 48.1 * LAKH, 49.5 * LAKH, 50.2 * LAKH, 47.8 * LAKH, 52.1 * LAKH,
        51.5 * LAKH, 53.2 * LAKH, 55.4 * LAKH, 54.1 * LAKH, 58.2 * LAKH, 60.5 * LAKH
      ]
    },
    {
      id: "rev-2",
      name: "Service Revenue",
      category: "Revenue",
      historicalValues: [
        5.1 * LAKH, 5.2 * LAKH, 5.0 * LAKH, 5.5 * LAKH, 5.8 * LAKH, 6.0 * LAKH,
        6.1 * LAKH, 6.2 * LAKH, 6.5 * LAKH, 6.4 * LAKH, 6.8 * LAKH, 7.0 * LAKH
      ]
    },
    {
      id: "cogs-1",
      name: "Raw Materials",
      category: "COGS",
      historicalValues: [
        18.5 * LAKH, 19.2 * LAKH, 19.8 * LAKH, 20.1 * LAKH, 19.0 * LAKH, 20.8 * LAKH,
        20.5 * LAKH, 21.2 * LAKH, 22.1 * LAKH, 21.6 * LAKH, 23.2 * LAKH, 24.1 * LAKH
      ]
    },
    {
      id: "cogs-2",
      name: "Direct Labor",
      category: "COGS",
      historicalValues: [
        10.0 * LAKH, 10.6 * LAKH, 10.0 * LAKH, 10.0 * LAKH, 10.0 * LAKH, 10.0 * LAKH,
        10.0 * LAKH, 10.0 * LAKH, 10.0 * LAKH, 10.0 * LAKH, 10.0 * LAKH, 10.0 * LAKH
      ]
    },
    {
      id: "exp-1",
      name: "Salaries & Wages",
      category: "Operating Expenses",
      historicalValues: [
        8.5 * LAKH, 8.5 * LAKH, 8.5 * LAKH, 9.2 * LAKH, 9.2 * LAKH, 9.2 * LAKH,
        9.2 * LAKH, 9.2 * LAKH, 9.2 * LAKH, 9.8 * LAKH, 9.8 * LAKH, 9.8 * LAKH
      ]
    },
    {
      id: "exp-2",
      name: "Rent",
      category: "Operating Expenses",
      historicalValues: [
        2.0 * LAKH, 2.0 * LAKH, 2.0 * LAKH, 2.0 * LAKH, 2.0 * LAKH, 2.0 * LAKH,
        2.0 * LAKH, 2.0 * LAKH, 2.0 * LAKH, 2.0 * LAKH, 2.0 * LAKH, 2.0 * LAKH
      ]
    },
    {
      id: "exp-3",
      name: "Utilities",
      category: "Operating Expenses",
      historicalValues: [
        1.6 * LAKH, 1.9 * LAKH, 1.5 * LAKH, 1.2 * LAKH, 1.3 * LAKH, 1.3 * LAKH,
        1.4 * LAKH, 1.3 * LAKH, 1.8 * LAKH, 1.5 * LAKH, 1.4 * LAKH, 1.5 * LAKH
      ]
    },
    {
      id: "ast-1",
      name: "Cash Equivalents",
      category: "Assets",
      historicalValues: [
        15.5 * LAKH, 16.2 * LAKH, 14.8 * LAKH, 15.1 * LAKH, 14.0 * LAKH, 15.8 * LAKH,
        15.5 * LAKH, 16.2 * LAKH, 17.1 * LAKH, 16.6 * LAKH, 18.2 * LAKH, 18.5 * LAKH
      ]
    }
  ];
};

export const demoData = generateDemoData();

export const historicalMonths = [
  "Apr-24", "May-24", "Jun-24", "Jul-24", "Aug-24", "Sep-24",
  "Oct-24", "Nov-24", "Dec-24", "Jan-25", "Feb-25", "Mar-25"
];

export const forecastMonths = [
  "Apr-25", "May-25", "Jun-25", "Jul-25", "Aug-25", "Sep-25",
  "Oct-25", "Nov-25", "Dec-25", "Jan-26", "Feb-26", "Mar-26"
];

export const allMonths = [...historicalMonths, ...forecastMonths];

// Demo config mapping account IDs to their value rules
export const demoValueRules: Record<string, AnyValueRuleConfig> = {
  "rev-1": { type: "growth", accountId: "rev-1", monthlyGrowthRate: 0.05 },
  "rev-2": { type: "rolling_avg", accountId: "rev-2", lookbackMonths: 3 },
  "cogs-1": { type: "growth", accountId: "cogs-1", monthlyGrowthRate: 0.02 },
  "cogs-2": { type: "same_last_year", accountId: "cogs-2" },
  "exp-1": { type: "same_last_year", accountId: "exp-1" },
  "exp-2": { type: "same_last_year", accountId: "exp-2" },
  "exp-3": { type: "rolling_avg", accountId: "exp-3", lookbackMonths: 6 },
};

export const demoTimingProfiles: Record<string, AnyTimingProfileConfig> = {
  "rev-1": { type: "receivables", accountId: "rev-1", month_0: 0.7, month_1: 0.3 },
  "rev-2": { type: "receivables", accountId: "rev-2", month_0: 1.0 },
  "cogs-1": { type: "payables", accountId: "cogs-1", month_0: 0.5, month_1: 0.5 },
  "cogs-2": { type: "payables", accountId: "cogs-2", month_0: 1.0 },
};
