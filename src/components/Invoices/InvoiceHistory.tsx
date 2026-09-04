import React, { useState, useMemo } from 'react';
import { CustomSelect } from '../CustomSelect';
import { Select } from '../Shared/Select';
import { 
  FileText, 
  Search, 
  Filter, 
  Eye, 
  Printer, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  TrendingUp, 
  DollarSign, 
  Calculator, 
  ShieldCheck, 
  Send, 
  Trash2, 
  AlertTriangle,
  Edit3,
  Plus,
  X,
  ShoppingCart
} from 'lucide-react';
import { Customer, DocumentType, Invoice, InvoiceItem, InvoiceStatus, Product, StoreSettings } from '../../types';
import { formatCurrency, formatDate, getDocumentTypeName, getPaymentMethodLabel } from '../../utils/formatters';
import { SriEmissionProgressModal } from '../POS/SriEmissionProgressModal';
import { useModal } from '../../context/ModalContext';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { downloadXML, getAuthorizedXmlContent } from '../../services/sriXmlService';

interface InvoiceHistoryProps {
  invoices: Invoice[];
  settings: StoreSettings;
  onOpenViewer: (invoice: Invoice) => void;
  onConvertQuoteToInvoice: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  initialDocType?: 'TODOS' | DocumentType;
  onNavigateToTab?: (tab: string, initialDocType?: DocumentType) => void;
}

