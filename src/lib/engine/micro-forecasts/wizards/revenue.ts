import { MicroForecast, MicroForecastLine } from '../overlay';

export interface RevenueWizardInputs {
  clientName: string;
  monthlyAmount: number; // In paise (exclusive of GST)
  startMonth: string; // e.g. 'Aug-25'
  gstRate: number; // percentage (e.g. 18 for 18%)
  /** Collection % in same month (0-100). Default 100 for MVP. */
  collectionPctSameMonth?: number;
}

export function generateRevenueMicroForecast(
  id: string,
  inputs: RevenueWizardInputs,
  forecastMonths: string[]
): MicroForecast {
  const plImpacts = new Array(forecastMonths.length).fill(0);
  const cashImpacts = new Array(forecastMonths.length).fill(0);

  // FIX audit3 M2: Support for partial same-month collection
  const sameMonthPct = (inputs.collectionPctSameMonth ?? 100) / 100;

  let started = false;

  for (let i = 0; i < forecastMonths.length; i++) {
    if (forecastMonths[i] === inputs.startMonth) {
      started = true;
    }

    if (started) {
      // FIX audit1: GST rate is now used — revenue recognized is ex-GST
      // but cash collected includes GST (customer pays GST-inclusive amount)
      const gstOnRevenue = Math.round(inputs.monthlyAmount * inputs.gstRate / 100);
      const totalCashExpected = inputs.monthlyAmount + gstOnRevenue;

      plImpacts[i] = inputs.monthlyAmount; // P&L is always ex-GST

      // FIX audit3 M2: Apply timing profile awareness for cash
      const sameMonthCash = Math.round(totalCashExpected * sameMonthPct);
      const nextMonthCash = totalCashExpected - sameMonthCash;

      cashImpacts[i] += sameMonthCash;

      // Remainder collected in the next month
      if (nextMonthCash > 0 && i + 1 < forecastMonths.length) {
        cashImpacts[i + 1] += nextMonthCash;
      }
    }
  }

  const line: MicroForecastLine = {
    category: 'Revenue',
    plImpacts,
    cashImpacts
  };

  return {
    id,
    name: `New Client: ${inputs.clientName}`,
    lines: [line]
  };
}
