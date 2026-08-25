const fs = require('fs');
let code = fs.readFileSync('src/components/Accounting/AccountingManager.tsx', 'utf8');

// 1. Zero out balances in accountPlan
// It looks like `balance: 45890.50` etc.
code = code.replace(/balance:\s*\d+(\.\d+)?/g, 'balance: 0');

// 2. Empty fiscalPeriods
const oldFiscalPeriodsStr = `const [fiscalPeriods, setFiscalPeriods] = useState<FiscalPeriod[]>([
    { year: 2026, monthName: 'Enero', status: 'CERRADO', closedDate: '2026-02-05', closingEntriesCount: 142 },
    { year: 2026, monthName: 'Febrero', status: 'CERRADO', closedDate: '2026-03-05', closingEntriesCount: 138 },
    { year: 2026, monthName: 'Marzo', status: 'CERRADO', closedDate: '2026-04-04', closingEntriesCount: 160 },
    { year: 2026, monthName: 'Abril', status: 'CERRADO', closedDate: '2026-05-05', closingEntriesCount: 155 },
    { year: 2026, monthName: 'Mayo', status: 'CERRADO', closedDate: '2026-06-03', closingEntriesCount: 172 },
    { year: 2026, monthName: 'Junio', status: 'CERRADO', closedDate: '2026-07-04', closingEntriesCount: 180 },
    { year: 2026, monthName: 'Julio', status: 'CERRADO', closedDate: '2026-08-04', closingEntriesCount: 195 },
    { year: 2026, monthName: 'Agosto', status: 'ABIERTO', closingEntriesCount: 82 }
  ]);`;
const newFiscalPeriodsStr = `const [fiscalPeriods, setFiscalPeriods] = useState<FiscalPeriod[]>([]);`;
if (code.includes(oldFiscalPeriodsStr)) {
  code = code.replace(oldFiscalPeriodsStr, newFiscalPeriodsStr);
}

fs.writeFileSync('src/components/Accounting/AccountingManager.tsx', code);
console.log("Mock data updated.");
