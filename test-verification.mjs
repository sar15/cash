// TEST 1.2: Three-Way Balance on Demo Data
// TEST 1.3: Value Rules verification

// We'll dynamically import the compiled engine
import { execSync } from 'child_process';

// Use tsx to run TypeScript directly
const tsCode = `
import { runForecastEngine } from './src/lib/engine/index';
import { demoValueRules } from './src/lib/demo-data';

// TEST 1.2: Run baseline engine
const result = runForecastEngine();
const months = result.rawIntegrationResults;

console.log("=== TEST 1.2: Three-Way Balance on Demo Data ===");
let passCount = 0;
for (let i = 0; i < months.length; i++) {
  const m = months[i];
  const bsDiff = Math.abs(m.bs.totalAssets - (m.bs.totalLiabilities + m.bs.totalEquity));
  
  // Calculate opening cash (from previous month or opening)
  const openingCash = i === 0 ? (result.rawIntegrationResults[0].bs.cash - result.rawIntegrationResults[0].cf.netCashFlow) : result.rawIntegrationResults[i-1].bs.cash;
  const cfDiff = Math.abs(m.bs.cash - (openingCash + m.cf.operatingCashFlow + m.cf.investingCashFlow + m.cf.financingCashFlow));
  
  const bsPass = bsDiff <= 1;
  const cfPass = cfDiff <= 1;
  const pass = bsPass && cfPass;
  
  console.log(\`Month \${i+1}: BS diff=\${bsDiff}, CF diff=\${cfDiff} → \${pass ? 'PASS' : 'FAIL'}\`);
  if (pass) passCount++;
}
console.log(\`\\nResult: \${passCount}/\${months.length} months balanced\\n\`);

// TEST 1.3: Value Rules
console.log("=== TEST 1.3: Value Rules ===");
console.log("Revenue (rev-1) rule type:", demoValueRules['rev-1']?.type);
console.log("Salaries (exp-1) rule type:", demoValueRules['exp-1']?.type);

// Direct entry test
const directEntryRules = JSON.parse(JSON.stringify(demoValueRules));
directEntryRules['rev-1'] = {
  type: 'direct_entry',
  accountId: 'rev-1',
  entries: [500000000, 550000000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};

const result2 = runForecastEngine({ valueRules: directEntryRules });
console.log("Direct entry Month 1 revenue:", result2.accountForecasts['rev-1']?.[0], "(expected 500000000)");
console.log("Direct entry Month 2 revenue:", result2.accountForecasts['rev-1']?.[1], "(expected 550000000)");

const m1Match = result2.accountForecasts['rev-1']?.[0] === 500000000;
const m2Match = result2.accountForecasts['rev-1']?.[1] === 550000000;
console.log("Values correct:", m1Match && m2Match ? "PASS" : "FAIL");

// Verify three-way still balances
const months2 = result2.rawIntegrationResults;
let allBalanced = true;
for (let i = 0; i < months2.length; i++) {
  const m = months2[i];
  const bsDiff = Math.abs(m.bs.totalAssets - (m.bs.totalLiabilities + m.bs.totalEquity));
  if (bsDiff > 1) {
    allBalanced = false;
    console.log(\`Month \${i+1} UNBALANCED after direct_entry change: BS diff=\${bsDiff}\`);
  }
}
console.log("Three-way balance after direct_entry:", allBalanced ? "PASS" : "FAIL");
`;

execSync(`npx tsx -e '${tsCode.replace(/'/g, "'\\''")}'`, { 
  cwd: process.cwd(), 
  stdio: 'inherit' 
});