export const InvoiceHistory: React.FC<InvoiceHistoryProps> = ({
  invoices,
  settings,
  onOpenViewer,
  onConvertQuoteToInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  initialDocType = 'TODOS',
  onNavigateToTab,
}) => {
  const { showConfirm, showToast } = useModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<'TODOS' | DocumentType>(initialDocType);
  const [statusFilter, setStatusFilter] = useState<'TODOS' | InvoiceStatus>('TODOS');
  const [sriStatusFilter, setSriStatusFilter] = useState<'TODOS' | 'AUTORIZADO' | 'PENDIENTE' | 'DEVUELTA'>('TODOS');
  
  // Data for editing quotes
  const [products] = useFirestoreSync<Product[]>('ferreteria_products', []);
  const [customers] = useFirestoreSync<Customer[]>('ferreteria_customers', []);
  const [sriMode] = useFirestoreSync<'PRUEBAS' | 'PRODUCCION'>('ferreteria_settings_sri_mode', 'PRUEBAS');
  const [editingQuote, setEditingQuote] = useState<Invoice | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string>('');
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editAddProductId, setEditAddProductId] = useState<string>('');
  const [editAddQty, setEditAddQty] = useState<string>('');

  // SRI Modal Trigger
  const [selectedInvoiceForSri, setSelectedInvoiceForSri] = useState<Invoice | null>(null);

  React.useEffect(() => {
    setDocTypeFilter(initialDocType);
  }, [initialDocType]);

  // Statistics calculations
  const totalInvoicesCount = invoices.filter((i) => i.documentType !== 'COTIZACION').length;
  const authorizedCount = invoices.filter((i) => i.documentType === 'FACTURA' && (i.sriStatus === 'AUTORIZADO' || !!i.sriNumeroAutorizacion)).length;
  const pendingOrFailedCount = invoices.filter((i) => i.documentType === 'FACTURA' && i.sriStatus !== 'AUTORIZADO' && !i.sriNumeroAutorizacion).length;

  const totalPaidAmount = invoices
    .filter((inv) => inv.documentType !== 'COTIZACION' && inv.paymentStatus === 'PAGADA')
    .reduce((sum, inv) => sum + inv.total, 0);
  
  const totalPendingAmount = invoices
    .filter((inv) => inv.documentType !== 'COTIZACION' && inv.paymentStatus === 'PENDIENTE')
    .reduce((sum, inv) => sum + inv.total, 0);

  const totalQuotesCount = invoices.filter((i) => i.documentType === 'COTIZACION').length;
  const totalQuotesAmount = invoices
    .filter((inv) => inv.documentType === 'COTIZACION')
    .reduce((sum, inv) => sum + inv.total, 0);

  // Filtered list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.fullNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer.docNumber.includes(searchTerm) ||
        (inv.sriNumeroAutorizacion && inv.sriNumeroAutorizacion.includes(searchTerm));

      const matchesDocType =
        docTypeFilter === 'TODOS' || inv.documentType === docTypeFilter;

      const matchesStatus =
        statusFilter === 'TODOS' || inv.paymentStatus === statusFilter;

      let matchesSri = true;
      if (sriStatusFilter === 'AUTORIZADO') {
        matchesSri = inv.documentType === 'FACTURA' && (inv.sriStatus === 'AUTORIZADO' || !!inv.sriNumeroAutorizacion);
      } else if (sriStatusFilter === 'PENDIENTE') {
        matchesSri = inv.documentType === 'FACTURA' && (inv.sriStatus === 'PENDIENTE' || !inv.sriStatus) && !inv.sriNumeroAutorizacion;
      } else if (sriStatusFilter === 'DEVUELTA') {
        matchesSri = inv.documentType === 'FACTURA' && (inv.sriStatus === 'NO AUTORIZADO' || (inv.sriStatus as string) === 'DEVUELTA' || (inv.sriStatus as string) === 'ERROR');
      }

      return matchesSearch && matchesDocType && matchesStatus && matchesSri;
    });
  }, [invoices, searchTerm, docTypeFilter, statusFilter, sriStatusFilter]);

  const handleOpenEditQuote = (quote: Invoice) => {
    setEditingQuote(quote);
    setEditCustomer(quote.customer);
    setEditCustomerId(quote.customer?.id || '');
    setEditItems(quote.items.map(item => ({ ...item })));
    setEditNotes(quote.notes || '');
    setEditAddProductId('');
    setEditAddQty('');
  };

  const handleAddEditQuoteItem = () => {
    const p = products.find(prod => prod.id === editAddProductId);
    if (!p) return;
    const qty = parseFloat(editAddQty) || 1;
    const taxRate = typeof p.taxRate === 'number' ? p.taxRate : 15;
    const subtotal = Math.round(p.price * qty * 100) / 100;
    const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const newItem: InvoiceItem = {
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      unit: p.unit || 'UND',
      quantity: qty,
      unitPrice: p.price,
      discountPercent: 0,
      subtotal: subtotal,
      taxRate: taxRate,
      taxAmount: tax,
      total: total
    };
    setEditItems(prev => [...prev, newItem]);
    setEditAddProductId('');
    setEditAddQty('');
  };

  const handleSaveEditQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuote) return;
    if (editItems.length === 0) {
      showToast('La cotización debe contener al menos un producto.', 'warning');
      return;
    }

    const matchedCustomer = customers.find(c => c.id === editCustomerId) || editCustomer || editingQuote.customer;
    const subtotal = editItems.reduce((acc, item) => acc + (item.subtotal || 0), 0);
    const taxTotal = editItems.reduce((acc, item) => acc + (item.total - item.subtotal), 0);
    const total = subtotal + taxTotal;

    const updatedQuote: Invoice = {
      ...editingQuote,
      customer: matchedCustomer,
      items: editItems,
      subtotal,
      taxTotal,
      total,
      notes: editNotes,
    };

    if (onUpdateInvoice) {
      onUpdateInvoice(updatedQuote);
    }
    setEditingQuote(null);
    showToast(`Cotización #${updatedQuote.fullNumber} actualizada exitosamente.`, 'success');
  };

  const handleDelete = (inv: Invoice) => {
    showConfirm(
      `¿Está seguro de eliminar ${inv.documentType === 'COTIZACION' ? 'la cotización' : 'el comprobante'} ${inv.fullNumber}? Esta acción no se puede deshacer.`,
      () => {
        if (onDeleteInvoice) {
          onDeleteInvoice(inv.id);
        }
      },
      `¿Eliminar ${inv.documentType === 'COTIZACION' ? 'Cotización' : 'Comprobante'}?`
    );
  };

  const handleCleanUnauthorized = () => {
    const unauth = invoices.filter(i => i.documentType === 'FACTURA' && i.sriStatus !== 'AUTORIZADO' && !i.sriNumeroAutorizacion);
    if (unauth.length === 0) {
      showToast('No hay facturas no autorizadas para limpiar.', 'info');
      return;
    }

    showConfirm(
      `Se eliminarán ${unauth.length} factura(s) de prueba que no fueron autorizadas por el SRI. ¿Desea continuar?`,
      () => {
        unauth.forEach(inv => {
          if (onDeleteInvoice) onDeleteInvoice(inv.id);
        });
        showToast(`Se eliminaron ${unauth.length} comprobantes no autorizados.`, 'success');
      },
      'Limpiar Comprobantes No Autorizados'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Total Comprobantes</span>
            <span className="text-2xl font-black text-slate-950 font-mono mt-0.5 block">{totalInvoicesCount}</span>
          </div>
          <div className="p-3 bg-slate-900 text-orange-400 rounded-xl border border-slate-800 shadow-2xs">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">SRI Autorizadas</span>
            <span className="text-2xl font-black text-emerald-600 font-mono mt-0.5 block">
              {authorizedCount} <span className="text-xs text-slate-400 font-normal">/ {totalInvoicesCount}</span>
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">SRI Pendientes/Error</span>
            <span className="text-2xl font-black text-rose-600 font-mono mt-0.5 block">
              {pendingOrFailedCount}
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Total Facturado</span>
            <span className="text-xl font-black text-slate-950 font-mono mt-0.5 block">
              {formatCurrency(totalPaidAmount, settings.currencySymbol)}
            </span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Section with Search and Filters */}
      <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por N° Comprobante, Cliente, RUC o Clave de Acceso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {initialDocType === 'TODOS' && (
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-black">
                {(['TODOS', 'FACTURA', 'BOLETA', 'COTIZACION'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDocTypeFilter(type)}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      docTypeFilter === type
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type === 'TODOS' ? 'Todos' : type === 'FACTURA' ? 'Facturas' : type === 'BOLETA' ? 'Boletas' : 'Cotizaciones'}
                  </button>
                ))}
              </div>
            )}

            {/* SRI Status Filter */}
            <CustomSelect
              value={sriStatusFilter}
              onChange={(val) => setSriStatusFilter(val as any)}
              options={[
                { value: 'TODOS', label: 'SRI: Todos' },
                { value: 'AUTORIZADO', label: 'SRI: Solo Autorizados', color: 'PAGADA', badge: '✓' },
                { value: 'PENDIENTE', label: 'SRI: Pendientes', color: 'PENDIENTE', badge: '⏳' },
                { value: 'DEVUELTA', label: 'SRI: Devueltas/Error', color: 'ANULADA', badge: '❌' },
              ]}
              variant="dark"
              size="sm"
            />

            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { value: 'TODOS', label: 'Pago: Todos' },
                { value: 'PAGADA', label: 'Pagada', color: 'PAGADA', badge: 'OK' },
                { value: 'PENDIENTE', label: 'Pendiente', color: 'PENDIENTE', badge: 'Cobrar' },
                { value: 'ANULADA', label: 'Anulada', color: 'ANULADA', badge: 'Cancelada' },
              ]}
              variant="dark"
              size="sm"
            />

            {pendingOrFailedCount > 0 && (
              <button
                type="button"
                onClick={handleCleanUnauthorized}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Eliminar todas las facturas de prueba no autorizadas"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar No Autorizadas ({pendingOrFailedCount})</span>
              </button>
            )}

            {initialDocType === 'COTIZACION' && onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('CAJA', 'COTIZACION')}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs rounded-xl shadow-sm hover:from-orange-600 hover:to-amber-600 transition flex items-center gap-2 cursor-pointer"
              >
                <span className="text-lg leading-none">+</span>
                Nueva Cotización
              </button>
            )}

            {initialDocType === 'FACTURA' && onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('CAJA', 'FACTURA')}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs rounded-xl shadow-sm hover:from-emerald-600 hover:to-teal-600 transition flex items-center gap-2 cursor-pointer"
              >
                <span className="text-lg leading-none">+</span>
                Nueva Factura / Boleta
              </button>
            )}
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">N° Comprobante</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Cliente / Razón Social</th>
                <th className="py-3 px-4">Método Pago</th>
                <th className="py-3 px-4 text-center">Estado Pago</th>
                <th className="py-3 px-4 text-center">Estado SRI</th>
                <th className="py-3 px-4 text-right">Monto Total</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                    <p className="font-semibold text-slate-600">No se encontraron comprobantes emitidos</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isFactura = inv.documentType === 'FACTURA';
                  const isAutorizado = isFactura && (inv.sriStatus === 'AUTORIZADO' || !!inv.sriNumeroAutorizacion);
                  const isDevuelta = isFactura && (inv.sriStatus === 'NO AUTORIZADO' || (inv.sriStatus as string) === 'DEVUELTA' || (inv.sriStatus as string) === 'ERROR');
                  const isPendiente = isFactura && !isAutorizado && !isDevuelta;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition group">
                      <td className="py-3 px-4 font-mono font-extrabold text-orange-600">
                        {inv.fullNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {getDocumentTypeName(inv.documentType)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {inv.customer.name}
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {inv.customer.docType}: {inv.customer.docNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-bold text-slate-800">{getPaymentMethodLabel(inv.paymentMethod)}</span>
                        {inv.paymentReference && (
                          <span className="block text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 mt-1 max-w-[180px] truncate" title={`Comprobante: ${inv.paymentReference}`}>
                            N°: {inv.paymentReference}
                          </span>
                        )}
                      </td>
                      
                      {/* Estado Pago */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            inv.paymentStatus === 'PAGADA'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : inv.paymentStatus === 'PENDIENTE'
                              ? 'bg-orange-50 border-orange-200 text-orange-700'
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>

                      {/* Estado SRI */}
                      <td className="py-3 px-4 text-center">
                        {!isFactura ? (
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200">
                            N/A
                          </span>
                        ) : isAutorizado ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 border border-emerald-300 text-emerald-700 shadow-2xs"
                            title={`Autorización SRI: ${inv.sriNumeroAutorizacion || 'OK'}`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>AUTORIZADO</span>
                          </span>
                        ) : isDevuelta ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 border border-rose-300 text-rose-700"
                            title={inv.sriMensaje || 'Devuelta por el SRI'}
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>DEVUELTA / ERROR</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 border border-amber-300 text-amber-700"
                            title="Comprobante pendiente de autorización en el SRI"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>PENDIENTE SRI</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-orange-600 text-sm">
                        {formatCurrency(inv.total, settings.currencySymbol)}
                      </td>
                      
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* 1. Ver */}
                          <button
                            onClick={() => onOpenViewer(inv)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 rounded-lg transition cursor-pointer"
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4 text-slate-600" />
                          </button>

                          {/* 2. Imprimir */}
                          <button
                            onClick={() => {
                              onOpenViewer(inv);
                              setTimeout(() => window.print(), 300);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 rounded-lg transition cursor-pointer"
                            title="Imprimir Comprobante"
                          >
                            <Printer className="w-4 h-4 text-slate-600" />
                          </button>

                          {/* 3. Editar (para Cotizaciones) */}
                          {inv.documentType === 'COTIZACION' && (
                            <button
                              onClick={() => handleOpenEditQuote(inv)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition cursor-pointer"
                              title="Editar Cotización"
                            >
                              <Edit3 className="w-4 h-4 text-amber-600" />
                            </button>
                          )}

                          {/* 4. Facturar (para Cotizaciones) */}
                          {inv.documentType === 'COTIZACION' && (
                            <button
                              onClick={() => onConvertQuoteToInvoice(inv)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition cursor-pointer"
                              title="Facturar Cotización en Punto de Venta"
                            >
                              <RefreshCw className="w-4 h-4 text-emerald-600" />
                            </button>
                          )}

                          {/* Transmitir SRI para Facturas No Autorizadas */}
                          {isFactura && !isAutorizado && (
                            <button
                              onClick={() => setSelectedInvoiceForSri(inv)}
                              className="p-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg transition cursor-pointer shadow-xs"
                              title="Transmitir o Reintentar Autorización SRI"
                            >
                              <Send className="w-4 h-4 text-white" />
                            </button>
                          )}

                          {/* Descargar XML Autorizado para Facturas Autorizadas */}
                          {isFactura && isAutorizado && (
                            <button
                              onClick={() => {
                                const xml = getAuthorizedXmlContent(inv, settings, undefined, undefined, sriMode);
                                downloadXML(xml, `factura-${inv.fullNumber || inv.number}-autorizada.xml`);
                                showToast(`XML Autorizado descargado exitosamente`, 'success');
                              }}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-300 transition cursor-pointer shadow-2xs"
                              title="Descargar XML Oficial Autorizado del SRI"
                            >
                              <Download className="w-4 h-4 text-emerald-600" />
                            </button>
                          )}

                          {/* 5. Eliminar */}
                          {onDeleteInvoice && (!isAutorizado || inv.documentType === 'COTIZACION') && (
                            <button
                              onClick={() => handleDelete(inv)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                              title={`Eliminar ${inv.documentType === 'COTIZACION' ? 'Cotización' : 'Comprobante'}`}
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
                            </button>
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

      {/* ── MODAL: EDITAR COTIZACIÓN ────────────────────────────────────────── */}
      {editingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-6 sm:p-8 space-y-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl">
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">
                    Editar Cotización #{editingQuote.fullNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modifique el cliente, productos, cantidades, precios y notas de la cotización
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingQuote(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditQuote} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Cliente / Receptor *</label>
                  <Select
                    value={editCustomerId}
                    onChange={(e: any) => setEditCustomerId(e.target.value)}
                    className="w-full bg-slate-50 border-slate-200 font-bold"
                  >
                    <option value="">Consumidor Final (9999999999999)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.docNumber})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block font-black text-slate-800 mb-1">Notas / Condiciones de Validez</label>
                  <input
                    type="text"
                    placeholder="Ej: Precios válidos por 15 días calendario..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Agregar producto a la cotización */}
              <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-3">
                <h4 className="font-black text-amber-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-600" />
                  <span>Agregar / Modificar Artículos a la Cotización</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <Select
                      value={editAddProductId}
                      onChange={(e: any) => setEditAddProductId(e.target.value)}
                      className="bg-white border-slate-200 text-xs font-bold"
                    >
                      <option value="">Seleccionar Producto...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} - {p.name} (${p.price.toFixed(2)})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      placeholder="Cantidad"
                      value={editAddQty}
                      onChange={(e) => setEditAddQty(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleAddEditQuoteItem}
                      className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla de ítems editables */}
              {editItems.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-white font-bold text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-center w-24">Cant.</th>
                        <th className="py-2.5 px-3 text-right w-28">Precio ($)</th>
                        <th className="py-2.5 px-3 text-right">Total ($)</th>
                        <th className="py-2.5 px-3 text-center w-12">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium">
                      {editItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <span className="font-mono text-orange-600 text-[10px] block">{item.sku}</span>
                            <span className="font-bold text-slate-800">{item.productName}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              step="any"
                              min="0.0001"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = parseFloat(e.target.value) || 0;
                                const sub = Math.round(item.unitPrice * newQty * 100) / 100;
                                const tax = Math.round(sub * ((item.taxRate || 15) / 100) * 100) / 100;
                                setEditItems(items => items.map((it, i) => i === idx ? {
                                  ...it,
                                  quantity: newQty,
                                  subtotal: sub,
                                  taxAmount: tax,
                                  total: Math.round((sub + tax) * 100) / 100
                                } : it));
                              }}
                              className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value) || 0;
                                const sub = Math.round(newPrice * item.quantity * 100) / 100;
                                const tax = Math.round(sub * ((item.taxRate || 15) / 100) * 100) / 100;
                                setEditItems(items => items.map((it, i) => i === idx ? {
                                  ...it,
                                  unitPrice: newPrice,
                                  subtotal: sub,
                                  taxAmount: tax,
                                  total: Math.round((sub + tax) * 100) / 100
                                } : it));
                              }}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.total, settings.currencySymbol)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total Summary */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono">
                <span className="font-bold text-slate-700 text-xs">Total de la Cotización:</span>
                <span className="text-base font-black text-emerald-600">
                  {formatCurrency(editItems.reduce((acc, item) => acc + item.total, 0), settings.currencySymbol)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingQuote(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editItems.length === 0}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Live SRI Emission */}
      {selectedInvoiceForSri && (
        <SriEmissionProgressModal
          isOpen={!!selectedInvoiceForSri}
          onClose={() => setSelectedInvoiceForSri(null)}
          invoice={selectedInvoiceForSri}
          settings={settings}
          onInvoiceUpdated={(updated) => {
            if (onUpdateInvoice) {
              onUpdateInvoice(updated);
            }
            setSelectedInvoiceForSri(updated);
          }}
        />
      )}
    </div>
  );
};
