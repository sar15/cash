import type { ThreeWayMonth } from '../three-way/builder';
import {
  ComplianceAdjustedMonth,
  ComplianceMonthAdjustment,
  ComplianceOpeningBalances,
  mergeComplianceAdjustments,
} from './types';

interface ApplyComplianceAdjustmentsInput {
  periods: string[];
  baseMonths: ThreeWayMonth[];
  adjustments: ComplianceMonthAdjustment[];
  openingBalances?: ComplianceOpeningBalances;
}

export function applyComplianceAdjustments({
  periods,
  baseMonths,
  adjustments,
  openingBalances,
}: ApplyComplianceAdjustmentsInput): ComplianceAdjustedMonth[] {
  const mergedAdjustments = mergeComplianceAdjustments(periods, adjustments);

  const runningBalances = {
    gstPayable: openingBalances?.gstPayable ?? 0,
    gstReceivable: openingBalances?.gstReceivable ?? 0,
    tdsPayable: openingBalances?.tdsPayable ?? 0,
    advanceTaxPaid: openingBalances?.advanceTaxPaid ?? 0,
    pfPayable: openingBalances?.pfPayable ?? 0,
    esiPayable: openingBalances?.esiPayable ?? 0,
    reclassifiedAp: openingBalances?.reclassifiedAp ?? 0,
    cumulativeCashDelta: 0,
    cumulativeEmployerExpense: 0,
  };

  return baseMonths.map((month, index) => {
    const adjustment = mergedAdjustments[index];

    runningBalances.gstPayable += adjustment.gstPayableDelta;
    runningBalances.gstReceivable += adjustment.gstReceivableDelta;
    runningBalances.tdsPayable += adjustment.tdsPayableDelta;
    runningBalances.advanceTaxPaid += adjustment.advanceTaxAssetDelta;
    runningBalances.pfPayable += adjustment.pfPayableDelta;
    runningBalances.esiPayable += adjustment.esiPayableDelta;
    runningBalances.reclassifiedAp += adjustment.apReclassification;

    const complianceCashOut =
      adjustment.gstPaid +
      adjustment.tdsPaid +
      adjustment.advanceTaxPaid +
      adjustment.pfPaid +
      adjustment.esiPaid;
    const netCashDelta = adjustment.operatingCashDelta - complianceCashOut;
    runningBalances.cumulativeCashDelta += netCashDelta;
    runningBalances.cumulativeEmployerExpense += adjustment.employerExpenseAccrual;

    const adjustedExpense = month.pl.expense + adjustment.employerExpenseAccrual;
    const adjustedNetIncome = month.pl.netIncome - adjustment.employerExpenseAccrual;
    const adjustedCash = month.bs.cash + runningBalances.cumulativeCashDelta;
    const adjustedAp = month.bs.ap - runningBalances.reclassifiedAp;
    const adjustedRetainedEarnings =
      month.bs.retainedEarnings - runningBalances.cumulativeEmployerExpense;
    const netFixedAssets = month.bs.fixedAssets - month.bs.accDepreciation;
    const adjustedTotalAssets =
      adjustedCash +
      month.bs.ar +
      netFixedAssets +
      runningBalances.gstReceivable +
      runningBalances.advanceTaxPaid;
    const adjustedTotalLiabilities =
      adjustedAp +
      month.bs.debt +
      runningBalances.gstPayable +
      runningBalances.tdsPayable +
      runningBalances.pfPayable +
      runningBalances.esiPayable;
    const adjustedTotalEquity = month.bs.equity + adjustedRetainedEarnings;

    return {
      pl: {
        ...month.pl,
        expense: adjustedExpense,
        netIncome: adjustedNetIncome,
      },
      cf: {
        ...month.cf,
        cashIn:
          month.cf.cashIn + (adjustment.operatingCashDelta > 0 ? adjustment.operatingCashDelta : 0),
        cashOut:
          month.cf.cashOut +
          complianceCashOut +
          (adjustment.operatingCashDelta < 0 ? Math.abs(adjustment.operatingCashDelta) : 0),
        operatingCashFlow: month.cf.operatingCashFlow + netCashDelta,
        netCashFlow: month.cf.netCashFlow + netCashDelta,
        gstPaid: adjustment.gstPaid,
        tdsPaid: adjustment.tdsPaid,
        advanceTaxPaid: adjustment.advanceTaxPaid,
        pfPaid: adjustment.pfPaid,
        esiPaid: adjustment.esiPaid,
        complianceCashOut,
      },
      bs: {
        ...month.bs,
        cash: adjustedCash,
        ap: adjustedAp,
        retainedEarnings: adjustedRetainedEarnings,
        totalAssets: adjustedTotalAssets,
        totalLiabilities: adjustedTotalLiabilities,
        totalEquity: adjustedTotalEquity,
        gstPayable: runningBalances.gstPayable,
        gstReceivable: runningBalances.gstReceivable,
        tdsPayable: runningBalances.tdsPayable,
        advanceTaxPaid: runningBalances.advanceTaxPaid,
        pfPayable: runningBalances.pfPayable,
        esiPayable: runningBalances.esiPayable,
      },
    };
  });
}
