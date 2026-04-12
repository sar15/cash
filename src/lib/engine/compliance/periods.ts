export function buildPeriodIndexMap(periods: string[]): Map<string, number> {
  return new Map(periods.map((period, index) => [period, index]));
}

export function parsePeriod(period: string): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function formatDate(date: Date, day: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');

  return `${year}-${month}-${paddedDay}`;
}

export function getFollowingMonthDueDate(period: string, day: number): string {
  const date = parsePeriod(period);
  const followingMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return formatDate(followingMonth, day);
}

export function getFollowingMonthPeriod(period: string): string {
  const date = parsePeriod(period);
  const followingMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const year = followingMonth.getFullYear();
  const month = String(followingMonth.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}-01`;
}
