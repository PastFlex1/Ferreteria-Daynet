import React, { useState, useMemo } from 'react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { es } from 'date-fns/locale';
registerLocale('es', es);
import { 
  BookOpen, 
  Receipt, 
  CreditCard, 
  Landmark, 
  FileText, 
  FileX, 
  Calculator, 
  FileSpreadsheet, 
  Scale, 
  Building2, 
  TrendingUp, 
  ClipboardCheck, 
  FolderTree, 
  Sliders, 
  Calendar, 
  FileCheck2, 
  Clock, 
  Plus, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Check, 
  Layers, 
  Download, 
  Lock, 
  Unlock, 
  Settings, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  Filter,
  Printer,
  ChevronRight,
  FileCode,
  Tag
} from 'lucide-react';
import { AccountingSubTab, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Select } from '../Shared/Select';

interface AccountingManagerProps {
  subTab: AccountingSubTab;
  settings: StoreSettings;
}

// ---------------------------------------------------------------------------
// INTERFACES FOR ACCOUNTING
// ---------------------------------------------------------------------------

export interface IssuedCheck {
  id: string;
  checkNumber: string;
  bankName: string;
  issueDate: string;
  paymentDate: string;
  beneficiary: string;
  amount: number;
  concept: string;
  status: 'GIRADO' | 'COBRADO' | 'ANULADO';
}

export interface PostdatedCheck {
  id: string;
  checkNumber: string;
  bankName: string;
  issuer: string;
  receptionDate: string;
  depositDate: string;
  amount: number;
  type: 'RECIBIDO' | 'EMITIDO';
  status: 'EN_CUSTODIA' | 'DEPOSITADO' | 'PROTESTADO';
}

export interface CardReconciliation {
  id: string;
  batchNumber: string; // N° Lote
  processor: 'Datafast' | 'Medianet' | 'Diners Club' | 'Visa/Mastercard Direct';
  date: string;
  grossAmount: number;
  commissionAmount: number;
  taxRetained: number;
  netAmount: number;
  status: 'CONCILIADO' | 'PENDIENTE';
}

export interface JournalEntryItem {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string; // ej: ASI-2026-0082
  date: string;
  concept: string;
  type: 'DIARIO' | 'INGRESO' | 'EGRESO' | 'AJUSTE' | 'CIERRE';
  items: JournalEntryItem[];
  totalDebit: number;
  totalCredit: number;
  status: 'ASENTADO' | 'BORRADOR';
}

export interface AccountPlanItem {
  code: string;
  name: string;
  level: number;
  type: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO';
  nature: 'DEUDORA' | 'ACREEDORA';
  acceptsMovement: boolean;
  balance: number;
}

export interface FiscalPeriod {
  year: number;
  monthName: string;
  status: 'ABIERTO' | 'CERRADO';
  closedDate?: string;
  closingEntriesCount: number;
}

