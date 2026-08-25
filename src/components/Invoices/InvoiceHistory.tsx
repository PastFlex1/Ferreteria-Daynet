import React, { useState, useMemo } from 'react';
import { CustomSelect } from '../CustomSelect';
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
  AlertTriangle
} from 'lucide-react';
import { DocumentType, Invoice, InvoiceStatus, StoreSettings } from '../../types';
import { formatCurrency, formatDate, getDocumentTypeName, getPaymentMethodLabel } from '../../utils/formatters';
import { SriEmissionProgressModal } from '../POS/SriEmissionProgressModal';
import { useModal } from '../../context/ModalContext';

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

  const handleDelete = (inv: Invoice) => {
    showConfirm(
      `¿Está seguro de eliminar el comprobante ${inv.fullNumber}? Esta acción no se puede deshacer.`,
      () => {
        if (onDeleteInvoice) {
          onDeleteInvoice(inv.id);
        }
      },
      '¿Eliminar Comprobante?'
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
                        {getPaymentMethodLabel(inv.paymentMethod)}
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
                        <div className="flex items-center justify-center space-x-1.5">
                          {inv.documentType !== 'COTIZACION' && (
                            <button
                              onClick={() => onOpenViewer(inv)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                              title="Ver / Imprimir Comprobante"
                            >
                              <Eye className="w-3.5 h-3.5 text-orange-600" />
                              <span>Ver</span>
                            </button>
                          )}

                          {/* Botón Transmitir SRI para Facturas No Autorizadas */}
                          {isFactura && !isAutorizado && (
                            <button
                              onClick={() => setSelectedInvoiceForSri(inv)}
                              className="p-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Transmitir o Reintentar Autorización con el SRI"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Transmitir SRI</span>
                            </button>
                          )}

                          {inv.documentType === 'COTIZACION' && (
                            <button
                              onClick={() => onConvertQuoteToInvoice(inv)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200 transition inline-flex items-center gap-1 cursor-pointer"
                              title="Facturar Cotización en Punto de Venta"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Facturar</span>
                            </button>
                          )}

                          {/* Botón Eliminar Borrador */}
                          {onDeleteInvoice && (!isAutorizado || inv.documentType === 'COTIZACION') && (
                            <button
                              onClick={() => handleDelete(inv)}
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg text-xs transition inline-flex items-center cursor-pointer"
                              title="Eliminar borrador no autorizado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
