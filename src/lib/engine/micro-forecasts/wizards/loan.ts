import { MicroForecast, MicroForecastLine } from '../overlay';

export interface LoanWizardInputs {
  loanName: string;
  principalAmount: number; // in paise
  startMonth: string;
  termMonths: number;
  annualInterestRate: number; // percentage (e.g. 10 for 10%)
}

export function generateLoanMicroForecast(
  id: string,
  inputs: LoanWizardInputs,
  forecastMonths: string[]
): MicroForecast {
  const plImpacts = new Array(forecastMonths.length).fill(0); // Interest Expense
  const cashImpacts = new Array(forecastMonths.length).fill(0); // Principal Drawdown/Repayment

  const monthlyPrincipal = Math.round(inputs.principalAmount / inputs.termMonths);
  const monthlyRate = (inputs.annualInterestRate / 100) / 12;

  let active = false;
  let remainingPrincipal = 0;
  let monthsCount = 0;

  for (let i = 0; i < forecastMonths.length; i++) {
    if (forecastMonths[i] === inputs.startMonth) {
      active = true;
      remainingPrincipal = inputs.principalAmount;
      // Net cash impact for the start month = Drawdown
      cashImpacts[i] += inputs.principalAmount; 
    }

    if (active && monthsCount < inputs.termMonths && remainingPrincipal > 0) {
      // Calculate interest on remaining balance BEFORE paying principal
      const interest = Math.round(remainingPrincipal * monthlyRate);
      
      plImpacts[i] = interest;

      // FIX audit3 M5: Final month gets the EXACT remaining principal, not monthlyPrincipal
      const isLastMonth = monthsCount === inputs.termMonths - 1;
      const principalPayment = isLastMonth ? remainingPrincipal : Math.min(monthlyPrincipal, remainingPrincipal);

      cashImpacts[i] -= principalPayment;
      
      remainingPrincipal -= principalPayment;
      monthsCount++;
    }
  }

  const line: MicroForecastLine = {
    category: 'Debt',
    plImpacts,  // Interest expense
    cashImpacts // Net debt (Drawdown - Repayment)
  };

  return {
    id,
    name: `Loan: ${inputs.loanName}`,
    lines: [line]
  };
}
