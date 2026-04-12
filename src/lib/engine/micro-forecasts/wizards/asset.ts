import { MicroForecast, MicroForecastLine } from '../overlay';

export interface AssetWizardInputs {
  assetName: string;
  purchaseAmount: number; // in paise
  purchaseMonth: string;
  usefulLifeMonths: number;
  salvageValue: number;
  /** If true, depreciation starts in the purchase month (default: false = next month) */
  depreciateFromPurchaseMonth?: boolean;
}

export function generateAssetMicroForecast(
  id: string,
  inputs: AssetWizardInputs,
  forecastMonths: string[]
): MicroForecast {
  const plImpacts = new Array(forecastMonths.length).fill(0); // Depreciation
  const cashImpacts = new Array(forecastMonths.length).fill(0); // Capex

  const depreciableAmount = inputs.purchaseAmount - inputs.salvageValue;
  const monthlyDepreciation = Math.round(depreciableAmount / inputs.usefulLifeMonths);

  // FIX audit3 M3: Depreciation starts the month AFTER purchase (configurable)
  const startNextMonth = !(inputs.depreciateFromPurchaseMonth ?? false);
  let active = false;
  let depreciationStarted = false;
  let remainingLife = inputs.usefulLifeMonths;
  // Track total depreciation for final month adjustment
  let totalDepreciated = 0;

  for (let i = 0; i < forecastMonths.length; i++) {
    if (forecastMonths[i] === inputs.purchaseMonth) {
      active = true;
      cashImpacts[i] = inputs.purchaseAmount; // Immediate cash outflow for capex
      if (!startNextMonth) {
        depreciationStarted = true;
      }
    } else if (active && !depreciationStarted) {
      // First month after purchase — start depreciation
      depreciationStarted = true;
    }

    if (depreciationStarted && remainingLife > 0) {
      // FIX audit1 asset rounding: final month gets the remainder to ensure no paise drift
      if (remainingLife === 1) {
        plImpacts[i] = depreciableAmount - totalDepreciated;
      } else {
        plImpacts[i] = monthlyDepreciation;
      }
      totalDepreciated += plImpacts[i];
      remainingLife--;
    }
  }

  const line: MicroForecastLine = {
    category: 'Assets',
    plImpacts,  // Treat as depreciation
    cashImpacts // Treat as capex
  };

  return {
    id,
    name: `Asset: ${inputs.assetName}`,
    lines: [line]
  };
}
