import { describe, it, expect } from 'vitest';
import { runThreeWayIntegration } from './builder';

describe('Three-Way Integrator', () => {
  it('balances the three-way model perfectly within 1 paise', () => {
    // We mock a very basic scenario
    // Revenue = 100,000. Cash collected = 30,000.
    // COGS = 50,000. Cash paid = 20,000.
    // Expenses = 10,000. Cash paid = 10,000.
    
    // Net profit = 100000 - 50000 - 10000 = 40000.
    // Retained Earnings change = 40000.
    
    // Cash Flow = +30000 - 20000 - 10000 = 0.
    // Opening Cash = 50000.
    // Closing Cash should be 50000 + 0 = 50000.
    
    // AR change = +100000 - 30000 = +70000.
    // AP change = +50000 - 20000 = +30000.
    
    // Balance Sheet check:
    // Assets = Cash(50000) + AR(70000) = 120000.
    // Liabilities = AP(30000)
    // Equity = Retained Earnings(40000) + Paid-In Capital(50000 from opening)
    // Total L+E = 30000 + 40000 + 50000 = 120000.
    // Assets = L + E.
    
    const openingBalances = {
      cash: 50000,
      ar: 0,
      ap: 0,
      equity: 50000,
      retainedEarnings: 0
    };
    
    const monthlyInputs = [
      {
        revenue: 100000, cashIn: 30000, // AR delta = 70000
        cogs: 50000, cogsPaid: 20000,   // AP delta = 30000
        expense: 10000, expensePaid: 10000 // No AP delta
      }
    ];
    
    const result = runThreeWayIntegration(openingBalances, monthlyInputs);
    
    expect(result.length).toBe(1);
    
    const m1 = result[0];
    
    // Check P&L Output
    expect(m1.pl.netIncome).toBe(40000);
    
    // Check Cash Flow
    expect(m1.cf.netCashFlow).toBe(0);
    expect(m1.cf.operatingCashFlow).toBe(0); 
    
    // Check BS Outuput
    expect(m1.bs.cash).toBe(50000);
    expect(m1.bs.totalAssets).toBe(120000);
    expect(m1.bs.totalLiabilities).toBe(30000);
    expect(m1.bs.totalEquity).toBe(90000);
    
    // RULE 2: Three-Way Balance Law Checks
    // |closingCash - (openingCash + netCF)| <= 1
    const cashDiff = Math.abs(m1.bs.cash - (openingBalances.cash + m1.cf.netCashFlow));
    expect(cashDiff).toBeLessThanOrEqual(1);
    
    // Total Assets === Total Liabilities + Total Equity
    const bsDiff = Math.abs(m1.bs.totalAssets - (m1.bs.totalLiabilities + m1.bs.totalEquity));
    expect(bsDiff).toBeLessThanOrEqual(1);
    
    // Net Income === Change in Retained Earnings
    const reDiff = Math.abs(m1.pl.netIncome - (m1.bs.retainedEarnings - openingBalances.retainedEarnings));
    expect(reDiff).toBeLessThanOrEqual(1);
  });
  
  it('allows negative cash (overdraft)', () => {
    const openingBalances = {
      cash: 10000,
      ar: 0,
      ap: 0,
      equity: 10000,
      retainedEarnings: 0
    };
    
    const monthlyInputs = [
      {
        revenue: 0, cashIn: 0,
        cogs: 0, cogsPaid: 0,
        expense: 50000, expensePaid: 50000 // Huge immediate drain
      }
    ];
    
    const result = runThreeWayIntegration(openingBalances, monthlyInputs);
    
    const m1 = result[0];
    
    expect(m1.bs.cash).toBe(-40000);
    expect(m1.cf.netCashFlow).toBe(-50000);
    
    // Check rule 2 balances
    const cashDiff = Math.abs(m1.bs.cash - (openingBalances.cash + m1.cf.netCashFlow));
    expect(cashDiff).toBeLessThanOrEqual(1);

    const bsDiff = Math.abs(m1.bs.totalAssets - (m1.bs.totalLiabilities + m1.bs.totalEquity));
    expect(bsDiff).toBeLessThanOrEqual(1);
  });
});
