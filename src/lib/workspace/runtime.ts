import {
  allMonths,
  demoData,
  forecastMonths,
  historicalMonths,
  demoTimingProfiles,
  demoValueRules,
  type AccountData,
} from '@/lib/demo-data';

import { useWorkspaceStore } from '@/stores/workspace-store';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function replaceRecord<T>(target: Record<string, T>, source: Record<string, T>) {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });

  Object.assign(target, clone(source));
}

export function applyWorkspaceStateToRuntime(state = useWorkspaceStore.getState()) {
  demoData.length = 0;
  demoData.push(...clone(state.accounts as AccountData[]));

  historicalMonths.length = 0;
  historicalMonths.push(...state.historicalMonths);

  forecastMonths.length = 0;
  forecastMonths.push(...state.forecastMonths);

  allMonths.length = 0;
  allMonths.push(...historicalMonths, ...forecastMonths);

  replaceRecord(demoValueRules, state.valueRules);
  replaceRecord(demoTimingProfiles, state.timingProfiles);
}
