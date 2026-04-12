'use client';

import { useState } from 'react';
import { ArrowRightLeft, Plus, Trash2 } from 'lucide-react';

import { demoData, demoTimingProfiles, forecastMonths } from '@/lib/demo-data';
import type { ScenarioDefinition } from '@/lib/engine/scenarios/types';
import { formatLakhs } from '@/lib/utils/indian-format';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import type { MicroForecastItem } from '@/stores/micro-forecast-store';
import { useScenarioStore } from '@/stores/scenario-store';

interface ScenarioFormState {
  name: string;
  description: string;
  adjustmentAccountId: string;
  adjustmentPct: string;
  timingAccountId: string;
  timingMonth0: string;
  timingMonth1: string;
  timingMonth2: string;
  timingMonth3: string;
  microForecastStates: Record<string, boolean>;
}

function getTimingPercentages(accountId: string) {
  const profile = demoTimingProfiles[accountId];

  return {
    month0: String(Math.round((profile?.month_0 ?? 0) * 100)),
    month1: String(Math.round((profile?.month_1 ?? 0) * 100)),
    month2: String(Math.round((profile?.month_2 ?? 0) * 100)),
    month3: String(Math.round((profile?.month_3 ?? 0) * 100)),
  };
}

function createEmptyForm(items: MicroForecastItem[]): ScenarioFormState {
  const timingDefaults = getTimingPercentages('rev-1');

  return {
    name: '',
    description: '',
    adjustmentAccountId: 'rev-1',
    adjustmentPct: '-15',
    timingAccountId: 'rev-1',
    timingMonth0: timingDefaults.month0,
    timingMonth1: timingDefaults.month1,
    timingMonth2: timingDefaults.month2,
    timingMonth3: timingDefaults.month3,
    microForecastStates: Object.fromEntries(items.map((item) => [item.id, item.isActive])),
  };
}

function buildFormFromScenario(
  scenario: ScenarioDefinition,
  items: MicroForecastItem[]
): ScenarioFormState {
  const baseline = createEmptyForm(items);
  const baselineAdjustment = scenario.baselineAdjustments[0];
  const timingOverride = scenario.timingProfileOverrides[0];
  const microForecastStates = Object.fromEntries(
    items.map((item) => {
      const override = scenario.microForecastToggles.find((toggle) => toggle.microForecastId === item.id);
      return [item.id, override ? override.isActive : item.isActive];
    })
  );

  return {
    name: scenario.name,
    description: scenario.description ?? '',
    adjustmentAccountId: baselineAdjustment?.accountId ?? baseline.adjustmentAccountId,
    adjustmentPct: String(baselineAdjustment?.adjustmentPct ?? 0),
    timingAccountId: timingOverride?.accountId ?? baseline.timingAccountId,
    timingMonth0: String(Math.round((timingOverride?.profile.month_0 ?? 0) * 100)),
    timingMonth1: String(Math.round((timingOverride?.profile.month_1 ?? 0) * 100)),
    timingMonth2: String(Math.round((timingOverride?.profile.month_2 ?? 0) * 100)),
    timingMonth3: String(Math.round((timingOverride?.profile.month_3 ?? 0) * 100)),
    microForecastStates,
  };
}

function polylinePoints(values: number[], width: number, height: number, min: number, max: number): string {
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const normalized = max === min ? 0.5 : (value - min) / (max - min);
      const y = height - normalized * height;
      return `${x},${y}`;
    })
    .join(' ');
}

