import { expect } from 'vitest';
import type { ThreeWayMonth } from '../three-way/builder';

/** Convert lakh amount to paise. e.g. lakh(1.5) = 1,50,00,000 paise */
export function lakh(rupees: number): number {
  return Math.round(rupees * 10_000_000);
}

/**
 * Convert a rupee amount to paise. e.g. rupees(50_000) = 50,00,000 paise.
 * FIX audit1: Name is slightly misleading — it takes rupees and returns PAISE.
 * Use rupeesToPaise() if you prefer an explicit name.
 */
export function rupees(amount: number): number {
  return Math.round(amount * 100);
}

/** Explicit alias for rupees() — converts rupee amount to paise. */
export const rupeesToPaise = rupees;

export function assertThreeWayBalances(
  months: Array<
    ThreeWayMonth & {
      bs: ThreeWayMonth['bs'] & {
        gstPayable?: number;
        gstReceivable?: number;
        tdsPayable?: number;
        advanceTaxPaid?: number;
        pfPayable?: number;
        esiPayable?: number;
      };
    }
  >,
  openingCash: number
): void {
  let runningCash = openingCash;

  months.forEach((month) => {
    runningCash += month.cf.netCashFlow;

    expect(Math.abs(month.bs.cash - runningCash)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(month.bs.totalAssets - (month.bs.totalLiabilities + month.bs.totalEquity))
    ).toBeLessThanOrEqual(1);
  });
}
