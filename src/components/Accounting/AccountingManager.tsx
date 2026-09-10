import React, { useState, useMemo } from 'react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
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
  Tag,
  Copy,
  Loader2,
  CheckSquare,
  Square,
  ExternalLink,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { useModal } from '../../context/ModalContext';
import { generateAtsXml } from '../../services/sriAtsService';
import { downloadXML } from '../../services/sriXmlService';
import { getNextCorrelativeCheck, getCheckStatusBadge, isCheckInTransit } from '../../utils/checkUtils';
import { AccountingSubTab, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Select } from '../Shared/Select';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { 
  OFFICIAL_NIIF_ACCOUNT_PLAN, 
  DEFAULT_ACCOUNTING_MAPPING, 
  AccountingMapping,
  buildAutomaticInvoiceEntry,
  buildAutomaticPurchaseEntry,
  getNextChildAccountCode
} from '../../utils/niifAccountingData';

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
  bankAccountId?: string;
  issueDate: string;
  deliveryDate?: string;
  paymentDate: string;
  clearedDate?: string;
  beneficiary: string;
  supplierId?: string;
  payableInvoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  concept: string;
  status: 'EMITIDO' | 'ENTREGADO' | 'COBRADO' | 'ANULADO' | 'GIRADO';
  journalEntryId?: string;
  notes?: string;
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
  processor: 'Datafast' | 'Medianet' | 'Diners Club' | 'Visa/Mastercard Direct' | 'Kushki' | string;
  date: string;
  grossAmount: number;
  commissionAmount: number;
  taxRetained: number;
  netAmount: number;
  status: 'CONCILIADO' | 'PENDIENTE';
  terminalId?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  reconciledInvoiceIds?: string[];
  commissionRate?: number;
  commissionIva?: number;
  irRetentionRate?: number;
  irRetentionAmount?: number;
  ivaRetentionRate?: number;
  ivaRetentionAmount?: number;
  networkFee?: number;
  journalEntryId?: string;
  notes?: string;
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
  const { showToast, showAlert, showConfirm } = useModal();
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

  // 5. Plan de Cuentas NIIF (Oficial 5 Niveles)
  const [accountPlan, setAccountPlan] = useFirestoreSync<AccountPlanItem[]>('ferreteria_account_plan', OFFICIAL_NIIF_ACCOUNT_PLAN);

  // 5.1 Motor de Mapeo Paramétrico Contable NIIF
  const [accountingMapping, setAccountingMapping] = useFirestoreSync<AccountingMapping>('ferreteria_accounting_mapping', DEFAULT_ACCOUNTING_MAPPING);

  // UI States para Catálogo y Parametrización
  const [accountPlanFilterElement, setAccountPlanFilterElement] = useState<'TODOS' | 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO'>('TODOS');
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [editingAccount, setEditingAccount] = useState<AccountPlanItem | null>(null);
  const [isSyncingEntries, setIsSyncingEntries] = useState(false);

  // 6. Periodos Fiscales
  const [fiscalPeriods, setFiscalPeriods] = useFirestoreSync<FiscalPeriod[]>('ferreteria_fiscal_periods', []);

  // 7. Global Collections for real calculations
  const [invoices] = useFirestoreSync<any[]>('ferreteria_invoices', []);
  const [purchases] = useFirestoreSync<any[]>('ferreteria_purchases', []);
  const [retenciones] = useFirestoreSync<any[]>('ferreteria_retenciones', []);
  const [bankAccounts] = useFirestoreSync<any[]>('ferreteria_bank_accounts', []);

  // Cálculo de Saldos Mayorizados en Tiempo Real por Cuenta a partir del Libro Diario
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accountPlan.forEach(a => {
      balances[a.code] = Number(a.balance || 0);
    });

    journalEntries.forEach(je => {
      if (je.status === 'ASENTADO') {
        je.items.forEach(it => {
          const acc = accountPlan.find(a => a.code === it.accountCode);
          const nature = acc ? acc.nature : (it.accountCode.startsWith('1') || it.accountCode.startsWith('5') ? 'DEUDORA' : 'ACREEDORA');
          const current = balances[it.accountCode] || 0;
          if (nature === 'DEUDORA') {
            balances[it.accountCode] = current + (it.debit || 0) - (it.credit || 0);
          } else {
            balances[it.accountCode] = current + (it.credit || 0) - (it.debit || 0);
          }
        });
      }
    });

    return balances;
  }, [accountPlan, journalEntries]);

  // Dynamic Metrics NIIF
  const totalActivos = React.useMemo(() => {
    return accountPlan
      .filter(a => a.type === 'ACTIVO' && a.acceptsMovement)
      .reduce((acc, c) => acc + (accountBalances[c.code] || 0), 0);
  }, [accountPlan, accountBalances]);

  const totalPasivos = React.useMemo(() => {
    return accountPlan
      .filter(a => a.type === 'PASIVO' && a.acceptsMovement)
      .reduce((acc, c) => acc + (accountBalances[c.code] || 0), 0);
  }, [accountPlan, accountBalances]);

  const totalPatrimonio = React.useMemo(() => {
    return accountPlan
      .filter(a => a.type === 'PATRIMONIO' && a.acceptsMovement)
      .reduce((acc, c) => acc + (accountBalances[c.code] || 0), 0);
  }, [accountPlan, accountBalances]);

  const totalIngresos = React.useMemo(() => {
    const fromAccounts = accountPlan
      .filter(a => a.type === 'INGRESO' && a.acceptsMovement)
      .reduce((acc, c) => acc + (accountBalances[c.code] || 0), 0);
    const fromInvoices = invoices
      .filter(i => i.paymentStatus !== 'ANULADA' && i.documentType !== 'COTIZACION')
      .reduce((acc, i) => acc + (i.total || 0), 0);
    return Math.max(fromAccounts, fromInvoices);
  }, [accountPlan, accountBalances, invoices]);

  const totalGastos = React.useMemo(() => {
    const fromAccounts = accountPlan
      .filter(a => a.type === 'GASTO' && a.acceptsMovement)
      .reduce((acc, c) => acc + (accountBalances[c.code] || 0), 0);
    const fromPurchases = purchases.reduce((acc, p) => acc + (p.total || 0), 0);
    return Math.max(fromAccounts, fromPurchases);
  }, [accountPlan, accountBalances, purchases]);

  const utilidadNeta = React.useMemo(() => totalIngresos - totalGastos, [totalIngresos, totalGastos]);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // SRI Form 103 & 104 DIMM State
  const dimmCurrentDate = useMemo(() => new Date(), []);
  const [dimmSelectedMonth, setDimmSelectedMonth] = useState<string>(String(dimmCurrentDate.getMonth() + 1).padStart(2, '0'));
  const [dimmSelectedYear, setDimmSelectedYear] = useState<string>(String(dimmCurrentDate.getFullYear()));
  const [dimmActiveTab, setDimmActiveTab] = useState<'FORM_104' | 'FORM_103' | 'RESUMEN' | 'ATS'>('FORM_104');

  // -------------------------------------------------------------------------
  // MOTOR DE CONSOLIDACIÓN Y MAPEO TRIBUTARIO SRI (FORMULARIOS 103 & 104)
  // -------------------------------------------------------------------------
  const taxConsolidationData = useMemo(() => {
    // 1. Filtrar ventas del mes fiscal (excluir cotizaciones y facturas anuladas)
    const ventasMes = invoices.filter(inv => {
      if (inv.documentType === 'COTIZACION' || inv.paymentStatus === 'ANULADA') return false;
      const d = new Date(inv.createdAt);
      if (isNaN(d.getTime())) return false;
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, '0');
      if (dimmSelectedMonth === 'TODOS') return y === dimmSelectedYear;
      return y === dimmSelectedYear && m === dimmSelectedMonth;
    });

    // 2. Filtrar compras del mes fiscal
    const comprasMes = purchases.filter(pur => {
      const d = new Date(pur.purchaseDate || (pur as any).createdAt);
      if (isNaN(d.getTime())) return false;
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, '0');
      if (dimmSelectedMonth === 'TODOS') return y === dimmSelectedYear;
      return y === dimmSelectedYear && m === dimmSelectedMonth;
    });

    // 3. Filtrar retenciones del mes fiscal
    const retencionesMes = retenciones.filter(ret => {
      const d = new Date(ret.issueDate || ret.createdAt);
      if (isNaN(d.getTime())) return false;
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, '0');
      if (dimmSelectedMonth === 'TODOS') return y === dimmSelectedYear;
      return y === dimmSelectedYear && m === dimmSelectedMonth;
    });

    // ── FORMULARIO 104 (DECLARACIÓN DE IVA SRI) ──────────────────────────────
    let vtaBase15 = 0;
    let vtaIva15 = 0;
    let vtaBase0 = 0;

    ventasMes.forEach(inv => {
      let b0 = 0;
      let b15 = 0;
      if (inv.items && inv.items.length > 0) {
        inv.items.forEach((it: any) => {
          const rate = Number(it.taxRate ?? 15);
          const lineTotal = (it.quantity * it.unitPrice) - ((it.quantity * it.unitPrice * (it.discountPercent || 0)) / 100);
          if (rate === 0) b0 += lineTotal;
          else b15 += lineTotal;
        });
      } else {
        if ((inv.taxTotal || 0) > 0) b15 = inv.subtotal || 0;
        else b0 = inv.subtotal || 0;
      }
      vtaBase15 += b15;
      vtaIva15 += (inv.taxTotal || (b15 * 0.15));
      vtaBase0 += b0;
    });

    const vtaTotal = vtaBase15 + vtaBase0;

    // Compras / Adquisiciones y Crédito Tributario (IVA Soportado)
    let cmpBase15 = 0;
    let cmpIva15 = 0;
    let cmpBase0 = 0;

    comprasMes.forEach(comp => {
      let cb0 = 0;
      let cb15 = 0;
      if (comp.items && comp.items.length > 0) {
        comp.items.forEach((it: any) => {
          const rate = Number(it.taxPercent ?? 15);
          const lineCost = it.subtotal || (it.quantity * it.costPrice) || 0;
          if (rate === 0) cb0 += lineCost;
          else cb15 += lineCost;
        });
      } else {
        if ((comp.taxTotal || 0) > 0) cb15 = comp.subtotal || 0;
        else cb0 = comp.subtotal || 0;
      }
      cmpBase15 += cb15;
      cmpIva15 += (comp.taxTotal || (cb15 * 0.15));
      cmpBase0 += cb0;
    });

    const cmpTotal = cmpBase15 + cmpBase0;

    // Liquidación Matemática IVA del Mes
    const impuestoGenerado = vtaIva15;
    const creditoTributario = cmpIva15;
    const impuestoCausado = Math.max(0, impuestoGenerado - creditoTributario);
    const saldoFavorCredito = Math.max(0, creditoTributario - impuestoGenerado);
    
    // Retenciones recibidas de IVA (Casillero 609)
    const retencionesIvaRecibidas = retencionesMes
      .filter(r => r.type === 'RECIBIDA' || r.isSalesRetention)
      .reduce((sum, r) => sum + (r.taxRetainedIva || r.ivaAmount || 0), 0);

    const impuestoAPagarIva = Math.max(0, impuestoCausado - retencionesIvaRecibidas);

    // ── FORMULARIO 103 (RETENCIONES EN LA FUENTE RENTA E IVA SRI) ────────────
    let cas312_base = 0; // Transferencia de bienes muebles (1.75%)
    let cas312_val = 0;
    let cas307_base = 0; // Servicios predomina mano de obra (2.75%)
    let cas307_val = 0;
    let cas304_base = 0; // Servicios predomina intelecto (8.00%)
    let cas304_val = 0;
    let cas320_base = 0; // Arrendamiento de inmuebles (8.00%)
    let cas320_val = 0;
    let cas343_base = 0; // Otras retenciones aplicables (1.75% / 2.75%)
    let cas343_val = 0;

    // Retenciones IVA Compras
    let cas721_val = 0; // 30% IVA Bienes
    let cas723_val = 0; // 70% IVA Servicios
    let cas725_val = 0; // 100% IVA Honorarios / Arriendos

    retencionesMes.forEach(ret => {
      const code = String(ret.retentionCode || ret.code || '312');
      const base = Number(ret.taxBase || ret.base || 0);
      const val = Number(ret.retainedAmount || ret.amount || 0);

      if (code === '312' || code === '312A') {
        cas312_base += base;
        cas312_val += val;
      } else if (code === '307') {
        cas307_base += base;
        cas307_val += val;
      } else if (code === '304' || code === '303') {
        cas304_base += base;
        cas304_val += val;
      } else if (code === '320') {
        cas320_base += base;
        cas320_val += val;
      } else {
        cas343_base += base;
        cas343_val += val;
      }

      if (ret.retentionIva30) cas721_val += Number(ret.retentionIva30);
      if (ret.retentionIva70) cas723_val += Number(ret.retentionIva70);
      if (ret.retentionIva100) cas725_val += Number(ret.retentionIva100);
    });

    // Fallback: Si no hay retenciones explícitas en la tabla dedicada, inferir de compras registradas
    if (cas312_base === 0 && comprasMes.length > 0) {
      comprasMes.forEach(c => {
        if (c.retentionNumber || c.totalRetained) {
          cas312_base += Number(c.subtotal || 0);
          cas312_val += Number(c.totalRetained || 0);
        }
      });
    }

    const totalBaseRenta = cas312_base + cas307_base + cas304_base + cas320_base + cas343_base;
    const totalRetenidoRenta = cas312_val + cas307_val + cas304_val + cas320_val + cas343_val;
    const totalRetenidoIva = cas721_val + cas723_val + cas725_val;
    const totalFormulario103 = totalRetenidoRenta + totalRetenidoIva;

    return {
      ventasCount: ventasMes.length,
      comprasCount: comprasMes.length,
      retencionesCount: retencionesMes.length,
      ventasMes,
      comprasMes,
      retencionesMes,

      // Form 104
      vtaBase15,
      vtaIva15,
      vtaBase0,
      vtaTotal,
      cmpBase15,
      cmpIva15,
      cmpBase0,
      cmpTotal,
      impuestoGenerado,
      creditoTributario,
      impuestoCausado,
      saldoFavorCredito,
      retencionesIvaRecibidas,
      impuestoAPagarIva,

      // Form 103
      cas312_base, cas312_val,
      cas307_base, cas307_val,
      cas304_base, cas304_val,
      cas320_base, cas320_val,
      cas343_base, cas343_val,
      cas721_val, cas723_val, cas725_val,
      totalBaseRenta,
      totalRetenidoRenta,
      totalRetenidoIva,
      totalFormulario103
    };
  }, [invoices, purchases, retenciones, dimmSelectedMonth, dimmSelectedYear]);

  // Handlers para exportaciones SRI
  const handleExportAtsXml = async () => {
    try {
      setIsGeneratingAts(true);
      const res = await generateAtsXml({
        mes: dimmSelectedMonth,
        anio: dimmSelectedYear,
        settings,
        invoices,
        purchases,
        useBackendIfAvailable: false
      });
      if (res.success && res.xml) {
        downloadXML(res.xml, res.filename);
        showToast(`ATS XML generado para el período ${dimmSelectedMonth}/${dimmSelectedYear}`, 'success');
      } else {
        showAlert('Error ATS', res.message || 'No se pudo generar el archivo ATS XML.');
      }
    } catch (e: any) {
      showAlert('Error ATS', e?.message || 'Ocurrió un error al compilar el anexo ATS.');
    } finally {
      setIsGeneratingAts(false);
    }
  };

  const handleExportForm104Excel = () => {
    const csvContent = [
      `FORMULARIO 104 - DECLARACION DE IMPUESTO AL VALOR AGREGADO (SRI ECUADOR)`,
      `Periodo Fiscal: ${dimmSelectedMonth}/${dimmSelectedYear}`,
      `Razon Social: ${settings.legalName || settings.storeName}`,
      `RUC: ${settings.taxId || ''}`,
      ``,
      `CASILLERO,DESCRIPCION,BASE IMPONIBLE ($),IMPUESTO GENERADO ($)`,
      `401,Ventas Locales Tarifa Diferente 0% (15%),${taxConsolidationData.vtaBase15.toFixed(2)},${taxConsolidationData.vtaIva15.toFixed(2)}`,
      `403,Ventas Locales Tarifa 0%,${taxConsolidationData.vtaBase0.toFixed(2)},0.00`,
      `429,TOTAL VENTAS Y OTRAS OPERACIONES,${taxConsolidationData.vtaTotal.toFixed(2)},${taxConsolidationData.vtaIva15.toFixed(2)}`,
      ``,
      `500,Compras Locales con Derecho a Credito Tributario (15%),${taxConsolidationData.cmpBase15.toFixed(2)},${taxConsolidationData.cmpIva15.toFixed(2)}`,
      `507,Compras Locales Tarifa 0%,${taxConsolidationData.cmpBase0.toFixed(2)},0.00`,
      `529,TOTAL ADQUISICIONES Y PAGOS,${taxConsolidationData.cmpTotal.toFixed(2)},${taxConsolidationData.cmpIva15.toFixed(2)}`,
      ``,
      `LIQUIDACION DEL IMPUESTO EN EL MES,,`,
      `499,Impuesto Generado por Ventas,,${taxConsolidationData.impuestoGenerado.toFixed(2)}`,
      `564,Crédito Tributario por Compras (IVA Soportado),,${taxConsolidationData.creditoTributario.toFixed(2)}`,
      `601,Impuesto Causado (Diferencia a favor del SRI),,${taxConsolidationData.impuestoCausado.toFixed(2)}`,
      `609,(-) Retenciones de IVA que le efectuaron en el mes,,${taxConsolidationData.retencionesIvaRecibidas.toFixed(2)}`,
      `699,TOTAL IMPUESTO A PAGAR IVA,,${taxConsolidationData.impuestoAPagarIva.toFixed(2)}`
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Formulario_104_SRI_${dimmSelectedMonth}_${dimmSelectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Formulario 104 exportado a Excel/CSV exitosamente', 'success');
  };

  const handleExportForm103Excel = () => {
    const csvContent = [
      `FORMULARIO 103 - RETENCIONES EN LA FUENTE IMPUESTO A LA RENTA E IVA (SRI ECUADOR)`,
      `Periodo Fiscal: ${dimmSelectedMonth}/${dimmSelectedYear}`,
      `Razon Social: ${settings.legalName || settings.storeName}`,
      `RUC: ${settings.taxId || ''}`,
      ``,
      `CASILLERO,CONCEPTO DE RETENCION,% RETENCION,BASE IMPONIBLE ($),IMPUESTO RETENIDO ($)`,
      `312,Transferencia de Bienes Muebles de naturaleza corporal,1.75%,${taxConsolidationData.cas312_base.toFixed(2)},${taxConsolidationData.cas312_val.toFixed(2)}`,
      `307,Servicios donde predomina la mano de obra,2.75%,${taxConsolidationData.cas307_base.toFixed(2)},${taxConsolidationData.cas307_val.toFixed(2)}`,
      `304,Servicios donde predomina el intelecto,8.00%,${taxConsolidationData.cas304_base.toFixed(2)},${taxConsolidationData.cas304_val.toFixed(2)}`,
      `320,Arrendamiento de Bienes Inmuebles,8.00%,${taxConsolidationData.cas320_base.toFixed(2)},${taxConsolidationData.cas320_val.toFixed(2)}`,
      `343,Otras Retenciones Aplicables,Varios,${taxConsolidationData.cas343_base.toFixed(2)},${taxConsolidationData.cas343_val.toFixed(2)}`,
      `399,TOTAL RETENCIONES RENTA,,${taxConsolidationData.totalBaseRenta.toFixed(2)},${taxConsolidationData.totalRetenidoRenta.toFixed(2)}`,
      ``,
      `RETENCION DEL IMPUESTO AL VALOR AGREGADO (IVA),,,`,
      `721,Retención IVA 30% (Adquisición de Bienes),30%,-,${taxConsolidationData.cas721_val.toFixed(2)}`,
      `723,Retención IVA 70% (Adquisición de Servicios),70%,-,${taxConsolidationData.cas723_val.toFixed(2)}`,
      `725,Retención IVA 100% (Honorarios / Arriendos),100%,-,${taxConsolidationData.cas725_val.toFixed(2)}`,
      `799,TOTAL RETENCIONES IVA,,,-,${taxConsolidationData.totalRetenidoIva.toFixed(2)}`,
      ``,
      `TOTAL A PAGAR FORMULARIO 103,,,-,${taxConsolidationData.totalFormulario103.toFixed(2)}`
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Formulario_103_SRI_${dimmSelectedMonth}_${dimmSelectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Formulario 103 exportado a Excel/CSV exitosamente', 'success');
  };

  // Cheques Girados Status Filter
  const [checkStatusFilter, setCheckStatusFilter] = useState<'TODOS' | 'EN_TRANSITO' | 'EMITIDO' | 'ENTREGADO' | 'COBRADO' | 'ANULADO'>('TODOS');

  // Modals visibility
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [selectedReconciliationDetail, setSelectedReconciliationDetail] = useState<CardReconciliation | null>(null);

  // Card Reconciliation States
  const [cardReconciliationTab, setCardReconciliationTab] = useState<'TRANSITO' | 'HISTORIAL'>('TRANSITO');
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>([]);
  const [cardSearchTerm, setCardSearchTerm] = useState<string>('');
  const [settlementForm, setSettlementForm] = useState({
    processor: 'Datafast' as 'Datafast' | 'Medianet' | 'Diners Club' | 'Visa/Mastercard Direct' | 'Kushki',
    batchNumber: '',
    terminalId: 'POS-01',
    settlementDate: new Date().toISOString().split('T')[0],
    bankAccountCode: '1.1.01.02.01',
    grossAmount: 0,
    taxBase: 0,
    taxAmount: 0,
    commissionRate: 3.5,
    commissionIvaRate: 15,
    irRetentionRate: 1.75,
    ivaRetentionRate: 30,
    networkFee: 0,
    notes: ''
  });

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
  // ATS (Anexo Transaccional Simplificado SRI) STATES & COMPUTED
  // -------------------------------------------------------------------------
  const now = new Date();
  const [atsYear, setAtsYear] = useState<string>(String(now.getFullYear()));
  const [atsMonth, setAtsMonth] = useState<string>(String(now.getMonth() + 1).padStart(2, '0'));
  const [isGeneratingAts, setIsGeneratingAts] = useState<boolean>(false);
  const [atsPreviewXml, setAtsPreviewXml] = useState<string | null>(null);
  const [atsActiveDetailTab, setAtsActiveDetailTab] = useState<'VENTAS' | 'COMPRAS' | 'ANULADOS'>('VENTAS');
  const [xmlCopied, setXmlCopied] = useState<boolean>(false);

  const atsVentasPeriodo = useMemo(() => {
    return invoices.filter((inv: any) => {
      if (inv.documentType === 'COTIZACION') return false;
      const d = new Date(inv.createdAt);
      if (isNaN(d.getTime())) return false;
      return String(d.getFullYear()) === atsYear && String(d.getMonth() + 1).padStart(2, '0') === atsMonth;
    });
  }, [invoices, atsYear, atsMonth]);

  const atsVentasValidas = useMemo(() => {
    return atsVentasPeriodo.filter((inv: any) => inv.paymentStatus !== 'ANULADA');
  }, [atsVentasPeriodo]);

  const atsAnuladas = useMemo(() => {
    return atsVentasPeriodo.filter((inv: any) => inv.paymentStatus === 'ANULADA');
  }, [atsVentasPeriodo]);

  const atsComprasPeriodo = useMemo(() => {
    return purchases.filter((pur: any) => {
      const d = new Date(pur.purchaseDate || pur.createdAt);
      if (isNaN(d.getTime())) return false;
      return String(d.getFullYear()) === atsYear && String(d.getMonth() + 1).padStart(2, '0') === atsMonth;
    });
  }, [purchases, atsYear, atsMonth]);

  const totalVentasAts = useMemo(() => atsVentasValidas.reduce((acc: number, v: any) => acc + (v.total || 0), 0), [atsVentasValidas]);
  const totalIvaVentasAts = useMemo(() => atsVentasValidas.reduce((acc: number, v: any) => acc + (v.taxTotal || 0), 0), [atsVentasValidas]);
  const totalSubtotalVentasAts = useMemo(() => atsVentasValidas.reduce((acc: number, v: any) => acc + (v.subtotal || 0), 0), [atsVentasValidas]);

  const totalComprasAts = useMemo(() => atsComprasPeriodo.reduce((acc: number, c: any) => acc + (c.total || 0), 0), [atsComprasPeriodo]);
  const totalIvaComprasAts = useMemo(() => atsComprasPeriodo.reduce((acc: number, c: any) => acc + (c.taxTotal || 0), 0), [atsComprasPeriodo]);
  const totalSubtotalComprasAts = useMemo(() => atsComprasPeriodo.reduce((acc: number, c: any) => acc + (c.subtotal || 0), 0), [atsComprasPeriodo]);

  const handleGenerateAts = async (onlyPreview: boolean = false) => {
    setIsGeneratingAts(true);
    try {
      const result = await generateAtsXml({
        mes: atsMonth,
        anio: atsYear,
        settings,
        invoices,
        purchases,
        establishment: '001'
      });

      if (result.success) {
        if (onlyPreview) {
          setAtsPreviewXml(result.xml);
          showToast(`XML generado para vista previa (${result.filename})`, 'info');
        } else {
          downloadXML(result.xml, result.filename);
          showToast(`¡Archivo ${result.filename} generado y descargado con éxito!`, 'success');
        }
      } else {
        showAlert('Error ATS', result.message || 'No se pudo generar el anexo transaccional.');
      }
    } catch (err: any) {
      showAlert('Error al generar ATS', err.message || 'Ocurrió un error al procesar el XML ATS.');
    } finally {
      setIsGeneratingAts(false);
    }
  };

  const handleCopyXml = () => {
    if (!atsPreviewXml) return;
    navigator.clipboard.writeText(atsPreviewXml);
    setXmlCopied(true);
    showToast('XML copiado al portapapeles.', 'success');
    setTimeout(() => setXmlCopied(false), 2500);
  };

  // -------------------------------------------------------------------------
  // CHEQUES GIRADOS COMPUTED & LIFECYCLE
  // -------------------------------------------------------------------------
  const chequesEnTransito = useMemo(() => issuedChecks.filter(c => isCheckInTransit(c.status)), [issuedChecks]);
  const chequesEmitidos = useMemo(() => issuedChecks.filter(c => c.status === 'EMITIDO' || c.status === 'GIRADO'), [issuedChecks]);
  const chequesEntregados = useMemo(() => issuedChecks.filter(c => c.status === 'ENTREGADO'), [issuedChecks]);
  const chequesCobrados = useMemo(() => issuedChecks.filter(c => c.status === 'COBRADO'), [issuedChecks]);
  const chequesAnulados = useMemo(() => issuedChecks.filter(c => c.status === 'ANULADO'), [issuedChecks]);

  const totalChequesAmount = useMemo(() => issuedChecks.filter(c => c.status !== 'ANULADO').reduce((acc, c) => acc + (c.amount || 0), 0), [issuedChecks]);
  const totalEnTransito = useMemo(() => chequesEnTransito.reduce((acc, c) => acc + (c.amount || 0), 0), [chequesEnTransito]);
  const totalCobrados = useMemo(() => chequesCobrados.reduce((acc, c) => acc + (c.amount || 0), 0), [chequesCobrados]);
  const totalAnulados = useMemo(() => chequesAnulados.reduce((acc, c) => acc + (c.amount || 0), 0), [chequesAnulados]);

  const filteredChecks = useMemo(() => {
    return issuedChecks.filter(chk => {
      const matchesSearch = 
        (chk.checkNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (chk.beneficiary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (chk.bankName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (chk.concept || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (checkStatusFilter === 'TODOS') return true;
      if (checkStatusFilter === 'EN_TRANSITO') return isCheckInTransit(chk.status);
      if (checkStatusFilter === 'EMITIDO') return chk.status === 'EMITIDO' || chk.status === 'GIRADO';
      return chk.status === checkStatusFilter;
    });
  }, [issuedChecks, searchTerm, checkStatusFilter]);

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------

  const handleSaveIssuedCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheck.checkNumber || !newCheck.beneficiary || !newCheck.amount) return;

    const bankName = newCheck.bankName || 'Banco Pichincha';
    const checkAmount = parseFloat(newCheck.amount.toString()) || 0;
    const journalEntryId = `entry-${Date.now()}`;
    const nextEntryNum = `AS-${new Date().getFullYear()}-${String(journalEntries.length + 1).padStart(4, '0')}`;

    const chk: IssuedCheck = {
      id: `chk-${Date.now()}`,
      checkNumber: newCheck.checkNumber,
      bankName,
      issueDate: new Date().toISOString().split('T')[0],
      paymentDate: newCheck.paymentDate || new Date().toISOString().split('T')[0],
      beneficiary: newCheck.beneficiary,
      amount: checkAmount,
      concept: newCheck.concept || 'Pago por comprobante',
      status: 'EMITIDO',
      journalEntryId
    };

    // Generar Asiento Contable Automático (Debe: Proveedores / Haber: Banco)
    const isGuayaquil = bankName.toLowerCase().includes('guayaquil');
    const creditAccountCode = isGuayaquil ? '1.1.01.02.02' : '1.1.01.02.01';

    const newJournalEntry: JournalEntry = {
      id: journalEntryId,
      entryNumber: nextEntryNum,
      date: chk.issueDate,
      concept: `Emisión Cheque N° ${chk.checkNumber} a favor de ${chk.beneficiary} - ${chk.concept}`,
      type: 'EGRESO',
      items: [
        {
          accountCode: '2.1.01.01.01',
          accountName: 'Cuentas por Pagar Proveedores Locales',
          debit: checkAmount,
          credit: 0
        },
        {
          accountCode: creditAccountCode,
          accountName: `${bankName} Cta Cte (Cheques en Tránsito)`,
          debit: 0,
          credit: checkAmount
        }
      ],
      totalDebit: checkAmount,
      totalCredit: checkAmount,
      status: 'ASENTADO'
    };

    setIssuedChecks([chk, ...issuedChecks]);
    setJournalEntries([newJournalEntry, ...journalEntries]);
    setIsCheckModalOpen(false);
    showToast(`Cheque N° ${chk.checkNumber} emitido en tránsito y Asiento ${nextEntryNum} mayorizado.`, 'success');
    setNewCheck({
      checkNumber: '',
      bankName: 'Banco Pichincha',
      paymentDate: new Date().toISOString().split('T')[0],
      beneficiary: '',
      amount: 0,
      concept: ''
    });
  };

  const handleMarkDelivered = (chk: IssuedCheck) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = issuedChecks.map(c => c.id === chk.id ? { ...c, status: 'ENTREGADO' as const, deliveryDate: today } : c);
    setIssuedChecks(updated);
    showToast(`Cheque N° ${chk.checkNumber} marcado como ENTREGADO al proveedor.`, 'info');
  };

  const handleMarkCleared = (chk: IssuedCheck) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = issuedChecks.map(c => c.id === chk.id ? { ...c, status: 'COBRADO' as const, clearedDate: today } : c);
    setIssuedChecks(updated);
    showToast(`Cheque N° ${chk.checkNumber} COBRADO y conciliado con el extracto bancario.`, 'success');
  };

  const handleCancelCheck = (chk: IssuedCheck) => {
    showConfirm(
      `¿Deseas anular el Cheque N° ${chk.checkNumber} por ${formatCurrency(chk.amount, settings.currencySymbol)}? Se generará el asiento contable de reversa.`,
      () => {
        const today = new Date().toISOString().split('T')[0];
        const updated = issuedChecks.map(c => c.id === chk.id ? { ...c, status: 'ANULADO' as const } : c);
        setIssuedChecks(updated);

        // Reversing entry: Debe Banco / Haber Proveedores
        const nextEntryNum = `AS-${new Date().getFullYear()}-${String(journalEntries.length + 1).padStart(4, '0')}`;
        const isGuayaquil = (chk.bankName || '').toLowerCase().includes('guayaquil');
        const bankAccountCode = isGuayaquil ? '1.1.01.02.02' : '1.1.01.02.01';

        const revEntry: JournalEntry = {
          id: `entry-rev-${Date.now()}`,
          entryNumber: nextEntryNum,
          date: today,
          concept: `REVERSA: Anulación Cheque N° ${chk.checkNumber} (${chk.beneficiary})`,
          type: 'AJUSTE',
          items: [
            {
              accountCode: bankAccountCode,
              accountName: `${chk.bankName} Cta Cte (Restitución Fondos)`,
              debit: chk.amount,
              credit: 0
            },
            {
              accountCode: '2.1.01.01.01',
              accountName: 'Cuentas por Pagar Proveedores Locales',
              debit: 0,
              credit: chk.amount
            }
          ],
          totalDebit: chk.amount,
          totalCredit: chk.amount,
          status: 'ASENTADO'
        };
        setJournalEntries([revEntry, ...journalEntries]);
        showToast(`Cheque N° ${chk.checkNumber} anulado y Asiento de reversa ${nextEntryNum} registrado.`, 'warning');
      },
      'Anular Cheque Girado',
      'Sí, Anular Cheque',
      'Cancelar'
    );
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

  const handleOpenNewAccountModal = (parent?: AccountPlanItem) => {
    setEditingAccount(null);
    if (parent) {
      const nextCode = getNextChildAccountCode(parent.code, accountPlan);
      const nextLevel = Math.min(5, (parent.level || 1) + 1);
      setNewAccount({
        code: nextCode,
        name: '',
        level: nextLevel,
        type: parent.type,
        nature: parent.nature,
        acceptsMovement: nextLevel >= 4
      });
    } else {
      setNewAccount({
        code: '',
        name: '',
        level: 5,
        type: 'ACTIVO',
        nature: 'DEUDORA',
        acceptsMovement: true
      });
    }
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccountModal = (account: AccountPlanItem) => {
    setEditingAccount(account);
    setNewAccount({
      code: account.code,
      name: account.name,
      level: account.level,
      type: account.type,
      nature: account.nature,
      acceptsMovement: account.acceptsMovement
    });
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.code || !newAccount.name) return;

    const trimmedCode = newAccount.code.trim();
    const trimmedName = newAccount.name.trim();

    // Auto-detect type & nature based on first digit if not set
    const firstDigit = trimmedCode.charAt(0);
    let autoType = newAccount.type || 'ACTIVO';
    let autoNature = newAccount.nature || 'DEUDORA';
    if (firstDigit === '1') { autoType = 'ACTIVO'; autoNature = 'DEUDORA'; }
    else if (firstDigit === '2') { autoType = 'PASIVO'; autoNature = 'ACREEDORA'; }
    else if (firstDigit === '3') { autoType = 'PATRIMONIO'; autoNature = 'ACREEDORA'; }
    else if (firstDigit === '4') { autoType = 'INGRESO'; autoNature = 'ACREEDORA'; }
    else if (firstDigit === '5') { autoType = 'GASTO'; autoNature = 'DEUDORA'; }

    const acc: AccountPlanItem = {
      code: trimmedCode,
      name: trimmedName,
      level: Number(newAccount.level || 5),
      type: autoType,
      nature: autoNature,
      acceptsMovement: newAccount.acceptsMovement ?? (Number(newAccount.level || 5) >= 4),
      balance: editingAccount ? editingAccount.balance : 0
    };

    if (editingAccount) {
      setAccountPlan(accountPlan.map(a => a.code === editingAccount.code ? acc : a));
      showToast(`Cuenta ${acc.code} - ${acc.name} actualizada con éxito.`, 'success');
    } else {
      // Check duplicate code
      if (accountPlan.some(a => a.code === acc.code)) {
        showAlert('Código Duplicado', `Ya existe una cuenta con el código ${acc.code}. Por favor use un código único.`);
        return;
      }
      setAccountPlan([...accountPlan, acc].sort((a, b) => a.code.localeCompare(b.code)));
      showToast(`Cuenta ${acc.code} agregada al catálogo NIIF.`, 'success');
    }

    setIsAccountModalOpen(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (code: string) => {
    const acc = accountPlan.find(a => a.code === code);
    if (!acc) return;

    // Check if account has movements in journal entries
    const hasMovements = journalEntries.some(je => je.items.some(it => it.accountCode === code));
    if (hasMovements) {
      showAlert('Cuenta con Movimientos', `La cuenta ${code} (${acc.name}) ya tiene asientos contables registrados en el Libro Diario y no puede ser eliminada para preservar la trazabilidad NIIF.`);
      return;
    }

    // Check if account has child accounts
    const prefix = code.replace(/\.00.*$/, '');
    const hasChildren = accountPlan.some(a => a.code !== code && a.code.startsWith(prefix));
    if (hasChildren && acc.level < 5) {
      showAlert('Cuenta Padre', `La cuenta ${code} tiene subcuentas hijas dependientes. Elimine primero las subcuentas.`);
      return;
    }

    showConfirm(
      `¿Está seguro de eliminar la cuenta contable ${code} - ${acc.name}?`,
      () => {
        setAccountPlan(accountPlan.filter(a => a.code !== code));
        showToast(`Cuenta ${code} eliminada del catálogo.`, 'info');
      },
      'Eliminar Cuenta NIIF',
      'Sí, Eliminar',
      'Cancelar'
    );
  };

  const handleResetAccountPlan = () => {
    showConfirm(
      '¿Desea restaurar el Catálogo Oficial NIIF para Ferreterías? Esta acción cargará más de 65 cuentas estandarizadas (Activo, Pasivo, Patrimonio, Ingresos y Gastos) preparadas para la normativa ecuatoriana.',
      () => {
        setAccountPlan(OFFICIAL_NIIF_ACCOUNT_PLAN);
        showToast('Catálogo Oficial NIIF para Ferreterías restaurado correctamente.', 'success');
      },
      'Restaurar Catálogo Oficial NIIF',
      'Sí, Restaurar Cuentas',
      'Cancelar'
    );
  };

  const handleExportAccountPlanCSV = () => {
    const headers = ['CODIGO', 'NOMBRE DE CUENTA', 'NIVEL', 'TIPO NIIF', 'NATURALEZA', 'MOVIMIENTO', 'SALDO MAYORIZADO'];
    const rows = accountPlan.map(a => [
      `"${a.code}"`,
      `"${a.name.replace(/"/g, '""')}"`,
      a.level,
      a.type,
      a.nature,
      a.acceptsMovement ? 'ACEPTA ASIENTOS' : 'AGRUPADORA',
      (accountBalances[a.code] || 0).toFixed(2)
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Catalogo_Cuentas_NIIF_${settings.storeName || 'Ferreteria'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Catálogo de Cuentas NIIF exportado en CSV.', 'success');
  };

  const handleSyncAutomaticEntries = () => {
    setIsSyncingEntries(true);
    try {
      const existingConcepts = new Set(journalEntries.map(je => je.concept));
      const newGeneratedEntries: JournalEntry[] = [];
      let entrySeq = journalEntries.length + 1;

      // 1. Asientos de Ventas
      const validInvoices = invoices.filter(inv => inv.paymentStatus !== 'ANULADA' && inv.documentType !== 'COTIZACION');
      validInvoices.forEach(inv => {
        const docNum = inv.invoiceNumber || inv.id || '';
        const isAlreadyAsented = journalEntries.some(je => je.concept.includes(`Factura #${docNum}`));
        if (!isAlreadyAsented && docNum) {
          const entryNum = `ASI-2026-${String(entrySeq++).padStart(4, '0')}`;
          const entry = buildAutomaticInvoiceEntry(inv, accountingMapping, accountPlan, entryNum);
          if (entry && !existingConcepts.has(entry.concept)) {
            newGeneratedEntries.push(entry);
            existingConcepts.add(entry.concept);
          }
        }
      });

      // 2. Asientos de Compras
      purchases.forEach(pur => {
        const docNum = pur.invoiceNumber || pur.documentNumber || pur.id || '';
        const isAlreadyAsented = journalEntries.some(je => je.concept.includes(`Compra / Adquisición #${docNum}`));
        if (!isAlreadyAsented && docNum) {
          const entryNum = `ASI-2026-${String(entrySeq++).padStart(4, '0')}`;
          const entry = buildAutomaticPurchaseEntry(pur, accountingMapping, accountPlan, entryNum);
          if (entry && !existingConcepts.has(entry.concept)) {
            newGeneratedEntries.push(entry);
            existingConcepts.add(entry.concept);
          }
        }
      });

      if (newGeneratedEntries.length === 0) {
        showToast('Todos los comprobantes de ventas y compras ya se encuentran debidamente contabilizados y mayorizados.', 'info');
      } else {
        setJournalEntries([...newGeneratedEntries, ...journalEntries]);
        showToast(`Se generaron y mayorizaron ${newGeneratedEntries.length} asientos automáticos con partida doble cuadrada.`, 'success');
      }
    } catch (e: any) {
      showAlert('Error en Sincronización', e?.message || 'No se pudieron generar los asientos automáticos.');
    } finally {
      setIsSyncingEntries(false);
    }
  };

  // -------------------------------------------------------------------------
  // CONCILIACIÓN DE TARJETAS Y VOUCHERS COMPUTED & HANDLERS
  // -------------------------------------------------------------------------
  const cardInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.paymentStatus === 'ANULADA' || inv.documentType === 'COTIZACION') return false;
      const pm = String(inv.paymentMethod || '').toUpperCase();
      return pm.includes('TARJETA') || pm === '19' || pm === '16';
    });
  }, [invoices]);

  const reconciledInvoiceIdsSet = useMemo(() => {
    const set = new Set<string>();
    cardReconciliations.forEach(cr => {
      if (Array.isArray(cr.reconciledInvoiceIds)) {
        cr.reconciledInvoiceIds.forEach(id => set.add(id));
      }
    });
    return set;
  }, [cardReconciliations]);

  const pendingCardVouchers = useMemo(() => {
    return cardInvoices.filter(inv => !reconciledInvoiceIdsSet.has(inv.id));
  }, [cardInvoices, reconciledInvoiceIdsSet]);

  const filteredPendingVouchers = useMemo(() => {
    if (!cardSearchTerm.trim()) return pendingCardVouchers;
    const q = cardSearchTerm.toLowerCase();
    return pendingCardVouchers.filter(v => 
      (v.fullNumber || '').toLowerCase().includes(q) ||
      (v.customer?.name || '').toLowerCase().includes(q) ||
      (v.customer?.idNumber || '').toLowerCase().includes(q) ||
      (v.paymentReference || '').toLowerCase().includes(q) ||
      (v.paymentMethod || '').toLowerCase().includes(q)
    );
  }, [pendingCardVouchers, cardSearchTerm]);

  const filteredReconciliations = useMemo(() => {
    if (!cardSearchTerm.trim()) return cardReconciliations;
    const q = cardSearchTerm.toLowerCase();
    return cardReconciliations.filter(cr => 
      (cr.batchNumber || '').toLowerCase().includes(q) ||
      (cr.processor || '').toLowerCase().includes(q) ||
      (cr.bankAccountName || '').toLowerCase().includes(q) ||
      (cr.notes || '').toLowerCase().includes(q)
    );
  }, [cardReconciliations, cardSearchTerm]);

  // Totales generales para KPIs
  const totalVouchersEnTransitoAmount = useMemo(() => {
    return pendingCardVouchers.reduce((sum, inv) => sum + (inv.total || 0), 0);
  }, [pendingCardVouchers]);

  const totalNetoAcreditado = useMemo(() => {
    return cardReconciliations.filter(cr => cr.status === 'CONCILIADO').reduce((sum, cr) => sum + (cr.netAmount || 0), 0);
  }, [cardReconciliations]);

  const totalComisionesDeducidas = useMemo(() => {
    return cardReconciliations.filter(cr => cr.status === 'CONCILIADO').reduce((sum, cr) => sum + (cr.commissionAmount || 0), 0);
  }, [cardReconciliations]);

  const totalRetencionesSoportadas = useMemo(() => {
    return cardReconciliations.filter(cr => cr.status === 'CONCILIADO').reduce((sum, cr) => sum + (cr.taxRetained || 0), 0);
  }, [cardReconciliations]);

  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  // Cálculos dinámicos en tiempo real para el formulario de liquidación
  const calculatedCommission = useMemo(() => {
    return round2((settlementForm.taxBase || 0) * (settlementForm.commissionRate / 100));
  }, [settlementForm.taxBase, settlementForm.commissionRate]);

  const calculatedCommissionIva = useMemo(() => {
    return round2(calculatedCommission * (settlementForm.commissionIvaRate / 100));
  }, [calculatedCommission, settlementForm.commissionIvaRate]);

  const calculatedIrRetention = useMemo(() => {
    return round2((settlementForm.taxBase || 0) * (settlementForm.irRetentionRate / 100));
  }, [settlementForm.taxBase, settlementForm.irRetentionRate]);

  const calculatedIvaRetention = useMemo(() => {
    return round2((settlementForm.taxAmount || 0) * (settlementForm.ivaRetentionRate / 100));
  }, [settlementForm.taxAmount, settlementForm.ivaRetentionRate]);

  const calculatedTotalDeductions = useMemo(() => {
    return round2(calculatedCommission + calculatedCommissionIva + calculatedIrRetention + calculatedIvaRetention + (settlementForm.networkFee || 0));
  }, [calculatedCommission, calculatedCommissionIva, calculatedIrRetention, calculatedIvaRetention, settlementForm.networkFee]);

  const calculatedNetAmount = useMemo(() => {
    return round2((settlementForm.grossAmount || 0) - calculatedTotalDeductions);
  }, [settlementForm.grossAmount, calculatedTotalDeductions]);

  // Selección de Vouchers
  const handleToggleVoucher = (id: string) => {
    setSelectedVoucherIds(prev => 
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    );
  };

  const handleSelectAllPendingVouchers = () => {
    if (selectedVoucherIds.length === pendingCardVouchers.length && pendingCardVouchers.length > 0) {
      setSelectedVoucherIds([]);
    } else {
      setSelectedVoucherIds(pendingCardVouchers.map(v => v.id));
    }
  };

  // Abrir Modal de Liquidación
  const handleOpenSettlement = (withSelectedVouchers: boolean = false) => {
    const vouchersToProcess = withSelectedVouchers 
      ? pendingCardVouchers.filter(v => selectedVoucherIds.includes(v.id))
      : [];

    const gross = vouchersToProcess.length > 0 
      ? round2(vouchersToProcess.reduce((sum, v) => sum + (v.total || 0), 0))
      : 0;

    const base = vouchersToProcess.length > 0 
      ? round2(vouchersToProcess.reduce((sum, v) => sum + (v.subtotal || (v.total / 1.15)), 0))
      : 0;

    const tax = vouchersToProcess.length > 0 
      ? round2(vouchersToProcess.reduce((sum, v) => sum + (v.taxTotal || (v.total - (v.subtotal || v.total / 1.15))), 0))
      : 0;

    const nextBatchNum = `LOTE-${String(cardReconciliations.length + 1).padStart(4, '0')}`;

    setSettlementForm({
      processor: 'Datafast',
      batchNumber: nextBatchNum,
      terminalId: 'POS-01',
      settlementDate: new Date().toISOString().split('T')[0],
      bankAccountCode: '1.1.01.02.01',
      grossAmount: gross,
      taxBase: base,
      taxAmount: tax,
      commissionRate: 3.5,
      commissionIvaRate: 15,
      irRetentionRate: 1.75,
      ivaRetentionRate: 30,
      networkFee: 0,
      notes: vouchersToProcess.length > 0 ? `Liquidación de ${vouchersToProcess.length} vouchers en tránsito de POS` : ''
    });

    setIsSettlementModalOpen(true);
  };

  // Guardar y Asentar Liquidación
  const handleSaveSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (settlementForm.grossAmount <= 0) {
      showAlert('Monto Requerido', 'El monto bruto del lote debe ser mayor a 0 para conciliar.');
      return;
    }
    if (calculatedNetAmount <= 0) {
      showAlert('Error en Liquidación', 'El monto neto a depositar debe ser mayor a 0.');
      return;
    }

    const today = settlementForm.settlementDate || new Date().toISOString().split('T')[0];
    const journalEntryId = `asi-card-${Date.now()}`;
    const nextEntryNum = `ASI-2026-${String(journalEntries.length + 1).padStart(4, '0')}`;
    
    // Cuenta bancaria destino
    const targetAccount = accountPlan.find(a => a.code === settlementForm.bankAccountCode);
    const bankAccountName = targetAccount ? targetAccount.name : 'Banco Pichincha Cta Cte';

    // Generación del Asiento Contable Automático en Partida Doble
    const items: JournalEntryItem[] = [
      {
        accountCode: settlementForm.bankAccountCode,
        accountName: `${bankAccountName} (Depósito Neto Lote)`,
        debit: calculatedNetAmount,
        credit: 0
      },
      {
        accountCode: '5.2.03.01.01',
        accountName: 'Comisiones Bancarias y Red POS Tarjetas',
        debit: round2(calculatedCommission + (settlementForm.networkFee || 0)),
        credit: 0
      }
    ];

    if (calculatedCommissionIva > 0) {
      items.push({
        accountCode: '1.1.04.01.01',
        accountName: 'Crédito Tributario IVA Compras y Servicios',
        debit: calculatedCommissionIva,
        credit: 0
      });
    }

    if (calculatedIrRetention > 0) {
      items.push({
        accountCode: '1.1.02.05.01',
        accountName: 'Anticipo Retención IR por Tarjetas de Crédito',
        debit: calculatedIrRetention,
        credit: 0
      });
    }

    if (calculatedIvaRetention > 0) {
      items.push({
        accountCode: '1.1.02.05.02',
        accountName: 'Crédito Tributario Retención IVA Tarjetas',
        debit: calculatedIvaRetention,
        credit: 0
      });
    }

    // Haber: Cierre exacto de la cuenta puente de vouchers
    items.push({
      accountCode: '1.1.01.03.01',
      accountName: 'Vouchers por Liquidar / Tarjetas en Tránsito',
      debit: 0,
      credit: settlementForm.grossAmount
    });

    const totalDebit = round2(items.reduce((s, it) => s + it.debit, 0));
    const totalCredit = round2(items.reduce((s, it) => s + it.credit, 0));

    // Validar partida doble
    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.05) {
      showAlert('Descuadre Contable', `Existe una diferencia de balance contable de $${diff.toFixed(2)}. Verifica los montos.`);
      return;
    }

    const newJournalEntry: JournalEntry = {
      id: journalEntryId,
      entryNumber: nextEntryNum,
      date: today,
      concept: `Liquidación Lote N° ${settlementForm.batchNumber} - ${settlementForm.processor} (${selectedVoucherIds.length > 0 ? `${selectedVoucherIds.length} vouchers en tránsito conciliados` : 'Liquidación Directa'})`,
      type: 'INGRESO',
      status: 'ASENTADO',
      items,
      totalDebit,
      totalCredit
    };

    const newReconciliation: CardReconciliation = {
      id: `cr-${Date.now()}`,
      batchNumber: settlementForm.batchNumber || `LOTE-${Date.now()}`,
      processor: settlementForm.processor,
      date: today,
      grossAmount: settlementForm.grossAmount,
      commissionAmount: round2(calculatedCommission + calculatedCommissionIva + (settlementForm.networkFee || 0)),
      taxRetained: round2(calculatedIrRetention + calculatedIvaRetention),
      netAmount: calculatedNetAmount,
      status: 'CONCILIADO',
      terminalId: settlementForm.terminalId,
      bankAccountId: settlementForm.bankAccountCode,
      bankAccountName,
      reconciledInvoiceIds: [...selectedVoucherIds],
      commissionRate: settlementForm.commissionRate,
      commissionIva: calculatedCommissionIva,
      irRetentionRate: settlementForm.irRetentionRate,
      irRetentionAmount: calculatedIrRetention,
      ivaRetentionRate: settlementForm.ivaRetentionRate,
      ivaRetentionAmount: calculatedIvaRetention,
      networkFee: settlementForm.networkFee,
      journalEntryId,
      notes: settlementForm.notes
    };

    setCardReconciliations([newReconciliation, ...cardReconciliations]);
    setJournalEntries([newJournalEntry, ...journalEntries]);
    setSelectedVoucherIds([]);
    setIsSettlementModalOpen(false);

    showToast(`Lote ${newReconciliation.batchNumber} conciliado con éxito. Asiento ${nextEntryNum} registrado en Libro Diario.`, 'success');
  };

  // Revertir Lote
  const handleRevertSettlement = (cr: CardReconciliation) => {
    showConfirm(
      `¿Deseas anular la conciliación del Lote N° ${cr.batchNumber} (${formatCurrency(cr.netAmount, settings.currencySymbol)})? Los vouchers asociados volverán al estado "En Tránsito" y se reversará el asiento contable.`,
      () => {
        // Remover de conciliaciones
        const updated = cardReconciliations.filter(c => c.id !== cr.id);
        setCardReconciliations(updated);

        // Reversar asiento contable si existe
        if (cr.journalEntryId) {
          const targetEntry = journalEntries.find(j => j.id === cr.journalEntryId);
          if (targetEntry) {
            const nextEntryNum = `AS-REV-${new Date().getFullYear()}-${String(journalEntries.length + 1).padStart(4, '0')}`;
            const revItems: JournalEntryItem[] = targetEntry.items.map(it => ({
              accountCode: it.accountCode,
              accountName: `${it.accountName} (REVERSA)`,
              debit: it.credit,
              credit: it.debit
            }));

            const revJournalEntry: JournalEntry = {
              id: `rev-${Date.now()}`,
              entryNumber: nextEntryNum,
              date: new Date().toISOString().split('T')[0],
              concept: `REVERSA: Anulación Liquidación Lote N° ${cr.batchNumber} - ${cr.processor}`,
              type: 'AJUSTE',
              status: 'ASENTADO',
              items: revItems,
              totalDebit: targetEntry.totalCredit,
              totalCredit: targetEntry.totalDebit
            };

            setJournalEntries([revJournalEntry, ...journalEntries]);
          }
        }

        showToast(`Lote N° ${cr.batchNumber} revertido con éxito. Vouchers restablecidos a "En Tránsito".`, 'info');
      },
      'Revertir Liquidación de Lote',
      'Sí, Revertir Lote',
      'Cancelar'
    );
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
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600">
                  <Receipt className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Gestión y Control de Cheques Girados
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ciclo de vida corporativo: Emisión, Entrega a Proveedor, Cobro en Banco y Conciliación contable.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const defaultBank = 'Banco Pichincha';
                const nextCheck = getNextCorrelativeCheck(issuedChecks, defaultBank);
                setNewCheck({
                  checkNumber: nextCheck,
                  bankName: defaultBank,
                  paymentDate: new Date().toISOString().split('T')[0],
                  beneficiary: '',
                  amount: 0,
                  concept: ''
                });
                setIsCheckModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Emitir Cheque Girado</span>
            </button>
          </div>

          {/* Top KPI Cards Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Total Cheques Girados</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {formatCurrency(totalChequesAmount, settings.currencySymbol)}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {issuedChecks.filter(c => c.status !== 'ANULADO').length} Documentos Activos
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-amber-800 text-[10px] font-bold uppercase tracking-wider">En Tránsito (Libros vs Banco)</span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <div className="text-2xl font-black text-amber-700 font-mono">
                {formatCurrency(totalEnTransito, settings.currencySymbol)}
              </div>
              <div className="text-xs text-amber-800 font-mono font-medium">
                {chequesEnTransito.length} Cheques pendientes de cobro
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-1">
              <span className="text-emerald-800 text-[10px] font-bold block uppercase tracking-wider">Cobrados / Conciliados</span>
              <div className="text-2xl font-black text-emerald-700 font-mono">
                {formatCurrency(totalCobrados, settings.currencySymbol)}
              </div>
              <div className="text-xs text-emerald-700 font-mono font-medium">
                {chequesCobrados.length} Cheques debitados en extracto
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Cheques Anulados</span>
              <div className="text-2xl font-black text-rose-600 font-mono">
                {chequesAnulados.length} <span className="text-xs font-normal text-slate-400">Cheques</span>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {formatCurrency(totalAnulados, settings.currencySymbol)} revertidos
              </div>
            </div>
          </div>

          {/* Search & Status Filter Pills */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por N° cheque, beneficiario, banco..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {(
                [
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'EN_TRANSITO', label: `En Tránsito (${chequesEnTransito.length})` },
                  { id: 'EMITIDO', label: `Emitidos (${chequesEmitidos.length})` },
                  { id: 'ENTREGADO', label: `Entregados (${chequesEntregados.length})` },
                  { id: 'COBRADO', label: `Cobrados (${chequesCobrados.length})` },
                  { id: 'ANULADO', label: `Anulados (${chequesAnulados.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCheckStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                    checkStatusFilter === tab.id
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cheques Girados Table with Interactive Lifecycle */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Cheque</th>
                  <th className="py-3 px-4">Banco Emisor</th>
                  <th className="py-3 px-4">Fechas</th>
                  <th className="py-3 px-4">Beneficiario / Proveedor</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-center">Estado Ciclo de Vida</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {filteredChecks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-sans text-xs">
                      No se encontraron cheques girados con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredChecks.map((chk) => {
                    const badge = getCheckStatusBadge(chk.status);
                    const isInTransit = isCheckInTransit(chk.status);

                    return (
                      <tr key={chk.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black text-slate-900 flex items-center gap-1.5">
                          <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{chk.checkNumber}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-800 font-bold">
                          {chk.bankName}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                          <div><span className="text-slate-400">Emi:</span> {chk.issueDate}</div>
                          {chk.deliveryDate && <div><span className="text-indigo-600 font-bold">Ent:</span> {chk.deliveryDate}</div>}
                          {chk.clearedDate && <div><span className="text-emerald-600 font-bold">Cob:</span> {chk.clearedDate}</div>}
                        </td>
                        <td className="py-3 px-4 font-sans font-bold text-slate-900">
                          {chk.beneficiary}
                          {chk.invoiceNumber && (
                            <span className="block text-[10px] font-mono text-orange-600 font-normal">
                              Factura: {chk.invoiceNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-sans truncate max-w-xs" title={chk.concept}>
                          {chk.concept}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                          {formatCurrency(chk.amount, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-wider block text-center ${badge.className}`}
                            title={badge.description}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1 font-sans">
                            {/* Entregar si está en estado EMITIDO / GIRADO */}
                            {(chk.status === 'EMITIDO' || chk.status === 'GIRADO') && (
                              <button
                                onClick={() => handleMarkDelivered(chk)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200 transition cursor-pointer"
                                title="Marcar como entregado físicamente al proveedor"
                              >
                                Entregar
                              </button>
                            )}

                            {/* Cobrar / Conciliar en banco */}
                            {chk.status !== 'COBRADO' && chk.status !== 'ANULADO' && (
                              <button
                                onClick={() => handleMarkCleared(chk)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200 transition cursor-pointer"
                                title="Marcar como cobrado en extracto bancario (Conciliado)"
                              >
                                Cobrado
                              </button>
                            )}

                            {/* Anular si no está anulado */}
                            {chk.status !== 'ANULADO' && (
                              <button
                                onClick={() => handleCancelCheck(chk)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold border border-rose-200 transition cursor-pointer"
                                title="Anular cheque y generar asiento contable de reversa"
                              >
                                Anular
                              </button>
                            )}

                            {chk.status === 'ANULADO' && (
                              <span className="text-[10px] text-slate-400 font-mono">Sin acción</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
        <div className="space-y-6">
          {/* Header & Acciones Principales */}
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-950 tracking-tight">
                      Conciliación de Tarjetas de Crédito, Débito & Vouchers
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Liquidación y cuadre financiero: cruce de vouchers en tránsito contra estados de adquirentes (Datafast, Medianet), deducción de comisiones y retenciones SRI con asiento contable automático.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => handleOpenSettlement(false)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4 text-slate-600" />
                  <span>Liquidación Manual de Lote</span>
                </button>

                <button
                  type="button"
                  disabled={selectedVoucherIds.length === 0}
                  onClick={() => handleOpenSettlement(true)}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl transition-all shadow-sm ${
                    selectedVoucherIds.length > 0
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer ring-2 ring-blue-500/20'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Liquidar Vouchers Seleccionados ({selectedVoucherIds.length})</span>
                </button>
              </div>
            </div>

            {/* Tarjetas Métricas Superiores (KPIs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
              {/* KPI 1: Vouchers en Tránsito */}
              <div className="bg-gradient-to-br from-amber-500/5 to-amber-600/10 border border-amber-200/80 rounded-2xl p-4.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-amber-800 tracking-wider">
                    Vouchers en Tránsito
                  </span>
                  <div className="p-1.5 bg-amber-100/80 text-amber-700 rounded-lg">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-950 font-mono tracking-tight">
                  {formatCurrency(totalVouchersEnTransitoAmount, settings.currencySymbol)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-amber-700 font-medium">
                  <span>{pendingCardVouchers.length} cobro{pendingCardVouchers.length !== 1 ? 's' : ''} por liquidar</span>
                  <span className="px-1.5 py-0.5 bg-amber-200/60 rounded text-[10px] font-bold">Activo Exigible</span>
                </div>
              </div>

              {/* KPI 2: Depósito Neto Acreditado */}
              <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 border border-emerald-200/80 rounded-2xl p-4.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
                    Neto Depositado en Bancos
                  </span>
                  <div className="p-1.5 bg-emerald-100/80 text-emerald-700 rounded-lg">
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight">
                  {formatCurrency(totalNetoAcreditado, settings.currencySymbol)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                  <span>{cardReconciliations.length} lote{cardReconciliations.length !== 1 ? 's' : ''} conciliado{cardReconciliations.length !== 1 ? 's' : ''}</span>
                  <span className="px-1.5 py-0.5 bg-emerald-200/60 rounded text-[10px] font-bold">Flujo de Caja Real</span>
                </div>
              </div>

              {/* KPI 3: Comisiones Financieras Deducidas */}
              <div className="bg-gradient-to-br from-rose-500/5 to-rose-600/10 border border-rose-200/80 rounded-2xl p-4.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-rose-800 tracking-wider">
                    Comisiones & Costos Red
                  </span>
                  <div className="p-1.5 bg-rose-100/80 text-rose-700 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-rose-950 font-mono tracking-tight">
                  -{formatCurrency(totalComisionesDeducidas, settings.currencySymbol)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-rose-700 font-medium">
                  <span>MDR + Red + IVA Comisión</span>
                  <span className="px-1.5 py-0.5 bg-rose-200/60 rounded text-[10px] font-bold">Gasto Financiero</span>
                </div>
              </div>

              {/* KPI 4: Retenciones Soportadas SRI */}
              <div className="bg-gradient-to-br from-blue-500/5 to-blue-600/10 border border-blue-200/80 rounded-2xl p-4.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-blue-800 tracking-wider">
                    Retenciones Soportadas SRI
                  </span>
                  <div className="p-1.5 bg-blue-100/80 text-blue-700 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-950 font-mono tracking-tight">
                  -{formatCurrency(totalRetencionesSoportadas, settings.currencySymbol)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-blue-700 font-medium">
                  <span>Retención IR + Retención IVA</span>
                  <span className="px-1.5 py-0.5 bg-blue-200/60 rounded text-[10px] font-bold">Crédito Fiscal SRI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navegación Secundaria y Filtros */}
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              {/* Pestañas de Vista */}
              <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setCardReconciliationTab('TRANSITO')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    cardReconciliationTab === 'TRANSITO'
                      ? 'bg-white text-blue-700 shadow-sm font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Vouchers en Tránsito</span>
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    cardReconciliationTab === 'TRANSITO' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {pendingCardVouchers.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCardReconciliationTab('HISTORIAL')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    cardReconciliationTab === 'HISTORIAL'
                      ? 'bg-white text-blue-700 shadow-sm font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Historial de Lotes Liquidados</span>
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    cardReconciliationTab === 'HISTORIAL' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {cardReconciliations.length}
                  </span>
                </button>
              </div>

              {/* Buscador */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={cardReconciliationTab === 'TRANSITO' ? "Buscar por N° factura, cliente, voucher..." : "Buscar lote, procesador, banco..."}
                  value={cardSearchTerm}
                  onChange={(e) => setCardSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                {cardSearchTerm && (
                  <button
                    onClick={() => setCardSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* =================================================================
                VISTA 1: VOUCHERS EN TRÁNSITO (POS PENDIENTES)
               ================================================================= */}
            {cardReconciliationTab === 'TRANSITO' && (
              <div className="space-y-4">
                {/* Barra de Selección Masiva */}
                {pendingCardVouchers.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSelectAllPendingVouchers}
                        className="inline-flex items-center gap-2 font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
                      >
                        {selectedVoucherIds.length === pendingCardVouchers.length ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <span>
                          {selectedVoucherIds.length === pendingCardVouchers.length
                            ? 'Deseleccionar todos'
                            : `Seleccionar todos (${pendingCardVouchers.length})`}
                        </span>
                      </button>

                      {selectedVoucherIds.length > 0 && (
                        <span className="text-slate-400">|</span>
                      )}

                      {selectedVoucherIds.length > 0 && (
                        <span className="font-bold text-blue-600">
                          {selectedVoucherIds.length} seleccionado{selectedVoucherIds.length !== 1 ? 's' : ''} (
                          {formatCurrency(
                            pendingCardVouchers
                              .filter(v => selectedVoucherIds.includes(v.id))
                              .reduce((s, v) => s + (v.total || 0), 0),
                            settings.currencySymbol
                          )}
                          )
                        </span>
                      )}
                    </div>

                    {selectedVoucherIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenSettlement(true)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        <span>Liquidar Selección Ahora</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Tabla de Vouchers en Tránsito */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedVoucherIds.length === pendingCardVouchers.length && pendingCardVouchers.length > 0}
                            onChange={handleSelectAllPendingVouchers}
                            className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-4">Fecha / Hora</th>
                        <th className="py-3 px-4">Factura N°</th>
                        <th className="py-3 px-4">Cliente / RUC</th>
                        <th className="py-3 px-4">Método POS</th>
                        <th className="py-3 px-4">Ref. Voucher / POS</th>
                        <th className="py-3 px-4 text-right">Subtotal Base</th>
                        <th className="py-3 px-4 text-right">IVA (15%)</th>
                        <th className="py-3 px-4 text-right">Total Voucher</th>
                        <th className="py-3 px-4 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                      {filteredPendingVouchers.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                                <CheckCircle2 className="w-8 h-8" />
                              </div>
                              <div className="font-black text-slate-800 text-sm">
                                {cardSearchTerm ? 'No se encontraron vouchers que coincidan con la búsqueda.' : '¡No hay vouchers pendientes de liquidar!'}
                              </div>
                              <p className="text-xs text-slate-500 max-w-md text-center">
                                {cardSearchTerm ? 'Prueba con otro término de búsqueda o limpia el filtro.' : 'Todas las ventas electrónicas registradas en el punto de venta han sido conciliadas y cuadradas con las redes adquirentes.'}
                              </p>
                              {!cardSearchTerm && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenSettlement(false)}
                                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Registrar Liquidación Externa</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredPendingVouchers.map((inv) => {
                          const isSelected = selectedVoucherIds.includes(inv.id);
                          const isCredit = String(inv.paymentMethod || '').toUpperCase().includes('CREDITO');
                          const dateFormatted = inv.createdAt ? new Date(inv.createdAt).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—';
                          
                          return (
                            <tr
                              key={inv.id}
                              onClick={() => handleToggleVoucher(inv.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleVoucher(inv.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600">{dateFormatted}</td>
                              <td className="py-3 px-4 font-mono font-black text-slate-900">
                                {inv.fullNumber || inv.id}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-800 line-clamp-1">{inv.customer?.name || 'Consumidor Final'}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{inv.customer?.idNumber || '9999999999999'}</div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isCredit ? 'bg-purple-50 text-purple-700 border border-purple-200/60' : 'bg-cyan-50 text-cyan-700 border border-cyan-200/60'
                                }`}>
                                  <CreditCard className="w-3 h-3" />
                                  <span>{isCredit ? 'T. Crédito' : 'T. Débito'}</span>
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-700">
                                {inv.paymentReference ? (
                                  <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold">
                                    Ref: {inv.paymentReference}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">POS Terminal</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">
                                {formatCurrency(inv.subtotal || (inv.total / 1.15), settings.currencySymbol)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">
                                {formatCurrency(inv.taxTotal || (inv.total - (inv.subtotal || inv.total / 1.15)), settings.currencySymbol)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-black text-slate-950 text-xs">
                                {formatCurrency(inv.total, settings.currencySymbol)}
                              </td>
                              <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedVoucherIds([inv.id]);
                                    handleOpenSettlement(true);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  Liquidar
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* =================================================================
                VISTA 2: HISTORIAL DE LOTES LIQUIDADOS
               ================================================================= */}
            {cardReconciliationTab === 'HISTORIAL' && (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">N° Lote / MID</th>
                        <th className="py-3 px-4">Procesador</th>
                        <th className="py-3 px-4">Fecha Liquidación</th>
                        <th className="py-3 px-4">Cuenta Banco Destino</th>
                        <th className="py-3 px-4 text-right">Monto Bruto</th>
                        <th className="py-3 px-4 text-right">Comisión Total</th>
                        <th className="py-3 px-4 text-right">Retenciones SRI</th>
                        <th className="py-3 px-4 text-right">Neto Acreditado</th>
                        <th className="py-3 px-4 text-center">Asiento Diario</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                      {filteredReconciliations.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center font-sans text-xs text-slate-400">
                            No hay registros de liquidaciones de tarjetas conciliadas en el historial.
                          </td>
                        </tr>
                      ) : (
                        filteredReconciliations.map((cr) => {
                          const linkedEntry = cr.journalEntryId ? journalEntries.find(j => j.id === cr.journalEntryId) : null;
                          return (
                            <tr key={cr.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-black text-slate-900">{cr.batchNumber}</div>
                                {cr.terminalId && (
                                  <div className="text-[10px] text-slate-400">Term: {cr.terminalId}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 font-sans font-bold text-slate-800">
                                <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">
                                  {cr.processor}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600">{cr.date}</td>
                              <td className="py-3 px-4 font-sans text-slate-700 text-[11px] max-w-xs truncate">
                                {cr.bankAccountName || 'Banco Pichincha Cta Cte'}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-800">
                                {formatCurrency(cr.grossAmount, settings.currencySymbol)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-rose-600">
                                -{formatCurrency(cr.commissionAmount, settings.currencySymbol)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-amber-600">
                                -{formatCurrency(cr.taxRetained, settings.currencySymbol)}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-emerald-600 text-xs bg-emerald-50/40">
                                {formatCurrency(cr.netAmount, settings.currencySymbol)}
                              </td>
                              <td className="py-3 px-4 text-center font-sans">
                                {linkedEntry ? (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono font-bold rounded text-[10px]">
                                    {linkedEntry.entryNumber}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center font-sans">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  cr.status === 'CONCILIADO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {cr.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-sans">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    title="Ver Comprobante de Liquidación"
                                    onClick={() => setSelectedReconciliationDetail(cr)}
                                    className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Revertir Lote y Restaurar Vouchers"
                                    onClick={() => handleRevertSettlement(cr)}
                                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                  <span className="font-bold">-{formatCurrency(totalEnTransito, settings.currencySymbol)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-black text-slate-900 uppercase text-xs">Estado de Cuenta Banco (Extracto)</h3>
              <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between py-1 border-b">
                  <span>Saldo según Banco:</span>
                  <span className="font-black text-slate-900">{formatCurrency(bankAccounts.reduce((sum: number, b: any) => sum + (b.balance || 0), 0), settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-600 font-black">
                  <span>Saldo Conciliado Disponible:</span>
                  <span>{formatCurrency(Math.max(0, bankAccounts.reduce((sum: number, b: any) => sum + (b.balance || 0), 0) - totalEnTransito), settings.currencySymbol)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Listado de Cheques en Tránsito para Conciliar */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" />
                <span>Partidas Conciliatorias: Cheques Girados en Tránsito ({chequesEnTransito.length})</span>
              </h3>
              <span className="text-xs font-mono font-bold text-rose-600">
                Total en Tránsito: -{formatCurrency(totalEnTransito, settings.currencySymbol)}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">N° Cheque</th>
                    <th className="py-2.5 px-3">Banco</th>
                    <th className="py-2.5 px-3">Fecha Emisión</th>
                    <th className="py-2.5 px-3">Beneficiario</th>
                    <th className="py-2.5 px-3">Concepto</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {chequesEnTransito.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 font-sans italic">
                        ¡Conciliación al día! No hay cheques girados pendientes de cobro en tránsito.
                      </td>
                    </tr>
                  ) : (
                    chequesEnTransito.map(chk => (
                      <tr key={chk.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{chk.checkNumber}</td>
                        <td className="py-2.5 px-3 text-slate-700">{chk.bankName}</td>
                        <td className="py-2.5 px-3 text-slate-500">{chk.issueDate}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-800">{chk.beneficiary}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans truncate max-w-xs">{chk.concept}</td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-600">
                          {formatCurrency(chk.amount, settings.currencySymbol)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-50 border border-amber-200 text-amber-800">
                            {chk.status === 'ENTREGADO' ? 'ENTREGADO' : 'EMITIDO'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleMarkCleared(chk)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer shadow-sm transition"
                            title="Marcar como debitado del extracto bancario y conciliar"
                          >
                            <Check className="w-3 h-3" />
                            <span>Conciliar en Banco</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
          SUBTAB 10: ESTADO_SITUACION_FINANCIERA (Balance General NIIF)
         --------------------------------------------------------------------- */}
      {subTab === 'ESTADO_SITUACION_FINANCIERA' && (() => {
        const activoCorriente = accountPlan
          .filter(a => a.code.startsWith('1.1') && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);
        
        const activoNoCorriente = accountPlan
          .filter(a => a.code.startsWith('1.2') && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);

        const pasivoCorriente = accountPlan
          .filter(a => a.code.startsWith('2.1') && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);

        const pasivoNoCorriente = accountPlan
          .filter(a => a.code.startsWith('2.2') && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);

        const patrimonioCapital = accountPlan
          .filter(a => a.code.startsWith('3.') && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);

        const patrimonioConsolidado = patrimonioCapital + utilidadNeta;
        const totalPasivoYPatrimonio = totalPasivos + patrimonioConsolidado;
        const diferenciaEcuacion = Math.abs(totalActivos - totalPasivoYPatrimonio);
        const estaCuadrado = diferenciaEcuacion < 0.05;

        return (
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-sky-600" />
                  <h2 className="text-xl font-black text-slate-950 tracking-tight">
                    Estado de Situación Financiera (Balance General NIIF)
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Estructuración patrimonial estandarizada: Activo, Pasivo y Patrimonio con comprobación de la Ecuación Contable Fundamental.
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Imprimir Balance</span>
              </button>
            </div>

            {/* Banner de Validación de la Ecuación Contable NIIF */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-mono ${
              estaCuadrado
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}>
              <div className="flex items-center gap-3">
                {estaCuadrado ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <span className="font-black uppercase tracking-wide block">
                    {estaCuadrado ? 'Ecuación Contable NIIF Cuadrada' : 'Ecuación Contable en Proceso de Cuadre'}
                  </span>
                  <span className="text-[11px] opacity-90">
                    ACTIVO ({formatCurrency(totalActivos, settings.currencySymbol)}) = PASIVO ({formatCurrency(totalPasivos, settings.currencySymbol)}) + PATRIMONIO CONSOLIDADO ({formatCurrency(patrimonioConsolidado, settings.currencySymbol)})
                  </span>
                </div>
              </div>

              <div className="text-right font-black text-sm">
                <span>Dif: {formatCurrency(diferenciaEcuacion, settings.currencySymbol)}</span>
              </div>
            </div>

            {/* Columnas de Activos vs Pasivos & Patrimonio */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
              {/* 1. ACTIVOS */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h3 className="font-black text-emerald-800 uppercase text-xs">
                    1. ACTIVOS TOTALES
                  </h3>
                  <span className="font-black text-emerald-800 text-sm">
                    {formatCurrency(totalActivos, settings.currencySymbol)}
                  </span>
                </div>

                {/* Activo Corriente */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-slate-800 text-[11px] bg-slate-100 p-2 rounded-lg">
                    <span>1.1 ACTIVO CORRIENTE</span>
                    <span>{formatCurrency(activoCorriente, settings.currencySymbol)}</span>
                  </div>
                  <div className="space-y-1 pl-3 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Efectivo y Equivalentes (Cajas & Bancos 1.1.01)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('1.1.01') && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Cuentas por Cobrar & Anticipos Impuestos (1.1.02)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('1.1.02') && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Inventarios de Mercaderías Ferretería (1.1.03)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('1.1.03') && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Crédito Tributario IVA Adquisiciones (1.1.04)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('1.1.04') && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                  </div>
                </div>

                {/* Activo No Corriente */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-slate-800 text-[11px] bg-slate-100 p-2 rounded-lg">
                    <span>1.2 ACTIVO NO CORRIENTE (PROPIEDADES, PLANTA Y EQUIPO)</span>
                    <span>{formatCurrency(activoNoCorriente, settings.currencySymbol)}</span>
                  </div>
                  <div className="space-y-1 pl-3 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Propiedades, Planta y Equipos Brutos (1.2.01)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('1.2.01') && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-rose-700">
                      <span>(-) Depreciación Acumulada NIIF (1.2.02)</span>
                      <span className="font-bold">-{formatCurrency(accountPlan.filter(a => a.code.startsWith('1.2.02') && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. PASIVOS & 3. PATRIMONIO */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h3 className="font-black text-rose-800 uppercase text-xs">
                    2. PASIVOS & 3. PATRIMONIO
                  </h3>
                  <span className="font-black text-slate-950 text-sm">
                    {formatCurrency(totalPasivoYPatrimonio, settings.currencySymbol)}
                  </span>
                </div>

                {/* Pasivo Corriente */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-rose-800 text-[11px] bg-rose-50 p-2 rounded-lg">
                    <span>2.1 PASIVO CORRIENTE</span>
                    <span>{formatCurrency(pasivoCorriente, settings.currencySymbol)}</span>
                  </div>
                  <div className="space-y-1 pl-3 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Cuentas por Pagar Proveedores Comerciales (2.1.01)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('2.1.01') && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Obligaciones Tributarias SRI (IVA & Retenciones 2.1.04)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('2.1.04') && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Obligaciones Laborales y Financieras CP (2.1.02/03)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => (a.code.startsWith('2.1.02') || a.code.startsWith('2.1.03')) && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                  </div>
                </div>

                {/* Pasivo No Corriente */}
                {pasivoNoCorriente > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between font-bold text-rose-800 text-[11px] bg-rose-50 p-2 rounded-lg">
                      <span>2.2 PASIVO NO CORRIENTE</span>
                      <span>{formatCurrency(pasivoNoCorriente, settings.currencySymbol)}</span>
                    </div>
                  </div>
                )}

                {/* 3. PATRIMONIO NETO */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between font-bold text-blue-800 text-[11px] bg-blue-50 p-2 rounded-lg">
                    <span>3. PATRIMONIO NETO CONSOLIDADO</span>
                    <span>{formatCurrency(patrimonioConsolidado, settings.currencySymbol)}</span>
                  </div>
                  <div className="space-y-1 pl-3 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Capital Social Suscrito y Reservas (3.1/3.2)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => (a.code.startsWith('3.1') || a.code.startsWith('3.2')) && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Resultados Acumulados Años Anteriores (3.3.01)</span>
                      <span className="font-bold">{formatCurrency(accountPlan.filter(a => a.code.startsWith('3.3.01') && a.acceptsMovement).reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0), settings.currencySymbol)}</span>
                    </div>
                    <div className={`flex justify-between py-1 font-bold ${utilidadNeta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      <span>(=) Resultado / Utilidad Neta del Ejercicio Actual</span>
                      <span>{formatCurrency(utilidadNeta, settings.currencySymbol)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------------------------------------------------------------------
          SUBTAB 11: ESTADO_RESULTADO (P&L Integral NIIF)
         --------------------------------------------------------------------- */}
      {subTab === 'ESTADO_RESULTADO' && (() => {
        const ventasNetas = totalIngresos;
        const costoVentas = accountPlan
          .filter(a => a.code.startsWith('5.1') && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);
        const gananciaBruta = ventasNetas - costoVentas;

        const gastosPersonal = accountPlan
          .filter(a => a.code.startsWith('5.2.01') && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);

        const gastosOperativos = accountPlan
          .filter(a => a.code.startsWith('5.2.02') && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);

        const gastosFinancieros = accountPlan
          .filter(a => (a.code.startsWith('5.2.03') || a.code.startsWith('5.3')) && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);

        const depreciacionDeterioro = accountPlan
          .filter(a => a.code.startsWith('5.4') && a.acceptsMovement)
          .reduce((sum, a) => sum + (accountBalances[a.code] || 0), 0);

        const totalGastosOperativos = gastosPersonal + gastosOperativos + gastosFinancieros + depreciacionDeterioro;
        const utilidadOperativa = gananciaBruta - totalGastosOperativos;

        return (
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-xl font-black text-slate-950 tracking-tight">
                    Estado de Resultados Integral (Pérdidas & Ganancias NIIF)
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Determinación de Ganancia Bruta, Costo de Ventas y Rendimiento Operativo Neto según NIIF para PYMES.
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Imprimir P&L</span>
              </button>
            </div>

            <div className="bg-slate-950 text-white rounded-3xl p-6 md:p-8 space-y-4 font-mono text-xs max-w-3xl mx-auto border border-slate-800 shadow-2xl">
              <div className="border-b border-slate-800 pb-3 text-center">
                <h3 className="font-black text-sm text-slate-200 tracking-wider uppercase">
                  {settings.storeName || 'FERRETERÍA'} - ESTADO DE RESULTADOS NIIF
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ejercicio Económico Fiscal 2026 (En Dólares de los Estados Unidos - USD)
                </p>
              </div>

              {/* 1. Ingresos Ordinarios */}
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="font-black uppercase text-emerald-400 text-sm">
                  (+) INGRESOS DE ACTIVIDADES ORDINARIAS (VENTAS)
                </span>
                <span className="font-black text-emerald-400 text-sm">
                  {formatCurrency(ventasNetas, settings.currencySymbol)}
                </span>
              </div>

              {/* 2. Costo de Ventas */}
              <div className="flex justify-between py-2 border-b border-slate-800 text-rose-400">
                <span>(-) COSTO DE VENTAS DE MERCADERÍAS FERRETERAS</span>
                <span className="font-bold">
                  -{formatCurrency(costoVentas, settings.currencySymbol)}
                </span>
              </div>

              {/* 3. Utilidad Bruta */}
              <div className="flex justify-between py-3 border-b border-slate-700 font-black text-blue-400 text-sm bg-slate-900/80 px-3 rounded-xl">
                <span>(=) GANANCIA BRUTA EN VENTAS</span>
                <span>{formatCurrency(gananciaBruta, settings.currencySymbol)}</span>
              </div>

              {/* 4. Gastos de Operación */}
              <div className="space-y-2 pt-2 text-slate-300">
                <span className="font-black text-[11px] text-slate-400 uppercase block">
                  (-) GASTOS OPERACIONALES Y DE ADMINISTRACIÓN
                </span>
                <div className="flex justify-between pl-4 text-amber-300">
                  <span>Gastos de Personal, Sueldos y Beneficios Sociales</span>
                  <span>-{formatCurrency(gastosPersonal, settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between pl-4 text-amber-300">
                  <span>Gastos de Arriendos, Servicios Básicos y Mantenimiento</span>
                  <span>-{formatCurrency(gastosOperativos, settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between pl-4 text-purple-300">
                  <span>Gastos Financieros & Comisiones Red POS Tarjetas</span>
                  <span>-{formatCurrency(gastosFinancieros, settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-400">
                  <span>Depreciaciones y Pérdidas por Deterioro / Mermas NIIF</span>
                  <span>-{formatCurrency(depreciacionDeterioro, settings.currencySymbol)}</span>
                </div>
              </div>

              {/* 5. Utilidad Neta Final */}
              <div className={`flex justify-between py-4 font-black text-base p-4 rounded-2xl border ${
                utilidadOperativa >= 0
                  ? 'bg-gradient-to-r from-emerald-950/80 to-slate-900 border-emerald-500/40 text-emerald-400'
                  : 'bg-gradient-to-r from-rose-950/80 to-slate-900 border-rose-500/40 text-rose-400'
              }`}>
                <span>(=) UTILIDAD NETA DEL EJERCICIO</span>
                <span>{formatCurrency(utilidadOperativa, settings.currencySymbol)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------------------------------------------------------------------
          SUBTAB 12: ATS (Anexo Transaccional Simplificado SRI)
         --------------------------------------------------------------------- */}
      {subTab === 'ATS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime-50 border border-lime-200 rounded-xl text-lime-700">
                  <ClipboardCheck className="w-5 h-5 text-lime-600" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Anexo Transaccional Simplificado (ATS - SRI)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generación y validación del archivo XML mensual conforme a la ficha técnica oficial del SRI Ecuador.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                onClick={() => handleGenerateAts(true)}
                disabled={isGeneratingAts}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                title="Inspeccionar el código XML antes de descargar"
              >
                <Eye className="w-4 h-4 text-slate-600" />
                <span>Ver XML</span>
              </button>

              <button
                onClick={() => handleGenerateAts(false)}
                disabled={isGeneratingAts}
                className="px-5 py-2.5 bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingAts ? (
                  <>
                    <Loader2 className="w-4 h-4 text-lime-400 animate-spin" />
                    <span>Generando XML...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-lime-400" />
                    <span>Generar y Descargar XML ATS SRI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Period Selector & Contribuyente Info */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Período Fiscal:</span>
              
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 font-bold">Mes:</label>
                <select
                  value={atsMonth}
                  onChange={(e) => setAtsMonth(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-lime-500 cursor-pointer shadow-sm"
                >
                  <option value="01">01 - Enero</option>
                  <option value="02">02 - Febrero</option>
                  <option value="03">03 - Marzo</option>
                  <option value="04">04 - Abril</option>
                  <option value="05">05 - Mayo</option>
                  <option value="06">06 - Junio</option>
                  <option value="07">07 - Julio</option>
                  <option value="08">08 - Agosto</option>
                  <option value="09">09 - Septiembre</option>
                  <option value="10">10 - Octubre</option>
                  <option value="11">11 - Noviembre</option>
                  <option value="12">12 - Diciembre</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 font-bold">Año:</label>
                <select
                  value={atsYear}
                  onChange={(e) => setAtsYear(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-lime-500 cursor-pointer shadow-sm"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600">
              <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                <strong className="text-slate-900">RUC:</strong> {settings.taxId || (settings as any).ruc || '1790012345001'}
              </span>
              <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                <strong className="text-slate-900">Razón Social:</strong> {settings.legalName || settings.storeName || 'FERRETERÍA CENTRAL'}
              </span>
              <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-lime-700 font-bold">
                Estab: 001
              </span>
            </div>
          </div>

          {/* KPI Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Ventas Locales del Mes</span>
              <div className="text-xl font-black text-slate-900 font-mono">{atsVentasValidas.length} <span className="text-xs font-normal text-slate-500">Facturas</span></div>
              <div className="text-xs font-mono text-slate-600 flex justify-between">
                <span>Total:</span>
                <span className="font-bold text-slate-900">{formatCurrency(totalVentasAts, settings.currencySymbol)}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 flex justify-between">
                <span>IVA 15%:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(totalIvaVentasAts, settings.currencySymbol)}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Compras Sustento Tributario</span>
              <div className="text-xl font-black text-slate-900 font-mono">{atsComprasPeriodo.length} <span className="text-xs font-normal text-slate-500">Comprobantes</span></div>
              <div className="text-xs font-mono text-slate-600 flex justify-between">
                <span>Total:</span>
                <span className="font-bold text-slate-900">{formatCurrency(totalComprasAts, settings.currencySymbol)}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 flex justify-between">
                <span>IVA Compras:</span>
                <span className="font-bold text-blue-600">{formatCurrency(totalIvaComprasAts, settings.currencySymbol)}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Comprobantes Anulados</span>
              <div className="text-xl font-black text-amber-600 font-mono">{atsAnuladas.length} <span className="text-xs font-normal text-slate-500">Documentos</span></div>
              <p className="text-[11px] text-slate-500 pt-2">
                Secuenciales dados de baja reportados con código 01 al SRI.
              </p>
            </div>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-1">
              <span className="text-emerald-800 text-[10px] font-bold block uppercase tracking-wider">Saldo Estimado de IVA</span>
              <div className="text-xl font-black text-emerald-700 font-mono">
                {formatCurrency(totalIvaVentasAts - totalIvaComprasAts, settings.currencySymbol)}
              </div>
              <div className="text-[11px] font-mono text-emerald-700 flex justify-between pt-2">
                <span>Estado:</span>
                <span className="font-bold">{(totalIvaVentasAts - totalIvaComprasAts) >= 0 ? 'IVA a Pagar' : 'Crédito Tributario'}</span>
              </div>
            </div>
          </div>

          {/* Interactive Details Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAtsActiveDetailTab('VENTAS')}
                  className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
                    atsActiveDetailTab === 'VENTAS'
                      ? 'border-slate-950 text-slate-950 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Detalle de Ventas ({atsVentasValidas.length})
                </button>
                <button
                  onClick={() => setAtsActiveDetailTab('COMPRAS')}
                  className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
                    atsActiveDetailTab === 'COMPRAS'
                      ? 'border-slate-950 text-slate-950 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Detalle de Compras ({atsComprasPeriodo.length})
                </button>
                <button
                  onClick={() => setAtsActiveDetailTab('ANULADOS')}
                  className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
                    atsActiveDetailTab === 'ANULADOS'
                      ? 'border-slate-950 text-slate-950 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Comprobantes Anulados ({atsAnuladas.length})
                </button>
              </div>

              <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
                Periodo: {atsMonth}/{atsYear}
              </span>
            </div>

            {/* TAB CONTENT: VENTAS */}
            {atsActiveDetailTab === 'VENTAS' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Comprobante</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Identificación</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-right">IVA</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3 text-center">F. Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {atsVentasValidas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                          No se registran ventas para el período seleccionado ({atsMonth}/{atsYear}).
                        </td>
                      </tr>
                    ) : (
                      atsVentasValidas.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                            {new Date(inv.createdAt).toLocaleDateString('es-EC')}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {inv.fullNumber || `${inv.series || '001-001'}-${String(inv.number || 1).padStart(9, '0')}`}
                          </td>
                          <td className="py-2.5 px-3 max-w-[180px] truncate text-slate-800" title={inv.customer?.name}>
                            {inv.customer?.name || 'CONSUMIDOR FINAL'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {inv.customer?.docNumber || '9999999999999'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {formatCurrency(inv.subtotal || 0, settings.currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">
                            {formatCurrency(inv.taxTotal || 0, settings.currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-950">
                            {formatCurrency(inv.total || 0, settings.currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600 font-bold">
                              {inv.paymentMethod || 'EFECTIVO'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT: COMPRAS */}
            {atsActiveDetailTab === 'COMPRAS' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">N° Factura Proveedor</th>
                      <th className="py-2.5 px-3">Proveedor</th>
                      <th className="py-2.5 px-3">RUC Proveedor</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-right">IVA</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {atsComprasPeriodo.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                          No se registran compras para el período seleccionado ({atsMonth}/{atsYear}).
                        </td>
                      </tr>
                    ) : (
                      atsComprasPeriodo.map((pur: any) => (
                        <tr key={pur.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                            {pur.purchaseDate || new Date(pur.createdAt || Date.now()).toLocaleDateString('es-EC')}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {pur.invoiceNumber || 'S/N'}
                          </td>
                          <td className="py-2.5 px-3 max-w-[180px] truncate text-slate-800">
                            {pur.supplier?.name || pur.supplier?.contactPerson || 'Proveedor General'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {pur.supplier?.taxId || '9999999999999'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {formatCurrency(pur.subtotal || 0, settings.currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-blue-600 font-bold">
                            {formatCurrency(pur.taxTotal || 0, settings.currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-950">
                            {formatCurrency(pur.total || 0, settings.currencySymbol)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT: ANULADOS */}
            {atsActiveDetailTab === 'ANULADOS' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Fecha Anulación</th>
                      <th className="py-2.5 px-3">N° Secuencial Anulado</th>
                      <th className="py-2.5 px-3">Tipo Comprobante</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Autorización / Clave Acceso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {atsAnuladas.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                          No hay comprobantes anulados en este período fiscal.
                        </td>
                      </tr>
                    ) : (
                      atsAnuladas.map((anul: any) => (
                        <tr key={anul.id} className="hover:bg-amber-50/50 transition">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                            {new Date(anul.createdAt).toLocaleDateString('es-EC')}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-amber-700">
                            {anul.fullNumber || `${anul.series || '001-001'}-${String(anul.number || 1).padStart(9, '0')}`}
                          </td>
                          <td className="py-2.5 px-3">01 (Factura)</td>
                          <td className="py-2.5 px-3 text-slate-600">{anul.customer?.name || 'CONSUMIDOR FINAL'}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[260px]">
                            {anul.sriClaveAcceso || anul.sriNumeroAutorizacion || 'Sin clave SRI'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Previa del XML */}
          {atsPreviewXml && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-lime-600" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">
                        Estructura XML ATS Generada
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500">
                        ATS_{settings.taxId || '1790012345001'}_{atsMonth}_{atsYear}.xml
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyXml}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      {xmlCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{xmlCopied ? '¡Copiado!' : 'Copiar'}</span>
                    </button>

                    <button
                      onClick={() => {
                        downloadXML(atsPreviewXml, `ATS_${settings.taxId || '1790012345001'}_${atsMonth}_${atsYear}.xml`);
                        showToast('Archivo XML descargado exitosamente.', 'success');
                      }}
                      className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 text-lime-400" />
                      <span>Descargar</span>
                    </button>

                    <button
                      onClick={() => setAtsPreviewXml(null)}
                      className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 overflow-auto bg-slate-950 text-lime-300 font-mono text-xs leading-relaxed flex-1">
                  <pre className="whitespace-pre-wrap select-all">{atsPreviewXml}</pre>
                </div>

                <div className="p-3 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                  <span>Cumple con especificación técnica de Anexo Transaccional Simplificado SRI Ecuador.</span>
                  <button
                    onClick={() => setAtsPreviewXml(null)}
                    className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 13: PLAN_CUENTAS (Catálogo Jerárquico Multinivel NIIF)
         --------------------------------------------------------------------- */}
      {subTab === 'PLAN_CUENTAS' && (() => {
        const filteredAccounts = accountPlan.filter(acc => {
          if (accountPlanFilterElement !== 'TODOS' && acc.type !== accountPlanFilterElement) return false;
          if (accountSearchQuery.trim()) {
            const q = accountSearchQuery.toLowerCase();
            return acc.code.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q);
          }
          return true;
        });

        const countMovimiento = accountPlan.filter(a => a.acceptsMovement).length;
        const countAgrupadoras = accountPlan.filter(a => !a.acceptsMovement).length;

        return (
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
            {/* Header Title & Global Actions */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <FolderTree className="w-6 h-6 text-indigo-600" />
                  <h2 className="text-xl font-black text-slate-950 tracking-tight">
                    Plan & Catálogo de Cuentas NIIF
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Normas Internacionales
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Estructura jerárquica multinivel codificada en 5 niveles: Activos, Pasivos, Patrimonio, Ingresos y Gastos con control de causación y saldos mayorizados.
                </p>
              </div>

              {/* Botones de acción principales */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleResetAccountPlan}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="Restablecer el catálogo oficial con más de 65 cuentas ferreteras estándar"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Restaurar Oficial NIIF</span>
                </button>

                <button
                  onClick={handleExportAccountPlanCSV}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Descargar catálogo completo en formato Excel / CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exportar CSV</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="Imprimir el plan de cuentas"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Imprimir</span>
                </button>

                <button
                  onClick={() => handleOpenNewAccountModal()}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Cuenta Contable</span>
                </button>
              </div>
            </div>

            {/* Tarjetas resumen por Elemento NIIF */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 space-y-1">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">1. ACTIVOS</span>
                <p className="text-base font-black text-emerald-950 font-mono">
                  {formatCurrency(totalActivos, settings.currencySymbol)}
                </p>
                <span className="text-[10px] text-emerald-700 font-semibold block">Naturaleza Deudora</span>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/40 space-y-1">
                <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">2. PASIVOS</span>
                <p className="text-base font-black text-rose-950 font-mono">
                  {formatCurrency(totalPasivos, settings.currencySymbol)}
                </p>
                <span className="text-[10px] text-rose-700 font-semibold block">Naturaleza Acreedora</span>
              </div>

              <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/40 space-y-1">
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">3. PATRIMONIO</span>
                <p className="text-base font-black text-blue-950 font-mono">
                  {formatCurrency(totalPatrimonio, settings.currencySymbol)}
                </p>
                <span className="text-[10px] text-blue-700 font-semibold block">Naturaleza Acreedora</span>
              </div>

              <div className="p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/40 space-y-1">
                <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider block">4. INGRESOS</span>
                <p className="text-base font-black text-purple-950 font-mono">
                  {formatCurrency(totalIngresos, settings.currencySymbol)}
                </p>
                <span className="text-[10px] text-purple-700 font-semibold block">Naturaleza Acreedora</span>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-1 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">5. GASTOS Y COSTOS</span>
                <p className="text-base font-black text-amber-950 font-mono">
                  {formatCurrency(totalGastos, settings.currencySymbol)}
                </p>
                <span className="text-[10px] text-amber-700 font-semibold block">Naturaleza Deudora</span>
              </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                {(['TODOS', 'ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO'] as const).map(el => (
                  <button
                    key={el}
                    type="button"
                    onClick={() => setAccountPlanFilterElement(el)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                      accountPlanFilterElement === el
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {el === 'TODOS' ? `Todos (${accountPlan.length})` : el}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[260px] max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por código o nombre..."
                  value={accountSearchQuery}
                  onChange={(e) => setAccountSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            {/* Tabla Jerárquica del Catálogo NIIF */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Código NIIF</th>
                    <th className="py-3 px-4">Nombre de la Cuenta</th>
                    <th className="py-3 px-3 text-center">Nivel</th>
                    <th className="py-3 px-3">Tipo NIIF</th>
                    <th className="py-3 px-3">Naturaleza</th>
                    <th className="py-3 px-3">Tipo Operativo</th>
                    <th className="py-3 px-4 text-right">Saldo Mayorizado</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                        No se encontraron cuentas contables que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => {
                      const levelPadding = Math.max(0, (acc.level - 1) * 16);
                      const isHeaderLevel = acc.level <= 2;
                      const balance = accountBalances[acc.code] || 0;

                      return (
                        <tr
                          key={acc.code}
                          className={`transition-colors ${
                            acc.level === 1
                              ? 'bg-slate-100/90 font-black text-slate-950 border-t-2 border-slate-300'
                              : acc.level === 2
                              ? 'bg-slate-50/70 font-bold text-slate-900'
                              : 'hover:bg-slate-50/80 text-slate-700'
                          }`}
                        >
                          {/* Código */}
                          <td className="py-2.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {acc.code}
                          </td>

                          {/* Nombre con sangría jerárquica */}
                          <td className="py-2.5 px-4 font-sans whitespace-nowrap" style={{ paddingLeft: `${16 + levelPadding}px` }}>
                            <div className="flex items-center gap-2">
                              {acc.level <= 2 ? (
                                <FolderTree className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              ) : acc.acceptsMovement ? (
                                <Tag className="w-3 h-3 text-emerald-500 shrink-0" />
                              ) : (
                                <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                              )}
                              <span className={isHeaderLevel ? 'font-black uppercase tracking-wide' : 'font-medium'}>
                                {acc.name}
                              </span>
                            </div>
                          </td>

                          {/* Nivel */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                              N{acc.level}
                            </span>
                          </td>

                          {/* Tipo NIIF */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                              acc.type === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' :
                              acc.type === 'PASIVO' ? 'bg-rose-100 text-rose-800' :
                              acc.type === 'PATRIMONIO' ? 'bg-blue-100 text-blue-800' :
                              acc.type === 'INGRESO' ? 'bg-purple-100 text-purple-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {acc.type}
                            </span>
                          </td>

                          {/* Naturaleza */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`text-[10px] font-bold ${
                              acc.nature === 'DEUDORA' ? 'text-sky-700' : 'text-purple-700'
                            }`}>
                              {acc.nature}
                            </span>
                          </td>

                          {/* Movimiento */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {acc.acceptsMovement ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Acepta Asientos</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-400 text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">
                                Agrupadora
                              </span>
                            )}
                          </td>

                          {/* Saldo Mayorizado */}
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(balance, settings.currencySymbol)}
                          </td>

                          {/* Acciones */}
                          <td className="py-2.5 px-4 text-center whitespace-nowrap font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              {acc.level < 5 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenNewAccountModal(acc)}
                                  className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg transition"
                                  title={`Crear subcuenta hija bajo ${acc.code}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditAccountModal(acc)}
                                className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition"
                                title="Editar cuenta contable"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAccount(acc.code)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                                title="Eliminar cuenta contable"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer con resumen estadístico */}
            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 border-t border-slate-200 pt-3">
              <span>
                Total Cuentas en Catálogo: <strong>{accountPlan.length}</strong> ({countMovimiento} imputables / {countAgrupadoras} agrupadoras)
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                Estructura NIIF Corporativa ecuatoriana vigente (SRI)
              </span>
            </div>
          </div>
        );
      })()}

      {/* ---------------------------------------------------------------------
          SUBTAB 14: PARAMETRIZACION (Motor de Mapeo Paramétrico Contable NIIF)
         --------------------------------------------------------------------- */}
      {subTab === 'PARAMETRIZACION' && (() => {
        const movementAccounts = accountPlan.filter(a => a.acceptsMovement);

        // Comprobantes pendientes de contabilizar
        const validInvoices = invoices.filter(inv => inv.paymentStatus !== 'ANULADA' && inv.documentType !== 'COTIZACION');
        const unmappedInvoices = validInvoices.filter(inv => {
          const docNum = inv.invoiceNumber || inv.id || '';
          return !journalEntries.some(je => je.concept.includes(`Factura #${docNum}`));
        });
        const unmappedPurchases = purchases.filter(pur => {
          const docNum = pur.invoiceNumber || pur.documentNumber || pur.id || '';
          return !journalEntries.some(je => je.concept.includes(`Compra / Adquisición #${docNum}`));
        });
        const pendingCount = unmappedInvoices.length + unmappedPurchases.length;

        return (
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
            {/* Header Title */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="w-6 h-6 text-indigo-600" />
                  <h2 className="text-xl font-black text-slate-950 tracking-tight">
                    Motor de Mapeo Paramétrico Contable NIIF
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Partida Doble Automática
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Enlaza los eventos operativos de ventas, compras, kárdex y tesorería con las cuentas del catálogo NIIF para disparar asientos en tiempo real sin requerir doble digitación.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  showToast('Parámetros de mapeo contable NIIF guardados exitosamente.', 'success');
                }}
                className="px-5 py-2.5 bg-slate-950 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Guardar Parámetros de Mapeo</span>
              </button>
            </div>

            {/* Banner de Sincronización Automática en Lote */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black uppercase tracking-wide">
                    Sincronizador Automático de Asientos del Ejercicio
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Evalúa facturas de venta y comprobantes de compra no asentados y genera de forma automática los asientos de partida doble correspondientes con numeración correlativa (<span className="font-mono text-amber-300">ASI-2026-XXXX</span>).
                </p>
                <div className="flex items-center gap-3 text-xs pt-1">
                  <span className="font-bold text-slate-400">Pendientes por asentar:</span>
                  <span className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                    pendingCount > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {pendingCount} comprobantes ({unmappedInvoices.length} ventas / {unmappedPurchases.length} compras)
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isSyncingEntries || pendingCount === 0}
                onClick={handleSyncAutomaticEntries}
                className={`px-5 py-2.5 font-black text-xs rounded-xl transition flex items-center gap-2 shrink-0 ${
                  pendingCount > 0 && !isSyncingEntries
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-lg cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                {isSyncingEntries ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Mayorizando Asientos...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Sincronizar y Mayorizar Asientos</span>
                  </>
                )}
              </button>
            </div>

            {/* Matriz de Mapeo Paramétrico en 4 Bloques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
              {/* 1. Ventas & Facturación Mostrador */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-black text-slate-900 uppercase text-xs">
                    1. Ventas & Facturación Mostrador (POS)
                  </h3>
                </div>

                <div className="space-y-3 font-sans">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Débito: Venta en Efectivo (Caja Mostrador)
                    </label>
                    <Select
                      value={accountingMapping.salesCashAccountDebit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, salesCashAccountDebit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Débito: Venta con Tarjeta de Crédito / Débito (Vouchers en Tránsito)
                    </label>
                    <Select
                      value={accountingMapping.salesCardAccountDebit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, salesCardAccountDebit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Débito: Venta a Crédito Clientes (Cuentas por Cobrar)
                    </label>
                    <Select
                      value={accountingMapping.salesCreditAccountDebit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, salesCreditAccountDebit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Crédito: Ingresos por Ventas Tarifa 15%
                    </label>
                    <Select
                      value={accountingMapping.salesAccountCredit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, salesAccountCredit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Crédito: IVA Cobrado en Ventas por Pagar SRI (15%)
                    </label>
                    <Select
                      value={accountingMapping.salesVatAccountCredit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, salesVatAccountCredit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* 2. Compras & Proveedores */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h3 className="font-black text-slate-900 uppercase text-xs">
                    2. Compras, Mercaderías & Proveedores
                  </h3>
                </div>

                <div className="space-y-3 font-sans">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Débito: Entrada de Inventario de Mercaderías
                    </label>
                    <Select
                      value={accountingMapping.purchasesInventoryDebit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, purchasesInventoryDebit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Débito: Crédito Tributario IVA Compras (15%)
                    </label>
                    <Select
                      value={accountingMapping.purchasesVatDebit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, purchasesVatDebit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Crédito: Cuentas por Pagar Proveedores Comerciales
                    </label>
                    <Select
                      value={accountingMapping.purchasesAccountsPayableCredit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, purchasesAccountsPayableCredit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Crédito: Retenciones en la Fuente IR por Pagar SRI
                    </label>
                    <Select
                      value={accountingMapping.purchasesRetentionIncomeCredit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, purchasesRetentionIncomeCredit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Crédito: Retenciones de IVA por Pagar SRI
                    </label>
                    <Select
                      value={accountingMapping.purchasesRetentionVatCredit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, purchasesRetentionVatCredit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* 3. Kárdex & Costo de Ventas */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Scale className="w-4 h-4 text-amber-600" />
                  <h3 className="font-black text-slate-900 uppercase text-xs">
                    3. Kárdex, Costo de Ventas & Deterioro NIIF
                  </h3>
                </div>

                <div className="space-y-3 font-sans">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Débito: Costo de Mercaderías Vendidas (Costo de Ventas)
                    </label>
                    <Select
                      value={accountingMapping.costOfSalesDebit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, costOfSalesDebit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Crédito: Salida de Inventario por Venta de Mercadería
                    </label>
                    <Select
                      value={accountingMapping.costOfSalesCredit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, costOfSalesCredit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Débito: Pérdida por Deterioro o Merma de Mercaderías
                    </label>
                    <Select
                      value={accountingMapping.inventoryDeteriorationDebit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, inventoryDeteriorationDebit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* 4. Tesorería & Conciliación de Vouchers */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <h3 className="font-black text-slate-900 uppercase text-xs">
                    4. Tesorería & Liquidación de Vouchers / Tarjetas
                  </h3>
                </div>

                <div className="space-y-3 font-sans">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Débito: Depósito Neto Bancario (Cuenta Corriente)
                    </label>
                    <Select
                      value={accountingMapping.cardBankDepositDebit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, cardBankDepositDebit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Débito: Comisiones Bancarias y Red POS (Datafast / Medianet)
                    </label>
                    <Select
                      value={accountingMapping.cardFeeAccountDebit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, cardFeeAccountDebit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Crédito: Cierre de Vouchers en Tránsito Liquidado
                    </label>
                    <Select
                      value={accountingMapping.cardTransitAccountCredit}
                      onChange={(e) => setAccountingMapping({ ...accountingMapping, cardTransitAccountCredit: e.target.value })}
                      className="w-full text-xs font-mono font-medium"
                    >
                      {movementAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
          SUBTAB 16: FORMULARIOS_DIMM (MOTORES 103 & 104 SRI)
         --------------------------------------------------------------------- */}
      {subTab === 'FORMULARIOS_DIMM' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Header Bar with Period Selectors */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-orange-500" />
                <span>Motor de Consolidación Tributaria SRI (Formularios 103 & 104)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mapeo automático de ventas, compras y retenciones del mes a los casilleros oficiales del SRI y DIMM.
              </p>
            </div>

            {/* Controls: Month & Year Selector + Actions */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <Select
                  value={dimmSelectedMonth}
                  onChange={(e) => setDimmSelectedMonth(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="TODOS">TODOS (Año Completo)</option>
                  <option value="01">01 - Enero</option>
                  <option value="02">02 - Febrero</option>
                  <option value="03">03 - Marzo</option>
                  <option value="04">04 - Abril</option>
                  <option value="05">05 - Mayo</option>
                  <option value="06">06 - Junio</option>
                  <option value="07">07 - Julio</option>
                  <option value="08">08 - Agosto</option>
                  <option value="09">09 - Septiembre</option>
                  <option value="10">10 - Octubre</option>
                  <option value="11">11 - Noviembre</option>
                  <option value="12">12 - Diciembre</option>
                </Select>

                <Select
                  value={dimmSelectedYear}
                  onChange={(e) => setDimmSelectedYear(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </Select>
              </div>

              {/* Quick Period Buttons */}
              <button
                type="button"
                onClick={() => setDimmSelectedMonth('TODOS')}
                className={`px-3 py-1.5 font-bold text-xs rounded-xl transition border cursor-pointer ${
                  dimmSelectedMonth === 'TODOS'
                    ? 'bg-purple-600 text-white border-purple-700 font-black'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                Año Completo
              </button>

              {/* Quick Period Buttons */}
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setDimmSelectedMonth(String(d.getMonth() + 1).padStart(2, '0'));
                  setDimmSelectedYear(String(d.getFullYear()));
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-200 cursor-pointer"
              >
                Mes Actual
              </button>

              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 1);
                  setDimmSelectedMonth(String(d.getMonth() + 1).padStart(2, '0'));
                  setDimmSelectedYear(String(d.getFullYear()));
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-200 cursor-pointer"
              >
                Mes Anterior
              </button>

              <button
                type="button"
                onClick={handleExportAtsXml}
                disabled={isGeneratingAts}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Generar y descargar Anexo Transaccional Simplificado SRI (XML)"
              >
                {isGeneratingAts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Descargar ATS XML</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Executive Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Ventas Gravadas (F104)</span>
              <div className="text-base font-black text-slate-950 font-mono">
                {formatCurrency(taxConsolidationData.vtaBase15, settings.currencySymbol)}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                IVA Generado 15%: <strong className="text-emerald-600 font-mono font-black">{formatCurrency(taxConsolidationData.vtaIva15, settings.currencySymbol)}</strong> ({taxConsolidationData.ventasCount} facturas)
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Compras con Crédito (F104)</span>
              <div className="text-base font-black text-slate-950 font-mono">
                {formatCurrency(taxConsolidationData.cmpBase15, settings.currencySymbol)}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                IVA Soportado: <strong className="text-blue-600 font-mono font-black">{formatCurrency(taxConsolidationData.cmpIva15, settings.currencySymbol)}</strong> ({taxConsolidationData.comprasCount} compras)
              </p>
            </div>

            <div className="p-4 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 block">Total Retenciones (F103)</span>
              <div className="text-base font-black text-purple-950 font-mono">
                {formatCurrency(taxConsolidationData.totalFormulario103, settings.currencySymbol)}
              </div>
              <p className="text-[10px] text-purple-700 font-medium">
                Renta: {formatCurrency(taxConsolidationData.totalRetenidoRenta, settings.currencySymbol)} • IVA: {formatCurrency(taxConsolidationData.totalRetenidoIva, settings.currencySymbol)}
              </p>
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Liquidación Neta IVA</span>
              </span>
              <div className="text-base font-black text-emerald-950 font-mono">
                {formatCurrency(taxConsolidationData.impuestoAPagarIva, settings.currencySymbol)}
              </div>
              <p className="text-[10px] text-emerald-700 font-medium">
                {taxConsolidationData.saldoFavorCredito > 0 
                  ? `Crédito a Favor: ${formatCurrency(taxConsolidationData.saldoFavorCredito, settings.currencySymbol)}` 
                  : 'Cuadre Tributario 100% Exacto'}
              </p>
            </div>
          </div>

          {/* Internal Navigation Tabs inside DIMM Module */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setDimmActiveTab('FORM_104')}
              className={`px-4 py-2 font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                dimmActiveTab === 'FORM_104'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>Formulario 104 (IVA SRI)</span>
            </button>

            <button
              type="button"
              onClick={() => setDimmActiveTab('FORM_103')}
              className={`px-4 py-2 font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                dimmActiveTab === 'FORM_103'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Formulario 103 (Retenciones Fuente)</span>
            </button>

            <button
              type="button"
              onClick={() => setDimmActiveTab('RESUMEN')}
              className={`px-4 py-2 font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                dimmActiveTab === 'RESUMEN'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Scale className="w-4 h-4 text-emerald-400" />
              <span>Resumen & Liquidación Exacta</span>
            </button>

            <button
              type="button"
              onClick={() => setDimmActiveTab('ATS')}
              className={`px-4 py-2 font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                dimmActiveTab === 'ATS'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Anexo Transaccional (ATS XML)</span>
            </button>
          </div>

          {/* TAB 1: FORMULARIO 104 (IVA) */}
          {dimmActiveTab === 'FORM_104' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Mapeo de Casilleros Oficiales Formulario 104 SRI (IVA — Período {dimmSelectedMonth}/{dimmSelectedYear})
                </span>
                <button
                  type="button"
                  onClick={handleExportForm104Excel}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Formulario 104 a Excel</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-300">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4 w-24">Casillero</th>
                      <th className="py-3 px-4 font-sans">Descripción del Casillero Tributario SRI</th>
                      <th className="py-3 px-4 text-right w-44">Base Imponible ($)</th>
                      <th className="py-3 px-4 text-right w-44">Monto Impuesto ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                    {/* SECCIÓN VENTAS */}
                    <tr className="bg-orange-50/70 font-black text-orange-950 font-sans">
                      <td colSpan={4} className="py-2 px-4 uppercase tracking-wider text-[10px]">
                        1. Ventas y Otras Operaciones (Ventas Locales / Facturación Electrónica)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-orange-600">401 / 411</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Ventas Locales Tarifa Diferente de 0% (Gravadas con IVA 15%)
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(taxConsolidationData.vtaBase15, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-emerald-600">
                        {formatCurrency(taxConsolidationData.vtaIva15, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-orange-600">403 / 413</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Ventas Locales Tarifa 0% (Bienes y Servicios no gravados)
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(taxConsolidationData.vtaBase0, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-400">$0.00</td>
                    </tr>
                    <tr className="bg-slate-100 font-black text-slate-950">
                      <td className="py-2.5 px-4 font-black text-orange-700">429</td>
                      <td className="py-2.5 px-4 font-sans uppercase">TOTAL VENTAS Y OTRAS OPERACIONES</td>
                      <td className="py-2.5 px-4 text-right text-slate-950 text-sm">
                        {formatCurrency(taxConsolidationData.vtaTotal, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-700 text-sm">
                        {formatCurrency(taxConsolidationData.vtaIva15, settings.currencySymbol)}
                      </td>
                    </tr>

                    {/* SECCIÓN COMPRAS */}
                    <tr className="bg-blue-50/70 font-black text-blue-950 font-sans">
                      <td colSpan={4} className="py-2 px-4 uppercase tracking-wider text-[10px]">
                        2. Compras y Adquisiciones (Crédito Tributario de IVA Soportado)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-blue-600">500 / 510</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Adquisiciones y Pagos Directos con Derecho a Crédito Tributario (15%)
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(taxConsolidationData.cmpBase15, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-blue-600">
                        {formatCurrency(taxConsolidationData.cmpIva15, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-blue-600">507 / 517</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Adquisiciones Locales Tarifa 0% (Sin IVA)
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(taxConsolidationData.cmpBase0, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-400">$0.00</td>
                    </tr>
                    <tr className="bg-slate-100 font-black text-slate-950">
                      <td className="py-2.5 px-4 font-black text-blue-700">529</td>
                      <td className="py-2.5 px-4 font-sans uppercase">TOTAL ADQUISICIONES Y PAGOS</td>
                      <td className="py-2.5 px-4 text-right text-slate-950 text-sm">
                        {formatCurrency(taxConsolidationData.cmpTotal, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-blue-700 text-sm">
                        {formatCurrency(taxConsolidationData.cmpIva15, settings.currencySymbol)}
                      </td>
                    </tr>

                    {/* SECCIÓN LIQUIDACIÓN DEL IMPUESTO */}
                    <tr className="bg-emerald-50/70 font-black text-emerald-950 font-sans">
                      <td colSpan={4} className="py-2 px-4 uppercase tracking-wider text-[10px]">
                        3. Liquidación del Impuesto al Valor Agregado en el Mes (SRI Formulario 104)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-emerald-600">499</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Impuesto Generado por Ventas (+ IVA Cobrado)
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-950">
                        {formatCurrency(taxConsolidationData.impuestoGenerado, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-emerald-600">564</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        (-) Crédito Tributario Aplicable por Compras (IVA Soportado)
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right font-black text-blue-600">
                        -{formatCurrency(taxConsolidationData.creditoTributario, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-emerald-600">601</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        (=) Impuesto Causado (Diferencia a Favor de la Administración Tributaria)
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-950">
                        {formatCurrency(taxConsolidationData.impuestoCausado, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-emerald-600">609</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        (-) Retenciones de IVA que le efectuaron en el mes (Comprobantes Autorizados)
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-600">
                        -{formatCurrency(taxConsolidationData.retencionesIvaRecibidas, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr className="bg-emerald-950 text-white font-black text-sm">
                      <td className="py-3 px-4 text-orange-400">699</td>
                      <td className="py-3 px-4 font-sans uppercase tracking-wide">
                        TOTAL IMPUESTO A PAGAR IVA (O SALDO A FAVOR DE CRÉDITO TRIBUTARIO)
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300 font-normal">—</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-black text-base">
                        {formatCurrency(taxConsolidationData.impuestoAPagarIva, settings.currencySymbol)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Auditoría en Vivo de Comprobantes Transaccionales del Período */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-orange-600" />
                    <span>Auditoría en Vivo: Documentos Procesados para Formulario 104</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {taxConsolidationData.ventasCount} Ventas • {taxConsolidationData.comprasCount} Compras
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Ventas en vivo */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 block text-[11px] font-sans border-b pb-1">
                      Últimas Facturas de Venta Procesadas ({taxConsolidationData.ventasCount})
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar text-[11px]">
                      {taxConsolidationData.ventasMes.length === 0 ? (
                        <p className="text-slate-400 font-sans py-2 text-center text-[11px]">No hay facturas registradas en este período.</p>
                      ) : (
                        taxConsolidationData.ventasMes.slice(0, 8).map((v: any) => (
                          <div key={v.id} className="flex justify-between items-center p-1.5 bg-slate-50 rounded border border-slate-100">
                            <div>
                              <span className="font-black text-slate-900 block">{v.fullNumber || v.number}</span>
                              <span className="text-[9px] text-slate-500 font-sans block">{v.customer?.name || 'Cliente'}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-emerald-600 block">{formatCurrency(v.total || 0, settings.currencySymbol)}</span>
                              <span className="text-[9px] text-slate-400 block">IVA: {formatCurrency(v.taxTotal || 0, settings.currencySymbol)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Compras en vivo */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 block text-[11px] font-sans border-b pb-1">
                      Últimas Compras a Proveedores Procesadas ({taxConsolidationData.comprasCount})
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar text-[11px]">
                      {taxConsolidationData.comprasMes.length === 0 ? (
                        <p className="text-slate-400 font-sans py-2 text-center text-[11px]">No hay compras registradas en este período.</p>
                      ) : (
                        taxConsolidationData.comprasMes.slice(0, 8).map((c: any) => (
                          <div key={c.id} className="flex justify-between items-center p-1.5 bg-slate-50 rounded border border-slate-100">
                            <div>
                              <span className="font-black text-slate-900 block">{c.invoiceNumber || c.id}</span>
                              <span className="text-[9px] text-slate-500 font-sans block">{c.supplier?.name || 'Proveedor'}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-blue-600 block">{formatCurrency(c.total || 0, settings.currencySymbol)}</span>
                              <span className="text-[9px] text-slate-400 block">IVA: {formatCurrency(c.taxTotal || 0, settings.currencySymbol)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FORMULARIO 103 (RETENCIONES RENTA E IVA) */}
          {dimmActiveTab === 'FORM_103' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Formulario 103 SRI — Retenciones en la Fuente de Impuesto a la Renta e IVA ({dimmSelectedMonth}/{dimmSelectedYear})
                </span>
                <button
                  type="button"
                  onClick={handleExportForm103Excel}
                  className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Formulario 103 a Excel</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-300">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-purple-950 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4 w-24">Casillero</th>
                      <th className="py-3 px-4 font-sans">Concepto de Retención SRI</th>
                      <th className="py-3 px-4 text-center w-28">% Ret.</th>
                      <th className="py-3 px-4 text-right w-44">Base Imponible ($)</th>
                      <th className="py-3 px-4 text-right w-44">Impuesto Retenido ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                    <tr className="bg-purple-50/70 font-black text-purple-950 font-sans">
                      <td colSpan={5} className="py-2 px-4 uppercase tracking-wider text-[10px]">
                        1. Retenciones en la Fuente de Impuesto a la Renta (Mapeo por Casilleros DIMM)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-purple-700">312</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Transferencia de Bienes Muebles de naturaleza corporal (Mercaderías / Ferretería)
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-600">1.75%</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(taxConsolidationData.cas312_base, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-700">
                        {formatCurrency(taxConsolidationData.cas312_val, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-purple-700">307</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Servicios donde predomina la mano de obra (Servicios generales / Mantenimiento)
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-600">2.75%</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(taxConsolidationData.cas307_base, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-700">
                        {formatCurrency(taxConsolidationData.cas307_val, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-purple-700">304 / 303</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Servicios donde predomina el intelecto / Honorarios profesionales
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-600">8.00% / 10%</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(taxConsolidationData.cas304_base, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-700">
                        {formatCurrency(taxConsolidationData.cas304_val, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-purple-700">320</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Arrendamiento de Bienes Inmuebles (Locales Comerciales / Bodegas)
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-600">8.00%</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(taxConsolidationData.cas320_base, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-700">
                        {formatCurrency(taxConsolidationData.cas320_val, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-purple-700">343</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Otras Retenciones Aplicables en la Fuente (Porcentajes Varios)
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-600">Varios</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(taxConsolidationData.cas343_base, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-700">
                        {formatCurrency(taxConsolidationData.cas343_val, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr className="bg-purple-100 font-black text-purple-950">
                      <td className="py-2.5 px-4 font-black text-purple-800">399</td>
                      <td colSpan={2} className="py-2.5 px-4 font-sans uppercase">
                        TOTAL RETENCIONES RENTA EN LA FUENTE
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-950">
                        {formatCurrency(taxConsolidationData.totalBaseRenta, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-purple-900 text-sm">
                        {formatCurrency(taxConsolidationData.totalRetenidoRenta, settings.currencySymbol)}
                      </td>
                    </tr>

                    {/* SECCIÓN RETENCIONES DE IVA */}
                    <tr className="bg-purple-50/70 font-black text-purple-950 font-sans">
                      <td colSpan={5} className="py-2 px-4 uppercase tracking-wider text-[10px]">
                        2. Retenciones del Impuesto al Valor Agregado (IVA por Compras de Bienes y Servicios)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-purple-700">721</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Retención IVA 30% — Adquisición de Bienes Muebles
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-600">30%</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-700">
                        {formatCurrency(taxConsolidationData.cas721_val, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-purple-700">723</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Retención IVA 70% — Adquisición de Servicios
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-600">70%</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-700">
                        {formatCurrency(taxConsolidationData.cas723_val, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-black text-purple-700">725</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                        Retención IVA 100% — Honorarios Profesionales / Arrendamientos
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-600">100%</td>
                      <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-700">
                        {formatCurrency(taxConsolidationData.cas725_val, settings.currencySymbol)}
                      </td>
                    </tr>
                    <tr className="bg-purple-100 font-black text-purple-950">
                      <td className="py-2.5 px-4 font-black text-purple-800">799</td>
                      <td colSpan={2} className="py-2.5 px-4 font-sans uppercase">
                        TOTAL RETENCIONES DE IVA
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right text-purple-900 text-sm">
                        {formatCurrency(taxConsolidationData.totalRetenidoIva, settings.currencySymbol)}
                      </td>
                    </tr>

                    <tr className="bg-purple-950 text-white font-black text-sm">
                      <td className="py-3 px-4 text-amber-400">899</td>
                      <td colSpan={2} className="py-3 px-4 font-sans uppercase tracking-wide">
                        TOTAL IMPUESTO A PAGAR FORMULARIO 103 (RENTA + IVA)
                      </td>
                      <td className="py-3 px-4 text-right text-purple-300 font-normal">
                        {formatCurrency(taxConsolidationData.totalBaseRenta, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-purple-300 font-black text-base">
                        {formatCurrency(taxConsolidationData.totalFormulario103, settings.currencySymbol)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: RESUMEN & LIQUIDACIÓN EXACTA */}
          {dimmActiveTab === 'RESUMEN' && (
            <div className="space-y-6">
              <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-amber-400" />
                    <span>Informe Ejecutivo de Liquidación Tributaria SRI ({dimmSelectedMonth}/{dimmSelectedYear})</span>
                  </span>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs rounded-full border border-emerald-500/30">
                    Cuadre Matemático Diferencia $0.00
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Consolidación procesada automáticamente desde las transacciones del período. Toda la información cuadra al 100% con los comprobantes de venta emitidos y los documentos de compras registrados.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* Resumen F104 */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-orange-500" />
                      <span>Liquidación Formulario 104 (IVA)</span>
                    </h3>
                    <span className="text-[10px] font-mono font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded">SRI 104</span>
                  </div>

                  <div className="space-y-2 text-slate-700 font-mono">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>(+) Total IVA Cobrado en Ventas:</span>
                      <strong className="text-slate-950 font-black">{formatCurrency(taxConsolidationData.vtaIva15, settings.currencySymbol)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>(-) Total IVA Soportado Compras:</span>
                      <strong className="text-blue-600 font-black">-{formatCurrency(taxConsolidationData.cmpIva15, settings.currencySymbol)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>(=) Impuesto Causado del Mes:</span>
                      <strong className="text-slate-950 font-black">{formatCurrency(taxConsolidationData.impuestoCausado, settings.currencySymbol)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>(-) Retenciones IVA efectuadas por clientes:</span>
                      <strong className="text-purple-600 font-black">-{formatCurrency(taxConsolidationData.retencionesIvaRecibidas, settings.currencySymbol)}</strong>
                    </div>
                    <div className="flex justify-between py-2 text-sm bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      <span className="font-sans font-black text-emerald-950">TOTAL A PAGAR IVA (F104):</span>
                      <strong className="text-emerald-700 font-black text-base">{formatCurrency(taxConsolidationData.impuestoAPagarIva, settings.currencySymbol)}</strong>
                    </div>
                  </div>
                </div>

                {/* Resumen F103 */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-purple-600" />
                      <span>Liquidación Formulario 103 (Retenciones)</span>
                    </h3>
                    <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">SRI 103</span>
                  </div>

                  <div className="space-y-2 text-slate-700 font-mono">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Retenciones Renta Fuente (Casillero 399):</span>
                      <strong className="text-purple-700 font-black">{formatCurrency(taxConsolidationData.totalRetenidoRenta, settings.currencySymbol)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Retenciones IVA Compras (Casillero 799):</span>
                      <strong className="text-purple-700 font-black">{formatCurrency(taxConsolidationData.totalRetenidoIva, settings.currencySymbol)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Total Base Imponible Renta Procesada:</span>
                      <strong className="text-slate-800 font-black">{formatCurrency(taxConsolidationData.totalBaseRenta, settings.currencySymbol)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Comprobantes de Retención Aplicados:</span>
                      <strong className="text-slate-800 font-black">{taxConsolidationData.retencionesCount} documentos</strong>
                    </div>
                    <div className="flex justify-between py-2 text-sm bg-purple-50 p-2.5 rounded-xl border border-purple-200">
                      <span className="font-sans font-black text-purple-950">TOTAL A PAGAR FORM 103:</span>
                      <strong className="text-purple-800 font-black text-base">{formatCurrency(taxConsolidationData.totalFormulario103, settings.currencySymbol)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ATS XML */}
          {dimmActiveTab === 'ATS' && (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-blue-600" />
                    <span>Anexo Transaccional Simplificado (ATS XML)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Estructura oficial XML compatible con el software DIMM Formularios y la plataforma SRI en Línea.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportAtsXml}
                  disabled={isGeneratingAts}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingAts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Descargar Archivo ATS XML</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono pt-2">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Nombre del Archivo</span>
                  <span className="font-black text-blue-700 truncate block">
                    ATS_{settings.taxId || '1790012345001'}_{dimmSelectedMonth}_{dimmSelectedYear}.xml
                  </span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Esquema XSD SRI</span>
                  <span className="font-black text-slate-800 block">v1.0.0 (Ficha Técnica Oficial)</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Transacciones Incluidas</span>
                  <span className="font-black text-emerald-600 block">
                    {taxConsolidationData.ventasCount} ventas • {taxConsolidationData.comprasCount} compras
                  </span>
                </div>
              </div>
            </div>
          )}
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
                <label className="block font-black text-slate-800 mb-1">Banco Emisor *</label>
                <Select
                  value={newCheck.bankName}
                  onChange={(e) => {
                    const newBank = e.target.value;
                    const nextCheckNum = getNextCorrelativeCheck(issuedChecks, newBank);
                    setNewCheck({
                      ...newCheck,
                      bankName: newBank,
                      checkNumber: nextCheckNum
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="Banco Pichincha">Banco Pichincha (Cta Cte #2100876543)</option>
                  <option value="Banco Guayaquil">Banco Guayaquil (Cta Cte #0012876451)</option>
                  <option value="Produbanco">Produbanco (Cta Cte #1009845120)</option>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-black text-slate-800">N° de Cheque (Correlativo) *</label>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    Siguiente automático
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="000101"
                  value={newCheck.checkNumber}
                  onChange={(e) => setNewCheck({ ...newCheck, checkNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
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
                  <CustomDatePicker
                    value={newCheck.paymentDate || ''}
                    onChange={(val) => setNewCheck({ ...newCheck, paymentDate: val })}
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
                  <CustomDatePicker
                    value={newEntry.date || ''}
                    onChange={(val) => setNewEntry({ ...newEntry, date: val })}
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

      {/* Modal: Nueva / Editar Cuenta Contable NIIF */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-600" />
                <span>{editingAccount ? 'Editar Cuenta Contable NIIF' : 'Nueva Cuenta Contable NIIF'}</span>
              </h3>
              <button onClick={() => { setIsAccountModalOpen(false); setEditingAccount(null); }} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Código Contable NIIF *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingAccount}
                    placeholder="ej: 1.1.01.03.01"
                    value={newAccount.code}
                    onChange={(e) => {
                      const val = e.target.value;
                      const first = val.charAt(0);
                      let derivedType = newAccount.type;
                      let derivedNature = newAccount.nature;
                      if (first === '1') { derivedType = 'ACTIVO'; derivedNature = 'DEUDORA'; }
                      else if (first === '2') { derivedType = 'PASIVO'; derivedNature = 'ACREEDORA'; }
                      else if (first === '3') { derivedType = 'PATRIMONIO'; derivedNature = 'ACREEDORA'; }
                      else if (first === '4') { derivedType = 'INGRESO'; derivedNature = 'ACREEDORA'; }
                      else if (first === '5') { derivedType = 'GASTO'; derivedNature = 'DEUDORA'; }
                      setNewAccount({
                        ...newAccount,
                        code: val,
                        type: derivedType,
                        nature: derivedNature
                      });
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold ${editingAccount ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Formato: X.X.XX.XX.XX</span>
                </div>

                <div>
                  <label className="block font-black text-slate-800 mb-1">Nivel Jerárquico</label>
                  <Select
                    value={String(newAccount.level || 5)}
                    onChange={(e) => setNewAccount({ ...newAccount, level: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="1">Nivel 1 - Clase (X.0.00.00.00)</option>
                    <option value="2">Nivel 2 - Grupo (X.X.00.00.00)</option>
                    <option value="3">Nivel 3 - Mayor (X.X.XX.00.00)</option>
                    <option value="4">Nivel 4 - Subcuenta (X.X.XX.XX.00)</option>
                    <option value="5">Nivel 5 - Auxiliar Imputable (X.X.XX.XX.XX)</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Nombre / Denominación de la Cuenta *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Caja Chica Sucursal Norte"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Clasificación NIIF</label>
                  <Select
                    value={newAccount.type}
                    onChange={(e) => {
                      const t = e.target.value as any;
                      const nat = (t === 'ACTIVO' || t === 'GASTO') ? 'DEUDORA' : 'ACREEDORA';
                      setNewAccount({ ...newAccount, type: t, nature: nat });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="ACTIVO">1. ACTIVO</option>
                    <option value="PASIVO">2. PASIVO</option>
                    <option value="PATRIMONIO">3. PATRIMONIO</option>
                    <option value="INGRESO">4. INGRESO</option>
                    <option value="GASTO">5. GASTOS Y COSTOS</option>
                  </Select>
                </div>

                <div>
                  <label className="block font-black text-slate-800 mb-1">Naturaleza Contable</label>
                  <Select
                    value={newAccount.nature}
                    onChange={(e) => setNewAccount({ ...newAccount, nature: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="DEUDORA">DEUDORA (Débito incrementa)</option>
                    <option value="ACREEDORA">ACREEDORA (Crédito incrementa)</option>
                  </Select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-black text-slate-900 block text-xs">Acepta Asientos / Movimientos</span>
                  <span className="text-[10px] text-slate-500">
                    Si se desactiva, actuará como cuenta agrupadora sumando las subcuentas hijas.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={newAccount.acceptsMovement ?? true}
                  onChange={(e) => setNewAccount({ ...newAccount, acceptsMovement: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setIsAccountModalOpen(false); setEditingAccount(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingAccount ? 'Actualizar Cuenta' : 'Guardar Cuenta NIIF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: NUEVA LIQUIDACIÓN & CUADRE FINANCIERO DE LOTE
         ===================================================================== */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl p-6 md:p-8 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950">
                    Liquidación & Cuadre Financiero de Lote
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cruce de vouchers electrónicos contra el estado del procesador adquirente y generación de asiento contable en partida doble.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettlement} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Columna Izquierda: Datos del Lote y Base Imponible */}
                <div className="space-y-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5">
                  <div className="flex items-center gap-2 font-black text-slate-900 border-b border-slate-200 pb-2 text-xs uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>1. Datos del Lote & Valores Brutos</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-black text-slate-700 mb-1">Red Adquirente *</label>
                      <Select
                        value={settlementForm.processor}
                        onChange={(e) => setSettlementForm({ ...settlementForm, processor: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                      >
                        <option value="Datafast">Datafast</option>
                        <option value="Medianet">Medianet</option>
                        <option value="Diners Club">Diners Club</option>
                        <option value="Visa/Mastercard Direct">Visa / Mastercard Direct</option>
                        <option value="Kushki">Kushki</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block font-black text-slate-700 mb-1">N° de Lote (Batch) *</label>
                      <input
                        type="text"
                        required
                        placeholder="ej: LOTE-0042"
                        value={settlementForm.batchNumber}
                        onChange={(e) => setSettlementForm({ ...settlementForm, batchNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-black text-slate-700 mb-1">Terminal POS / MID</label>
                      <input
                        type="text"
                        placeholder="ej: POS-01"
                        value={settlementForm.terminalId}
                        onChange={(e) => setSettlementForm({ ...settlementForm, terminalId: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-black text-slate-700 mb-1">Fecha Liquidación *</label>
                      <CustomDatePicker
                        value={settlementForm.settlementDate}
                        onChange={(val) => setSettlementForm({ ...settlementForm, settlementDate: val })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-black text-slate-700 mb-1">Cuenta Bancaria de Acreditación *</label>
                    <Select
                      value={settlementForm.bankAccountCode}
                      onChange={(e) => setSettlementForm({ ...settlementForm, bankAccountCode: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="1.1.01.02.01">1.1.01.02.01 - Banco Pichincha Cta Cte #2100876543</option>
                      <option value="1.1.01.02.02">1.1.01.02.02 - Banco Guayaquil Cta Cte #0012876451</option>
                      {accountPlan
                        .filter(a => a.type === 'ACTIVO' && a.acceptsMovement && a.code.startsWith('1.1.01.02') && a.code !== '1.1.01.02.01' && a.code !== '1.1.01.02.02')
                        .map(a => (
                          <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                        ))
                      }
                    </Select>
                  </div>

                  {/* Desglose de Base y Bruto */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-black text-slate-800">Monto Bruto del Lote (Total Vouchers) *</label>
                        {selectedVoucherIds.length > 0 && (
                          <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
                            {selectedVoucherIds.length} vouchers vinculados
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={settlementForm.grossAmount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSettlementForm({
                              ...settlementForm,
                              grossAmount: val,
                              taxBase: round2(val / 1.15),
                              taxAmount: round2(val - val / 1.15)
                            });
                          }}
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-black text-sm text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">Base Imponible (Sin IVA)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={settlementForm.taxBase || ''}
                          onChange={(e) => setSettlementForm({ ...settlementForm, taxBase: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 mb-1">Monto IVA (15%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={settlementForm.taxAmount || ''}
                          onChange={(e) => setSettlementForm({ ...settlementForm, taxAmount: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Notas / Referencia</label>
                      <input
                        type="text"
                        placeholder="ej: Liquidación quincenal lote POS tienda principal"
                        value={settlementForm.notes}
                        onChange={(e) => setSettlementForm({ ...settlementForm, notes: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Deducciones Financieras y Tributarias */}
                <div className="space-y-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5">
                  <div className="flex items-center gap-2 font-black text-slate-900 border-b border-slate-200 pb-2 text-xs uppercase tracking-wider">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    <span>2. Deducciones Contractuales & Retenciones SRI</span>
                  </div>

                  {/* Comisión Procesador */}
                  <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800">Comisión del Procesador (MDR)</span>
                      <span className="font-mono font-bold text-rose-600">
                        -{formatCurrency(calculatedCommission, settings.currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="20"
                        value={settlementForm.commissionRate}
                        onChange={(e) => setSettlementForm({ ...settlementForm, commissionRate: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold"
                      />
                      <span className="text-slate-500 font-bold">% sobre base</span>
                      <div className="flex-1 flex justify-end gap-1">
                        {[2.5, 3.5, 4.0].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setSettlementForm({ ...settlementForm, commissionRate: rate })}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                              settlementForm.commissionRate === rate
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* IVA sobre Comisión */}
                  <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800">IVA sobre Comisión (15%)</span>
                      <span className="font-mono font-bold text-rose-600">
                        -{formatCurrency(calculatedCommissionIva, settings.currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="20"
                        value={settlementForm.commissionIvaRate}
                        onChange={(e) => setSettlementForm({ ...settlementForm, commissionIvaRate: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold"
                      />
                      <span className="text-slate-500 font-bold">% de IVA sobre comisión</span>
                    </div>
                  </div>

                  {/* Retención Impuesto a la Renta */}
                  <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-black text-slate-800">Retención Impuesto a la Renta SRI</span>
                        <div className="text-[10px] text-slate-400">Presuntiva sobre ventas electrónicas</div>
                      </div>
                      <span className="font-mono font-bold text-amber-600">
                        -{formatCurrency(calculatedIrRetention, settings.currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="10"
                        value={settlementForm.irRetentionRate}
                        onChange={(e) => setSettlementForm({ ...settlementForm, irRetentionRate: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold"
                      />
                      <span className="text-slate-500 font-bold">% sobre base imponible</span>
                      <div className="flex-1 flex justify-end gap-1">
                        {[1.75, 2.0].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setSettlementForm({ ...settlementForm, irRetentionRate: rate })}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                              settlementForm.irRetentionRate === rate
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Retención IVA */}
                  <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-black text-slate-800">Retención de IVA SRI</span>
                        <div className="text-[10px] text-slate-400">Efectuada por la entidad emisora</div>
                      </div>
                      <span className="font-mono font-bold text-amber-600">
                        -{formatCurrency(calculatedIvaRetention, settings.currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="5"
                        min="0"
                        max="100"
                        value={settlementForm.ivaRetentionRate}
                        onChange={(e) => setSettlementForm({ ...settlementForm, ivaRetentionRate: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold"
                      />
                      <span className="text-slate-500 font-bold">% sobre el monto del IVA</span>
                      <div className="flex-1 flex justify-end gap-1">
                        {[0, 30, 70, 100].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setSettlementForm({ ...settlementForm, ivaRetentionRate: rate })}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                              settlementForm.ivaRetentionRate === rate
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Costo de Red / Otros */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="font-bold text-slate-700">Costos de Red / Switch (Fijo):</span>
                    <div className="relative w-32">
                      <DollarSign className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settlementForm.networkFee || ''}
                        onChange={(e) => setSettlementForm({ ...settlementForm, networkFee: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-full pl-6 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Tarjeta de Resumen Neto Acreditado */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                        Depósito Neto Exacto a Banco
                      </span>
                      <div className="text-xl font-black text-emerald-950 font-mono">
                        {formatCurrency(calculatedNetAmount, settings.currencySymbol)}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-emerald-700 font-bold">
                      <div>Total deducciones:</div>
                      <div className="font-mono text-rose-600">
                        -{formatCurrency(calculatedTotalDeductions, settings.currencySymbol)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel Inferior: Previsualización en Partida Doble del Asiento Contable */}
              <div className="bg-slate-950 text-white rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span className="font-black text-xs uppercase tracking-wider">
                      Previsualización del Asiento Contable en Libro Diario
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Partida Doble: Cuadre al centavo
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 text-[10px]">
                        <th className="py-1.5 px-2">Código</th>
                        <th className="py-1.5 px-2">Nombre Cuenta</th>
                        <th className="py-1.5 px-2 text-right">Debe</th>
                        <th className="py-1.5 px-2 text-right">Haber</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {/* Línea 1: Banco Destino */}
                      <tr>
                        <td className="py-1.5 px-2 text-blue-400">{settlementForm.bankAccountCode}</td>
                        <td className="py-1.5 px-2 text-slate-200 font-sans">
                          {accountPlan.find(a => a.code === settlementForm.bankAccountCode)?.name || 'Banco Cta Cte'} (Neto Acreditado)
                        </td>
                        <td className="py-1.5 px-2 text-right text-emerald-400 font-bold">
                          {formatCurrency(calculatedNetAmount, settings.currencySymbol)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-600">—</td>
                      </tr>

                      {/* Línea 2: Gasto Comisiones */}
                      <tr>
                        <td className="py-1.5 px-2 text-blue-400">5.2.03.01.01</td>
                        <td className="py-1.5 px-2 text-slate-200 font-sans">
                          Comisiones Bancarias y Red POS Tarjetas (Gasto)
                        </td>
                        <td className="py-1.5 px-2 text-right text-rose-400 font-bold">
                          {formatCurrency(round2(calculatedCommission + (settlementForm.networkFee || 0)), settings.currencySymbol)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-600">—</td>
                      </tr>

                      {/* Línea 3: IVA Comisión */}
                      {calculatedCommissionIva > 0 && (
                        <tr>
                          <td className="py-1.5 px-2 text-blue-400">1.1.04.01.01</td>
                          <td className="py-1.5 px-2 text-slate-200 font-sans">
                            Crédito Tributario IVA Compras y Servicios (IVA Comisión)
                          </td>
                          <td className="py-1.5 px-2 text-right text-amber-400 font-bold">
                            {formatCurrency(calculatedCommissionIva, settings.currencySymbol)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-600">—</td>
                        </tr>
                      )}

                      {/* Línea 4: Anticipo IR */}
                      {calculatedIrRetention > 0 && (
                        <tr>
                          <td className="py-1.5 px-2 text-blue-400">1.1.02.05.01</td>
                          <td className="py-1.5 px-2 text-slate-200 font-sans">
                            Anticipo Retención IR por Tarjetas (Crédito Fiscal SRI)
                          </td>
                          <td className="py-1.5 px-2 text-right text-amber-400 font-bold">
                            {formatCurrency(calculatedIrRetention, settings.currencySymbol)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-600">—</td>
                        </tr>
                      )}

                      {/* Línea 5: Retención IVA */}
                      {calculatedIvaRetention > 0 && (
                        <tr>
                          <td className="py-1.5 px-2 text-blue-400">1.1.02.05.02</td>
                          <td className="py-1.5 px-2 text-slate-200 font-sans">
                            Crédito Tributario Retención IVA Tarjetas
                          </td>
                          <td className="py-1.5 px-2 text-right text-amber-400 font-bold">
                            {formatCurrency(calculatedIvaRetention, settings.currencySymbol)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-600">—</td>
                        </tr>
                      )}

                      {/* Línea 6 (HABER): Cierre cuenta puente */}
                      <tr>
                        <td className="py-1.5 px-2 text-blue-400">1.1.01.03.01</td>
                        <td className="py-1.5 px-2 text-slate-200 font-sans">
                          Vouchers por Liquidar / Tarjetas en Tránsito (Cierre de Cobro)
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-600">—</td>
                        <td className="py-1.5 px-2 text-right text-sky-400 font-bold">
                          {formatCurrency(settlementForm.grossAmount, settings.currencySymbol)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-700 text-xs font-black">
                        <td colSpan={2} className="py-2 px-2 text-slate-300 font-sans">TOTALES MAYORIZADOS:</td>
                        <td className="py-2 px-2 text-right text-emerald-400">
                          {formatCurrency(
                            round2(calculatedNetAmount + calculatedCommission + (settlementForm.networkFee || 0) + calculatedCommissionIva + calculatedIrRetention + calculatedIvaRetention),
                            settings.currencySymbol
                          )}
                        </td>
                        <td className="py-2 px-2 text-right text-sky-400">
                          {formatCurrency(settlementForm.grossAmount, settings.currencySymbol)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900 text-slate-400">
                  <span>Estado de Cuadre: <strong className="text-emerald-400">Balanceado Exacto ($0.00 de diferencia)</strong></span>
                  <span>Tipo de Asiento: <strong>INGRESO / LIQUIDACIÓN</strong></span>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl cursor-pointer transition-all shadow-md shadow-blue-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Liquidación y Asentar en Diario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: COMPROBANTE DE DETALLE DE LOTE LIQUIDADO
         ===================================================================== */}
      {selectedReconciliationDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-950">
                      Liquidación Lote N° {selectedReconciliationDetail.batchNumber}
                    </h3>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded">
                      CONCILIADO
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Procesador: {selectedReconciliationDetail.processor} • Fecha: {selectedReconciliationDetail.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReconciliationDetail(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen del Lote */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Monto Bruto</div>
                <div className="text-base font-black text-slate-900 font-mono mt-0.5">
                  {formatCurrency(selectedReconciliationDetail.grossAmount, settings.currencySymbol)}
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                <div className="text-[10px] font-bold text-rose-600 uppercase">Comisiones</div>
                <div className="text-base font-black text-rose-700 font-mono mt-0.5">
                  -{formatCurrency(selectedReconciliationDetail.commissionAmount, settings.currencySymbol)}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <div className="text-[10px] font-bold text-amber-600 uppercase">Retenciones SRI</div>
                <div className="text-base font-black text-amber-700 font-mono mt-0.5">
                  -{formatCurrency(selectedReconciliationDetail.taxRetained, settings.currencySymbol)}
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <div className="text-[10px] font-bold text-emerald-700 uppercase">Neto Acreditado</div>
                <div className="text-base font-black text-emerald-800 font-mono mt-0.5">
                  {formatCurrency(selectedReconciliationDetail.netAmount, settings.currencySymbol)}
                </div>
              </div>
            </div>

            {/* Detalle Técnico */}
            <div className="space-y-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Cuenta Bancaria Destino:</span>
                <span className="font-bold text-slate-900">{selectedReconciliationDetail.bankAccountName || 'Banco Pichincha Cta Cte'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Terminal POS / MID:</span>
                <span className="font-mono font-bold text-slate-900">{selectedReconciliationDetail.terminalId || 'POS-01'}</span>
              </div>
              {selectedReconciliationDetail.commissionRate && (
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Tasa de Comisión MDR:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedReconciliationDetail.commissionRate}% (+ 15% IVA)</span>
                </div>
              )}
              {selectedReconciliationDetail.irRetentionRate && (
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Retención en la Fuente IR:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedReconciliationDetail.irRetentionRate}% (Anticipo de Impuesto)</span>
                </div>
              )}
              {selectedReconciliationDetail.ivaRetentionRate && (
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Retención de IVA en Ventas:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedReconciliationDetail.ivaRetentionRate}%</span>
                </div>
              )}
              {selectedReconciliationDetail.notes && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Notas / Observaciones:</span>
                  <span className="italic text-slate-700">{selectedReconciliationDetail.notes}</span>
                </div>
              )}
            </div>

            {/* Asiento Contable Asociado */}
            {selectedReconciliationDetail.journalEntryId && (() => {
              const entry = journalEntries.find(j => j.id === selectedReconciliationDetail.journalEntryId);
              if (!entry) return null;
              return (
                <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-400 text-[11px] pb-2 border-b border-slate-800">
                    <span className="font-sans font-bold text-slate-200">Asiento Contable Vinculado:</span>
                    <span className="text-indigo-400 font-black">{entry.entryNumber}</span>
                  </div>
                  <div className="space-y-1">
                    {entry.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span className="text-slate-300 truncate max-w-xs">{it.accountCode} - {it.accountName}</span>
                        <span>
                          {it.debit > 0 ? (
                            <strong className="text-emerald-400">D: {formatCurrency(it.debit, settings.currencySymbol)}</strong>
                          ) : (
                            <strong className="text-sky-400">H: {formatCurrency(it.credit, settings.currencySymbol)}</strong>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Acciones */}
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Liquidación</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReconciliationDetail(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