function ScenarioComparisonChart({
  labels,
  baseValues,
  scenarioValues,
}: {
  labels: string[];
  baseValues: number[];
  scenarioValues: number[];
}) {
  const width = 720;
  const height = 220;
  const values = [...baseValues, ...scenarioValues];
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div className="rounded-2xl border border-border/80 bg-background/80 p-4">
      <svg viewBox={`0 0 ${width} ${height + 36}`} className="w-full">
        <polyline
          fill="none"
          stroke="#0f766e"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polylinePoints(baseValues, width, height, min, max)}
        />
        <polyline
          fill="none"
          stroke="#c2410c"
          strokeWidth="4"
          strokeDasharray="10 8"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polylinePoints(scenarioValues, width, height, min, max)}
        />
        {labels.map((label, index) => {
          const x = (index / Math.max(labels.length - 1, 1)) * width;
          return (
            <text
              key={label}
              x={x}
              y={height + 24}
              textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'}
              className="fill-muted-foreground text-[10px]"
            >
              {label}
            </text>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-8 rounded-full bg-teal-700" />
          Base Case
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-8 rounded-full border-t-4 border-dashed border-orange-700" />
          Scenario
        </div>
      </div>
    </div>
  );
}

export function ScenarioWorkspace() {
  const {
    baselineResult,
    engineResult: scenarioResult,
    hasHydrated,
    isEngineComputing,
    items,
    ready,
    scenarios,
    selectedScenario,
  } = useCurrentForecast();
  const addScenario = useScenarioStore((state) => state.addScenario);
  const updateScenario = useScenarioStore((state) => state.updateScenario);
  const deleteScenario = useScenarioStore((state) => state.deleteScenario);
  const selectedScenarioId = useForecastStore((state) => state.selectedScenarioId);
  const setSelectedScenarioId = useForecastStore((state) => state.setSelectedScenarioId);

  const [draftScenarioId, setDraftScenarioId] = useState<string | null>(null);
  const [form, setForm] = useState<ScenarioFormState>(() => createEmptyForm(items));
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!hasHydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-[620px]" />
      </div>
    );
  }

  if (!ready || !baselineResult || !scenarioResult) {
    return (
      <EmptyState
        icon={ArrowRightLeft}
        title="Complete your forecast setup first"
        description="Scenarios layer on top of a live forecast, so finish setup before building what-if cases."
        ctaHref="/data"
        ctaLabel="Finish Setup"
      />
    );
  }

  const baseCashSeries = baselineResult.integrationResults.map((month) => month.bs.cash);
  const scenarioCashSeries = scenarioResult.integrationResults.map((month) => month.bs.cash);
  const summaryRows = [
    {
      label: 'End Cash',
      base: baselineResult.integrationResults.at(-1)?.bs.cash ?? 0,
      scenario: scenarioResult.integrationResults.at(-1)?.bs.cash ?? 0,
    },
    {
      label: 'Lowest Cash',
      base: Math.min(...baseCashSeries),
      scenario: Math.min(...scenarioCashSeries),
    },
    {
      label: 'Months Negative',
      base: baseCashSeries.filter((value) => value < 0).length,
      scenario: scenarioCashSeries.filter((value) => value < 0).length,
      countOnly: true,
    },
  ];

  const accountOptions = demoData.filter((account) =>
    ['Revenue', 'COGS', 'Operating Expenses'].includes(account.category)
  );
  const timingOptions = Object.keys(demoTimingProfiles);

  const saveScenario = () => {
    const timingTotal =
      Number(form.timingMonth0 || 0) +
      Number(form.timingMonth1 || 0) +
      Number(form.timingMonth2 || 0) +
      Number(form.timingMonth3 || 0);

    if (!form.name.trim()) {
      setValidationError('Scenario name is required.');
      return;
    }

    if (timingTotal !== 100) {
      setValidationError('Timing profile percentages must sum to 100.');
      return;
    }

    const baseTimingProfile = demoTimingProfiles[form.timingAccountId];
    const hasTimingOverride =
      Number(form.timingMonth0) !== Math.round((baseTimingProfile?.month_0 ?? 0) * 100) ||
      Number(form.timingMonth1) !== Math.round((baseTimingProfile?.month_1 ?? 0) * 100) ||
      Number(form.timingMonth2) !== Math.round((baseTimingProfile?.month_2 ?? 0) * 100) ||
      Number(form.timingMonth3) !== Math.round((baseTimingProfile?.month_3 ?? 0) * 100);

    const scenario: Omit<ScenarioDefinition, 'id'> = {
      name: form.name.trim(),
      description: form.description.trim(),
      baselineAdjustments:
        Number(form.adjustmentPct) !== 0
          ? [
              {
                accountId: form.adjustmentAccountId,
                adjustmentPct: Number(form.adjustmentPct),
              },
            ]
          : [],
      timingProfileOverrides: hasTimingOverride
        ? [
            {
              accountId: form.timingAccountId,
              profile: {
                ...(demoTimingProfiles[form.timingAccountId] ?? {
                  type: 'receivables',
                  accountId: form.timingAccountId,
                }),
                accountId: form.timingAccountId,
                month_0: Number(form.timingMonth0) / 100,
                month_1: Number(form.timingMonth1) / 100,
                month_2: Number(form.timingMonth2) / 100,
                month_3: Number(form.timingMonth3) / 100,
                month_4: 0,
                month_5: 0,
                month_6: 0,
                bad_debt: 0,
              },
            },
          ]
        : [],
      microForecastToggles: items
        .filter((item) => form.microForecastStates[item.id] !== item.isActive)
        .map((item) => ({
          microForecastId: item.id,
          isActive: form.microForecastStates[item.id],
        })),
    };

    if (draftScenarioId) {
      updateScenario(draftScenarioId, scenario);
      setSelectedScenarioId(draftScenarioId);
    } else {
      const createdId = addScenario(scenario);
      setDraftScenarioId(createdId);
      setSelectedScenarioId(createdId);
    }

    setValidationError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Scenario engine
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Compare base vs. what-if cases</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Layer baseline adjustments, timing changes, and event toggles on top of the current
            forecast without copying the whole model.
          </p>
        </div>

        <Button
          variant="outline"
          className="h-10 rounded-xl"
          onClick={() => {
            setDraftScenarioId(null);
            setValidationError(null);
            setForm(createEmptyForm(items));
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Scenario
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Scenario List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scenarios.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center">
                <div className="text-base font-semibold">Create your first scenario</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Start with a downside case or collection delay and compare it against the base forecast.
                </div>
                <Button
                  type="button"
                  className="mt-4 rounded-full"
                  onClick={() => {
                    setDraftScenarioId(null);
                    setValidationError(null);
                    setForm(createEmptyForm(items));
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first scenario
                </Button>
              </div>
            ) : null}
            {scenarios.map((scenario) => {
              const active = selectedScenarioId === scenario.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => {
                    setSelectedScenarioId(scenario.id);
                    setDraftScenarioId(scenario.id);
                    setValidationError(null);
                    setForm(buildFormFromScenario(scenario, items));
                  }}
                  className={[
                    'w-full rounded-2xl border px-4 py-4 text-left transition-colors',
                    active
                      ? 'border-emerald-300 bg-emerald-50/80'
                      : 'border-border/80 bg-background/70 hover:border-emerald-200 hover:bg-emerald-50/40',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{scenario.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {scenario.description || 'No description yet.'}
                      </div>
                    </div>
                    <div className="rounded-full border border-border bg-card px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      {scenario.baselineAdjustments.length + scenario.timingProfileOverrides.length + scenario.microForecastToggles.length}{' '}
                      overrides
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {draftScenarioId ? 'Edit Scenario' : 'Scenario Builder'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Name
                </label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                  placeholder="Pessimistic"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Description
                </label>
                <Input
                  value={form.description}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, description: event.target.value }))
                  }
                  placeholder="Revenue drops and collections slip"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_0.65fr]">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Baseline Adjustment Account
                </label>
                <Select
                  value={form.adjustmentAccountId}
                  onValueChange={(value) =>
                    setForm((state) => ({ ...state, adjustmentAccountId: value ?? state.adjustmentAccountId }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountOptions.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Adjustment %
                </label>
                <Input
                  type="number"
                  value={form.adjustmentPct}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, adjustmentPct: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ArrowRightLeft className="h-4 w-4 text-amber-700" />
                Timing Profile Override
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Timing Account
                  </label>
                  <Select
                    value={form.timingAccountId}
                    onValueChange={(value) =>
                      setForm((state) => ({ ...state, timingAccountId: value ?? state.timingAccountId }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timingOptions.map((accountId) => (
                        <SelectItem key={accountId} value={accountId}>
                          {demoData.find((account) => account.id === accountId)?.name ?? accountId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ['Month 0', 'timingMonth0'],
                    ['Month 1', 'timingMonth1'],
                    ['Month 2', 'timingMonth2'],
                    ['Month 3', 'timingMonth3'],
                  ].map(([label, key]) => (
                    <div key={key} className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        {label}
                      </label>
                      <Input
                        type="number"
                        value={form[key as keyof ScenarioFormState] as string}
                        onChange={(event) =>
                          setForm((state) => ({
                            ...state,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
              <div className="text-sm font-semibold">Micro-Forecast Toggles</div>
              <div className="mt-3 space-y-2">
                {items.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Add business events in the forecast workspace to toggle them per scenario.
                  </div>
                ) : (
                  items.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Starts {item.startMonth}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.microForecastStates[item.id] ?? item.isActive}
                        onChange={(event) =>
                          setForm((state) => ({
                            ...state,
                            microForecastStates: {
                              ...state.microForecastStates,
                              [item.id]: event.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-border text-emerald-700 focus:ring-emerald-700"
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            {validationError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {validationError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-xl" onClick={saveScenario}>
                {draftScenarioId ? 'Update Scenario' : 'Save Scenario'}
              </Button>
              {draftScenarioId && (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    deleteScenario(draftScenarioId);
                    if (selectedScenarioId === draftScenarioId) {
                      setSelectedScenarioId(null);
                    }
                    setDraftScenarioId(null);
                    setValidationError(null);
                    setForm(createEmptyForm(items));
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isEngineComputing ? (
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-[260px]" />
        </div>
      ) : null}

      {!isEngineComputing ? (
      <Card className="border-border/80 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            Base Case vs. {selectedScenario?.name ?? 'Scenario Preview'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ScenarioComparisonChart
            labels={forecastMonths}
            baseValues={baseCashSeries}
            scenarioValues={scenarioCashSeries}
          />

          <div className="grid gap-3 md:grid-cols-3">
            {summaryRows.map((row) => (
              <div key={row.label} className="rounded-2xl border border-border/80 bg-background/80 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {row.label}
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Base
                    </div>
                    <div className="text-lg font-semibold">
                      {'countOnly' in row && row.countOnly ? row.base : formatLakhs(row.base as number, 1)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Scenario
                    </div>
                    <div className="text-lg font-semibold text-amber-700">
                      {'countOnly' in row && row.countOnly
                        ? row.scenario
                        : formatLakhs(row.scenario as number, 1)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
