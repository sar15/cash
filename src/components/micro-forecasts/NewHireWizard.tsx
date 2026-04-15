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

export function NewHireWizard({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [role, setRole] = useState('');
  const [monthlyCTC, setMonthlyCTC] = useState('');
  const [startMonth, setStartMonth] = useState(forecastMonths[0]);
  const [netPct, setNetPct] = useState('80');
  const [statPct, setStatPct] = useState('20');

  const addHire = useMicroForecastStore((s) => s.addHire);

  const ctcPaise = Math.round(parseFloat(monthlyCTC || '0') * LAKH);
  const netPctNum = parseFloat(netPct || '80') / 100;
  const statPctNum = parseFloat(statPct || '20') / 100;
  const isValid = role.trim().length > 0 && ctcPaise > 0;

  const handleSave = async () => {
    if (!isValid || isSaving) return;

    setIsSaving(true);

    try {
      await addHire({
        role,
        monthlyCTC: ctcPaise,
        startMonth,
        netSalaryPct: netPctNum,
        statutoryPct: statPctNum
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setStep(1);
    setRole('');
    setMonthlyCTC('');
    setStartMonth(forecastMonths[0]);
    setNetPct('80');
    setStatPct('20');
    onClose();
  };

  const startIdx = forecastMonths.indexOf(startMonth);
  const monthsActive = startIdx >= 0 ? forecastMonths.length - startIdx : 0;
  const netSalaryPerMonth = Math.round(ctcPaise * netPctNum);
  const statutoryPerMonth = Math.round(ctcPaise * statPctNum);

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
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 text-sm">👤</span>
            New Hire
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role / Designation</Label>
              <Input id="role" placeholder="e.g. Senior Developer, Marketing Manager" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctc">Monthly CTC (₹ Lakhs)</Label>
              <Input id="ctc" type="number" step="0.1" min="0" placeholder="e.g. 1.5" value={monthlyCTC} onChange={(e) => setMonthlyCTC(e.target.value)} />
              {ctcPaise > 0 && <p className="text-xs text-muted-foreground">= {formatLakhs(ctcPaise, 2)} per month</p>}
            </div>
            <div className="space-y-2">
              <Label>Start Month</Label>
              <Select value={startMonth} onValueChange={(value) => value && setStartMonth(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {forecastMonths.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Salary Breakup & Timing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Net Salary %</Label>
                <Input type="number" value={netPct} onChange={(e) => { setNetPct(e.target.value); setStatPct(String(100 - parseFloat(e.target.value || '0'))); }} />
                <p className="text-xs text-muted-foreground">Paid same month</p>
              </div>
              <div className="space-y-2">
                <Label>Statutory %</Label>
                <Input type="number" value={statPct} onChange={(e) => { setStatPct(e.target.value); setNetPct(String(100 - parseFloat(e.target.value || '0'))); }} />
                <p className="text-xs text-muted-foreground">PF/ESI/TDS — paid next month</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net salary (month 0)</span>
                <span className="font-semibold">{formatLakhs(netSalaryPerMonth, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PF/ESI/TDS (month 1)</span>
                <span className="font-semibold">{formatLakhs(statutoryPerMonth, 2)}</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Impact Preview</h3>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">P&L: Salary expense</span>
                <span className="text-sm font-semibold text-red-500">+{formatLakhs(ctcPaise, 2)}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">CF: Cash outflow (M0)</span>
                <span className="text-sm font-semibold text-red-500">−{formatLakhs(netSalaryPerMonth, 2)}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">CF: Statutory (M+1)</span>
                <span className="text-sm font-semibold text-red-500">−{formatLakhs(statutoryPerMonth, 2)}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active months</span>
                <span className="text-sm font-semibold">{monthsActive}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-sm font-medium">Total cash impact</span>
                <span className="text-sm font-bold text-red-500">−{formatLakhs(ctcPaise * monthsActive, 2)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!isValid || isSaving}>Salary Breakup →</Button>
          )}
          {step === 2 && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSaving}>← Back</Button>
              <Button onClick={() => setStep(3)} disabled={isSaving}>Preview Impact →</Button>
            </div>
          )}
          {step === 3 && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep(2)} disabled={isSaving}>← Back</Button>
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