export const AccountingManager: React.FC<AccountingManagerProps> = ({
  subTab,
  settings,
}) => {
  // -------------------------------------------------------------------------
  // MOCK DATA STATES
  // -------------------------------------------------------------------------

  // 1. Cheques Girados
  const [issuedChecks, setIssuedChecks] = useFirestoreSync<IssuedCheck[]>('ferreteria_issued_checks', []);

  // 2. Cheques Posfechados
  const [postdatedChecks, setPostdatedChecks] = useFirestoreSync<PostdatedCheck[]>('ferreteria_postdated_checks', []);

  // 3. Conciliación de Tarjetas
  const [cardReconciliations, setCardReconciliations] = useFirestoreSync<CardReconciliation[]>('ferreteria_card_reconciliations', []);

  // 4. Asientos Contables / Libro Diario
  const [journalEntries, setJournalEntries] = useFirestoreSync<JournalEntry[]>('ferreteria_journal_entries', []);

  // 5. Plan de Cuentas NIIF
  const [accountPlan, setAccountPlan] = useFirestoreSync<AccountPlanItem[]>('ferreteria_account_plan', [
    { code: '1.0.00.00.00', name: 'ACTIVO', level: 1, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
    { code: '1.1.00.00.00', name: 'ACTIVO CORRIENTE', level: 2, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
    { code: '1.1.01.00.00', name: 'EFECTIVO Y EQUIVALENTES DE EFECTIVO', level: 3, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
    { code: '1.1.01.01.01', name: 'Caja General Mostrador', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
    { code: '1.1.01.02.01', name: 'Banco Pichincha Cta Cte #2100876543', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
    { code: '1.1.01.02.02', name: 'Banco Guayaquil Cta Cte #0012876451', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
    { code: '1.1.03.01.01', name: 'Inventario de Mercaderías Ferretería', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
    { code: '2.0.00.00.00', name: 'PASIVO', level: 1, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
    { code: '2.1.01.01.01', name: 'Cuentas por Pagar Proveedores Locales', level: 4, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
    { code: '2.1.04.01.01', name: 'IVA Cobrado por Pagar SRI', level: 4, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
    { code: '3.0.00.00.00', name: 'PATRIMONIO', level: 1, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
    { code: '3.1.01.01.01', name: 'Capital Social Suscrito', level: 4, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
    { code: '3.3.01.01.01', name: 'Utilidades Acumuladas Ejercicios Anteriores', level: 4, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
    { code: '4.0.00.00.00', name: 'INGRESOS', level: 1, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
    { code: '4.1.01.01.01', name: 'Ventas de Mercadería Mostrador', level: 4, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
    { code: '5.0.00.00.00', name: 'GASTOS', level: 1, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
    { code: '5.1.01.01.01', name: 'Costo de Ventas Ferretería', level: 4, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
    { code: '5.2.01.01.01', name: 'Gastos de Personal / Sueldos', level: 4, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
    { code: '5.2.01.02.01', name: 'Gastos de Arriendo de Local', level: 4, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
    { code: '5.2.01.03.01', name: 'Servicios Básicos y Comunicaciones', level: 4, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 }
  ]);

  // 6. Periodos Fiscales
  const [fiscalPeriods, setFiscalPeriods] = useFirestoreSync<FiscalPeriod[]>('ferreteria_fiscal_periods', []);

  // 7. Global Collections for real calculations
  const [invoices] = useFirestoreSync<any[]>('ferreteria_invoices', []);
  const [purchases] = useFirestoreSync<any[]>('ferreteria_purchases', []);
  const [retenciones] = useFirestoreSync<any[]>('ferreteria_retenciones', []);
  const [bankAccounts] = useFirestoreSync<any[]>('ferreteria_bank_accounts', []);

  // Dynamic Metrics
  const totalActivos = React.useMemo(() => accountPlan.filter(a => a.type === 'ACTIVO' && a.acceptsMovement).reduce((acc, c) => acc + (c.balance || 0), 0), [accountPlan]);
  const totalPasivos = React.useMemo(() => accountPlan.filter(a => a.type === 'PASIVO' && a.acceptsMovement).reduce((acc, c) => acc + (c.balance || 0), 0), [accountPlan]);
  const totalPatrimonio = React.useMemo(() => accountPlan.filter(a => a.type === 'PATRIMONIO' && a.acceptsMovement).reduce((acc, c) => acc + (c.balance || 0), 0), [accountPlan]);
  const totalIngresos = React.useMemo(() => {
    const fromAccounts = accountPlan.filter(a => a.type === 'INGRESO' && a.acceptsMovement).reduce((acc, c) => acc + (c.balance || 0), 0);
    const fromInvoices = invoices.filter(i => i.paymentStatus !== 'ANULADA' && i.documentType !== 'COTIZACION').reduce((acc, i) => acc + (i.total || 0), 0);
    return Math.max(fromAccounts, fromInvoices);
  }, [accountPlan, invoices]);
  const totalGastos = React.useMemo(() => {
    const fromAccounts = accountPlan.filter(a => a.type === 'GASTO' && a.acceptsMovement).reduce((acc, c) => acc + (c.balance || 0), 0);
    const fromPurchases = purchases.reduce((acc, p) => acc + (p.total || 0), 0);
    return Math.max(fromAccounts, fromPurchases);
  }, [accountPlan, purchases]);
  const utilidadNeta = React.useMemo(() => totalIngresos - totalGastos, [totalIngresos, totalGastos]);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals visibility
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // New Check form state
  const [newCheck, setNewCheck] = useState<Partial<IssuedCheck>>({
    checkNumber: '',
    bankName: 'Banco Pichincha',
    paymentDate: new Date().toISOString().split('T')[0],
    beneficiary: '',
    amount: 0,
    concept: ''
  });

  // New Entry form state
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'DIARIO' as JournalEntry['type'],
    concept: '',
    debitAccount: '1.1.01.01.01',
    creditAccount: '4.1.01.01.01',
    amount: ''
  });

  // New Account form state
  const [newAccount, setNewAccount] = useState<Partial<AccountPlanItem>>({
    code: '',
    name: '',
    level: 4,
    type: 'ACTIVO',
    nature: 'DEUDORA',
    acceptsMovement: true
  });

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------

  const handleSaveIssuedCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheck.checkNumber || !newCheck.beneficiary || !newCheck.amount) return;

    const chk: IssuedCheck = {
      id: `chk-${Date.now()}`,
      checkNumber: newCheck.checkNumber,
      bankName: newCheck.bankName || 'Banco Pichincha',
      issueDate: new Date().toISOString().split('T')[0],
      paymentDate: newCheck.paymentDate || new Date().toISOString().split('T')[0],
      beneficiary: newCheck.beneficiary,
      amount: parseFloat(newCheck.amount.toString()) || 0,
      concept: newCheck.concept || 'Pago por comprobante',
      status: 'GIRADO'
    };

    setIssuedChecks([chk, ...issuedChecks]);
    setIsCheckModalOpen(false);
    setNewCheck({
      checkNumber: '',
      bankName: 'Banco Pichincha',
      paymentDate: new Date().toISOString().split('T')[0],
      beneficiary: '',
      amount: 0,
      concept: ''
    });
  };

  const handleSaveJournalEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newEntry.amount) || 0;
    if (amt <= 0 || !newEntry.concept) return;

    const debAcc = accountPlan.find((a) => a.code === newEntry.debitAccount);
    const credAcc = accountPlan.find((a) => a.code === newEntry.creditAccount);

    const entry: JournalEntry = {
      id: `asi-${Date.now()}`,
      entryNumber: `ASI-2026-${(journalEntries.length + 1).toString().padStart(4, '0')}`,
      date: newEntry.date,
      concept: newEntry.concept,
      type: newEntry.type,
      status: 'ASENTADO',
      totalDebit: amt,
      totalCredit: amt,
      items: [
        {
          accountCode: newEntry.debitAccount,
          accountName: debAcc ? debAcc.name : 'Cuenta Débito',
          debit: amt,
          credit: 0
        },
        {
          accountCode: newEntry.creditAccount,
          accountName: credAcc ? credAcc.name : 'Cuenta Crédito',
          debit: 0,
          credit: amt
        }
      ]
    };

    setJournalEntries([entry, ...journalEntries]);
    setIsEntryModalOpen(false);
    setNewEntry({
      date: new Date().toISOString().split('T')[0],
      type: 'DIARIO',
      concept: '',
      debitAccount: '1.1.01.01.01',
      creditAccount: '4.1.01.01.01',
      amount: ''
    });
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.code || !newAccount.name) return;

    const acc: AccountPlanItem = {
      code: newAccount.code,
      name: newAccount.name,
      level: newAccount.level || 4,
      type: newAccount.type || 'ACTIVO',
      nature: newAccount.nature || 'DEUDORA',
      acceptsMovement: true,
      balance: 0
    };

    setAccountPlan([...accountPlan, acc]);
    setIsAccountModalOpen(false);
    setNewAccount({
      code: '',
      name: '',
      level: 4,
      type: 'ACTIVO',
      nature: 'DEUDORA',
      acceptsMovement: true
    });
  };

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------
          SUBTAB 1: CONTABILIDAD_RESUMEN
         --------------------------------------------------------------------- */}
      {subTab === 'CONTABILIDAD_RESUMEN' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <span>Dashboard General de Contabilidad & Estados NIIF</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Visión holística de balance contable, asientos asentados, conciliaciones y obligaciones tributarias.
              </p>
            </div>

            <button
              onClick={() => setIsEntryModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Asiento Contable</span>
            </button>
          </div>

          {/* Key accounting metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Activos</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {formatCurrency(totalActivos, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pasivos</div>
              <div className="text-2xl font-black font-mono text-rose-400 mt-1">
                {formatCurrency(totalPasivos, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patrimonio Neto</div>
              <div className="text-2xl font-black font-mono text-blue-400 mt-1">
                {formatCurrency(totalPatrimonio, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Utilidad Neta del Ejercicio</div>
              <div className="text-2xl font-black font-mono text-amber-400 mt-1">
                {formatCurrency(utilidadNeta, settings.currencySymbol)}
              </div>
            </div>
          </div>

          {/* Quick status overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span>Estado de Periodos Fiscales</span>
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700">Periodo Actual</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded text-[10px]">
                    ABIERTO
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700">Cierres Registrados</span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold rounded text-[10px]">
                    {fiscalPeriods.length} Periodos
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                <span>Anexo Transaccional (ATS) & SRI</span>
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700">Comprobantes procesados en mes</span>
                  <span className="font-black text-slate-900">{invoices.filter((i: any) => i.paymentStatus !== 'ANULADA' && i.documentType !== 'COTIZACION').length} Facturas</span>
                </div>
                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700">Generación de XML ATS SRI</span>
                  <span className="text-emerald-600 font-black">Listo para Exportar</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 2: CHEQUES_GIRADOS
         --------------------------------------------------------------------- */}
      {subTab === 'CHEQUES_GIRADOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-500" />
                <span>Gestión y Registro de Cheques Girados</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Control de cheques emitidos a proveedores, fechas de cobranza y estado de cobro.
              </p>
            </div>

            <button
              onClick={() => setIsCheckModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Cheque Girado</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Cheque</th>
                  <th className="py-3 px-4">Banco Emisor</th>
                  <th className="py-3 px-4">Fecha Emisión</th>
                  <th className="py-3 px-4">Fecha Cobro</th>
                  <th className="py-3 px-4">Beneficiario</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {issuedChecks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans text-xs">
                      No hay cheques girados registrados.
                    </td>
                  </tr>
                ) : (
                  issuedChecks.map((chk) => (
                    <tr key={chk.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-slate-900">{chk.checkNumber}</td>
                      <td className="py-3 px-4 text-slate-800 font-bold">{chk.bankName}</td>
                      <td className="py-3 px-4 text-slate-500">{chk.issueDate}</td>
                      <td className="py-3 px-4 text-slate-700 font-bold">{chk.paymentDate}</td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-800">{chk.beneficiary}</td>
                      <td className="py-3 px-4 text-slate-600 font-sans truncate max-w-xs">{chk.concept}</td>
                      <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                        {formatCurrency(chk.amount, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          chk.status === 'COBRADO'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : chk.status === 'GIRADO'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}>
                          {chk.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 3: CONCILIACION_TARJETAS
         --------------------------------------------------------------------- */}
      {subTab === 'CONCILIACION_TARJETAS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-500" />
                <span>Conciliación de Tarjetas de Crédito & Vouchers</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verificación de liquidaciones de procesadores de cobro con tarjeta (Datafast, Medianet), comisiones y retenciones.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Lote</th>
                  <th className="py-3 px-4">Procesador</th>
                  <th className="py-3 px-4">Fecha Cierre</th>
                  <th className="py-3 px-4 text-right">Monto Bruto</th>
                  <th className="py-3 px-4 text-right">Comisión</th>
                  <th className="py-3 px-4 text-right">Retenciones</th>
                  <th className="py-3 px-4 text-right">Monto Neto Banco</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {cardReconciliations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans text-xs">
                      No hay liquidaciones de tarjetas por conciliar.
                    </td>
                  </tr>
                ) : (
                  cardReconciliations.map((cr) => (
                    <tr key={cr.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-slate-900">{cr.batchNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{cr.processor}</td>
                      <td className="py-3 px-4 text-slate-500">{cr.date}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-700">
                        {formatCurrency(cr.grossAmount, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        -{formatCurrency(cr.commissionAmount, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-600">
                        -{formatCurrency(cr.taxRetained, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                        {formatCurrency(cr.netAmount, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cr.status === 'CONCILIADO' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {cr.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 4: CONCILIACION_BANCARIA
         --------------------------------------------------------------------- */}
      {subTab === 'CONCILIACION_BANCARIA' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-500" />
                <span>Conciliación Bancaria Mensual</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cotejo entre el Estado de Cuenta Bancario enviado por la entidad y el Libro Auxiliar de Bancos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-black text-slate-900 uppercase text-xs">Libro Auxiliar de Bancos (POS)</h3>
              <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between py-1 border-b">
                  <span>Saldo según Libros:</span>
                  <span className="font-black text-slate-900">{formatCurrency(bankAccounts.reduce((sum: number, b: any) => sum + (b.balance || 0), 0), settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between py-1 border-b text-emerald-600">
                  <span>(+) Depósitos no acreditados:</span>
                  <span className="font-bold">{formatCurrency(0, settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between py-1 text-rose-600">
                  <span>(-) Cheques girados en tránsito:</span>
                  <span className="font-bold">-{formatCurrency(issuedChecks.filter(c => c.status === 'GIRADO').reduce((sum, c) => sum + c.amount, 0), settings.currencySymbol)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-black text-slate-900 uppercase text-xs">Estado de Cuenta Banco</h3>
              <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between py-1 border-b">
                  <span>Saldo según Banco:</span>
                  <span className="font-black text-slate-900">{formatCurrency(bankAccounts.reduce((sum: number, b: any) => sum + (b.balance || 0), 0), settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-600 font-black">
                  <span>Diferencia por Conciliar:</span>
                  <span>{formatCurrency(0.00, settings.currencySymbol)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 5: COMPROBANTE_INGRESO
         --------------------------------------------------------------------- */}
      {subTab === 'COMPROBANTE_INGRESO' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-500" />
                <span>Comprobantes Contables de Ingreso</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Emisión de comprobantes de caja/bancos por recaudación de cobros y ventas.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Comprobante</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Recibido De</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4 text-right">Monto ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {journalEntries.filter(e => e.type === 'INGRESO').length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs">
                      No hay comprobantes de ingreso registrados.
                    </td>
                  </tr>
                ) : (
                  journalEntries.filter(e => e.type === 'INGRESO').map((ci) => (
                    <tr key={ci.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-slate-900">{ci.entryNumber}</td>
                      <td className="py-3 px-4 text-slate-500">{ci.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">CLIENTES VARIOS</td>
                      <td className="py-3 px-4 text-slate-600 font-sans">{ci.concept}</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                        {formatCurrency(ci.totalDebit, settings.currencySymbol)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 6: COMPROBANTE_EGRESO
         --------------------------------------------------------------------- */}
      {subTab === 'COMPROBANTE_EGRESO' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FileX className="w-5 h-5 text-red-500" />
                <span>Comprobantes Contables de Egreso</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Emisión de comprobantes para soporte de egresos de caja y pagos bancarios.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Comprobante</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Pagado A</th>
                  <th className="py-3 px-4">Forma de Pago</th>
                  <th className="py-3 px-4 text-right">Monto ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {journalEntries.filter(e => e.type === 'EGRESO').length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs">
                      No hay comprobantes de egreso registrados.
                    </td>
                  </tr>
                ) : (
                  journalEntries.filter(e => e.type === 'EGRESO').map((ce) => (
                    <tr key={ce.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-slate-900">{ce.entryNumber}</td>
                      <td className="py-3 px-4 text-slate-500">{ce.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">PROVEEDORES VARIOS</td>
                      <td className="py-3 px-4 text-slate-600 font-sans">{ce.concept}</td>
                      <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                        {formatCurrency(ce.totalCredit, settings.currencySymbol)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 7: ASIENTOS (Libro Diario)
         --------------------------------------------------------------------- */}
      {subTab === 'ASIENTOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-purple-500" />
                <span>Libro Diario & Asientos Contables</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro cronológico de todas las operaciones contables con partida doble.
              </p>
            </div>

            <button
              onClick={() => setIsEntryModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Asiento</span>
            </button>
          </div>

          <div className="space-y-4">
            {journalEntries.length === 0 ? (
              <div className="py-12 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium space-y-2">
                <Calculator className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No hay asientos contables registrados en el libro diario.</p>
                <p className="text-[11px] text-slate-400">Haz clic en "Nuevo Asiento" para registrar el primer movimiento con partida doble.</p>
              </div>
            ) : (
              journalEntries.map((entry) => (
                <div key={entry.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono font-black text-slate-900 text-xs">{entry.entryNumber}</span>
                      <span className="text-xs text-slate-500 font-mono font-bold">{entry.date}</span>
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-extrabold text-[10px] rounded uppercase">
                        {entry.type}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-full">
                      {entry.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">{entry.concept}</p>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="py-2 px-3">Código</th>
                          <th className="py-2 px-3">Cuenta Contable</th>
                          <th className="py-2 px-3 text-right">Debe ($)</th>
                          <th className="py-2 px-3 text-right">Haber ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {entry.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 font-bold text-slate-600">{item.accountCode}</td>
                            <td className="py-1.5 px-3 font-sans text-slate-800">{item.accountName}</td>
                            <td className="py-1.5 px-3 text-right text-emerald-700 font-bold">
                              {item.debit > 0 ? formatCurrency(item.debit, settings.currencySymbol) : '-'}
                            </td>
                            <td className="py-1.5 px-3 text-right text-rose-700 font-bold">
                              {item.credit > 0 ? formatCurrency(item.credit, settings.currencySymbol) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-[11px]">
                        <tr>
                          <td colSpan={2} className="py-2 px-3 text-right uppercase">Totales Parti. Doble:</td>
                          <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(entry.totalDebit, settings.currencySymbol)}</td>
                          <td className="py-2 px-3 text-right text-rose-600">{formatCurrency(entry.totalCredit, settings.currencySymbol)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 8: MAYORES (Libro Mayor)
         --------------------------------------------------------------------- */}
      {subTab === 'MAYORES' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-cyan-500" />
                <span>Libro Mayor General de Cuentas</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Resumen de movimientos débito/crédito y saldo acumulado por cada cuenta contable del catálogo.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código Cuenta</th>
                  <th className="py-3 px-4">Nombre de la Cuenta</th>
                  <th className="py-3 px-4">Naturaleza</th>
                  <th className="py-3 px-4 text-right">Saldo Actual ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {accountPlan.filter(a => a.acceptsMovement).map((acc) => (
                  <tr key={acc.code} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{acc.code}</td>
                    <td className="py-2.5 px-4 font-sans font-bold text-slate-800">{acc.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 font-bold text-[10px] rounded">
                        {acc.nature}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(acc.balance, settings.currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 9: BALANCE_COMPROBACION
         --------------------------------------------------------------------- */}
      {subTab === 'BALANCE_COMPROBACION' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-500" />
                <span>Balance de Comprobación de Sumas y Saldos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verificación de igualdad entre débitos y créditos acumulados en todo el sistema.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 font-mono text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Cuenta</th>
                  <th className="py-3 px-4 text-right">Sumas Debe</th>
                  <th className="py-3 px-4 text-right">Sumas Haber</th>
                  <th className="py-3 px-4 text-right">Saldo Deudor</th>
                  <th className="py-3 px-4 text-right">Saldo Acreedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {accountPlan.filter(a => a.acceptsMovement).map((acc) => {
                  const isDeudora = acc.nature === 'DEUDORA';
                  return (
                    <tr key={acc.code} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{acc.code}</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">{acc.name}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                        {formatCurrency(acc.balance, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">$0.00</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {isDeudora ? formatCurrency(acc.balance, settings.currencySymbol) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {!isDeudora ? formatCurrency(acc.balance, settings.currencySymbol) : '-'}
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
          SUBTAB 10: ESTADO_SITUACION_FINANCIERA (Balance General)
         --------------------------------------------------------------------- */}
      {subTab === 'ESTADO_SITUACION_FINANCIERA' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-500" />
                <span>Estado de Situación Financiera (Balance General NIIF)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Estructura de Activo, Pasivo y Patrimonio con verificación de la Ecuación Contable.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-black text-emerald-700 uppercase text-xs border-b border-slate-200 pb-2">
                1. ACTIVOS (TOTAL: {formatCurrency(totalActivos, settings.currencySymbol)})
              </h3>
              <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between py-1">
                  <span>Efectivo y Bancos (1.1.01)</span>
                  <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('1.1.01') && a.acceptsMovement).reduce((sum, a) => sum + (a.balance || 0), 0), settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Inventario de Mercaderías (1.1.03)</span>
                  <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('1.1.03') && a.acceptsMovement).reduce((sum, a) => sum + (a.balance || 0), 0), settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Activos Fijos y Equipos (1.2)</span>
                  <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('1.2') && a.acceptsMovement).reduce((sum, a) => sum + (a.balance || 0), 0), settings.currencySymbol)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-black text-rose-700 uppercase text-xs border-b border-slate-200 pb-2">
                2. PASIVOS & 3. PATRIMONIO
              </h3>
              <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between py-1 border-b">
                  <span>Pasivo Corriente / Proveedores (2.1):</span>
                  <span className="font-bold text-rose-600">{formatCurrency(totalPasivos, settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between py-1 pt-2">
                  <span>Capital y Reservas (3.0):</span>
                  <span className="font-bold text-blue-600">{formatCurrency(totalPatrimonio, settings.currencySymbol)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 11: ESTADO_RESULTADO
         --------------------------------------------------------------------- */}
      {subTab === 'ESTADO_RESULTADO' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <span>Estado de Resultados (Pérdidas & Ganancias - P&L)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cálculo de Utilidad Bruta, Gastos Operacionales y Utilidad Neta del Ejercicio.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 text-white rounded-2xl p-6 space-y-3 font-mono text-xs max-w-2xl mx-auto border border-slate-800">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="font-bold uppercase text-emerald-400">(+) VENTA DE MERCADERÍAS</span>
              <span className="font-black text-emerald-400 text-sm">{formatCurrency(totalIngresos, settings.currencySymbol)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800 text-rose-400">
              <span>(-) COSTO DE VENTAS (MERCADERÍA)</span>
              <span className="font-bold">-{formatCurrency(accountPlan.filter(a => a.code.startsWith('5.1') && a.acceptsMovement).reduce((sum, a) => sum + (a.balance || 0), 0), settings.currencySymbol)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800 font-black text-blue-400">
              <span>(=) UTILIDAD BRUTA EN VENTAS</span>
              <span>{formatCurrency(totalIngresos - accountPlan.filter(a => a.code.startsWith('5.1') && a.acceptsMovement).reduce((sum, a) => sum + (a.balance || 0), 0), settings.currencySymbol)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800 text-amber-400">
              <span>(-) GASTOS OPERACIONALES (NOMINA, ARRIENDO)</span>
              <span className="font-bold">-{formatCurrency(accountPlan.filter(a => a.code.startsWith('5.2') && a.acceptsMovement).reduce((sum, a) => sum + (a.balance || 0), 0), settings.currencySymbol)}</span>
            </div>
            <div className="flex justify-between py-3 font-black text-emerald-400 text-base bg-slate-900 p-3 rounded-xl border border-slate-800">
              <span>(=) UTILIDAD NETA DEL EJERCICIO</span>
              <span>{formatCurrency(utilidadNeta, settings.currencySymbol)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 12: ATS (Anexo Transaccional Simplificado SRI)
         --------------------------------------------------------------------- */}
      {subTab === 'ATS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-lime-500" />
                <span>Anexo Transaccional Simplificado (ATS - SRI)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Generación y validación del archivo XML para presentación mensual al Servicio de Rentas Internas.
              </p>
            </div>

            <button className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer">
              <Download className="w-4 h-4 text-lime-400" />
              <span>Generar XML ATS SRI</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-slate-500 text-[10px] font-bold block uppercase">Ventas Locales Registradas</span>
              <span className="text-lg font-black text-slate-900">{invoices.filter((i: any) => i.paymentStatus !== 'ANULADA' && i.documentType !== 'COTIZACION').length} Transacciones</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-slate-500 text-[10px] font-bold block uppercase">Compras con Sustento Tributario</span>
              <span className="text-lg font-black text-slate-900">{purchases.length} Comprobantes</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-slate-500 text-[10px] font-bold block uppercase">Comprobantes Anulados</span>
              <span className="text-lg font-black text-amber-600">{invoices.filter((i: any) => i.paymentStatus === 'ANULADA').length} Documentos</span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 13: PLAN_CUENTAS
         --------------------------------------------------------------------- */}
      {subTab === 'PLAN_CUENTAS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-500" />
                <span>Plan y Catálogo de Cuentas Contables NIIF</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Estructura codificada en árbol de 5 niveles para la clasificación contable corporativa.
              </p>
            </div>

            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cuenta Contable</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Nombre de Cuenta</th>
                  <th className="py-3 px-4">Nivel</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Movimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {accountPlan.map((acc) => (
                  <tr key={acc.code} className={acc.level === 1 ? 'bg-slate-100 font-black' : 'hover:bg-slate-50'}>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{acc.code}</td>
                    <td className="py-2.5 px-4 font-sans font-bold text-slate-800" style={{ paddingLeft: `${acc.level * 12}px` }}>
                      {acc.name}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-500">{acc.level}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-[10px]">
                        {acc.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {acc.acceptsMovement ? (
                        <span className="text-emerald-600 font-bold">Acepta Asientos</span>
                      ) : (
                        <span className="text-slate-400">Agrupadora</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 14: PARAMETRIZACION
         --------------------------------------------------------------------- */}
      {subTab === 'PARAMETRIZACION' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-slate-500" />
                <span>Parametrización & Asientos Automáticos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mapeo de cuentas por defecto para facturación de ventas, compras e IVA.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-black text-slate-900 block uppercase">Ventas en Efectivo:</span>
              <p className="text-slate-600">Débito: 1.1.01.01.01 (Caja General)</p>
              <p className="text-slate-600">Crédito: 4.1.01.01.01 (Ventas Mostrador)</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-black text-slate-900 block uppercase">Cuenta IVA Cobrado (15%):</span>
              <p className="text-slate-600">Crédito: 2.1.04.01.01 (IVA Cobrado por Pagar SRI)</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 15: PERIODOS_FISCALES
         --------------------------------------------------------------------- */}
      {subTab === 'PERIODOS_FISCALES' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-yellow-500" />
                <span>Control de Periodos Fiscales & Ejercicio Económico</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Apertura y bloqueo contable mensual para evitar alteraciones retroactivas de balances.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {fiscalPeriods.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400 text-xs font-mono bg-slate-50 rounded-2xl border border-slate-200">
                No hay periodos fiscales cerrados o bloqueados. Todos los movimientos están activos en el periodo corriente.
              </div>
            ) : (
              fiscalPeriods.map((fp, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 text-sm">{fp.monthName} {fp.year}</span>
                    {fp.status === 'CERRADO' ? (
                      <Lock className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Unlock className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-500">Estado:</span>
                    <span className={`font-black ${fp.status === 'CERRADO' ? 'text-slate-600' : 'text-emerald-600'}`}>
                      {fp.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 16: FORMULARIOS_DIMM
         --------------------------------------------------------------------- */}
      {subTab === 'FORMULARIOS_DIMM' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-orange-500" />
                <span>Formularios Tributarios DIMM (103 & 104 SRI)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Generación automática de campos para la declaración de IVA y Retenciones en la Fuente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
              <h3 className="font-black text-slate-900 text-sm">Formulario 104 - Declaración de IVA</h3>
              <p className="text-slate-600">Ventas Tarifa 15%: {formatCurrency(invoices.reduce((sum: number, i: any) => sum + (i.subtotal || 0), 0), settings.currencySymbol)}</p>
              <p className="text-slate-600">Impuesto Generado: {formatCurrency(invoices.reduce((sum: number, i: any) => sum + (i.taxTotal || 0), 0), settings.currencySymbol)}</p>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
              <h3 className="font-black text-slate-900 text-sm">Formulario 103 - Retenciones Fuente</h3>
              <p className="text-slate-600">Total Retenido Compras: {formatCurrency(retenciones.reduce((sum: number, r: any) => sum + (r.totalRetained || 0), 0), settings.currencySymbol)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 17: CHEQUES_POSFECHADOS
         --------------------------------------------------------------------- */}
      {subTab === 'CHEQUES_POSFECHADOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Clock className="w-5 h-5 text-pink-500" />
                <span>Cartera de Cheques Posfechados & Diferidos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Custodia de cheques recibidos con fecha diferida de depósito en ventanilla bancaria.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Cheque</th>
                  <th className="py-3 px-4">Banco</th>
                  <th className="py-3 px-4">Emisor</th>
                  <th className="py-3 px-4">Fecha Depósito</th>
                  <th className="py-3 px-4 text-right">Monto ($)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {postdatedChecks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans text-xs">
                      No hay cheques posfechados en custodia.
                    </td>
                  </tr>
                ) : (
                  postdatedChecks.map((pch) => (
                    <tr key={pch.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-slate-900">{pch.checkNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{pch.bankName}</td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-800">{pch.issuer}</td>
                      <td className="py-3 px-4 font-black text-blue-600">{pch.depositDate}</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                        {formatCurrency(pch.amount, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-full text-[10px] border border-amber-200">
                          {pch.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODALS
         --------------------------------------------------------------------- */}

      {/* Modal: Registrar Cheque Girado */}
      {isCheckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-500" />
                <span>Registrar Cheque Girado</span>
              </h3>
              <button onClick={() => setIsCheckModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIssuedCheck} className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">N° de Cheque *</label>
                <input
                  type="text"
                  required
                  placeholder="0004524"
                  value={newCheck.checkNumber}
                  onChange={(e) => setNewCheck({ ...newCheck, checkNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Banco Emisor *</label>
                <Select
                  value={newCheck.bankName}
                  onChange={(e) => setNewCheck({ ...newCheck, bankName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="Banco Pichincha">Banco Pichincha</option>
                  <option value="Banco Guayaquil">Banco Guayaquil</option>
                  <option value="Produbanco">Produbanco</option>
                </Select>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Beneficiario *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: STANLEY TOOLS ECUADOR S.A."
                  value={newCheck.beneficiary}
                  onChange={(e) => setNewCheck({ ...newCheck, beneficiary: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Fecha de Cobro</label>
                  <DatePicker
                    selected={newCheck.paymentDate ? new Date(newCheck.paymentDate + 'T12:00:00Z') : null}
                    onChange={(date) => setNewCheck({ ...newCheck, paymentDate: date ? date.toISOString().split('T')[0] : '' })}
                    dateFormat="dd/MM/yyyy"
                    locale="es"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Monto ($) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newCheck.amount}
                    onChange={(e) => setNewCheck({ ...newCheck, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-rose-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Concepto / Detalle</label>
                <textarea
                  rows={2}
                  placeholder="Detalle del pago o factura sustentada"
                  value={newCheck.concept}
                  onChange={(e) => setNewCheck({ ...newCheck, concept: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsCheckModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl cursor-pointer">
                  Guardar Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Asiento Contable */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-purple-500" />
                <span>Registrar Asiento Contable</span>
              </h3>
              <button onClick={() => setIsEntryModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJournalEntry} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Fecha</label>
                  <DatePicker
                    selected={newEntry.date ? new Date(newEntry.date + 'T12:00:00Z') : null}
                    onChange={(date) => setNewEntry({ ...newEntry, date: date ? date.toISOString().split('T')[0] : '' })}
                    dateFormat="dd/MM/yyyy"
                    locale="es"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Tipo de Asiento</label>
                  <Select
                    value={newEntry.type}
                    onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="DIARIO">DIARIO</option>
                    <option value="INGRESO">INGRESO</option>
                    <option value="EGRESO">EGRESO</option>
                    <option value="AJUSTE">AJUSTE</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Concepto del Asiento *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Ajuste de amortizaciones o cobro directo"
                  value={newEntry.concept}
                  onChange={(e) => setNewEntry({ ...newEntry, concept: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Cuenta Débito (DEBE) *</label>
                  <Select
                    value={newEntry.debitAccount}
                    onChange={(e) => setNewEntry({ ...newEntry, debitAccount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  >
                    {accountPlan.filter(a => a.acceptsMovement).map(a => (
                      <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block font-black text-slate-800 mb-1">Cuenta Crédito (HABER) *</label>
                  <Select
                    value={newEntry.creditAccount}
                    onChange={(e) => setNewEntry({ ...newEntry, creditAccount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  >
                    {accountPlan.filter(a => a.acceptsMovement).map(a => (
                      <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Monto ($) *</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="0.00"
                  value={newEntry.amount}
                  onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-purple-600 text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsEntryModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl cursor-pointer">
                  Asentar Operación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nueva Cuenta Contable */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-500" />
                <span>Agregar Cuenta al Plan</span>
              </h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">Código Contable *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: 1.1.01.03.01"
                  value={newAccount.code}
                  onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Nombre de la Cuenta *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Caja Chica Sucursal Norte"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Tipo de Cuenta</label>
                  <Select
                    value={newAccount.type}
                    onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="PASIVO">PASIVO</option>
                    <option value="PATRIMONIO">PATRIMONIO</option>
                    <option value="INGRESO">INGRESO</option>
                    <option value="GASTO">GASTO</option>
                  </Select>
                </div>

                <div>
                  <label className="block font-black text-slate-800 mb-1">Naturaleza</label>
                  <Select
                    value={newAccount.nature}
                    onChange={(e) => setNewAccount({ ...newAccount, nature: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="DEUDORA">DEUDORA</option>
                    <option value="ACREEDORA">ACREEDORA</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsAccountModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl cursor-pointer">
                  Guardar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
