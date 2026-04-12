import { describe, expect, it } from 'vitest';
import { generatePeriods } from '../../utils/date-utils';
import { runThreeWayIntegration } from '../three-way/builder';
import { applyComplianceAdjustments } from './apply';
import { calculateGSTForecast } from './gst';
import { assertThreeWayBalances, lakh, rupees } from './test-helpers';

describe('GST compliance engine', () => {
  it('splits intra-state GST, schedules payments on the 20th, and carries forward excess ITC as a receivable', () => {
    const periods = generatePeriods(new Date(2025, 3, 1), 3);
    const openingCash = lakh(25);

    const base = runThreeWayIntegration(
      {
        cash: openingCash,
        ar: 0,
        ap: 0,
        equity: openingCash,
        retainedEarnings: 0,
      },
      [
        {
          revenue: lakh(10),
          cashIn: lakh(10),
          cogs: lakh(6),
          cogsPaid: lakh(6),
          expense: lakh(1),
          expensePaid: lakh(1),
        },
        {
          revenue: 0,
          cashIn: 0,
          cogs: 0,
          cogsPaid: 0,
          expense: lakh(1),
          expensePaid: lakh(1),
        },
        {
          revenue: lakh(2),
          cashIn: lakh(2),
          cogs: lakh(4),
          cogsPaid: lakh(4),
          expense: rupees(50_000),
          expensePaid: rupees(50_000),
        },
      ]
    );

    const gst = calculateGSTForecast({
      periods,
      taxableRevenue: [lakh(10), 0, lakh(2)],
      taxablePurchases: [lakh(6), 0, lakh(4)],
      outputRatePct: 18,
      inputTaxCreditPct: 85,
      supplyType: 'intra-state',
    });

    expect(gst.months[0].outputGST).toBe(rupees(180_000));
    expect(gst.months[0].outputCGST).toBe(rupees(90_000));
    expect(gst.months[0].outputSGST).toBe(rupees(90_000));
    expect(gst.months[0].inputGST).toBe(rupees(91_800));
    expect(gst.months[0].inputCGST).toBe(rupees(45_900));
    expect(gst.months[0].inputSGST).toBe(rupees(45_900));
    expect(gst.months[0].netPayable).toBe(rupees(88_200));
    expect(gst.months[0].dueDate).toBe('2025-05-20');

    expect(gst.months[2].netPayable).toBe(0);
    expect(gst.months[2].closingReceivable).toBe(rupees(25_200));

    const withCompliance = applyComplianceAdjustments({
      periods,
      baseMonths: base,
      adjustments: gst.adjustments,
    });

    expect(withCompliance[0].bs.gstPayable).toBe(rupees(88_200));
    expect(withCompliance[1].cf.gstPaid).toBe(rupees(88_200));
    expect(withCompliance[1].bs.gstPayable).toBe(0);
    expect(withCompliance[2].bs.gstReceivable).toBe(rupees(25_200));

    assertThreeWayBalances(withCompliance, openingCash);
  });
});
