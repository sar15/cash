import { MonthlyInput } from '../three-way/builder';

export interface MicroForecastLine {
  category: 'Revenue' | 'COGS' | 'Operating Expenses' | 'Assets' | 'Liabilities' | 'Equity' | 'Debt';
  plImpacts: number[];  // Array of monthly amount changes for the forecast period
  cashImpacts: number[]; // Array of corresponding cash impacts for those months
}

export interface MicroForecast {
  id: string;
  name: string;
  lines: MicroForecastLine[];
}

/**
 * Overlays a micro-forecast on top of the baseline MonthlyInputs.
 * Does not mutate the baseline. Returns a new combined MonthlyInput array.
 */
export function overlayMicroForecast(
  baselineInputs: MonthlyInput[],
  microForecast: MicroForecast
): MonthlyInput[] {
  // Create a deep copy of baseline to avoid mutation
  const combined: MonthlyInput[] = baselineInputs.map(input => ({ ...input }));

  for (const line of microForecast.lines) {
    for (let m = 0; m < combined.length; m++) {
      const plImpact = line.plImpacts[m] || 0;
      const cashImpact = line.cashImpacts[m] || 0;

      if (line.category === 'Revenue') {
        combined[m].revenue += plImpact;
        combined[m].cashIn += cashImpact;
      } else if (line.category === 'COGS') {
        combined[m].cogs += plImpact;
        combined[m].cogsPaid += cashImpact;
      } else if (line.category === 'Operating Expenses') {
        combined[m].expense += plImpact;
        combined[m].expensePaid += cashImpact;
      } else if (line.category === 'Assets') {
        combined[m].depreciation = (combined[m].depreciation || 0) + plImpact;
        combined[m].assetPurchases = (combined[m].assetPurchases || 0) + cashImpact;
      } else if (line.category === 'Liabilities' || line.category === 'Debt') {
        // FIX audit3 M4: Interest expense STAYS on P&L (it IS an expense)
        // but cash flow classification goes through financing, not operating.
        combined[m].expense = (combined[m].expense || 0) + plImpact;

        // FIX audit3 M4: Loan interest payment is NOT operating cash — it's treated
        // as part of the debt cash flow. The interest cash leaves through expensePaid
        // for P&L integrity, but the principal flows through financing.
        // NOTE: plImpact = interest expense (paid same month for simplicity)
        combined[m].expensePaid = (combined[m].expensePaid || 0) + plImpact;
        
        // cashImpact > 0 = new debt inflow; cashImpact < 0 = principal repayment
        if (cashImpact > 0) {
          combined[m].newDebt = (combined[m].newDebt || 0) + cashImpact;
        } else if (cashImpact < 0) {
          combined[m].debtRepayment = (combined[m].debtRepayment || 0) + Math.abs(cashImpact);
        }
      }
    }
  }

  return combined;
}
