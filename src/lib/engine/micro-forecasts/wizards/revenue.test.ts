import { describe, it, expect } from 'vitest';
import { generateRevenueMicroForecast } from './revenue';

const LAKH = 10_000_000;

describe('Revenue Wizard Engine', () => {
  it('Should generate correct plImpacts and cashImpacts with GST', () => {
    const inputs = {
      clientName: 'Acme Corp',
      monthlyAmount: 2 * LAKH, // 2L ex-GST
      startMonth: 'Aug-25',
      gstRate: 18,
    };

    const forecastMonths = [
      "Apr-25", "May-25", "Jun-25", "Jul-25", "Aug-25", "Sep-25",
      "Oct-25", "Nov-25", "Dec-25", "Jan-26", "Feb-26", "Mar-26"
    ];

    const result = generateRevenueMicroForecast('mf-revenue', inputs, forecastMonths);

    expect(result.id).toBe('mf-revenue');
    expect(result.name).toBe('New Client: Acme Corp');
    expect(result.lines.length).toBe(1);

    const line = result.lines[0];
    expect(line.category).toBe('Revenue');

    // Before Aug-25 (0 to 3) should be 0 impact
    for (let i = 0; i < 4; i++) {
        expect(line.plImpacts[i]).toBe(0);
        expect(line.cashImpacts[i]).toBe(0);
    }

    // P&L is always ex-GST
    for (let i = 4; i < 12; i++) {
        expect(line.plImpacts[i]).toBe(2 * LAKH);
    }

    // FIX: Cash now includes GST — customer pays GST-inclusive amount
    // 2L + 18% GST = 2L + 0.36L = 2.36L
    const expectedCashPerMonth = 2 * LAKH + Math.round(2 * LAKH * 18 / 100); // 23600000 paise
    for (let i = 4; i < 12; i++) {
        expect(line.cashImpacts[i]).toBe(expectedCashPerMonth);
    }
  });

  it('Should support partial same-month collection', () => {
    const inputs = {
      clientName: 'Big Corp',
      monthlyAmount: 10 * LAKH,
      startMonth: 'Apr-25',
      gstRate: 18,
      collectionPctSameMonth: 70, // 70% same month, 30% next
    };

    const forecastMonths = ["Apr-25", "May-25", "Jun-25"];

    const result = generateRevenueMicroForecast('mf-rev-partial', inputs, forecastMonths);
    const line = result.lines[0];

    // P&L is ex-GST
    expect(line.plImpacts[0]).toBe(10 * LAKH);

    // Total cash = 10L + 18% = 11.8L = 118000000 paise
    const totalCash = 10 * LAKH + Math.round(10 * LAKH * 18 / 100);
    const sameMonthCash = Math.round(totalCash * 0.7);
    const nextMonthCash = totalCash - sameMonthCash;

    // Month 0: 70% of 11.8L
    expect(line.cashImpacts[0]).toBe(sameMonthCash);
    // Month 1: 30% of month-0 revenue + 70% of month-1 revenue
    expect(line.cashImpacts[1]).toBe(nextMonthCash + sameMonthCash);
  });
});
