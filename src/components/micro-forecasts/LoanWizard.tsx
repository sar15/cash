'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMicroForecastStore } from '@/stores/micro-forecast-store';
import { useCompanyStore } from '@/stores/company-store';
import { buildForecastMonthLabels } from '@/lib/forecast-periods';
import { formatLakhs } from '@/lib/utils/indian-format';

const LAKH = 10_000_000;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LoanWizard({ open, onClose }: Props) {
  const fyStartMonth = useCompanyStore((state) => state.activeCompany()?.fyStartMonth ?? 4);
  const forecastMonths = buildForecastMonthLabels({ fyStartMonth });
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [loanName, setLoanName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [startMonth, setStartMonth] = useState(forecastMonths[0]);
  const [termMonths, setTermMonths] = useState('24');
  const [interestRate, setInterestRate] = useState('10');

  const addLoan = useMicroForecastStore((s) => s.addLoan);

  const principalPaise = Math.round(parseFloat(principal || '0') * LAKH);
  const termNum = parseInt(termMonths || '24');
  const rateNum = parseFloat(interestRate || '10');
  const isValid = loanName.trim().length > 0 && principalPaise > 0 && termNum > 0;

  const monthlyPrincipalRepay = principalPaise > 0 && termNum > 0 ? Math.round(principalPaise / termNum) : 0;
  const monthlyRate = rateNum / 100 / 12;
  const firstMonthInterest = Math.round(principalPaise * monthlyRate);
  const totalInterest = Math.round(
    Array.from({ length: Math.min(termNum, forecastMonths.length) }, (_, i) => {
      const remaining = principalPaise - (monthlyPrincipalRepay * i);
      return Math.round(remaining * monthlyRate);
    }).reduce((a, b) => a + b, 0)
  );

  const startIdx = forecastMonths.indexOf(startMonth);
  const monthsActive = startIdx >= 0 ? Math.min(forecastMonths.length - startIdx, termNum) : 0;

  const handleSave = async () => {
    if (!isValid || isSaving) return;

    setIsSaving(true);

    try {
      await addLoan({
        loanName,
        principalAmount: principalPaise,
        startMonth,
        termMonths: termNum,
        annualInterestRate: rateNum
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setStep(1);
    setLoanName('');
    setPrincipal('');
    setStartMonth(forecastMonths[0]);
    setTermMonths('24');
    setInterestRate('10');
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
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 text-sm">🏦</span>
            New Loan
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="loanName">Loan Name / Purpose</Label>
              <Input id="loanName" placeholder="e.g. Machinery Loan, Working Capital" value={loanName} onChange={(e) => setLoanName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="principal">Principal Amount (₹ Lakhs)</Label>
              <Input id="principal" type="number" step="0.1" min="0" placeholder="e.g. 50.0" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
              {principalPaise > 0 && <p className="text-xs text-muted-foreground">= {formatLakhs(principalPaise, 2)}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Disbursement Month</Label>
                <Select value={startMonth} onValueChange={(value) => value && setStartMonth(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {forecastMonths.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tenure (Months)</Label>
                <Input type="number" min="1" max="360" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Annual Interest Rate (%)</Label>
              <Input type="number" step="0.1" min="0" max="50" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Loan Schedule Preview</h3>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly principal repayment</span>
                <span className="font-semibold">{formatLakhs(monthlyPrincipalRepay, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">First month interest</span>
                <span className="font-semibold">{formatLakhs(firstMonthInterest, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">FY interest expense</span>
                <span className="font-semibold text-red-500">{formatLakhs(totalInterest, 2)}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-medium">CF: Financing inflow (M0)</span>
                  <span className="font-bold text-emerald-600">+{formatLakhs(principalPaise, 2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-medium">CF: Monthly outflow</span>
                  <span className="font-bold text-red-500">−{formatLakhs(monthlyPrincipalRepay + firstMonthInterest, 2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-medium">BS: Debt liability</span>
                  <span className="font-bold">+{formatLakhs(principalPaise, 2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-medium">Active FY months</span>
                  <span className="font-bold">{monthsActive}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!isValid || isSaving}>Preview Schedule →</Button>
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
