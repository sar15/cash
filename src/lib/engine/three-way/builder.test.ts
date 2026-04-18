import { describe, it, expect } from 'vitest';
import { runThreeWayIntegration } from './builder';

describe('Three-Way Integrator — Schedule III / AS 3', () => {
  it('balances the three-way model perfectly within 1 paise', () => {
    // Revenue = 100,000. Cash collected = 30,000.
    // COGS = 50,000. Cash paid = 20,000.
    // Expenses = 10,000. Cash paid = 10,000.
    //
    // PBT = 100000 - 50000 - 10000 = 40000 (no tax in this test)
    // PAT = 40000
    // Retained Earnings change = 40000
    //
    // Cash Flow = +30000 - 20000 - 10000 = 0
    // Opening Cash = 50000 → Closing Cash = 50000
    //
    // AR change = +100000 - 30000 = +70000
    // AP change = +50000 - 20000 = +30000
    //
    // Balance Sheet:
    // Assets = Cash(50000) + AR(70000) = 120000
    // Liabilities = AP(30000)
    // Equity = RE(40000) + Share Capital(50000) = 90000
    // Total L+E = 30000 + 90000 = 120000 ✓

    const openingBalances = {
      cash: 50000,
      ar: 0,
      ap: 0,
      equity: 50000,
      retainedEarnings: 0,
    };

    const monthlyInputs = [
      {
        revenue: 100000, cashIn: 30000,
        cogs: 50000, cogsPaid: 20000,
        expense: 10000, expensePaid: 10000,
      }
    ];

    const result = runThreeWayIntegration(openingBalances, monthlyInputs);

    expect(result.length).toBe(1);
    const m1 = result[0];

    // ── P&L checks ──────────────────────────────────────────────────────────
    // Schedule III fields
    expect(m1.pl.profitBeforeTax).toBe(40000);
    expect(m1.pl.taxExpense).toBe(0);
    expect(m1.pl.profitAfterTax).toBe(40000);
    // Backward compat alias
    expect(m1.pl.netIncome).toBe(40000);
    // Gross profit (management metric)
    expect(m1.pl.grossProfit).toBe(50000);

    // ── CF checks ───────────────────────────────────────────────────────────
    expect(m1.cf.netCashFlow).toBe(0);
    expect(m1.cf.netOperatingCF).toBe(0);
    expect(m1.cf.closingCash).toBe(50000);

    // ── BS checks ───────────────────────────────────────────────────────────
    expect(m1.bs.cash).toBe(50000);
    expect(m1.bs.totalAssets).toBe(120000);
    expect(m1.bs.totalLiabilities).toBe(30000);
    expect(m1.bs.totalEquity).toBe(90000);
    // Schedule III fields
    expect(m1.bs.shareCapital).toBe(50000);
    expect(m1.bs.retainedEarnings).toBe(40000);
    expect(m1.bs.tradeReceivables).toBe(70000);

    // ── Three-Way Balance Laws ───────────────────────────────────────────────
    // Law 1: |closingCash - (openingCash + netCF)| ≤ 1
    const cashDiff = Math.abs(m1.bs.cash - (openingBalances.cash + m1.cf.netCashFlow));
    expect(cashDiff).toBeLessThanOrEqual(1);

    // Law 2: Total Assets === Total Liabilities + Total Equity (within 1 paise)
    const bsDiff = Math.abs(m1.bs.totalAssets - (m1.bs.totalLiabilities + m1.bs.totalEquity));
    expect(bsDiff).toBeLessThanOrEqual(1);

    // Law 3: PAT === Change in Retained Earnings (no dividends in this test)
    const reDiff = Math.abs(m1.pl.profitAfterTax - (m1.bs.retainedEarnings - openingBalances.retainedEarnings));
    expect(reDiff).toBeLessThanOrEqual(1);

    // Law 4: CF closing cash === BS cash
    expect(Math.abs(m1.cf.closingCash - m1.bs.cash)).toBeLessThanOrEqual(1);
  });

  it('allows negative cash (overdraft)', () => {
    const openingBalances = {
      cash: 10000,
      ar: 0,
      ap: 0,
      equity: 10000,
      retainedEarnings: 0,
    };

    const monthlyInputs = [
      {
        revenue: 0, cashIn: 0,
        cogs: 0, cogsPaid: 0,
        expense: 50000, expensePaid: 50000,
      }
    ];

    const result = runThreeWayIntegration(openingBalances, monthlyInputs);
    const m1 = result[0];

    expect(m1.bs.cash).toBe(-40000);
    expect(m1.cf.netCashFlow).toBe(-50000);
    expect(m1.pl.profitAfterTax).toBe(-50000);

    const cashDiff = Math.abs(m1.bs.cash - (openingBalances.cash + m1.cf.netCashFlow));
    expect(cashDiff).toBeLessThanOrEqual(1);

    const bsDiff = Math.abs(m1.bs.totalAssets - (m1.bs.totalLiabilities + m1.bs.totalEquity));
    expect(bsDiff).toBeLessThanOrEqual(1);
  });

  it('correctly handles dividends — RE = Opening RE + PAT - Dividends', () => {
    const openingBalances = {
      cash: 100000,
      ar: 0,
      ap: 0,
      equity: 100000,
      retainedEarnings: 50000,
    };

    const monthlyInputs = [
      {
        revenue: 80000, cashIn: 80000,
        cogs: 0, cogsPaid: 0,
        expense: 20000, expensePaid: 20000,
        dividendsPaid: 10000,
      }
    ];

    const result = runThreeWayIntegration(openingBalances, monthlyInputs);
    const m1 = result[0];

    // PAT = 80000 - 20000 = 60000
    expect(m1.pl.profitAfterTax).toBe(60000);
    // RE = 50000 + 60000 - 10000 = 100000
    expect(m1.bs.retainedEarnings).toBe(100000);

    // BS balance
    const bsDiff = Math.abs(m1.bs.totalAssets - (m1.bs.totalLiabilities + m1.bs.totalEquity));
    expect(bsDiff).toBeLessThanOrEqual(1);
  });

  it('correctly handles inventories — buildup reduces operating CF', () => {
    const openingBalances = {
      cash: 100000,
      ar: 0,
      ap: 0,
      equity: 100000,
      retainedEarnings: 0,
      inventories: 0,
    };

    const monthlyInputs = [
      {
        revenue: 50000, cashIn: 50000,
        cogs: 30000, cogsPaid: 30000,
        expense: 0, expensePaid: 0,
        // Inventory builds up by 20000 (cash outflow)
        inventoriesBalance: 20000,
      }
    ];

    const result = runThreeWayIntegration(openingBalances, monthlyInputs);
    const m1 = result[0];

    // Inventory buildup = -20000 in CF (cash out)
    expect(m1.cf.operatingIndirect.changeInInventories).toBe(-20000);
    // BS inventories = 20000
    expect(m1.bs.inventories).toBe(20000);
    // BS balance
    const bsDiff = Math.abs(m1.bs.totalAssets - (m1.bs.totalLiabilities + m1.bs.totalEquity));
    expect(bsDiff).toBeLessThanOrEqual(1);
  });
});
