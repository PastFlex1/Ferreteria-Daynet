import React, { useState } from 'react';
import { Percent, X, AlertCircle, FileText, User } from 'lucide-react';
import { Invoice, StoreSettings } from '../../types';
import { Select } from '../Shared/Select';

interface CreateRetentionModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
  invoices: Invoice[];
  settings: StoreSettings;
  establishment: string;
  emissionPoint: string;
  secRetention: string;
}

export const CreateRetentionModal: React.FC<CreateRetentionModalProps> = ({
  onClose,
  onSave,
  invoices,
  settings,
  establishment,
  emissionPoint,
  secRetention,
}) => {
  const [formData, setFormData] = useState({
    invoiceRef: '',
    retentionRir: '1.75%',
    retentionIva: '30%',
    totalRetenido: '',
  });

  const selectedInvoice = invoices.find((inv) => inv.id === formData.invoiceRef || inv.fullNumber === formData.invoiceRef);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    onSave({
      id: `${establishment}-${emissionPoint}-${secRetention}`,
      invoiceRef: selectedInvoice.fullNumber || selectedInvoice.id,
      customer: selectedInvoice.customer.name,
      retentionRir: `Renta: ${formData.retentionRir}`,
      retentionIva: `IVA: ${formData.retentionIva}`,
      totalRetenido: parseFloat(formData.totalRetenido) || 0,
      date: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-fadeIn">
        <div className="bg-slate-950 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-500/20 flex items-center justify-center rounded-xl border border-indigo-500/30">
              <Percent className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Registrar Retención</h2>
              <p className="text-slate-400 text-xs font-medium">Emisión de comprobante de retención de impuestos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            {/* Secuencial Proyectado */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">N° Comprobante a Generar:</span>
              <span className="font-mono font-black text-slate-900 bg-slate-200 px-2 py-0.5 rounded">
                {establishment}-{emissionPoint}-{secRetention}
              </span>
            </div>

            {/* Factura a Retener */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-orange-500" /> Factura Asociada *
              </label>
              <Select
                required
                value={formData.invoiceRef}
                onChange={(e) => setFormData({ ...formData, invoiceRef: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">Seleccione una factura emitida...</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.fullNumber} - {inv.customer.name} - ${inv.total.toFixed(2)}
                  </option>
                ))}
              </Select>
            </div>

            {selectedInvoice && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" /> {selectedInvoice.customer.name}
                </p>
                <p className="text-slate-500">
                  Subtotal: <span className="font-mono font-bold text-slate-900">${selectedInvoice.subtotal.toFixed(2)}</span>
                </p>
                <p className="text-slate-500">
                  IVA Retenible: <span className="font-mono font-bold text-slate-900">${selectedInvoice.taxTotal.toFixed(2)}</span>
                </p>
                <p className="text-slate-500">
                  Total Factura: <span className="font-mono font-black text-slate-900">${selectedInvoice.total.toFixed(2)}</span>
                </p>
              </div>
            )}

            {/* Tipo Retención Renta */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">Porcentaje Retención Renta</label>
              <Select
                value={formData.retentionRir}
                onChange={(e) => setFormData({ ...formData, retentionRir: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="0%">Sin retención de Renta (0%)</option>
                <option value="1.75%">Cod 312 - Adquisición de bienes (1.75%)</option>
                <option value="2.75%">Cod 343 - Servicios generales (2.75%)</option>
                <option value="8%">Cod 304 - Honorarios profesionales (8%)</option>
                <option value="10%">Cod 307 - Comisiones / otros (10%)</option>
              </Select>
            </div>

            {/* Tipo Retención IVA */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">Porcentaje Retención IVA</label>
              <Select
                value={formData.retentionIva}
                onChange={(e) => setFormData({ ...formData, retentionIva: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="0%">Sin retención de IVA (0%)</option>
                <option value="30%">Retención del 30% (Bienes)</option>
                <option value="70%">Retención del 70% (Servicios)</option>
                <option value="100%">Retención del 100% (Profesionales / Liquidación)</option>
              </Select>
            </div>

            {/* Valor total a retener */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">Monto Total Retenido *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  {settings.currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.totalRetenido}
                  onChange={(e) => setFormData({ ...formData, totalRetenido: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-800 font-medium leading-relaxed">
              El comprobante de retención será emitido electrónicamente y transmitido al SRI bajo el secuencial correspondiente.
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
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
            >
              <Percent className="w-4 h-4" />
              <span>Registrar Retención</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
