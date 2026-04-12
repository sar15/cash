const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

function getCurrentFyStartDate(fyStartMonth: number, now: Date) {
  const currentMonth = now.getMonth() + 1
  const year = currentMonth < fyStartMonth ? now.getFullYear() - 1 : now.getFullYear()
  return new Date(year, fyStartMonth - 1, 1)
}

export function formatMonthLabel(date: Date) {
  return `${MONTH_NAMES[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`
}

export function parseMonthLabel(label: string) {
  const [monthToken, yearToken] = label.split('-')
  const monthIndex = MONTH_NAMES.indexOf(monthToken as (typeof MONTH_NAMES)[number])
  const year = Number(`20${yearToken}`)

  if (monthIndex < 0 || Number.isNaN(year)) {
    return null
  }

  return new Date(year, monthIndex, 1)
}

export function buildForecastMonthLabels({
  fyStartMonth = 4,
  historicalPeriods = [],
  months = 12,
  now = new Date(),
}: {
  fyStartMonth?: number
  historicalPeriods?: string[]
  months?: number
  now?: Date
}) {
  const sortedPeriods = [...historicalPeriods]
    .filter((period) => /^\d{4}-\d{2}-01$/.test(period))
    .sort()

  const startDate =
    sortedPeriods.length > 0
      ? (() => {
          const [year, month] = sortedPeriods[sortedPeriods.length - 1].split('-').map(Number)
          return new Date(year, month, 1)
        })()
      : getCurrentFyStartDate(fyStartMonth, now)

  return Array.from({ length: months }, (_, index) =>
    formatMonthLabel(new Date(startDate.getFullYear(), startDate.getMonth() + index, 1))
  )
}

export function monthInputToLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) {
    return ''
  }

  return formatMonthLabel(new Date(year, month - 1, 1))
}
