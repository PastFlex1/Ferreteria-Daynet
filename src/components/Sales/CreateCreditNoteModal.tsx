import React, { useState, useMemo } from 'react';
import { CreditCard, X, AlertCircle, FileText, User } from 'lucide-react';
import { Invoice, StoreSettings } from '../../types';
import { Select } from '../Shared/Select';

interface CreateCreditNoteModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
  invoices: Invoice[];
  settings: StoreSettings;
  establishment: string;
  emissionPoint: string;
  secCreditNote: string;
}

export const CreateCreditNoteModal: React.FC<CreateCreditNoteModalProps> = ({
  onClose,
  onSave,
  invoices,
  settings,
  establishment,
  emissionPoint,
  secCreditNote,
}) => {
  const [formData, setFormData] = useState({
    invoiceRef: '',
    reason: 'Devolución de mercadería',
    amount: '',
  });

  // Filtrar estrictamente solo Facturas (excluyendo cotizaciones, proformas y anuladas)
  const facturasOnly = useMemo(() => {
    return invoices.filter(inv => inv.documentType === 'FACTURA' && inv.paymentStatus !== 'ANULADA');
  }, [invoices]);

  const selectedInvoice = facturasOnly.find(inv => inv.id === formData.invoiceRef || inv.fullNumber === formData.invoiceRef);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amountVal = parseFloat(formData.amount) || selectedInvoice.total;
    const ratio = selectedInvoice.total > 0 ? amountVal / selectedInvoice.total : 1;
    const subtotal = Math.round(selectedInvoice.subtotal * ratio * 100) / 100;
    const tax = Math.round((amountVal - subtotal) * 100) / 100;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}${month}${year}`;
    const ruc = (settings.taxId || '1790012345001').padStart(13, '0');
    const ambiente = '1';
    const serie = `${establishment.padStart(3, '0')}${emissionPoint.padStart(3, '0')}`;
    const secuencial = secCreditNote.padStart(9, '0');
    const codNum = '12345678';
    const tipoEmi = '1';
    const baseKey = `${dateStr}04${ruc}${ambiente}${serie}${secuencial}${codNum}${tipoEmi}`;
    let factor = 2;
    let sum = 0;
    for (let i = baseKey.length - 1; i >= 0; i--) {
      sum += parseInt(baseKey.charAt(i), 10) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }
    const rem = sum % 11;
    const dv = rem === 0 ? 0 : rem === 1 ? 1 : 11 - rem;
    const claveAcceso = `${baseKey}${dv}`;

    onSave({
      id: `${establishment}-${emissionPoint}-${secCreditNote}`,
      invoiceRef: selectedInvoice.fullNumber || selectedInvoice.id,
      invoiceId: selectedInvoice.id,
      invoiceDate: selectedInvoice.createdAt,
      customer: selectedInvoice.customer?.name || 'Consumidor Final',
      customerRuc: selectedInvoice.customer?.docNumber || '9999999999999',
      customerAddress: selectedInvoice.customer?.address || 'Matriz',
      customerEmail: selectedInvoice.customer?.email || '',
      customerPhone: selectedInvoice.customer?.phone || '',
      reason: formData.reason,
      amount: amountVal,
      subtotal,
      tax,
      items: selectedInvoice.items,
      date: now.toISOString(),
      status: 'AUTORIZADO',
      establishment,
      emissionPoint,
      secNumber: secCreditNote,
      claveAcceso,
      numeroAutorizacion: claveAcceso,
      fechaAutorizacion: now.toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        <div className="bg-slate-950 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-rose-500/20 flex items-center justify-center rounded-xl border border-rose-500/30">
              <CreditCard className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Generar Nota de Crédito</h2>
              <p className="text-slate-400 text-xs font-medium">Anulación y devolución sobre factura emitida</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-orange-500" /> Factura a Modificar *
              </label>
              <Select
                required
                value={formData.invoiceRef}
                onChange={(e) => setFormData({ ...formData, invoiceRef: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">
                  {facturasOnly.length === 0 ? 'No hay facturas emitidas disponibles' : 'Seleccione una factura emitida...'}
                </option>
                {facturasOnly.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.fullNumber} - {inv.customer?.name || 'Consumidor Final'} - ${inv.total.toFixed(2)}
                  </option>
                ))}
              </Select>
            </div>

            {selectedInvoice && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <p className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  <User className="w-4 h-4 text-slate-400" /> {selectedInvoice.customer?.name || 'Consumidor Final'}
                </p>
                <p className="text-slate-500">Monto Original Factura: <span className="font-mono font-black text-slate-900">${selectedInvoice.total.toFixed(2)}</span></p>
                <p className="text-slate-500">Fecha de Emisión: {new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">Motivo de Modificación *</label>
              <Select
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="Devolución de mercadería">Devolución de mercadería</option>
                <option value="Anulación total de la factura">Anulación total de la factura</option>
                <option value="Descuento aplicado post-venta">Descuento aplicado post-venta</option>
                <option value="Error en la facturación">Error en la facturación</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">Monto de la Devolución/Nota de Crédito *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{settings.currencySymbol}</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                  placeholder={selectedInvoice ? selectedInvoice.total.toFixed(2) : "0.00"}
                  max={selectedInvoice ? selectedInvoice.total : undefined}
                />
              </div>
              <p className="text-[10px] text-slate-500">El monto no puede superar el total de la factura original.</p>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-800 font-medium leading-relaxed">
              La Nota de Crédito será autorizada con el SRI y los artículos (si es por devolución) retornarán al inventario.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedInvoice}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Emitir Nota de Crédito</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
