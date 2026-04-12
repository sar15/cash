'use client';
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react';
import {
  Building2,
  Download,
  ImageUp,
  LoaderCircle,
  Settings2,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildConfigurationFile, getConfigurationFilename, parseConfigurationFile } from '@/lib/configuration';
import { useCurrentForecast } from '@/hooks/use-current-forecast';
import { useMicroForecastStore } from '@/stores/micro-forecast-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

const PAISE_PER_LAKH = 10_000_000;

export function SettingsWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const {
    companyProfile,
    complianceConfig,
    hasHydrated,
    items,
    quickMetricThresholds,
  } = useCurrentForecast();

  const loadItems = useMicroForecastStore((state) => state.loadItems);
  const addAsset = useMicroForecastStore((state) => state.addAsset);
  const addHire = useMicroForecastStore((state) => state.addHire);
  const addLoan = useMicroForecastStore((state) => state.addLoan);
  const addRevenue = useMicroForecastStore((state) => state.addRevenue);
  const removeItem = useMicroForecastStore((state) => state.removeItem);
  const toggleActive = useMicroForecastStore((state) => state.toggleActive);

  const logoDataUrl = useWorkspaceStore((state) => state.logoDataUrl);
  const setCompanyProfile = useWorkspaceStore((state) => state.setCompanyProfile);
  const setComplianceConfig = useWorkspaceStore((state) => state.setComplianceConfig);
  const setLogoDataUrl = useWorkspaceStore((state) => state.setLogoDataUrl);
  const setQuickMetricThresholds = useWorkspaceStore((state) => state.setQuickMetricThresholds);
  const replaceTimingProfiles = useWorkspaceStore((state) => state.replaceTimingProfiles);
  const replaceValueRules = useWorkspaceStore((state) => state.replaceValueRules);

  if (!hasHydrated) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-3xl bg-muted/60" />
        <div className="h-[420px] animate-pulse rounded-3xl bg-muted/50" />
      </div>
    );
  }

  const clearMessages = () => {
    setError(null);
    setStatus(null);
  };

  const exportConfiguration = () => {
    clearMessages();

    const blob = new Blob(
      [
        JSON.stringify(
          buildConfigurationFile(companyProfile.name, {
            valueRules: useWorkspaceStore.getState().valueRules,
            timingProfiles: useWorkspaceStore.getState().timingProfiles,
            complianceConfig: useWorkspaceStore.getState().complianceConfig,
            quickMetricThresholds: useWorkspaceStore.getState().quickMetricThresholds,
            microForecasts: items.map((item) => ({
              type: item.type,
              wizardInputs: item.wizardInputs as unknown as Record<string, unknown>,
              isActive: item.isActive,
            })),
          }),
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );

    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = getConfigurationFilename(companyProfile.name);
    anchor.click();
    URL.revokeObjectURL(href);

    setStatus('Configuration exported.');
  };

  const importConfiguration = async (file: File) => {
    clearMessages();
    setIsImporting(true);

    try {
      await loadItems(true);
      const raw = await file.text();
      const configuration = parseConfigurationFile(raw);

      replaceValueRules(configuration.valueRules);
      replaceTimingProfiles(configuration.timingProfiles);
      setComplianceConfig(configuration.complianceConfig);
      setQuickMetricThresholds(configuration.quickMetricThresholds);

      const existingItems = [...useMicroForecastStore.getState().items];
      for (const item of existingItems) {
        await removeItem(item.id);
      }

      for (const snapshot of configuration.microForecasts) {
        const beforeIds = new Set(useMicroForecastStore.getState().items.map((item) => item.id));

        switch (snapshot.type) {
          case 'asset':
            await addAsset(snapshot.wizardInputs as never);
            break;
          case 'hire':
            await addHire(snapshot.wizardInputs as never);
            break;
          case 'loan':
            await addLoan(snapshot.wizardInputs as never);
            break;
          case 'revenue':
          default:
            await addRevenue(snapshot.wizardInputs as never);
            break;
        }

        if (!snapshot.isActive) {
          const created = useMicroForecastStore
            .getState()
            .items.find((item) => !beforeIds.has(item.id));

          if (created) {
            await toggleActive(created.id);
          }
        }
      }

      setStatus('Configuration imported for this company.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company profile, forecast thresholds, report branding, and reusable configuration packs.
        </p>
      </div>

      {status ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
          {status}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4.5 w-4.5 text-emerald-700" />
              Company Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-name-settings">Company Name</Label>
              <Input
                id="company-name-settings"
                value={companyProfile.name}
                onChange={(event) => setCompanyProfile({ name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select
                value={companyProfile.industry}
                onValueChange={(value) =>
                  setCompanyProfile({ industry: value as typeof companyProfile.industry })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="trading">Trading</SelectItem>
                  <SelectItem value="services">Services</SelectItem>
                  <SelectItem value="startup">Startup / SaaS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Financial Year Start</Label>
              <Select
                value={String(companyProfile.fyStartMonth)}
                onValueChange={(value) => setCompanyProfile({ fyStartMonth: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">April</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Report Logo</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <ImageUp className="mr-2 h-4 w-4" />
                  Upload Logo
                </Button>
                {logoDataUrl ? (
                  <img
                    src={logoDataUrl}
                    alt={`${companyProfile.name} logo preview`}
                    className="h-12 rounded-xl border border-border bg-white p-2"
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">Used on the PDF cover page.</div>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }

                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      setLogoDataUrl(reader.result);
                      setStatus('Logo updated for reports.');
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4.5 w-4.5 text-amber-700" />
              Thresholds & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min-cash-threshold">Minimum Cash Threshold (₹ Lakhs)</Label>
                <Input
                  id="min-cash-threshold"
                  type="number"
                  min="0"
                  step="0.1"
                  value={quickMetricThresholds.minimumCashThreshold / PAISE_PER_LAKH}
                  onChange={(event) =>
                    setQuickMetricThresholds({
                      minimumCashThreshold: Math.round(Number(event.target.value || 0) * PAISE_PER_LAKH),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receivables-threshold">Receivables Alert (₹ Lakhs)</Label>
                <Input
                  id="receivables-threshold"
                  type="number"
                  min="0"
                  step="0.1"
                  value={quickMetricThresholds.receivablesAlertThreshold / PAISE_PER_LAKH}
                  onChange={(event) =>
                    setQuickMetricThresholds({
                      receivablesAlertThreshold: Math.round(Number(event.target.value || 0) * PAISE_PER_LAKH),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gst-rate">GST Rate %</Label>
                <Input
                  id="gst-rate"
                  type="number"
                  min="0"
                  step="0.1"
                  value={complianceConfig.gstRatePct}
                  onChange={(event) =>
                    setComplianceConfig({ gstRatePct: Number(event.target.value || 0) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itc-rate">Input Tax Credit %</Label>
                <Input
                  id="itc-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={complianceConfig.inputTaxCreditPct}
                  onChange={(event) =>
                    setComplianceConfig({ inputTaxCreditPct: Number(event.target.value || 0) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="advance-tax-rate">Advance Tax Rate %</Label>
                <Input
                  id="advance-tax-rate"
                  type="number"
                  min="0"
                  step="0.1"
                  value={complianceConfig.advanceTaxRatePct}
                  onChange={(event) =>
                    setComplianceConfig({ advanceTaxRatePct: Number(event.target.value || 0) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>TDS Regime</Label>
                <Select
                  value={complianceConfig.tdsRegime}
                  onValueChange={() => setComplianceConfig({ tdsRegime: 'new' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New Regime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4.5 w-4.5 text-sky-700" />
              Configuration Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              Export your value rules, timing profiles, micro-forecasts, compliance config, and quick
              metric thresholds as a reusable JSON pack for similar companies.
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" className="rounded-full" onClick={exportConfiguration}>
                <Download className="mr-2 h-4 w-4" />
                Export Configuration
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                {isImporting ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import Configuration
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importConfiguration(file);
                }
                event.target.value = '';
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">What Gets Shared</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>All value rules and direct entries</div>
            <div>All timing profiles and collections assumptions</div>
            <div>All business events and micro-forecasts</div>
            <div>Compliance setup for GST, TDS, and advance tax</div>
            <div>Quick metric thresholds used in dashboard alerts</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
