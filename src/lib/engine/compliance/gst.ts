import { multiplyByPct } from '../../utils/math';
import { buildPeriodIndexMap, getFollowingMonthDueDate, getFollowingMonthPeriod } from './periods';
import { ComplianceMonthAdjustment, createZeroAdjustment } from './types';

type SupplyType = 'intra-state' | 'inter-state';

interface GSTForecastInput {
  periods: string[];
  taxableRevenue: number[];
  taxablePurchases: number[];
  outputRatePct?: number;
  inputTaxCreditPct?: number;
  supplyType?: SupplyType;
}

export interface GSTForecastMonth {
  period: string;
  outputGST: number;
  outputCGST: number;
  outputSGST: number;
  outputIGST: number;
  inputGST: number;
  inputCGST: number;
  inputSGST: number;
  inputIGST: number;
  creditUsed: number;
  netPayable: number;
  closingReceivable: number;
  dueDate: string;
  paymentPeriod?: string;
}

export interface GSTForecastResult {
  months: GSTForecastMonth[];
  adjustments: ComplianceMonthAdjustment[];
}

export function calculateGSTForecast({
  periods,
  taxableRevenue,
  taxablePurchases,
  outputRatePct = 18,
  inputTaxCreditPct = 85,
  supplyType = 'intra-state',
}: GSTForecastInput): GSTForecastResult {
  const periodIndexMap = buildPeriodIndexMap(periods);
  const adjustments = periods.map((period) => createZeroAdjustment(period));
  const months: GSTForecastMonth[] = [];
  let runningReceivable = 0;

  periods.forEach((period, index) => {
    const revenue = taxableRevenue[index] ?? 0;
    const purchases = taxablePurchases[index] ?? 0;
    const outputGST = multiplyByPct(revenue, outputRatePct);
    const grossInputGST = multiplyByPct(purchases, outputRatePct);
    const inputGST = multiplyByPct(grossInputGST, inputTaxCreditPct);
    const availableCredit = runningReceivable + inputGST;
    const creditUsed = Math.min(outputGST, availableCredit);
    const netPayable = Math.max(0, outputGST - availableCredit);
    const closingReceivable = availableCredit - creditUsed;

    adjustments[index].operatingCashDelta += outputGST - inputGST;
    adjustments[index].gstReceivableDelta += closingReceivable - runningReceivable;
    adjustments[index].gstPayableDelta += netPayable;

    const paymentPeriod = getFollowingMonthPeriod(period);
    const paymentIndex = periodIndexMap.get(paymentPeriod);

    if (paymentIndex !== undefined && netPayable > 0) {
      adjustments[paymentIndex].gstPayableDelta -= netPayable;
      adjustments[paymentIndex].gstPaid += netPayable;
    }

    runningReceivable = closingReceivable;

    const splitOutput = supplyType === 'intra-state' ? Math.floor(outputGST / 2) : 0;
    const splitInput = supplyType === 'intra-state' ? Math.floor(inputGST / 2) : 0;

    months.push({
      period,
      outputGST,
      outputCGST: supplyType === 'intra-state' ? splitOutput : 0,
      outputSGST: supplyType === 'intra-state' ? outputGST - splitOutput : 0,
      outputIGST: supplyType === 'inter-state' ? outputGST : 0,
      inputGST,
      inputCGST: supplyType === 'intra-state' ? splitInput : 0,
      inputSGST: supplyType === 'intra-state' ? inputGST - splitInput : 0,
      inputIGST: supplyType === 'inter-state' ? inputGST : 0,
      creditUsed,
      netPayable,
      closingReceivable,
      dueDate: getFollowingMonthDueDate(period, 20),
      paymentPeriod: paymentIndex === undefined ? undefined : paymentPeriod,
    });
  });

  return {
    months,
    adjustments,
  };
}
