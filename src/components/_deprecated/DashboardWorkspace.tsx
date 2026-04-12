'use client';

import { AlertTriangle, ArrowUpRight, BadgeCheck, IndianRupee, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { CashWaterfallChart } from '@/components/dashboard/QuickCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentForecast } from '@/hooks/use-current-forecast';
import { formatDateIndian, formatLakhs } from '@/lib/utils/indian-format';

interface DashboardAlert {
  id: string;
  tone: 'warning' | 'success';
  title: string;
  detail: string;
}

function toPeriodFromLabel(label: string): string {
  const monthIndexByLabel: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  const [monthLabel, yearLabel] = label.split('-');
  const month = monthIndexByLabel[monthLabel];
  const year = Number(`20${yearLabel}`);

  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

function buildAlerts({
  engineResult,
  forecastMonthLabels,
  minimumCashThreshold,
  receivablesAlertThreshold,
}: {
  engineResult: NonNullable<ReturnType<typeof useCurrentForecast>['engineResult']>;
  forecastMonthLabels: string[];
  minimumCashThreshold: number;
  receivablesAlertThreshold: number;
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const lowCashMonthIndex = engineResult.integrationResults.findIndex(
    (month) => month.bs.cash < minimumCashThreshold
  );
  const lowCashMonth = lowCashMonthIndex >= 0 ? engineResult.integrationResults[lowCashMonthIndex] : null;

  if (lowCashMonth) {
    const lowCashPeriod = toPeriodFromLabel(forecastMonthLabels[lowCashMonthIndex] ?? forecastMonthLabels[0]);
    const relatedCompliance = engineResult.compliance.events.find(
      (event) => event.paymentPeriod === lowCashPeriod || event.sourcePeriod === lowCashPeriod
    );

    alerts.push({
      id: `cash-${lowCashMonthIndex}`,
      tone: 'warning',
      title: `Cash drops below ${formatLakhs(minimumCashThreshold, 1)} in ${forecastMonthLabels[lowCashMonthIndex]}`,
      detail: relatedCompliance
        ? `Projected before ${relatedCompliance.type} payment of ${formatLakhs(relatedCompliance.amount, 1)}.`
        : 'Projected closing cash falls below your minimum threshold.',
    });
  }

  const receivablesSpikeIndex = engineResult.integrationResults.findIndex(
    (month) => month.bs.ar > receivablesAlertThreshold
  );
  const receivablesSpike =
    receivablesSpikeIndex >= 0 ? engineResult.integrationResults[receivablesSpikeIndex] : null;

  if (receivablesSpike) {
    alerts.push({
      id: `receivables-${receivablesSpikeIndex}`,
      tone: 'warning',
      title: `Receivables exceed ${formatLakhs(receivablesAlertThreshold, 0)}`,
      detail: `Collection slowdown detected in ${forecastMonthLabels[receivablesSpikeIndex]} with AR at ${formatLakhs(receivablesSpike.bs.ar, 1)}.`,
    });
  }

  const firstGap = Math.max(0, (engineResult.integrationResults[0]?.bs.ar ?? 0) - (engineResult.integrationResults[0]?.bs.ap ?? 0));
  const lastMonth = engineResult.integrationResults.at(-1);
  const lastGap = Math.max(0, (lastMonth?.bs.ar ?? 0) - (lastMonth?.bs.ap ?? 0));

  if (lastGap < firstGap) {
    alerts.push({
      id: 'wc-improving',
      tone: 'success',
      title: 'Working capital gap closing',
      detail: `Gap improves from ${formatLakhs(firstGap, 1)} to ${formatLakhs(lastGap, 1)} across the forecast.`,
    });
  }

  engineResult.compliance.alerts.slice(0, 2).forEach((alert) => {
    alerts.push({
      id: alert.id,
      tone: 'warning',
      title: `${formatLakhs(alert.shortfall, 1)} short for ${alert.type}`,
      detail: `Due on ${formatDateIndian(new Date(alert.dueDate))} against a payment of ${formatLakhs(alert.amount, 1)}.`,
    });
  });

  return alerts.slice(0, 5);
}

export function DashboardWorkspace() {
  const { accounts, companyProfile, engineResult, hasHydrated, quickMetricThresholds, ready } =
    useCurrentForecast();

  if (!hasHydrated) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[360px]" />
        <Skeleton className="h-[260px]" />
      </div>
    );
  }

  if (!ready || !engineResult) {
    return (
      <EmptyState
        icon={Wallet}
        title="Upload your financial data to see your forecast"
        description="Complete the onboarding flow or use the demo dataset to turn the dashboard into a live decision surface."
        ctaHref="/data"
        ctaLabel="Start Setup"
      />
    );
  }

  const currentMonth = engineResult.integrationResults[0];
  const currentMonthLabel = engineResult.forecastMonths[0] ?? 'Current forecast month';
  const lastMonth = engineResult.integrationResults.at(-1);
  const closingCash = lastMonth?.bs.cash ?? 0;
  const thisMonthNetCashFlow = currentMonth?.cf.netCashFlow ?? 0;
  const previousCash = accounts.find((account) => account.id === 'ast-1')?.historicalValues.at(-1) ?? 0;
  const workingCapitalGap = (currentMonth?.bs.ar ?? 0) - (currentMonth?.bs.ap ?? 0);
  const grossMarginPct =
    currentMonth && currentMonth.pl.revenue > 0 ? (currentMonth.pl.grossProfit / currentMonth.pl.revenue) * 100 : 0;

  const metrics = [
    {
      title: 'Cash on Hand',
      value: formatLakhs(closingCash, 1),
      delta: closingCash - previousCash,
      icon: IndianRupee,
      danger: closingCash < 0,
      helper: 'End of forecast period',
      statusLabel: closingCash < 0 ? 'At risk' : 'Healthy',
    },
    {
      title: 'This Month Net Cash Flow',
      value: formatLakhs(thisMonthNetCashFlow, 1),
      delta: thisMonthNetCashFlow,
      icon: TrendingUp,
      danger: thisMonthNetCashFlow < 0,
      helper: currentMonthLabel,
      statusLabel: thisMonthNetCashFlow < 0 ? 'Outflow' : 'Inflow',
    },
    {
      title: 'Working Capital Gap',
      value: formatLakhs(workingCapitalGap, 1),
      delta: workingCapitalGap,
      icon: TrendingDown,
      danger: workingCapitalGap > 0,
      helper: currentMonthLabel,
      statusLabel: workingCapitalGap > 0 ? 'Gap open' : 'Covered',
    },
    {
      title: 'Gross Margin %',
      value: `${grossMarginPct.toFixed(1)}%`,
      delta: grossMarginPct,
      icon: ArrowUpRight,
      warning: grossMarginPct < 20,
      helper: currentMonthLabel,
      statusLabel: grossMarginPct < 20 ? 'Watch' : 'Stable',
    },
  ];

  const waterfallData = engineResult.integrationResults.map((month, index) => {
    const openingCash =
      index === 0
        ? accounts.find((account) => account.id === 'ast-1')?.historicalValues.at(-1) ?? 0
        : engineResult.integrationResults[index - 1].bs.cash;

    return {
      month: engineResult.forecastMonths[index] ?? `M${index + 1}`,
      openingCash,
      netCashFlow: month.cf.netCashFlow,
      closingCash: month.bs.cash,
      threshold: quickMetricThresholds.minimumCashThreshold,
      belowThreshold: month.bs.cash < quickMetricThresholds.minimumCashThreshold,
      barBase: Math.min(openingCash, month.bs.cash),
      barHeight: Math.abs(month.cf.netCashFlow),
    };
  });

  const alerts = buildAlerts({
    engineResult,
    forecastMonthLabels: engineResult.forecastMonths,
    minimumCashThreshold: quickMetricThresholds.minimumCashThreshold,
    receivablesAlertThreshold: quickMetricThresholds.receivablesAlertThreshold,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Decision surface for <span className="font-medium text-foreground">{companyProfile.name}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const tint = metric.danger
            ? 'bg-red-500/10 text-red-600'
            : metric.warning
              ? 'bg-amber-500/10 text-amber-700'
              : 'bg-emerald-500/10 text-emerald-700';

          return (
            <Card key={metric.title} className="border-border/80 bg-card/90 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
                <div className={`rounded-2xl p-2 ${tint}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">{metric.value}</div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className={metric.danger ? 'text-red-600' : 'text-emerald-700'}>
                    {metric.title === 'Gross Margin %'
                      ? `${metric.delta >= 0 ? '+' : ''}${metric.delta.toFixed(1)} pts`
                      : `${metric.delta >= 0 ? '+' : ''}${formatLakhs(metric.delta, 1)}`}
                  </span>
                  <span className="text-muted-foreground">{metric.helper}</span>
                </div>
                <div className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {metric.statusLabel}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/80 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Cash Waterfall</CardTitle>
        </CardHeader>
        <CardContent>
          <CashWaterfallChart
            data={waterfallData}
            minimumCashThreshold={quickMetricThresholds.minimumCashThreshold}
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-sm text-emerald-800">
              All clear. Cash, compliance, and working capital are tracking within thresholds.
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={[
                  'flex items-start gap-3 rounded-2xl border px-4 py-4',
                  alert.tone === 'warning'
                    ? 'border-amber-200 bg-amber-50/80'
                    : 'border-emerald-200 bg-emerald-50/70',
                ].join(' ')}
              >
                <div
                  className={[
                    'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full',
                    alert.tone === 'warning' ? 'bg-amber-500/15 text-amber-700' : 'bg-emerald-500/15 text-emerald-700',
                  ].join(' ')}
                >
                  {alert.tone === 'warning' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{alert.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{alert.detail}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
