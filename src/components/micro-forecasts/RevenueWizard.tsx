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

export function RevenueWizard({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [startMonth, setStartMonth] = useState(forecastMonths[0]);
  const [gstRate, setGstRate] = useState('18');

  const addRevenue = useMicroForecastStore((s) => s.addRevenue);

  const amountPaise = Math.round(parseFloat(monthlyAmount || '0') * LAKH);
  const gstRateNum = parseFloat(gstRate || '0');
  const isValid = clientName.trim().length > 0 && amountPaise > 0;

  const handleSave = async () => {
    if (!isValid || isSaving) return;

    setIsSaving(true);

    try {
      await addRevenue({
        clientName,
        monthlyAmount: amountPaise,
        startMonth,
        gstRate: gstRateNum
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setStep(1);
    setClientName('');
    setMonthlyAmount('');
    setStartMonth(forecastMonths[0]);
    setGstRate('18');
    onClose();
  };

  // Count months impacted
  const startIdx = forecastMonths.indexOf(startMonth);
  const monthsActive = startIdx >= 0 ? forecastMonths.length - startIdx : 0;
  const totalImpact = amountPaise * monthsActive;

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
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 text-sm font-bold">₹</span>
            New Revenue / Client
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client / Revenue Source Name</Label>
              <Input
                id="clientName"
                placeholder="e.g. Acme Corp, New Product Line"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyAmount">Monthly Revenue (₹ Lakhs)</Label>
              <Input
                id="monthlyAmount"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 5.0"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
              />
              {amountPaise > 0 && (
                <p className="text-xs text-muted-foreground">= {formatLakhs(amountPaise, 2)} per month</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Month</Label>
                <Select value={startMonth} onValueChange={(value) => value && setStartMonth(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {forecastMonths.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>GST Rate (%)</Label>
                <Select value={gstRate} onValueChange={(value) => value && setGstRate(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (Exempt)</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Impact Preview</h3>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">P&L: Revenue increase</span>
                <span className="text-sm font-semibold text-emerald-600">+{formatLakhs(amountPaise, 2)}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">CF: Cash inflow</span>
                <span className="text-sm font-semibold text-emerald-600">+{formatLakhs(amountPaise, 2)}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active months</span>
                <span className="text-sm font-semibold">{monthsActive} months ({startMonth} → Mar-26)</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-sm font-medium">Total forecast impact</span>
                <span className="text-sm font-bold text-emerald-600">+{formatLakhs(totalImpact, 2)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!isValid || isSaving}>
              Preview Impact →
            </Button>
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
