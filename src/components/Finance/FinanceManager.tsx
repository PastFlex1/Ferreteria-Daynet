import React, { useState } from 'react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { 
  Landmark, 
  PiggyBank, 
  Coins, 
  Briefcase, 
  PieChart, 
  Plus, 
  Search, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  CreditCard, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Edit3, 
  Trash2, 
  Eye, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Receipt, 
  Calculator, 
  Check, 
  Layers, 
  Send,
  Upload,
  RefreshCw,
  FolderPlus
} from 'lucide-react';
import { FinanceSubTab, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Select } from '../Shared/Select';

interface FinanceManagerProps {
  subTab: FinanceSubTab;
  settings: StoreSettings;
}

// ---------------------------------------------------------------------------
// TYPES & INTERFACES FOR FINANCE
// ---------------------------------------------------------------------------

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: 'Corriente' | 'Ahorros';
  accountNumber: string;
  accountHolder: string;
  currentBalance: number;
  currency: string;
  status: 'ACTIVA' | 'INACTIVA';
  lastReconciliationDate: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  bankName: string;
  type: 'DEPOSITO' | 'RETIRO' | 'TRANSFERENCIA' | 'COMISION';
  amount: number;
  date: string;
  referenceNumber: string;
  description: string;
  reconciled: boolean;
}

export interface BankDeposit {
  id: string;
  depositSlipNumber: string; // N° Papeleta de depósito
  bankAccountId: string;
  bankName: string;
  depositDate: string;
  cashAmount: number;
  checksAmount: number;
  totalAmount: number;
  depositedBy: string;
  notes?: string;
  status: 'CONCILIADO' | 'PENDIENTE';
}

export interface PettyCashExpense {
  id: string;
  receiptNumber: string; // N° Factura / Vale de caja
  date: string;
  category: 'TRANSPORTE' | 'ALIMENTACION' | 'SUMINISTROS' | 'LIMPIEZA' | 'MANTENIMIENTO' | 'OTROS';
  description: string;
  amount: number;
  beneficiary: string;
  approvedBy: string;
}

export interface FixedAsset {
  id: string;
  assetCode: string; // ej: AF-2026-001
  name: string;
  category: 'EQUIPO_COMPUTACION' | 'MAQUINARIA' | 'VEHICULOS' | 'MUEBLES_ENSERES' | 'HERRAMIENTAS';
  purchaseDate: string;
  acquisitionCost: number;
  usefulLifeYears: number; // Vida útil en años
  accumulatedDepreciation: number;
  bookValue: number; // Valor actual en libros
  location: string;
  status: 'EN_USO' | 'EN_MANTENIMIENTO' | 'DE_BAJA';
  serialNumber?: string;
}

export interface BudgetCategory {
  id: string;
  categoryName: string;
  type: 'INGRESO' | 'GASTO';
  budgetedAmount: number;
  actualAmount: number;
  period: string; // ej: "Agosto 2026"
}

