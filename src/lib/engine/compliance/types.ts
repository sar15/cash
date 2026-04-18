import type { ThreeWayMonth } from '../three-way/builder';

export interface ComplianceMonthAdjustment {
  period: string;
  operatingCashDelta: number;
  employerExpenseAccrual: number;
  apReclassification: number;
  gstPayableDelta: number;
  gstReceivableDelta: number;
  tdsPayableDelta: number;
  advanceTaxAssetDelta: number;
  pfPayableDelta: number;
  esiPayableDelta: number;
  gstPaid: number;
  tdsPaid: number;
  advanceTaxPaid: number;
  pfPaid: number;
  esiPaid: number;
  /** Monthly corporate income tax provision (PBT × taxRate / 12) — Fix 2.3 */
  corporateTaxProvision: number;
}

export interface ComplianceOpeningBalances {
  gstPayable?: number;
  gstReceivable?: number;
  tdsPayable?: number;
  advanceTaxPaid?: number;
  pfPayable?: number;
  esiPayable?: number;
  reclassifiedAp?: number;
}

export interface ComplianceAdjustedMonth extends Omit<ThreeWayMonth, 'bs' | 'cf'> {
  bs: ThreeWayMonth['bs'] & {
    gstPayable: number;
    gstReceivable: number;
    tdsPayable: number;
    advanceTaxPaid: number;
    pfPayable: number;
    esiPayable: number;
    /** Corporate income tax payable (accrued provision) — Fix 2.3 */
    corporateTaxPayable: number;
  };
  cf: ThreeWayMonth['cf'] & {
    gstPaid: number;
    tdsPaid: number;
    advanceTaxPaid: number;
    pfPaid: number;
    esiPaid: number;
    complianceCashOut: number;
  };
}

export function createZeroAdjustment(period: string): ComplianceMonthAdjustment {
  return {
    period,
    operatingCashDelta: 0,
    employerExpenseAccrual: 0,
    apReclassification: 0,
    gstPayableDelta: 0,
    gstReceivableDelta: 0,
    tdsPayableDelta: 0,
    advanceTaxAssetDelta: 0,
    pfPayableDelta: 0,
    esiPayableDelta: 0,
    gstPaid: 0,
    tdsPaid: 0,
    advanceTaxPaid: 0,
    pfPaid: 0,
    esiPaid: 0,
    corporateTaxProvision: 0,
  };
}

const ADJUSTMENT_KEYS: Array<keyof Omit<ComplianceMonthAdjustment, 'period'>> = [
  'operatingCashDelta',
  'employerExpenseAccrual',
  'apReclassification',
  'gstPayableDelta',
  'gstReceivableDelta',
  'tdsPayableDelta',
  'advanceTaxAssetDelta',
  'pfPayableDelta',
  'esiPayableDelta',
  'gstPaid',
  'tdsPaid',
  'advanceTaxPaid',
  'pfPaid',
  'esiPaid',
  'corporateTaxProvision',
];

export function mergeComplianceAdjustments(
  periods: string[],
  ...adjustmentSets: ComplianceMonthAdjustment[][]
): ComplianceMonthAdjustment[] {
  const merged = new Map(periods.map((period) => [period, createZeroAdjustment(period)]));

  adjustmentSets.forEach((set) => {
    set.forEach((adjustment) => {
      const bucket = merged.get(adjustment.period);
      if (!bucket) {
        return;
      }

      ADJUSTMENT_KEYS.forEach((key) => {
        bucket[key] += adjustment[key];
      });
    });
  });

  return periods.map((period) => merged.get(period) ?? createZeroAdjustment(period));
}
