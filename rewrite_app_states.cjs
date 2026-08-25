const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Find start and end
const startStr = "const [settings, setSettings] = useState<StoreSettings>(() => {";
const endStr = "// Active Invoice Viewer Modal State";

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
  console.log("Could not find start or end index.");
  process.exit(1);
}

const replacement = `const [settings, setSettings] = useFirestoreSync<StoreSettings>('ferreteria_settings', initialStoreSettings);
  const [units, setUnits] = useFirestoreSync<any[]>('ferreteria_units', [
    { id: 'u-1', code: 'UND', name: 'Unidad', symbol: 'und', baseRatio: 1, category: 'CANTIDAD', fractional: false }
  ]);
  const [products, setProducts] = useFirestoreSync<Product[]>('ferreteria_products', initialProducts);
  const [customers, setCustomers] = useFirestoreSync<Customer[]>('ferreteria_customers', initialCustomers);
  const [invoices, setInvoices] = useFirestoreSync<Invoice[]>('ferreteria_invoices', initialInvoices);
  const [cashSession, setCashSession] = useFirestoreSync<CashRegisterSession>('ferreteria_cash_session', {
    id: 'cash-0',
    openedAt: new Date().toISOString(),
    initialCash: 0,
    expectedCash: 0,
    status: 'CERRADA',
    totalSalesCash: 0,
    totalSalesTransfer: 0,
    totalSalesCard: 0,
    totalSalesCredit: 0,
    totalInvoicesCount: 0,
  });

  `;

code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
fs.writeFileSync('src/App.tsx', code);
console.log('Successfully rewrote states in App.tsx');
