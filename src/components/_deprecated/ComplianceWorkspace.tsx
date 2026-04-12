'use client';

import { AlertTriangle, CalendarDays, Landmark, ShieldCheck } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { formatDateIndian, formatLakhs, formatRupees } from '@/lib/utils/indian-format';
import { formatPeriod } from '@/lib/utils/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentForecast } from '@/hooks/use-current-forecast';
import { useForecastStore } from '@/stores/forecast-store';

function formatDueLabel(dueDate: string): string {
  const date = new Date(dueDate);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function ComplianceWorkspace() {
  const { engineResult, hasHydrated, isEngineComputing, ready, scenarios, selectedScenario } =
    useCurrentForecast();
  const setSelectedScenarioId = useForecastStore((state) => state.setSelectedScenarioId);

  if (!hasHydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  if (!ready || !engineResult) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Complete your forecast setup first"
        description="Compliance due dates need a live forecast before GST, TDS, advance tax, and PF/ESI can be calculated."
        ctaHref="/data"
        ctaLabel="Finish Setup"
      />
    );
  }

  const groupedEvents = Array.from(
    engineResult.compliance.events.reduce((map, event) => {
      const bucket = map.get(event.paymentPeriod) ?? [];
      bucket.push(event);
      map.set(event.paymentPeriod, bucket);
      return map;
    }, new Map<string, typeof engineResult.compliance.events>()).entries()
  );

  const nextEvents = engineResult.compliance.events.slice(0, 4);
  const alerts = engineResult.compliance.alerts.slice(0, 4);

  const summaryCards = [
    {
      id: 'gst',
      label: 'GST Remittances',
      value: formatLakhs(engineResult.compliance.totalsByType.GST, 1),
      helper: 'Output less 85% ITC',
      tint: 'bg-emerald-500/10 text-emerald-700',
    },
    {
      id: 'tds',
      label: 'Salary TDS',
      value: formatLakhs(engineResult.compliance.totalsByType.TDS, 1),
      helper: 'New regime payroll withholding',
      tint: 'bg-sky-500/10 text-sky-700',
    },
    {
      id: 'advance',
      label: 'Advance Tax',
      value: formatLakhs(engineResult.compliance.totalsByType['Advance Tax'], 1),
      helper: 'Quarterly June / Sep / Dec / Mar',
      tint: 'bg-amber-500/10 text-amber-700',
    },
    {
      id: 'statutory',
      label: 'PF + ESI',
      value: formatLakhs(
        engineResult.compliance.totalsByType.PF + engineResult.compliance.totalsByType.ESI,
        1
      ),
      helper: 'Employer-side cash deposits',
      tint: 'bg-rose-500/10 text-rose-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Live compliance engine
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Cash impact by due date</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            GST, TDS, advance tax, and PF/ESI are flowing through the balance sheet and cash flow
            forecast for {selectedScenario?.name ?? 'Base Case'}.
          </p>
        </div>

        <Select
          value={selectedScenario?.id ?? 'base'}
          onValueChange={(value) => setSelectedScenarioId(value === 'base' ? null : value)}
        >
          <SelectTrigger className="h-10 min-w-[220px] rounded-xl border-border bg-card">
            <SelectValue>{selectedScenario?.name ?? 'Base Case'}</SelectValue>
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
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.id} className="border-border/80 bg-card/90 shadow-sm">
            <CardContent className="flex items-center gap-3 py-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.tint}`}>
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {card.label}
                </div>
                <div className="mt-1 text-xl font-semibold tracking-tight">{card.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isEngineComputing ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : null}

      {!isEngineComputing ? (
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4.5 w-4.5 text-emerald-700" />
              Compliance Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groupedEvents.map(([period, events]) => (
              <div
                key={period}
                className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm"
              >
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {formatPeriod(period)}
                </div>
                <div className="mt-3 space-y-3">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className={[
                        'rounded-xl border px-3 py-3',
                        event.shortfall > 0
                          ? 'border-red-200 bg-red-50/70'
                          : 'border-emerald-100 bg-emerald-50/60',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{event.type}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDueLabel(event.dueDate)} · {event.label}
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold">
                          {formatLakhs(event.amount, 1)}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Cash before due: {formatLakhs(event.projectedCashBefore, 1)}
                      </div>
                      {event.shortfall > 0 && (
                        <div className="mt-1 text-xs font-medium text-red-700">
                          Shortfall: {formatLakhs(event.shortfall, 1)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/80 bg-card/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-700" />
                Next Due Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-background/80 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">{event.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateIndian(new Date(event.dueDate))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatRupees(event.amount, false)}</div>
                    <div className="text-xs text-muted-foreground">
                      Cash before: {formatLakhs(event.projectedCashBefore, 1)}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-700" />
                Shortfall Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-sm text-emerald-800">
                  No projected shortfalls across the current compliance schedule.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-4"
                  >
                    <div className="text-sm font-semibold text-red-800">
                      {formatLakhs(alert.shortfall, 1)} short for {alert.type} on{' '}
                      {formatDueLabel(alert.dueDate)}
                    </div>
                    <div className="mt-1 text-xs text-red-700/90">
                      Due amount {formatRupees(alert.amount, false)} with insufficient projected cash.
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      ) : null}
    </div>
  );
}
