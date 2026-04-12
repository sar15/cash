export type TimingProfileType = 'receivables' | 'payables';

// Representing fractions adding up to 1.0
export interface BaseTimingProfile {
  type: TimingProfileType;
  accountId: string; // The account to which this timing profile is applied
  // For receivables, month_0 is % collected in same month, month_1 is % collected in next month, etc.
  // We represent them as ratios (e.g. 0.30 for 30%)
  month_0?: number;
  month_1?: number;
  month_2?: number;
  month_3?: number;
  month_4?: number;
  month_5?: number;
  month_6?: number;
  bad_debt?: number; // Bad debt percentage (e.g., 0.02 for 2%) - permanently remains receivable
}

export interface ReceivablesTimingProfile extends BaseTimingProfile {
  type: 'receivables';
}

export interface PayablesTimingProfile extends BaseTimingProfile {
  type: 'payables';
}

export type AnyTimingProfileConfig = ReceivablesTimingProfile | PayablesTimingProfile;

export function validateTimingProfile(profile: BaseTimingProfile): boolean {
  const sum = 
    (profile.month_0 || 0) +
    (profile.month_1 || 0) +
    (profile.month_2 || 0) +
    (profile.month_3 || 0) +
    (profile.month_4 || 0) +
    (profile.month_5 || 0) +
    (profile.month_6 || 0) +
    (profile.bad_debt || 0);
  
  // Use a small epsilon for floating point comparison to 1.0
  return Math.abs(sum - 1.0) < 0.001;
}
