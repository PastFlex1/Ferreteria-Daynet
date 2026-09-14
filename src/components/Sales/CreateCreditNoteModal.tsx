import React, { useState, useMemo } from 'react';
import { CreditCard, X, AlertCircle, FileText, User } from 'lucide-react';
import { Invoice, StoreSettings, CreditNoteData } from '../../types';
import { Select } from '../Shared/Select';

interface CreateCreditNoteModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
  invoices: Invoice[];
  settings: StoreSettings;
  establishment: string;
  emissionPoint: string;
  secCreditNote: string;
  preselectedInvoiceId?: string;
  existingCreditNotes?: CreditNoteData[];
}

export const CreateCreditNoteModal: React.FC<CreateCreditNoteModalProps> = ({
  onClose,
  onSave,
  invoices,
  settings,
  establishment,
  emissionPoint,
  secCreditNote,
  preselectedInvoiceId,
  existingCreditNotes = [],
}) => {
  // Filtrar facturas y comprobantes activos (excluyendo cotizaciones, anuladas y que ya cuenten con Nota de Crédito)
  const facturasOnly = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Debe ser un comprobante emitido (no cotización)
      if (inv.documentType === 'COTIZACION') return false;

      // 2. No debe estar anulada previamente
      if (inv.paymentStatus === 'ANULADA' || inv.sriStatus === 'ANULADO') return false;

      // 3. No debe tener ya una nota de crédito vinculada directamente
      if (inv.creditNoteRef) return false;

      // 4. No debe existir ya una nota de crédito emitida para esta factura
      if (
        existingCreditNotes &&
        existingCreditNotes.some(
          (cn) =>
            cn.invoiceRef === inv.fullNumber ||
            cn.invoiceId === inv.id ||
            (inv.fullNumber && cn.invoiceRef && cn.invoiceRef.endsWith(inv.fullNumber))
        )
      ) {
        return false;
      }

      return true;
    });
  }, [invoices, existingCreditNotes]);

  const initialInvoice = useMemo(() => {
    if (!preselectedInvoiceId) return facturasOnly[0] || null;
    return (
      facturasOnly.find(
        (inv) => inv.id === preselectedInvoiceId || inv.fullNumber === preselectedInvoiceId
      ) ||
      facturasOnly[0] ||
      null
    );
  }, [preselectedInvoiceId, facturasOnly]);

  const [formData, setFormData] = useState({
    invoiceRef: initialInvoice ? initialInvoice.id : '',
    reason: 'Anulación total de la factura',
    amount: initialInvoice ? initialInvoice.total.toFixed(2) : '',
  });

  const [restoreStock, setRestoreStock] = useState(true);

  const selectedInvoice = facturasOnly.find(inv => inv.id === formData.invoiceRef || inv.fullNumber === formData.invoiceRef);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (
      existingCreditNotes &&
      existingCreditNotes.some(
        (cn) =>
          cn.invoiceRef === selectedInvoice.fullNumber ||
          cn.invoiceId === selectedInvoice.id ||
          (selectedInvoice.fullNumber && cn.invoiceRef && cn.invoiceRef.endsWith(selectedInvoice.fullNumber))
      )
    ) {
      onClose();
      return;
    }

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
      restoreStock,
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
                <FileText className="w-4 h-4 text-orange-500" /> Factura a Modificar / Anular *
              </label>
              <Select
                required
                value={formData.invoiceRef}
                onChange={(e) => {
                  const invId = e.target.value;
                  const targetInv = facturasOnly.find((inv) => inv.id === invId || inv.fullNumber === invId);
                  setFormData({
                    ...formData,
                    invoiceRef: invId,
                    amount: targetInv ? targetInv.total.toFixed(2) : '',
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">
                  {facturasOnly.length === 0 ? 'No hay facturas activas disponibles' : 'Seleccione una factura a anular o modificar...'}
                </option>
                {facturasOnly.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.fullNumber} - {inv.customer?.name || 'Consumidor Final'} - ${inv.total.toFixed(2)} {inv.sriStatus === 'AUTORIZADO' ? '✓ [SRI Autorizado]' : `[${inv.sriStatus || 'EMITIDA'}]`}
                  </option>
                ))}
              </Select>
            </div>

            {selectedInvoice && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400" /> {selectedInvoice.customer?.name || 'Consumidor Final'}
                  </p>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                    selectedInvoice.sriStatus === 'AUTORIZADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedInvoice.sriStatus || 'EMITIDA'}
                  </span>
                </div>
                <p className="text-slate-500">Monto Original Factura: <span className="font-mono font-black text-slate-900">${selectedInvoice.total.toFixed(2)}</span></p>
                <p className="text-slate-500">Fecha de Emisión: {new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">Motivo de Modificación *</label>
              <Select
                required
                value={formData.reason}
                onChange={(e) => {
                  const newReason = e.target.value;
                  const isTotal = newReason === 'Anulación total de la factura';
                  setFormData({ 
                    ...formData, 
                    reason: newReason,
                    amount: isTotal && selectedInvoice ? selectedInvoice.total.toFixed(2) : formData.amount
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="Anulación total de la factura">Anulación total de la factura</option>
                <option value="Devolución de mercadería">Devolución de mercadería</option>
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
              <p className="text-[10px] text-slate-500">El monto no puede superar el total de la factura original (${selectedInvoice?.total.toFixed(2) || '0.00'}).</p>
            </div>

            {/* Opción de reintegrar stock */}
            <div className="pt-1">
              <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
                <input
                  type="checkbox"
                  checked={restoreStock}
                  onChange={(e) => setRestoreStock(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-slate-800 block">Reintegrar productos al inventario</span>
                  <span className="text-[10px] text-slate-500 block">Devuelve las cantidades vendidas al stock actual de la bodega</span>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-800 font-medium leading-relaxed">
              Al emitir la Nota de Crédito por anulación total, la factura original quedará marcada automáticamente como <strong className="font-bold text-rose-700">ANULADA</strong> en el sistema y se generará su RIDE oficial.
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