export const FinanceManager: React.FC<FinanceManagerProps> = ({
  subTab,
  settings,
}) => {
  // -------------------------------------------------------------------------
  // INITIAL MOCK STATES FOR FINANCE MODULES
  // -------------------------------------------------------------------------

  // 1. BANCOS
  const [bankAccounts, setBankAccounts] = useFirestoreSync<BankAccount[]>('ferreteria_bank_accounts', []);
  const [bankTransactions, setBankTransactions] = useFirestoreSync<BankTransaction[]>('ferreteria_bank_transactions', []);

  // 2. DEPOSITOS
  const [deposits, setDeposits] = useFirestoreSync<BankDeposit[]>('ferreteria_bank_deposits', []);

  // 3. CAJA CHICA
  const pettyCashBaseFund = 0.00;
  const [pettyExpenses, setPettyExpenses] = useFirestoreSync<PettyCashExpense[]>('ferreteria_petty_expenses', []);

  // 4. ACTIVOS FIJOS
  const [fixedAssets, setFixedAssets] = useFirestoreSync<FixedAsset[]>('ferreteria_finance_assets', []);

  // 5. PRESUPUESTO
  const [budgetCategories, setBudgetCategories] = useFirestoreSync<BudgetCategory[]>('ferreteria_budget_categories', []);

  // Search & Modals state
  const [searchTerm, setSearchTerm] = useState('');

  // Modals visibility
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isPettyModalOpen, setIsPettyModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // Forms states
  const [newBankAccount, setNewBankAccount] = useState<Partial<BankAccount>>({
    bankName: '',
    accountType: 'Corriente',
    accountNumber: '',
    accountHolder: settings.storeName || 'FERRETERÍA POS',
    currentBalance: 0
  });

  const [newDeposit, setNewDeposit] = useState({
    bankAccountId: '',
    cashAmount: '',
    checksAmount: '',
    depositedBy: '',
    notes: '',
    depositSlipNumber: `DEP-${Date.now().toString().slice(-6)}`
  });

  const [newPettyExpense, setNewPettyExpense] = useState({
    receiptNumber: `VALE-${(pettyExpenses.length + 1).toString().padStart(3, '0')}`,
    category: 'SUMINISTROS' as PettyCashExpense['category'],
    description: '',
    amount: '',
    beneficiary: ''
  });

  const [newAsset, setNewAsset] = useState<Partial<FixedAsset>>({
    assetCode: `AF-${new Date().getFullYear()}-${(fixedAssets.length + 1).toString().padStart(3, '0')}`,
    name: '',
    category: 'EQUIPO_COMPUTACION',
    acquisitionCost: 0,
    usefulLifeYears: 3,
    location: 'Local Principal',
    serialNumber: ''
  });

  const [newBudgetItem, setNewBudgetItem] = useState<Partial<BudgetCategory>>({
    categoryName: '',
    type: 'GASTO',
    budgetedAmount: 0,
    actualAmount: 0,
    period: 'Agosto 2026'
  });

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------

  // Save Bank Account
  const handleSaveBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankAccount.bankName || !newBankAccount.accountNumber) return;

    const acc: BankAccount = {
      id: `bank-${Date.now()}`,
      bankName: newBankAccount.bankName,
      accountType: newBankAccount.accountType || 'Corriente',
      accountNumber: newBankAccount.accountNumber,
      accountHolder: newBankAccount.accountHolder || 'EMPRESA POS',
      currentBalance: parseFloat(newBankAccount.currentBalance?.toString() || '0') || 0,
      currency: 'USD',
      status: 'ACTIVA',
      lastReconciliationDate: new Date().toISOString().split('T')[0]
    };

    setBankAccounts([...bankAccounts, acc]);
    setIsBankModalOpen(false);
    setNewBankAccount({
      bankName: '',
      accountType: 'Corriente',
      accountNumber: '',
      accountHolder: settings.storeName || 'FERRETERÍA POS',
      currentBalance: 0
    });
  };

  // Save Bank Deposit
  const handleSaveDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(newDeposit.cashAmount) || 0;
    const checks = parseFloat(newDeposit.checksAmount) || 0;
    const total = cash + checks;
    if (total <= 0 || !newDeposit.bankAccountId) return;

    const selectedBank = bankAccounts.find((b) => b.id === newDeposit.bankAccountId);

    const dep: BankDeposit = {
      id: `dep-${Date.now()}`,
      depositSlipNumber: newDeposit.depositSlipNumber || `DEP-${Date.now().toString().slice(-4)}`,
      bankAccountId: newDeposit.bankAccountId,
      bankName: selectedBank ? `${selectedBank.bankName} (${selectedBank.accountNumber})` : 'Cuenta Principal',
      depositDate: new Date().toISOString().split('T')[0],
      cashAmount: cash,
      checksAmount: checks,
      totalAmount: total,
      depositedBy: newDeposit.depositedBy || 'Cajero de Turno',
      notes: newDeposit.notes || '',
      status: 'CONCILIADO'
    };

    setDeposits([dep, ...deposits]);

    // Update Bank Account Balance
    if (selectedBank) {
      setBankAccounts(
        bankAccounts.map((b) =>
          b.id === selectedBank.id ? { ...b, currentBalance: b.currentBalance + total } : b
        )
      );
    }

    setIsDepositModalOpen(false);
    setNewDeposit({
      bankAccountId: '',
      cashAmount: '',
      checksAmount: '',
      depositedBy: '',
      notes: '',
      depositSlipNumber: `DEP-${Date.now().toString().slice(-6)}`
    });
  };

  // Save Petty Cash Expense
  const handleSavePettyExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newPettyExpense.amount) || 0;
    if (amt <= 0 || !newPettyExpense.description) return;

    const exp: PettyCashExpense = {
      id: `pe-${Date.now()}`,
      receiptNumber: newPettyExpense.receiptNumber || `VALE-${Date.now().toString().slice(-3)}`,
      date: new Date().toISOString().split('T')[0],
      category: newPettyExpense.category,
      description: newPettyExpense.description,
      amount: amt,
      beneficiary: newPettyExpense.beneficiary || 'Proveedor Local',
      approvedBy: 'Administrador'
    };

    setPettyExpenses([exp, ...pettyExpenses]);
    setIsPettyModalOpen(false);
    setNewPettyExpense({
      receiptNumber: `VALE-${(pettyExpenses.length + 2).toString().padStart(3, '0')}`,
      category: 'SUMINISTROS',
      description: '',
      amount: '',
      beneficiary: ''
    });
  };

  // Save Fixed Asset
  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(newAsset.acquisitionCost?.toString() || '0') || 0;
    if (!newAsset.name || cost <= 0) return;

    const usefulLife = newAsset.usefulLifeYears || 3;
    const asset: FixedAsset = {
      id: `af-${Date.now()}`,
      assetCode: newAsset.assetCode || `AF-${Date.now().toString().slice(-4)}`,
      name: newAsset.name,
      category: newAsset.category || 'EQUIPO_COMPUTACION',
      purchaseDate: new Date().toISOString().split('T')[0],
      acquisitionCost: cost,
      usefulLifeYears: usefulLife,
      accumulatedDepreciation: 0,
      bookValue: cost,
      location: newAsset.location || 'Local Principal',
      status: 'EN_USO',
      serialNumber: newAsset.serialNumber || 'SN-N/A'
    };

    setFixedAssets([...fixedAssets, asset]);
    setIsAssetModalOpen(false);
    setNewAsset({
      assetCode: `AF-${new Date().getFullYear()}-${(fixedAssets.length + 2).toString().padStart(3, '0')}`,
      name: '',
      category: 'EQUIPO_COMPUTACION',
      acquisitionCost: 0,
      usefulLifeYears: 3,
      location: 'Local Principal',
      serialNumber: ''
    });
  };

  // Save Budget Item
  const handleSaveBudgetItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudgetItem.categoryName) return;

    const item: BudgetCategory = {
      id: `b-${Date.now()}`,
      categoryName: newBudgetItem.categoryName,
      type: newBudgetItem.type || 'GASTO',
      budgetedAmount: parseFloat(newBudgetItem.budgetedAmount?.toString() || '0') || 0,
      actualAmount: parseFloat(newBudgetItem.actualAmount?.toString() || '0') || 0,
      period: newBudgetItem.period || 'Agosto 2026'
    };

    setBudgetCategories([...budgetCategories, item]);
    setIsBudgetModalOpen(false);
    setNewBudgetItem({
      categoryName: '',
      type: 'GASTO',
      budgetedAmount: 0,
      actualAmount: 0,
      period: 'Agosto 2026'
    });
  };

  // Calculations for Petty Cash
  const totalPettySpent = pettyExpenses.reduce((acc, e) => acc + e.amount, 0);
  const remainingPettyCash = pettyCashBaseFund - totalPettySpent;

  // Calculations for Fixed Assets
  const totalAssetsValue = fixedAssets.reduce((acc, a) => acc + a.acquisitionCost, 0);
  const totalAssetsBookValue = fixedAssets.reduce((acc, a) => acc + a.bookValue, 0);

  // Calculations for Bank Totals
  const totalBankBalance = bankAccounts.reduce((acc, b) => acc + b.currentBalance, 0);

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------
          SUBTAB 1: BANCOS
         --------------------------------------------------------------------- */}
      {subTab === 'BANCOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-blue-500" />
                <span>Gestión de Cuentas Bancarias & Tesorería</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Control de saldos en entidades financieras, conciliaciones e historial de transferencias.
              </p>
            </div>

            <button
              onClick={() => setIsBankModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Cuenta Bancaria</span>
            </button>
          </div>

          {/* Cards metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Total Bancos</div>
                <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                  {formatCurrency(totalBankBalance, settings.currencySymbol)}
                </div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <Landmark className="w-6 h-6 text-emerald-400" />
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cuentas Registradas</div>
                <div className="text-2xl font-black font-mono text-blue-400 mt-1">{bankAccounts.length} Cuentas</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <CreditCard className="w-6 h-6 text-blue-400" />
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Última Conciliación</div>
                <div className="text-2xl font-black font-mono text-amber-400 mt-1">Hace 2 días</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <CheckCircle2 className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bankAccounts.map((acc) => (
              <div key={acc.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-400 hover:shadow-md transition space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 font-extrabold text-[10px] rounded-lg uppercase">
                    {acc.accountType}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">Ref: {acc.currency}</span>
                </div>

                <div>
                  <h3 className="font-black text-slate-900 text-sm">{acc.bankName}</h3>
                  <p className="font-mono text-xs text-slate-600 font-bold">N° {acc.accountNumber}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{acc.accountHolder}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Saldo Disponible</span>
                    <span className="font-mono font-black text-emerald-600 text-lg">
                      {formatCurrency(acc.currentBalance, settings.currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Transactions table */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Movimientos de Cuenta & Conciliación</span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-950 text-white font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Banco / Cuenta</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Descripción / Referencia</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                  {bankTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2 px-3 text-slate-500 font-bold">{tx.date}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{tx.bankName}</td>
                      <td className="py-2 px-3 font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          tx.type === 'DEPOSITO' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {tx.description} <span className="text-slate-400 font-bold">({tx.referenceNumber})</span>
                      </td>
                      <td className={`py-2 px-3 text-right font-black ${
                        tx.type === 'DEPOSITO' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {tx.type === 'DEPOSITO' ? '+' : '-'}{formatCurrency(tx.amount, settings.currencySymbol)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px]">
                          Conciliado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 2: DEPOSITOS
         --------------------------------------------------------------------- */}
      {subTab === 'DEPOSITOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-emerald-500" />
                <span>Control de Depósitos Bancarios & Remesas</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro de papeletas de depósito bancario provenientes de la recaudación diaria de ventas.
              </p>
            </div>

            <button
              onClick={() => setIsDepositModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Nuevo Depósito</span>
            </button>
          </div>

          {/* Table of Deposits */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Papeleta / Ref</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Banco Destino</th>
                  <th className="py-3 px-4 text-right">Efectivo</th>
                  <th className="py-3 px-4 text-right">Cheques</th>
                  <th className="py-3 px-4 text-right">Monto Total</th>
                  <th className="py-3 px-4">Depositado Por</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {deposits.map((dep) => (
                  <tr key={dep.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-black text-slate-900">{dep.depositSlipNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{dep.depositDate}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{dep.bankName}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-600">
                      {formatCurrency(dep.cashAmount, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-600">
                      {formatCurrency(dep.checksAmount, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                      {formatCurrency(dep.totalAmount, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-sans">{dep.depositedBy}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        dep.status === 'CONCILIADO'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {dep.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 3: CAJA CHICA
         --------------------------------------------------------------------- */}
      {subTab === 'CAJA_CHICA' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span>Control de Caja Chica & Fondo Fijo</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Administración de gastos menores de papelería, limpieza, transporte y caja chica operacional.
              </p>
            </div>

            <button
              onClick={() => setIsPettyModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Gasto de Caja Chica</span>
            </button>
          </div>

          {/* Cards for Petty Cash summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fondo Fijo Asignado</div>
              <div className="text-2xl font-black font-mono text-amber-400 mt-1">
                {formatCurrency(pettyCashBaseFund, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gastos Acumulados</div>
              <div className="text-2xl font-black font-mono text-rose-400 mt-1">
                {formatCurrency(totalPettySpent, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Disponible en Caja</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {formatCurrency(remainingPettyCash, settings.currencySymbol)}
              </div>
            </div>
          </div>

          {/* Petty Cash Expenses List */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Vale / Comprobante</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Descripción del Gasto</th>
                  <th className="py-3 px-4">Beneficiario / Proveedor</th>
                  <th className="py-3 px-4 text-right">Monto ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pettyExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 font-mono text-[11px]">
                    <td className="py-3 px-4 font-black text-slate-900">{exp.receiptNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{exp.date}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded text-[10px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-800">{exp.description}</td>
                    <td className="py-3 px-4 text-slate-600 font-sans">{exp.beneficiary}</td>
                    <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                      {formatCurrency(exp.amount, settings.currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 4: ACTIVOS FIJOS
         --------------------------------------------------------------------- */}
      {subTab === 'ACTIVOS_FIJOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-500" />
                <span>Control de Activos Fijos & Propiedad</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inventario físico de bienes corporativos, equipos de computación, muebles y cálculo de depreciación.
              </p>
            </div>

            <button
              onClick={() => setIsAssetModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Activo Fijo</span>
            </button>
          </div>

          {/* Asset Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor de Adquisición Total</div>
              <div className="text-2xl font-black font-mono text-indigo-400 mt-1">
                {formatCurrency(totalAssetsValue, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor Actual en Libros</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {formatCurrency(totalAssetsBookValue, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unidades de Bienes</div>
              <div className="text-2xl font-black font-mono text-amber-400 mt-1">{fixedAssets.length} Activos</div>
            </div>
          </div>

          {/* Asset Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fixedAssets.map((asset) => (
              <div key={asset.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 transition space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-slate-400 uppercase">{asset.assetCode}</span>
                    <h3 className="font-black text-slate-900 text-sm">{asset.name}</h3>
                  </div>
                  <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px] rounded-full uppercase">
                    {asset.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Costo Adquisición</span>
                    <span className="font-bold text-slate-800">{formatCurrency(asset.acquisitionCost, settings.currencySymbol)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Valor en Libros</span>
                    <span className="font-black text-emerald-600">{formatCurrency(asset.bookValue, settings.currencySymbol)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Ubicación: <strong className="text-slate-800">{asset.location}</strong></span>
                  <span className="font-mono">Vida Útil: {asset.usefulLifeYears} Años</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 5: PRESUPUESTO
         --------------------------------------------------------------------- */}
      {subTab === 'PRESUPUESTO' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-500" />
                <span>Presupuesto Operativo & Ejecución Financiera</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Proyección mensual de ingresos, gastos operacionales y control de variaciones presupuestarias.
              </p>
            </div>

            <button
              onClick={() => setIsBudgetModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Partida Presupuestaria</span>
            </button>
          </div>

          {/* Budget Items Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Partida / Categoría</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4 text-right">Presupuestado</th>
                  <th className="py-3 px-4 text-right">Ejecutado Real</th>
                  <th className="py-3 px-4 text-center">% Cumplimiento</th>
                  <th className="py-3 px-4 text-right">Variación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {budgetCategories.map((item) => {
                  const pct = Math.round((item.actualAmount / (item.budgetedAmount || 1)) * 100);
                  const diff = item.type === 'INGRESO' ? item.actualAmount - item.budgetedAmount : item.budgetedAmount - item.actualAmount;
                  const isPositive = diff >= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900 font-sans">{item.categoryName}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          item.type === 'INGRESO' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        {formatCurrency(item.budgetedAmount, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(item.actualAmount, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${pct > 100 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="font-bold text-[10px]">{pct}%</span>
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-right font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(diff, settings.currencySymbol)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODALS
         --------------------------------------------------------------------- */}

      {/* Modal 1: Agregar Cuenta Bancaria */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-blue-500" />
                <span>Registrar Cuenta Bancaria</span>
              </h3>
              <button onClick={() => setIsBankModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBankAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">Nombre de la Entidad Bancaria *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Banco Pichincha / Banco Guayaquil"
                  value={newBankAccount.bankName}
                  onChange={(e) => setNewBankAccount({ ...newBankAccount, bankName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Tipo de Cuenta</label>
                  <Select
                    value={newBankAccount.accountType}
                    onChange={(e) => setNewBankAccount({ ...newBankAccount, accountType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="Corriente">Corriente</option>
                    <option value="Ahorros">Ahorros</option>
                  </Select>
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">N° de Cuenta *</label>
                  <input
                    type="text"
                    required
                    placeholder="2100876543"
                    value={newBankAccount.accountNumber}
                    onChange={(e) => setNewBankAccount({ ...newBankAccount, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Titular de la Cuenta</label>
                <input
                  type="text"
                  value={newBankAccount.accountHolder}
                  onChange={(e) => setNewBankAccount({ ...newBankAccount, accountHolder: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Saldo Inicial ($)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newBankAccount.currentBalance}
                  onChange={(e) => setNewBankAccount({ ...newBankAccount, currentBalance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-emerald-600"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsBankModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl cursor-pointer">
                  Guardar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Registrar Depósito Bancario */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-emerald-500" />
                <span>Registrar Depósito Bancario</span>
              </h3>
              <button onClick={() => setIsDepositModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDeposit} className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">Cuenta Bancaria Destino *</label>
                <Select
                  required
                  value={newDeposit.bankAccountId}
                  onChange={(e) => setNewDeposit({ ...newDeposit, bankAccountId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="">-- Seleccionar Banco --</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - Cta #{b.accountNumber}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Monto Efectivo ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    value={newDeposit.cashAmount}
                    onChange={(e) => setNewDeposit({ ...newDeposit, cashAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Monto Cheques ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    value={newDeposit.checksAmount}
                    onChange={(e) => setNewDeposit({ ...newDeposit, checksAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">N° Papeleta de Depósito *</label>
                <input
                  type="text"
                  required
                  value={newDeposit.depositSlipNumber}
                  onChange={(e) => setNewDeposit({ ...newDeposit, depositSlipNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Depositado Por</label>
                <input
                  type="text"
                  placeholder="Carlos Mendoza (Cajero)"
                  value={newDeposit.depositedBy}
                  onChange={(e) => setNewDeposit({ ...newDeposit, depositedBy: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsDepositModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl cursor-pointer">
                  Guardar Depósito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Gasto de Caja Chica */}
      {isPettyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span>Nuevo Gasto de Caja Chica</span>
              </h3>
              <button onClick={() => setIsPettyModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePettyExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">Categoría del Gasto</label>
                <Select
                  value={newPettyExpense.category}
                  onChange={(e) => setNewPettyExpense({ ...newPettyExpense, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="SUMINISTROS">Suministros de Oficina</option>
                  <option value="TRANSPORTE">Transporte / Fletes</option>
                  <option value="LIMPIEZA">Limpieza y Aseo</option>
                  <option value="ALIMENTACION">Alimentación / Refrigerio</option>
                  <option value="MANTENIMIENTO">Mantenimiento Menor</option>
                  <option value="OTROS">Otros Gastos Operativos</option>
                </Select>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Descripción del Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Compra de marcadores y carpetas"
                  value={newPettyExpense.description}
                  onChange={(e) => setNewPettyExpense({ ...newPettyExpense, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Monto del Gasto ($) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    placeholder="15.00"
                    value={newPettyExpense.amount}
                    onChange={(e) => setNewPettyExpense({ ...newPettyExpense, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-rose-600 text-base"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Beneficiario / Vendedor</label>
                  <input
                    type="text"
                    placeholder="Papelería Express"
                    value={newPettyExpense.beneficiary}
                    onChange={(e) => setNewPettyExpense({ ...newPettyExpense, beneficiary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsPettyModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl cursor-pointer">
                  Registrar Vale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Registrar Activo Fijo */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-500" />
                <span>Registrar Activo Fijo</span>
              </h3>
              <button onClick={() => setIsAssetModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">Nombre del Activo / Bien *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Impresora Láser Multifunción HP"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Categoría</label>
                  <Select
                    value={newAsset.category}
                    onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="EQUIPO_COMPUTACION">Equipo de Computación</option>
                    <option value="MUEBLES_ENSERES">Muebles y Enseres</option>
                    <option value="MAQUINARIA">Maquinaria & Equipos</option>
                    <option value="VEHICULOS">Vehículos</option>
                    <option value="HERRAMIENTAS">Herramientas Especiales</option>
                  </Select>
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Costo Adquisición ($) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    placeholder="450.00"
                    value={newAsset.acquisitionCost}
                    onChange={(e) => setNewAsset({ ...newAsset, acquisitionCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Vida Útil (Años)</label>
                  <input
                    type="number"
                    value={newAsset.usefulLifeYears}
                    onChange={(e) => setNewAsset({ ...newAsset, usefulLifeYears: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Ubicación</label>
                  <input
                    type="text"
                    placeholder="Caja Principal / Bodega"
                    value={newAsset.location}
                    onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsAssetModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl cursor-pointer">
                  Guardar Activo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Agregar Partida Presupuestaria */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-500" />
                <span>Partida Presupuestaria</span>
              </h3>
              <button onClick={() => setIsBudgetModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudgetItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">Nombre de la Categoría *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Ventas de Canal Online"
                  value={newBudgetItem.categoryName}
                  onChange={(e) => setNewBudgetItem({ ...newBudgetItem, categoryName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Tipo Partida</label>
                  <Select
                    value={newBudgetItem.type}
                    onChange={(e) => setNewBudgetItem({ ...newBudgetItem, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="INGRESO">Ingreso Proyectado</option>
                    <option value="GASTO">Gasto Proyectado</option>
                  </Select>
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Monto Presupuestado ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newBudgetItem.budgetedAmount}
                    onChange={(e) => setNewBudgetItem({ ...newBudgetItem, budgetedAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsBudgetModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl cursor-pointer">
                  Guardar Partida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
