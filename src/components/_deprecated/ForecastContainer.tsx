'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  IndianRupee,
  PanelLeftOpen,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { formatLakhs } from '@/lib/utils/indian-format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ForecastGrid } from '@/components/forecast/ForecastGrid';
import { MicroForecastSidebar } from '@/components/micro-forecasts/MicroForecastSidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentForecast } from '@/hooks/use-current-forecast';
import { useForecastStore } from '@/stores/forecast-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

type ViewType = 'PL' | 'BS' | 'CF';

const viewConfig: Record<
  ViewType,
  { label: string; description: string; icon: typeof TrendingUp }
> = {
  PL: {
    label: 'P&L',
    description: 'Edit the forecast drivers that shape revenue, cost, and profit.',
    icon: TrendingUp,
  },
  BS: {
    label: 'BS',
    description: 'Review the integrated closing balances produced by the engine.',
    icon: Wallet,
  },
  CF: {
    label: 'CF',
    description: 'Track monthly movement through operating, investing, and financing cash flows.',
    icon: BarChart3,
  },
};

export function ForecastContainer() {
  const [view, setView] = useState<ViewType>('PL');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const {
    baselineResult,
    companyProfile,
    engineResult,
    hasHydrated,
    isEngineComputing,
    items,
    ready,
    scenarios,
    selectedScenario,
    valueRules,
  } = useCurrentForecast();
  const setSelectedScenarioId = useForecastStore((state) => state.setSelectedScenarioId);
  const bumpEngineVersion = useForecastStore((state) => state.bumpEngineVersion);
  const setValueRule = useWorkspaceStore((state) => state.setValueRule);

  const handleCellEdit = (accountId: string, monthIndex: number, paiseValue: number) => {
    const currentRule = valueRules[accountId];
    let newEntries: Array<number | null> = Array(12).fill(null);

    if (currentRule && currentRule.type === 'direct_entry') {
      newEntries = [...(currentRule.entries || Array(12).fill(null))];
    }

    newEntries[monthIndex] = paiseValue;

    setValueRule(accountId, {
      type: 'direct_entry',
      accountId,
      entries: newEntries,
    });

    bumpEngineVersion();
  };

  if (!hasHydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-[540px]" />
      </div>
    );
  }

  if (!ready || !baselineResult || !engineResult) {
    return (
      <EmptyState
        icon={Wallet}
        title="Upload your financial data to see your forecast"
        description="Complete your forecast setup first, or use the demo dataset to unlock the live grid."
        ctaHref="/data"
        ctaLabel="Go To Setup"
      />
    );
  }

  const currentView = viewConfig[view];
  const lastMonth = engineResult.integrationResults.at(-1);
  const baselineLastMonth = baselineResult.integrationResults.at(-1);
  const activeScenarioLabel = selectedScenario?.name ?? 'Base Case';
  const scenarioAdjustedMicroCount = items.filter((item) => {
    if (!item.isActive) {
      return false;
    }

    const toggle = selectedScenario?.microForecastToggles.find(
      (override) => override.microForecastId === item.id
    );

    return toggle ? toggle.isActive : true;
  }).length;

  const cashOnHand = lastMonth?.bs.cash ?? 0;
  const baselineCashOnHand = baselineLastMonth?.bs.cash ?? 0;
  const cashDelta = cashOnHand - baselineCashOnHand;
  const minCash = Math.min(...engineResult.integrationResults.map((month) => month.bs.cash));
  const isOverdraft = minCash < 0;

  const fyNetIncome = engineResult.integrationResults.reduce((sum, month) => sum + month.pl.netIncome, 0);
  const baselineFyNetIncome = baselineResult.integrationResults.reduce(
    (sum, month) => sum + month.pl.netIncome,
    0
  );
  const incomeDelta = fyNetIncome - baselineFyNetIncome;

  const workingCapital = (lastMonth?.bs.cash ?? 0) + (lastMonth?.bs.ar ?? 0) - (lastMonth?.bs.ap ?? 0);
  const baselineWorkingCapital =
    (baselineLastMonth?.bs.cash ?? 0) +
    (baselineLastMonth?.bs.ar ?? 0) -
    (baselineLastMonth?.bs.ap ?? 0);
  const workingCapitalDelta = workingCapital - baselineWorkingCapital;

  const grossMarginPct =
    lastMonth && lastMonth.pl.revenue > 0
      ? (lastMonth.pl.grossProfit / lastMonth.pl.revenue) * 100
      : 0;
  const baselineGrossMarginPct =
    baselineLastMonth && baselineLastMonth.pl.revenue > 0
      ? (baselineLastMonth.pl.grossProfit / baselineLastMonth.pl.revenue) * 100
      : 0;
  const grossMarginDelta = grossMarginPct - baselineGrossMarginPct;

  const metrics = [
    {
      id: 'cash',
      label: 'Closing Cash',
      value: formatLakhs(cashOnHand, 1),
      helper: isOverdraft ? `Min cash ${formatLakhs(minCash, 1)}` : 'Mar-26 closing balance',
      delta: cashDelta,
      icon: isOverdraft ? AlertTriangle : IndianRupee,
      tint: isOverdraft
        ? 'bg-red-500/10 text-red-500 ring-red-500/20'
        : 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20',
    },
    {
      id: 'income',
      label: 'FY Net Income',
      value: formatLakhs(fyNetIncome, 1),
      helper: 'Annual profit projection',
      delta: incomeDelta,
      icon: TrendingUp,
      tint: 'bg-primary/10 text-primary ring-primary/15',
    },
    {
      id: 'margin',
      label: 'Gross Margin',
      value: `${grossMarginPct.toFixed(1)}%`,
      helper: 'Final forecast month',
      delta: grossMarginDelta,
      icon: Sparkles,
      tint: 'bg-amber-500/10 text-amber-600 ring-amber-500/20',
    },
    {
      id: 'working-capital',
      label: 'Working Capital',
      value: formatLakhs(workingCapital, 1),
      helper: 'Cash + AR - AP',
      delta: workingCapitalDelta,
      icon: Wallet,
      tint: 'bg-secondary text-secondary-foreground ring-foreground/10',
    },
  ];

  return (
    <div className="flex h-[calc(100vh-180px)] overflow-hidden rounded-2xl border border-border/80 bg-background/50">
      <MicroForecastSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-border/80 bg-card/90 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <span>{companyProfile.name}</span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>FY 2025-26</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Integrated forecast workspace
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentView.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedScenario?.id ?? 'base'}
                onValueChange={(value) => setSelectedScenarioId(value === 'base' ? null : value)}
              >
                <SelectTrigger className="h-9 min-w-[180px] rounded-full border-border bg-muted/50 px-3">
                  <SelectValue>{activeScenarioLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="base">Base Case</SelectItem>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                {scenarioAdjustedMicroCount} active event{scenarioAdjustedMicroCount === 1 ? '' : 's'}
              </div>
              <div className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                12 forecast months
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              const positiveDelta = metric.delta > 0;
              const negativeDelta = metric.delta < 0;

              return (
                <Card key={metric.id} size="sm" className="border border-border/80 bg-background/80 shadow-sm">
                  <CardContent className="flex items-center gap-3 py-1">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${metric.tint}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        {metric.label}
                      </div>
                      <div className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                        {metric.value}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{metric.helper}</span>
                        {metric.delta !== 0 && (
                          <span
                            className={
                              positiveDelta
                                ? 'text-emerald-600'
                                : negativeDelta
                                  ? 'text-negative'
                                  : 'text-muted-foreground'
                            }
                          >
                            {positiveDelta ? '+' : ''}
                            {metric.id === 'margin'
                              ? `${metric.delta.toFixed(1)} pts`
                              : formatLakhs(metric.delta, 1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {isEngineComputing && (
            <div
              className={[
                'mt-4 rounded-2xl border px-4 py-3 text-sm',
                'border-border bg-muted/50 text-muted-foreground',
              ].join(' ')}
            >
              Forecast grid is recalculating...
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {!sidebarOpen && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={() => setSidebarOpen(true)}
                >
                  <PanelLeftOpen className="mr-2 h-4 w-4" />
                  Events
                </Button>
              )}

              <div className="rounded-2xl border border-border bg-card p-1">
                {(Object.keys(viewConfig) as ViewType[]).map((item) => {
                  const Icon = viewConfig[item].icon;
                  const active = item === view;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setView(item)}
                      className={[
                        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      ].join(' ')}
                    >
                      <Icon className="h-4 w-4" />
                      {viewConfig[item].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              {view === 'PL'
                ? selectedScenario
                  ? 'Editing still updates the base case; scenario overrides stay layered on top.'
                  : 'Driver editing is optimistic and recalculates immediately.'
                : selectedScenario
                  ? `${selectedScenario.name} is applied on top of the base case.`
                  : 'Statement values are derived from the current engine run.'}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {isEngineComputing ? (
              <div className="space-y-3 rounded-2xl border border-border/80 bg-card/80 p-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            ) : (
              <ForecastGrid
                view={view}
                onCellEdit={handleCellEdit}
                engineResult={engineResult}
                baselineEngineResult={baselineResult}
                scenarioActive={Boolean(selectedScenario)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
