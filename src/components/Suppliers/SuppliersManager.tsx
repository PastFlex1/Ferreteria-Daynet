import React, { useState, useEffect } from 'react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { useModal } from '../../context/ModalContext';
import { 
  Building2, 
  CreditCard, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Edit3, 
  Trash2, 
  Eye, 
  Download, 
  X, 
  Filter, 
  ArrowUpRight, 
  Check, 
  BadgeCheck, 
  Send,
  Printer,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { StoreSettings, SuppliersSubTab } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { validateEcuadorianDocument } from '../../utils/ecuadorianValidator';
import { useCedulaSearch } from '../../hooks/useCedulaSearch';
import { Select } from '../Shared/Select';
import { LocationSelectSection } from '../Shared/LocationSelectSection';

interface SuppliersManagerProps {
  subTab: SuppliersSubTab;
  settings: StoreSettings;
}

export interface SupplierDetail {
  id: string;
  taxId: string; // RUC / NIT / RFC
  name: string; // Razón Social / Nombre Comercial
  contactPerson: string;
  phone: string;
  email: string;
  country?: string;
  province?: string;
  city?: string;
  address: string;
  paymentDays: number; // Días de crédito otorgados
  bankName?: string;
  accountType?: 'Ahorros' | 'Corriente';
  accountNumber?: string;
  status: 'ACTIVO' | 'INACTIVO';
  currentBalance: number; // Deuda pendiente total
  notes?: string;
}

export interface PayableInvoice {
  id: string;
  invoiceNumber: string; // Factura Proveedor ej: 001-002-00008920
  supplierId: string;
  supplierName: string;
  supplierTaxId: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: 'PAGADA' | 'PENDIENTE' | 'VENCIDA';
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  payableInvoiceId: string;
  invoiceNumber: string;
  supplierName: string;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: 'TRANSFERENCIA' | 'EFECTIVO' | 'CHEQUE' | 'TARJETA';
  referenceNumber: string; // N° Comprobante transferencia / cheque
  registeredBy: string;
}

export const SuppliersManager: React.FC<SuppliersManagerProps> = ({
  subTab,
  settings,
}) => {
  const { showConfirm, showAlert, showToast } = useModal();
  // Clean Suppliers State
  const [suppliers, setSuppliers] = useFirestoreSync<SupplierDetail[]>('ferreteria_suppliers_details', []);

  // Cuentas por Pagar (Payable Invoices)
  const [payables, setPayables] = useFirestoreSync<PayableInvoice[]>('ferreteria_payables', []);

  // Payment History Log
  const [paymentHistory, setPaymentHistory] = useFirestoreSync<PaymentRecord[]>('ferreteria_supplier_payments', []);







  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDIENTE' | 'VENCIDA' | 'PAGADA'>('TODOS');

  // Supplier Form Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierDetail | null>(null);
  const [supplierFormData, setSupplierFormData] = useState<Partial<SupplierDetail>>({
    taxId: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    country: 'Ecuador',
    province: '',
    city: '',
    address: '',
    paymentDays: 30,
    bankName: '',
    accountType: 'Corriente',
    accountNumber: '',
    status: 'ACTIVO',
    notes: ''
  });

  const { isSearchingCedula, fetchCedulaData } = useCedulaSearch();
  const lastSearchedDocRef = React.useRef<string>('');

  const handleSearchSupplierDoc = (docToSearch?: string) => {
    const doc = (docToSearch || supplierFormData.taxId || '').trim();
    if (!doc) return;
    fetchCedulaData(doc, (data) => {
      setSupplierFormData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        address: data.address || prev.address,
        phone: data.phone || prev.phone,
        email: data.email || prev.email,
      }));
    });
  };

  useEffect(() => {
    if (!isSupplierModalOpen) {
      lastSearchedDocRef.current = '';
      return;
    }
    const cleanDoc = (supplierFormData.taxId || '').trim();
    if ((cleanDoc.length === 10 || cleanDoc.length === 13) && cleanDoc !== lastSearchedDocRef.current) {
      const res = validateEcuadorianDocument('AUTO', cleanDoc);
      if (res.isValid) {
        lastSearchedDocRef.current = cleanDoc;
        handleSearchSupplierDoc(cleanDoc);
      }
    }
    if (cleanDoc === '') {
      lastSearchedDocRef.current = '';
    }
  }, [supplierFormData.taxId, isSupplierModalOpen]);

  // Search filter
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.taxId.includes(searchTerm) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.city && s.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.province && s.province.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Payment Form Modal State
  const [selectedPayableForPayment, setSelectedPayableForPayment] = useState<PayableInvoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'TRANSFERENCIA' as PaymentRecord['paymentMethod'],
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });

  // View Supplier Details Modal
  const [viewingSupplierDetail, setViewingSupplierDetail] = useState<SupplierDetail | null>(null);

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------

  // Save / Update Supplier
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormData.taxId || !supplierFormData.name) return;

    // Validación RUC/CI SRI de Ecuador
    const valResult = validateEcuadorianDocument('AUTO', supplierFormData.taxId);
    if (!valResult.isValid) {
      showAlert(
        valResult.message || 'El RUC / Cédula del proveedor no cumple con las reglas del SRI o Registro Civil de Ecuador.',
        'RUC de Proveedor Inválido',
        'warning'
      );
      return;
    }

    if (editingSupplier) {
      setSuppliers(
        suppliers.map((s) =>
          s.id === editingSupplier.id
            ? { ...s, ...supplierFormData } as SupplierDetail
            : s
        )
      );
    } else {
      const newSup: SupplierDetail = {
        id: `sup-${Date.now()}`,
        taxId: supplierFormData.taxId!,
        name: supplierFormData.name!,
        contactPerson: supplierFormData.contactPerson || '',
        phone: supplierFormData.phone || '',
        email: supplierFormData.email || '',
        country: supplierFormData.country || 'Ecuador',
        province: supplierFormData.province || '',
        city: supplierFormData.city || '',
        address: supplierFormData.address || '',
        paymentDays: supplierFormData.paymentDays || 30,
        bankName: supplierFormData.bankName || '',
        accountType: supplierFormData.accountType || 'Corriente',
        accountNumber: supplierFormData.accountNumber || '',
        status: supplierFormData.status || 'ACTIVO',
        currentBalance: 0,
        notes: supplierFormData.notes || ''
      };
      setSuppliers([...suppliers, newSup]);
    }

    setIsSupplierModalOpen(false);
    setEditingSupplier(null);
    setSupplierFormData({
      taxId: '',
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      country: 'Ecuador',
      province: '',
      city: '',
      address: '',
      paymentDays: 30,
      bankName: '',
      accountType: 'Corriente',
      accountNumber: '',
      status: 'ACTIVO',
      notes: ''
    });
    showToast(editingSupplier ? 'Proveedor actualizado con éxito.' : 'Proveedor registrado con éxito.', 'success');
  };

  const handleOpenEditSupplier = (sup: SupplierDetail) => {
    setEditingSupplier(sup);
    setSupplierFormData({ ...sup });
    setIsSupplierModalOpen(true);
  };

  const handleDeleteSupplier = (id: string) => {
    showConfirm(
      '¿Estás seguro de eliminar este proveedor del catálogo?',
      () => {
        setSuppliers(suppliers.filter((s) => s.id !== id));
      },
      'Eliminar Proveedor',
      'Sí, Eliminar',
      'Cancelar'
    );
  };

  // Register Payment to Payable Invoice
  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayableForPayment) return;

    const amount = parseFloat(paymentForm.amount) || 0;
    const pendingBalance = selectedPayableForPayment.totalAmount - selectedPayableForPayment.paidAmount;

    if (amount <= 0) return;

    const newPaidAmount = selectedPayableForPayment.paidAmount + amount;
    const isFullyPaid = newPaidAmount >= selectedPayableForPayment.totalAmount;

    // Update Payable Invoice
    const updatedPayable: PayableInvoice = {
      ...selectedPayableForPayment,
      paidAmount: Math.min(newPaidAmount, selectedPayableForPayment.totalAmount),
      status: isFullyPaid ? 'PAGADA' : selectedPayableForPayment.status
    };

    setPayables(payables.map((p) => (p.id === updatedPayable.id ? updatedPayable : p)));

    // Update Supplier Balance
    setSuppliers(
      suppliers.map((sup) => {
        if (sup.id === selectedPayableForPayment.supplierId) {
          return {
            ...sup,
            currentBalance: Math.max(0, sup.currentBalance - amount)
          };
        }
        return sup;
      })
    );

    // Log Payment Record
    const newLog: PaymentRecord = {
      id: `pym-${Date.now()}`,
      payableInvoiceId: selectedPayableForPayment.id,
      invoiceNumber: selectedPayableForPayment.invoiceNumber,
      supplierName: selectedPayableForPayment.supplierName,
      paymentDate: paymentForm.paymentDate,
      amountPaid: amount,
      paymentMethod: paymentForm.method,
      referenceNumber: paymentForm.reference || 'REF-N/A',
      registeredBy: 'Administrador POS'
    };

    setPaymentHistory([newLog, ...paymentHistory]);
    setSelectedPayableForPayment(null);
    setPaymentForm({
      amount: '',
      method: 'TRANSFERENCIA',
      reference: '',
      paymentDate: new Date().toISOString().split('T')[0]
    });
  };

  // Calculations for Cuentas Por Pagar Overview
  const totalDebt = payables.reduce((acc, p) => acc + (p.totalAmount - p.paidAmount), 0);
  const overdueDebt = payables
    .filter((p) => p.status === 'VENCIDA')
    .reduce((acc, p) => acc + (p.totalAmount - p.paidAmount), 0);
  const pendingCount = payables.filter((p) => p.status !== 'PAGADA').length;

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------
          SUBTAB 1: PROVEEDORES (CATÁLOGO Y DIRECTORIO DE PROVEEDORES)
         --------------------------------------------------------------------- */}
      {subTab === 'PROVEEDORES' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-500" />
                <span>Directorio General de Proveedores & Fabricantes</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Administra información fiscal, datos bancarios, condiciones de crédito y líneas de contacto de proveedores.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingSupplier(null);
                setSupplierFormData({
                  taxId: '',
                  name: '',
                  contactPerson: '',
                  phone: '',
                  email: '',
                  address: '',
                  paymentDays: 30,
                  bankName: '',
                  accountType: 'Corriente',
                  accountNumber: '',
                  status: 'ACTIVO',
                  notes: ''
                });
                setIsSupplierModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Proveedor</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 text-white p-4 rounded-2xl flex items-center justify-between border border-slate-800">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Proveedores</div>
                <div className="text-2xl font-black font-mono text-orange-400 mt-1">{suppliers.length}</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <Building2 className="w-6 h-6 text-orange-400" />
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl flex items-center justify-between border border-slate-800">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pasivos Pendientes</div>
                <div className="text-2xl font-black font-mono text-rose-400 mt-1">
                  {formatCurrency(totalDebt, settings.currencySymbol)}
                </div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <CreditCard className="w-6 h-6 text-rose-400" />
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl flex items-center justify-between border border-slate-800">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Promedio Crédito</div>
                <div className="text-2xl font-black font-mono text-emerald-400 mt-1">30 Días</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <Clock className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar proveedor por RUC/Tax ID, Razón Social, Contacto o Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white transition outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Suppliers List Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4">RUC / NIT</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Teléfono</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-center">Crédito</th>
                  <th className="py-3 px-4 text-right">Saldo</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {suppliers
                  .filter(
                    (s) =>
                      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.taxId.includes(searchTerm) ||
                      s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((sup) => (
                    <tr key={sup.id} className="hover:bg-orange-50/40 transition group">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-slate-950 text-orange-400 rounded-lg flex items-center justify-center font-black text-xs shrink-0 border border-slate-800">
                            {sup.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-black text-slate-950 text-xs block">{sup.name}</span>
                            {(sup.city || sup.province) && (
                              <span className="text-[10px] text-orange-600 font-bold">
                                📍 {[sup.city, sup.province].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-600 text-[11px]">{sup.taxId}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{sup.contactPerson || '—'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[11px] text-slate-600">{sup.phone || 'N/A'}</td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 truncate max-w-[160px]">{sup.email || 'N/A'}</td>
                      <td className="py-3 px-4 text-center font-mono font-black text-slate-900">{sup.paymentDays} días</td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-mono font-black text-xs ${
                            sup.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {formatCurrency(sup.currentBalance, settings.currencySymbol)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingSupplierDetail(sup)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                            title="Ver Ficha Completa"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditSupplier(sup)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition cursor-pointer"
                            title="Editar Proveedor"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSupplier(sup.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                            title="Eliminar Proveedor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {suppliers.filter(
                  (s) =>
                    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.taxId.includes(searchTerm) ||
                    s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
                ).length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-bold text-slate-600 text-sm">No se encontraron proveedores</p>
                      <p className="text-xs mt-1">Registre su primer proveedor para comenzar.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 2: CUENTAS POR PAGAR (PASIVOS A PROVEEDORES)
         --------------------------------------------------------------------- */}
      {subTab === 'CUENTAS_POR_PAGAR' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-rose-500" />
              <span>Gestión de Cuentas por Pagar & Pasivos Comercial</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Control centralizado de obligaciones financieras con proveedores, seguimiento de vencimientos y registro de abonos.
            </p>
          </div>

          {/* Cards Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deuda Total Acumulada</div>
              <div className="text-2xl font-black font-mono text-rose-400 mt-1">
                {formatCurrency(totalDebt, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturas Vencidas</div>
              <div className="text-2xl font-black font-mono text-red-500 mt-1">
                {formatCurrency(overdueDebt, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturas Pendientes</div>
              <div className="text-2xl font-black font-mono text-amber-400 mt-1">{pendingCount} Facturas</div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Abonos Registrados</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">{paymentHistory.length} Pagos</div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por N° factura o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {(['TODOS', 'PENDIENTE', 'VENCIDA', 'PAGADA'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                    statusFilter === st
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Table of Payable Invoices */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Factura Proveedor</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4 text-center">Emisión / Vencimiento</th>
                  <th className="py-3 px-4 text-right">Monto Total</th>
                  <th className="py-3 px-4 text-right">Abonado</th>
                  <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payables
                  .filter((p) => {
                    const matchText =
                      p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchStatus = statusFilter === 'TODOS' || p.status === statusFilter;
                    return matchText && matchStatus;
                  })
                  .map((pay) => {
                    const balance = pay.totalAmount - pay.paidAmount;
                    return (
                      <tr key={pay.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black font-mono text-slate-900 text-[11px]">{pay.invoiceNumber}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {pay.supplierName}
                          <span className="block font-mono text-[10px] text-slate-400">RUC: {pay.supplierTaxId}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[11px]">
                          <span className="block text-slate-500">Emisión: {pay.issueDate}</span>
                          <span className="font-bold text-rose-600">Vence: {pay.dueDate}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(pay.totalAmount, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          {formatCurrency(pay.paidAmount, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-rose-600 text-sm">
                          {formatCurrency(balance, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                              pay.status === 'PAGADA'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : pay.status === 'VENCIDA'
                                ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}
                          >
                            {pay.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {balance > 0 ? (
                            <button
                              onClick={() => {
                                setSelectedPayableForPayment(pay);
                                setPaymentForm({
                                  amount: balance.toString(),
                                  method: 'TRANSFERENCIA',
                                  reference: '',
                                  paymentDate: new Date().toISOString().split('T')[0]
                                });
                              }}
                              className="px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-lg text-[11px] shadow-sm transition cursor-pointer flex items-center gap-1 mx-auto"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Pagar / Abonar</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Cancelado</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Payment History Log */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span>Historial de Pagos y Abonos Efectuados a Proveedores</span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Fecha Pago</th>
                    <th className="py-2.5 px-3">Proveedor</th>
                    <th className="py-2.5 px-3">Factura Referencia</th>
                    <th className="py-2.5 px-3">Método Pago</th>
                    <th className="py-2.5 px-3 font-mono">N° Comprobante</th>
                    <th className="py-2.5 px-3 text-right">Monto Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                  {paymentHistory.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 px-3 font-bold text-slate-900">{log.paymentDate}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{log.supplierName}</td>
                      <td className="py-2 px-3 text-orange-600 font-bold">{log.invoiceNumber}</td>
                      <td className="py-2 px-3 font-bold">{log.paymentMethod}</td>
                      <td className="py-2 px-3 text-slate-500">{log.referenceNumber}</td>
                      <td className="py-2 px-3 text-right font-black text-emerald-600">
                        {formatCurrency(log.amountPaid, settings.currencySymbol)}
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
          MODAL 1: REGISTRAR / EDITAR PROVEEDOR
         --------------------------------------------------------------------- */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-500" />
                <span>{editingSupplier ? 'Editar Ficha Proveedor' : 'Registrar Nuevo Proveedor'}</span>
              </h3>
              <button onClick={() => {
                setIsSupplierModalOpen(false);
                setEditingSupplier(null);
                setSupplierFormData({
                  taxId: '', name: '', contactPerson: '', phone: '', email: '', address: '', paymentDays: 30, bankName: '', accountType: 'Corriente', accountNumber: '', status: 'ACTIVO', notes: ''
                });
              }} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">RUC / Cédula Proveedor (SRI) *</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      placeholder="1792048593001"
                      value={supplierFormData.taxId}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, taxId: e.target.value.trim() })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchSupplierDoc();
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleSearchSupplierDoc()}
                      disabled={isSearchingCedula || !supplierFormData.taxId}
                      className="p-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                      title="Consultar en SRI / Registro Civil"
                    >
                      {isSearchingCedula ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {supplierFormData.taxId && (() => {
                    const res = validateEcuadorianDocument('AUTO', supplierFormData.taxId);
                    return (
                      <div className={`mt-1.5 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${
                        res.isValid 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {res.isValid ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              {res.type === 'CEDULA' && 'Cédula Válida (Ecuador)'}
                              {res.type === 'RUC_NATURAL' && 'RUC Persona Natural Válido'}
                              {res.type === 'RUC_PRIVADA' && 'RUC Sociedad Privada Válido'}
                              {res.type === 'RUC_PUBLICA' && 'RUC Sociedad Pública Válido'}
                              {res.type === 'PASAPORTE' && 'Pasaporte Válido'}
                              {res.type === 'CONSUMIDOR_FINAL' && 'Consumidor Final (SRI)'}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{res.message}</span>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Días de Crédito Otorgados</label>
                  <input
                    type="number"
                    value={supplierFormData.paymentDays}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, paymentDays: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Razón Social / Empresa *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: DISTRIBUIDORA HERRAMIENTAS STANLEY S.A."
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    placeholder="Ing. Fernando Morales"
                    value={supplierFormData.contactPerson}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+593 99 876 5432"
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="ventas@proveedor.com"
                  value={supplierFormData.email}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="pt-2">
                <LocationSelectSection
                  country={supplierFormData.country || 'Ecuador'}
                  province={supplierFormData.province || ''}
                  city={supplierFormData.city || ''}
                  onCountryChange={(val) => setSupplierFormData({ ...supplierFormData, country: val })}
                  onProvinceChange={(val) => setSupplierFormData({ ...supplierFormData, province: val })}
                  onCityChange={(val) => setSupplierFormData({ ...supplierFormData, city: val })}
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Dirección Física / Bodega (Calles & N°)</label>
                <input
                  type="text"
                  placeholder="Av. Industrial N45-12 y Panamericana Norte"
                  value={supplierFormData.address}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-900 text-xs">Datos de Cuenta Bancaria (Pagos)</div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Banco"
                    value={supplierFormData.bankName}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, bankName: e.target.value })}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                  <Select
                    value={supplierFormData.accountType}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, accountType: e.target.value as any })}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                  >
                    <option value="Corriente">Corriente</option>
                    <option value="Ahorros">Ahorros</option>
                  </Select>
                  <input
                    type="text"
                    placeholder="N° Cuenta"
                    value={supplierFormData.accountNumber}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, accountNumber: e.target.value })}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsSupplierModalOpen(false);
                    setEditingSupplier(null);
                    setSupplierFormData({
                      taxId: '', name: '', contactPerson: '', phone: '', email: '', address: '', paymentDays: 30, bankName: 'Banco Pichincha', accountType: 'Corriente', accountNumber: '', status: 'ACTIVO', notes: ''
                    });
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl shadow-md cursor-pointer"
                >
                  {editingSupplier ? 'Actualizar Ficha' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL 2: REGISTRAR PAGO / ABONO A PASIVO
         --------------------------------------------------------------------- */}
      {selectedPayableForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                <span>Registrar Pago a Proveedor</span>
              </h3>
              <button onClick={() => setSelectedPayableForPayment(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs font-mono">
              <div className="text-slate-400 font-bold uppercase text-[10px]">Factura Proveedor</div>
              <div className="font-black text-slate-900 text-sm">{selectedPayableForPayment.invoiceNumber}</div>
              <div className="text-slate-700 font-bold">{selectedPayableForPayment.supplierName}</div>
              <div className="flex justify-between text-rose-600 font-black text-xs pt-2 border-t border-slate-200">
                <span>Saldo Pendiente:</span>
                <span>
                  {formatCurrency(
                    selectedPayableForPayment.totalAmount - selectedPayableForPayment.paidAmount,
                    settings.currencySymbol
                  )}
                </span>
              </div>
            </div>

            <form onSubmit={handleProcessPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">Monto a Abonar ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-lg text-emerald-600 text-center"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Forma de Pago</label>
                <Select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                >
                  <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                  <option value="EFECTIVO">Efectivo de Caja</option>
                  <option value="CHEQUE">Cheque Corporativo</option>
                  <option value="TARJETA">Tarjeta de Crédito Empresa</option>
                </Select>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">N° Comprobante / Lote / Ref</label>
                <input
                  type="text"
                  placeholder="ej: TRF-9021845"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedPayableForPayment(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md cursor-pointer"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL 3: FICHA DE PROVEEDOR
         --------------------------------------------------------------------- */}
      {viewingSupplierDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-500" />
                <span>Ficha Técnica del Proveedor</span>
              </h3>
              <button onClick={() => setViewingSupplierDetail(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl space-y-1">
                <div className="font-black text-slate-900 text-base">{viewingSupplierDetail.name}</div>
                <div className="font-mono text-slate-500 font-bold">RUC: {viewingSupplierDetail.taxId}</div>
                <div className="text-slate-600 font-medium">{viewingSupplierDetail.address}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl font-mono">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Contacto</div>
                  <div className="font-bold text-slate-800">{viewingSupplierDetail.contactPerson}</div>
                  <div className="text-slate-500">{viewingSupplierDetail.phone}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Cuenta Bancaria</div>
                  <div className="font-bold text-slate-800">{viewingSupplierDetail.bankName}</div>
                  <div className="text-slate-500">{viewingSupplierDetail.accountNumber}</div>
                </div>
              </div>

              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-orange-950">Saldo por Pagar Actual:</span>
                <span className="font-mono font-black text-rose-600 text-base">
                  {formatCurrency(viewingSupplierDetail.currentBalance, settings.currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
