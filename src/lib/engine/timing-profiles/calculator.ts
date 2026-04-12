import { BaseTimingProfile, validateTimingProfile } from './types';

export interface TimingProfileResult {
  cashFlows: number[];
  balances: number[]; // e.g. AR or AP balances at the end of each forecast month
}

export function applyTimingProfile(
  historicalValues: number[],
  forecastValues: number[],
  profile: BaseTimingProfile
): TimingProfileResult {
  if (!validateTimingProfile(profile)) {
    throw new Error(`[Engine] Timing profile for ${profile.accountId} does not sum to 1.0`);
  }

  const profileArray = [
    profile.month_0 || 0,
    profile.month_1 || 0,
    profile.month_2 || 0,
    profile.month_3 || 0,
    profile.month_4 || 0,
    profile.month_5 || 0,
    profile.month_6 || 0,
  ];
  
  const badDebt = profile.bad_debt || 0;

  // Implied opening balance at the start of the forecast
  // The uncollected portion of historical values.
  // FIX audit3 TP1: Round each intermediate multiplication to prevent float drift
  let openingBalance = 0;
  for (let i = 0; i < historicalValues.length; i++) {
    const monthsAgo = historicalValues.length - 1 - i;
    let uncollectedFraction = badDebt;
    for (let j = monthsAgo + 1; j < profileArray.length; j++) {
      uncollectedFraction += profileArray[j];
    }
    // Round each product individually to prevent cumulative drift
    openingBalance += Math.round(historicalValues[i] * uncollectedFraction);
  }

  const cashFlows: number[] = [];
  const balances: number[] = [];
  let currentBalance = openingBalance;

  // Full array we can sample from (history + forecast)
  const allValues = [...historicalValues, ...forecastValues];
  const historyLen = historicalValues.length;

  for (let f = 0; f < forecastValues.length; f++) {
    const currentMonthIndex = historyLen + f;
    const currentRevenue = forecastValues[f];
    
    // Calculate cash collected THIS month
    let cashCollected = 0;
    
    // FIX audit3 TP2: Round each multiplication to prevent cumulative float drift
    for (let p = 0; p < profileArray.length; p++) {
      const targetMonthIndex = currentMonthIndex - p;
      if (targetMonthIndex >= 0) {
        cashCollected += Math.round(allValues[targetMonthIndex] * profileArray[p]);
      }
    }
    
    const roundedCash = Math.round(cashCollected);
    cashFlows.push(roundedCash);
    
    // Balance delta: goes up by revenue recognized, goes down by cash collected
    currentBalance = currentBalance + currentRevenue - roundedCash;
    balances.push(currentBalance);
  }

  return { cashFlows, balances };
}
