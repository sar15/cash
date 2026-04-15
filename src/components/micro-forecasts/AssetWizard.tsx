'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMicroForecastStore } from '@/stores/micro-forecast-store';
import { forecastMonths } from '@/lib/demo-data';
import { formatLakhs } from '@/lib/utils/indian-format';

const LAKH = 10_000_000;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AssetWizard({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [amount, setAmount] = useState('');
  const [purchaseMonth, setPurchaseMonth] = useState(forecastMonths[0]);
  const [lifeYears, setLifeYears] = useState('5');
  const [salvage, setSalvage] = useState('0');

  const addAsset = useMicroForecastStore((s) => s.addAsset);

  const amountPaise = Math.round(parseFloat(amount || '0') * LAKH);
  const salvagePaise = Math.round(parseFloat(salvage || '0') * LAKH);
  const lifeMonths = Math.round(parseFloat(lifeYears || '5') * 12);
  const monthlyDepr = lifeMonths > 0 ? Math.round((amountPaise - salvagePaise) / lifeMonths) : 0;
  const isValid = assetName.trim().length > 0 && amountPaise > 0;

  const startIdx = forecastMonths.indexOf(purchaseMonth);
  const monthsActive = startIdx >= 0 ? Math.min(forecastMonths.length - startIdx, lifeMonths) : 0;

  const handleSave = async () => {
    if (!isValid || isSaving) return;

    setIsSaving(true);

    try {
      await addAsset({
        assetName,
        purchaseAmount: amountPaise,
        purchaseMonth,
        usefulLifeMonths: lifeMonths,
        salvageValue: salvagePaise
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setStep(1);
    setAssetName('');
    setAmount('');
    setPurchaseMonth(forecastMonths[0]);
    setLifeYears('5');
    setSalvage('0');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 text-sm">🏭</span>
            Asset Purchase
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assetName">Asset Name</Label>
              <Input id="assetName" placeholder="e.g. CNC Machine, Delivery Van" value={assetName} onChange={(e) => setAssetName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Purchase Cost (₹ Lakhs)</Label>
              <Input id="amount" type="number" step="0.1" min="0" placeholder="e.g. 12.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {amountPaise > 0 && <p className="text-xs text-muted-foreground">= {formatLakhs(amountPaise, 2)}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Month</Label>
                <Select value={purchaseMonth} onValueChange={(value) => value && setPurchaseMonth(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {forecastMonths.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Useful Life (Years)</Label>
                <Input type="number" step="1" min="1" max="30" value={lifeYears} onChange={(e) => setLifeYears(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Salvage Value (₹ Lakhs)</Label>
              <Input type="number" step="0.1" min="0" value={salvage} onChange={(e) => setSalvage(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Impact Preview</h3>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capex (one-time)</span>
                <span className="font-semibold text-red-500">−{formatLakhs(amountPaise, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly depreciation</span>
                <span className="font-semibold text-amber-600">{formatLakhs(monthlyDepr, 2)}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Depreciation method</span>
                <span className="font-semibold">Straight Line</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">FY impact months</span>
                <span className="font-semibold">{monthsActive} months</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-medium">BS: Fixed Assets ↑</span>
                  <span className="font-bold text-emerald-600">+{formatLakhs(amountPaise, 2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-medium">CF: Investing outflow</span>
                  <span className="font-bold text-red-500">−{formatLakhs(amountPaise, 2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-medium">P&L: Depr. (FY total)</span>
                  <span className="font-bold text-red-500">−{formatLakhs(monthlyDepr * monthsActive, 2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!isValid || isSaving}>Preview Impact →</Button>
          ) : (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSaving}>← Back</Button>
              <Button onClick={() => void handleSave()} disabled={isSaving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {isSaving ? 'Saving...' : 'Save & Update Forecast'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
