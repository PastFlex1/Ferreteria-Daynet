/**
 * @fileOverview Modal especializado para la corrección inteligente y guiada
 * de facturas devueltas por el SRI por observaciones en el documento.
 */

import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Send, 
  User, 
  Calendar, 
  Hash, 
  DollarSign, 
  Sparkles,
  Info,
  ArrowRight
} from 'lucide-react';
import { Invoice, StoreSettings } from '../../types';
import { diagnosticarFacturaSri, validarCedulaRucEcuador } from '../../utils/sriDocumentValidation';
import { formatCurrency } from '../../utils/formatters';

interface SriCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  existingInvoices: Invoice[];
  settings: StoreSettings;
  onSaveCorrection: (updatedInvoice: Invoice, shouldResendImmediately?: boolean) => void;
}

export const SriCorrectionModal: React.FC<SriCorrectionModalProps> = ({
  isOpen,
  onClose,
  invoice,
  existingInvoices,
  settings,
  onSaveCorrection,
}) => {
  if (!isOpen || !invoice) return null;

  const initialDiagnostic = diagnosticarFacturaSri(invoice, existingInvoices);

  // Form State
  const [customerIdNumber, setCustomerIdNumber] = useState(
    invoice.customer?.docNumber || invoice.customer?.idNumber || ''
  );
  const [customerName, setCustomerName] = useState(invoice.customer?.name || '');
  const [customerAddress, setCustomerAddress] = useState(invoice.customer?.address || 'Ecuador');
  const [customerEmail, setCustomerEmail] = useState(invoice.customer?.email || '');
  const [emissionDate, setEmissionDate] = useState(
    invoice.createdAt ? new Date(invoice.createdAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [fullNumber, setFullNumber] = useState(
    invoice.fullNumber || (invoice.number !== undefined ? String(invoice.number) : '')
  );
  const [subtotal, setSubtotal] = useState(Number(invoice.subtotal || 0));
  const [taxTotal, setTaxTotal] = useState(Number(invoice.taxTotal || 0));
  const [total, setTotal] = useState(Number(invoice.total || 0));

  // Live validator for customer ID
  const idValidation = validarCedulaRucEcuador(customerIdNumber);

  // Helper: auto-fix customer ID with a valid test RUC or Cédula
  const handleFixValidId = () => {
    // Ejemplo de Cédula válida de Guayas (0926691459) o Pichincha (1710034065)
    setCustomerIdNumber('0926691459');
    setCustomerName('CLIENTE CORREGIDO S.A.');
  };

  // Helper: fix to Consumidor Final if allowed
  const handleFixConsumidorFinal = () => {
    setCustomerIdNumber('9999999999999');
    setCustomerName('CONSUMIDOR FINAL');
    if (total > 50) {
      // Ajustar a $49.00 si se desea Consumidor Final
      const nuevoSub = 42.61;
      const nuevoIva = 6.39;
      setSubtotal(nuevoSub);
      setTaxTotal(nuevoIva);
      setTotal(49.00);
    }
  };

  // Helper: set to current date/time
  const handleFixDateNow = () => {
    const now = new Date();
    setEmissionDate(now.toISOString().slice(0, 16));
  };

  // Helper: generate next sequential
  const handleFixNextSequential = () => {
    const secNumeros = existingInvoices
      .map((i) => {
        const full = i.fullNumber || String(i.number || '');
        const parts = full.split('-');
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      })
      .filter((n) => n > 0);

    const maxSec = secNumeros.length > 0 ? Math.max(...secNumeros) : 100;
    const nextSec = (maxSec + 1).toString().padStart(9, '0');
    setFullNumber(`001-001-${nextSec}`);
  };

  // Helper: recalculate 15% VAT
  const handleRecalculateVat = () => {
    const newTax = Math.round(subtotal * 0.15 * 100) / 100;
    const newTot = Math.round((subtotal + newTax) * 100) / 100;
    setTaxTotal(newTax);
    setTotal(newTot);
  };

  // Save changes
  const handleSave = (resend: boolean = false) => {
    const seqParts = fullNumber.split('-');
    const numericSec = seqParts.length === 3 ? parseInt(seqParts[2], 10) : parseInt(fullNumber, 10);
    const parsedNumber = !isNaN(numericSec) ? numericSec : (typeof invoice.number === 'number' ? invoice.number : 0);

    const detectedDocType = customerIdNumber === '9999999999999' 
      ? 'CONSUMIDOR_FINAL' 
      : customerIdNumber.length === 13 
        ? 'RUC' 
        : 'C.I.';

    const updated: Invoice = {
      ...invoice,
      fullNumber,
      number: parsedNumber,
      createdAt: new Date(emissionDate).toISOString(),
      customer: {
        ...invoice.customer,
        name: customerName,
        docNumber: customerIdNumber,
        idNumber: customerIdNumber,
        docType: detectedDocType,
        idType: detectedDocType,
        address: customerAddress,
        email: customerEmail,
      },
      subtotal,
      taxTotal,
      total,
      sriStatus: 'PENDIENTE',
      sriMensaje: 'Documento corregido internamente. Listo para reenvío al SRI.',
    };

    onSaveCorrection(updated, resend);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-2xl border border-orange-500/30">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base">Corrección de Factura Devuelta</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                  DEVUELTA POR EL SRI
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Comprobante: {invoice.fullNumber || invoice.number} — Total: {formatCurrency(invoice.total, settings.currencySymbol)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Motivo Oficial del SRI Card */}
        <div className="px-6 py-4 bg-red-50/80 border-b border-red-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-red-950 uppercase tracking-wide">
                Motivo del Rechazo / Devolución SRI:
              </span>
              {initialDiagnostic.codigoError && (
                <span className="px-2 py-0.5 rounded-md bg-red-200 text-red-900 font-black text-[10px]">
                  CÓDIGO {initialDiagnostic.codigoError}
                </span>
              )}
            </div>
            <p className="font-mono text-red-900 font-bold bg-white/80 p-2 rounded-lg border border-red-200 text-[11px] leading-relaxed">
              {invoice.sriMensaje || initialDiagnostic.motivoSri || 'El documento fue devuelto por inconsistencia en datos tributarios.'}
            </p>
            <p className="text-red-700 font-medium">
              <span className="font-bold">Diagnóstico:</span> {initialDiagnostic.diagnostico || 'Revisar datos del comprobante.'}
            </p>
          </div>
        </div>

        {/* Formulario de Corrección */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* SECCIÓN 1: DATOS DEL CLIENTE / RECEPTOR */}
          <div className={`p-4 rounded-2xl border transition ${
            initialDiagnostic.campoAfectado === 'IDENTIFICACION' 
              ? 'bg-orange-50/60 border-orange-300 ring-2 ring-orange-400/20' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-black text-slate-900 uppercase">
                <User className="w-4 h-4 text-orange-500" />
                <span>1. Identificación y Datos del Cliente</span>
              </div>
              {initialDiagnostic.campoAfectado === 'IDENTIFICACION' && (
                <span className="text-[10px] font-black uppercase text-orange-700 bg-orange-200/80 px-2 py-0.5 rounded">
                  ⚠️ Campo Observado por SRI
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Cédula / RUC del Cliente:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerIdNumber}
                    onChange={(e) => setCustomerIdNumber(e.target.value.trim())}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border ${
                      idValidation.valido 
                        ? 'border-emerald-300 bg-white text-emerald-950 focus:border-emerald-500' 
                        : 'border-red-300 bg-red-50/50 text-red-950 focus:border-red-500'
                    }`}
                    placeholder="Ej. 0926691459 o 1792345678001"
                  />
                  <div className="absolute right-2.5 top-2.5">
                    {idValidation.valido ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
                <div className="mt-1 text-[10px] font-medium">
                  {idValidation.valido ? (
                    <span className="text-emerald-700 font-bold">✓ {idValidation.tipo} verificada correctamente</span>
                  ) : (
                    <span className="text-red-600 font-semibold">{idValidation.error}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Razón Social / Nombre:
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Dirección:
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Correo Electrónico (para RIDE/XML):
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white focus:border-orange-500"
                />
              </div>
            </div>

            {/* Acciones Rápidas para Identificación */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200/80">
              <button
                type="button"
                onClick={handleFixValidId}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-lg border border-emerald-300 transition flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Asignar Cédula Válida (0926691459)</span>
              </button>

              <button
                type="button"
                onClick={handleFixConsumidorFinal}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[10px] rounded-lg border border-amber-300 transition flex items-center gap-1"
              >
                <span>Cambiar a Consumidor Final (&lt;$50)</span>
              </button>
            </div>
          </div>

          {/* SECCIÓN 2: FECHA Y SECUENCIAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fecha */}
            <div className={`p-4 rounded-2xl border transition ${
              initialDiagnostic.campoAfectado === 'FECHA'
                ? 'bg-orange-50/60 border-orange-300 ring-2 ring-orange-400/20'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-black text-slate-900 uppercase">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>2. Fecha de Emisión</span>
                </div>
                {initialDiagnostic.campoAfectado === 'FECHA' && (
                  <span className="text-[9px] font-black text-orange-700 bg-orange-200 px-1.5 py-0.5 rounded">
                    Observada
                  </span>
                )}
              </div>
              <input
                type="datetime-local"
                value={emissionDate}
                onChange={(e) => setEmissionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-slate-300 bg-white"
              />
              <button
                type="button"
                onClick={handleFixDateNow}
                className="mt-2 w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] rounded-lg border border-blue-200 transition flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>Actualizar a Fecha y Hora Actual</span>
              </button>
            </div>

            {/* Secuencial */}
            <div className={`p-4 rounded-2xl border transition ${
              initialDiagnostic.campoAfectado === 'SECUENCIAL'
                ? 'bg-orange-50/60 border-orange-300 ring-2 ring-orange-400/20'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-black text-slate-900 uppercase">
                  <Hash className="w-3.5 h-3.5 text-purple-500" />
                  <span>3. Secuencial Factura</span>
                </div>
                {initialDiagnostic.campoAfectado === 'SECUENCIAL' && (
                  <span className="text-[9px] font-black text-orange-700 bg-orange-200 px-1.5 py-0.5 rounded">
                    Observada
                  </span>
                )}
              </div>
              <input
                type="text"
                value={fullNumber}
                onChange={(e) => setFullNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-slate-300 bg-white"
                placeholder="001-001-000000001"
              />
              <button
                type="button"
                onClick={handleFixNextSequential}
                className="mt-2 w-full py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-[10px] rounded-lg border border-purple-200 transition flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span>Generar Siguiente Secuencial</span>
              </button>
            </div>
          </div>

          {/* SECCIÓN 3: TOTALES E IMPUESTOS */}
          <div className={`p-4 rounded-2xl border transition ${
            initialDiagnostic.campoAfectado === 'TOTALES'
              ? 'bg-orange-50/60 border-orange-300 ring-2 ring-orange-400/20'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-black text-slate-900 uppercase">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>4. Totales & Desglose de IVA (15%)</span>
              </div>
              <button
                type="button"
                onClick={handleRecalculateVat}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-lg border border-emerald-300 transition flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Recalcular IVA 15% Automático</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Subtotal ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={subtotal}
                  onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-mono font-bold border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">IVA 15% ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={taxTotal}
                  onChange={(e) => setTaxTotal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-mono font-bold border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Total ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={total}
                  onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-mono font-black border border-slate-300 bg-white text-emerald-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition w-full sm:w-auto"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-1.5 flex-1 sm:flex-initial cursor-pointer"
            >
              <span>Guardar Corrección</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 flex-1 sm:flex-initial cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Guardar y Reenviar al SRI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
