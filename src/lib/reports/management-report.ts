import type { AccountData } from '@/lib/demo-data';
import type { EngineResult } from '@/lib/engine';

interface ReportLine {
  label: string;
  values: number[];
  total: number;
  emphasize?: boolean;
}

interface ScenarioSummaryRow {
  label: string;
  base: number;
  scenario: number;
}

export interface ManagementReportData {
  companyName: string;
  periodLabel: string;
  forecastMonthLabels: string[];
  notes: string;
  logoDataUrl: string | null;
  executiveSummary: {
    revenue: number;
    netProfit: number;
    cashOnHand: number;
    workingCapitalGap: number;
  };
  pnlRows: ReportLine[];
  balanceSheetRows: ReportLine[];
  cashFlowRows: ReportLine[];
  complianceRows: Array<{
    month: string;
    gst: number;
    tds: number;
    pf: number;
    esi: number;
    advanceTax: number;
    total: number;
  }>;
  scenarioSummary:
    | {
        scenarioName: string;
        rows: ScenarioSummaryRow[];
      }
    | null;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function buildAccountRows(
  accounts: AccountData[],
  engineResult: EngineResult,
  categories: AccountData['category'][]
): ReportLine[] {
  return accounts
    .filter((account) => categories.includes(account.category))
    .map((account) => {
      const values = engineResult.accountForecasts[account.id] ?? Array(engineResult.forecastMonths.length).fill(0);
      return {
        label: account.name,
        values,
        total: sum(values),
      };
    });
}

export function buildManagementReportData({
  accounts,
  baselineResult,
  companyName,
  engineResult,
  forecastMonthLabels,
  logoDataUrl,
  notes,
  selectedScenarioName,
}: {
  accounts: AccountData[];
  baselineResult: EngineResult | null;
  companyName: string;
  engineResult: EngineResult;
  forecastMonthLabels: string[];
  logoDataUrl: string | null;
  notes: string;
  selectedScenarioName?: string | null;
}): ManagementReportData {
  const revenueAccountRows = buildAccountRows(accounts, engineResult, ['Revenue']);
  const cogsAccountRows = buildAccountRows(accounts, engineResult, ['COGS']);
  const expenseAccountRows = buildAccountRows(accounts, engineResult, ['Operating Expenses']);

  const revenueSeries = engineResult.integrationResults.map((month) => month.pl.revenue);
  const cogsSeries = engineResult.integrationResults.map((month) => month.pl.cogs);
  const grossProfitSeries = engineResult.integrationResults.map((month) => month.pl.grossProfit);
  const expenseSeries = engineResult.integrationResults.map((month) => month.pl.expense);
  const operatingProfitSeries = engineResult.integrationResults.map(
    (month) => month.pl.grossProfit - month.pl.expense
  );
  const netProfitSeries = engineResult.integrationResults.map((month) => month.pl.netIncome);

  const lastMonth = engineResult.integrationResults.at(-1);
  const workingCapitalGap = Math.max(0, (lastMonth?.bs.ar ?? 0) - (lastMonth?.bs.ap ?? 0));
  const periodLabel = `Forecast: ${forecastMonthLabels[0]} - ${forecastMonthLabels.at(-1)}`;

  const balanceSheetRows: ReportLine[] = [
    { label: 'Cash', values: engineResult.integrationResults.map((month) => month.bs.cash), total: lastMonth?.bs.cash ?? 0 },
    { label: 'Receivables', values: engineResult.integrationResults.map((month) => month.bs.ar), total: lastMonth?.bs.ar ?? 0 },
    {
      label: 'Payables',
      values: engineResult.integrationResults.map((month) => month.bs.ap),
      total: lastMonth?.bs.ap ?? 0,
    },
    {
      label: 'Fixed Assets',
      values: engineResult.integrationResults.map(
        (month) => month.bs.fixedAssets - month.bs.accDepreciation
      ),
      total: (lastMonth?.bs.fixedAssets ?? 0) - (lastMonth?.bs.accDepreciation ?? 0),
    },
    { label: 'Loans', values: engineResult.integrationResults.map((month) => month.bs.debt), total: lastMonth?.bs.debt ?? 0 },
    {
      label: 'Equity',
      values: engineResult.integrationResults.map((month) => month.bs.totalEquity),
      total: lastMonth?.bs.totalEquity ?? 0,
      emphasize: true,
    },
  ];

  const cashFlowRows: ReportLine[] = [
    {
      label: 'Operating CF',
      values: engineResult.integrationResults.map((month) => month.cf.operatingCashFlow),
      total: sum(engineResult.integrationResults.map((month) => month.cf.operatingCashFlow)),
      emphasize: true,
    },
    {
      label: 'Investing CF',
      values: engineResult.integrationResults.map((month) => month.cf.investingCashFlow),
      total: sum(engineResult.integrationResults.map((month) => month.cf.investingCashFlow)),
    },
    {
      label: 'Financing CF',
      values: engineResult.integrationResults.map((month) => month.cf.financingCashFlow),
      total: sum(engineResult.integrationResults.map((month) => month.cf.financingCashFlow)),
    },
    {
      label: 'Net CF',
      values: engineResult.integrationResults.map((month) => month.cf.netCashFlow),
      total: sum(engineResult.integrationResults.map((month) => month.cf.netCashFlow)),
      emphasize: true,
    },
    {
      label: 'Closing Cash',
      values: engineResult.integrationResults.map((month) => month.bs.cash),
      total: lastMonth?.bs.cash ?? 0,
      emphasize: true,
    },
  ];

  const complianceByMonth = new Map(
    forecastMonthLabels.map((monthLabel, index) => [
      monthLabel,
      {
        month: monthLabel,
        gst: engineResult.integrationResults[index]?.cf.gstPaid ?? 0,
        tds: engineResult.integrationResults[index]?.cf.tdsPaid ?? 0,
        pf: engineResult.integrationResults[index]?.cf.pfPaid ?? 0,
        esi: engineResult.integrationResults[index]?.cf.esiPaid ?? 0,
        advanceTax: engineResult.integrationResults[index]?.cf.advanceTaxPaid ?? 0,
        total: 0,
      },
    ])
  );

  const complianceRows = Array.from(complianceByMonth.values()).map((row) => ({
    ...row,
    total: row.gst + row.tds + row.pf + row.esi + row.advanceTax,
  }));

  const scenarioSummary =
    baselineResult && selectedScenarioName
      ? {
          scenarioName: selectedScenarioName,
          rows: [
            {
              label: 'End Cash',
              base: baselineResult.integrationResults.at(-1)?.bs.cash ?? 0,
              scenario: engineResult.integrationResults.at(-1)?.bs.cash ?? 0,
            },
            {
              label: 'Net Profit',
              base: sum(baselineResult.integrationResults.map((month) => month.pl.netIncome)),
              scenario: sum(engineResult.integrationResults.map((month) => month.pl.netIncome)),
            },
            {
              label: 'Revenue',
              base: sum(baselineResult.integrationResults.map((month) => month.pl.revenue)),
              scenario: sum(engineResult.integrationResults.map((month) => month.pl.revenue)),
            },
          ],
        }
      : null;

  return {
    companyName,
    periodLabel,
    forecastMonthLabels,
    notes,
    logoDataUrl,
    executiveSummary: {
      revenue: sum(revenueSeries),
      netProfit: sum(netProfitSeries),
      cashOnHand: lastMonth?.bs.cash ?? 0,
      workingCapitalGap,
    },
    pnlRows: [
      ...revenueAccountRows,
      { label: 'Revenue', values: revenueSeries, total: sum(revenueSeries), emphasize: true },
      ...cogsAccountRows,
      { label: 'COGS', values: cogsSeries, total: sum(cogsSeries), emphasize: true },
      { label: 'Gross Profit', values: grossProfitSeries, total: sum(grossProfitSeries), emphasize: true },
      ...expenseAccountRows,
      { label: 'Operating Expenses', values: expenseSeries, total: sum(expenseSeries), emphasize: true },
      { label: 'Operating Profit', values: operatingProfitSeries, total: sum(operatingProfitSeries), emphasize: true },
      { label: 'Net Profit', values: netProfitSeries, total: sum(netProfitSeries), emphasize: true },
    ],
    balanceSheetRows,
    cashFlowRows,
    complianceRows,
    scenarioSummary,
  };
}
