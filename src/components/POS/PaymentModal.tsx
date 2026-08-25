import React, { useState } from 'react';
import { 
  X, 
  DollarSign, 
  CreditCard, 
  ArrowLeftRight, 
  Users, 
  CheckCircle2, 
  Receipt, 
  Printer, 
  AlertCircle,
  Table,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { CartItem, Customer, DocumentType, PaymentMethod, StoreSettings } from '../../types';
import { formatCurrency, getDocumentTypeName } from '../../utils/formatters';
import { SriTotalsTable } from './SriTotalsTable';
import { calculateSriTotals } from '../../utils/sriCalculations';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: DocumentType;
  customer: Customer;
  cartItems: CartItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  settings: StoreSettings;
  onCompleteSale: (
    paymentMethod: PaymentMethod,
    amountTendered?: number,
    changeGiven?: number,
    notes?: string
  ) => void;
}

const PRESET_BILLS = [50, 100, 200, 500, 1000];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  documentType,
  customer,
  cartItems,
  subtotal,
  discountTotal,
  taxTotal,
  total,
  settings,
  onCompleteSale,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [amountTenderedStr, setAmountTenderedStr] = useState<string>(total.toFixed(4));
  const [notes, setNotes] = useState('');
  const [propinaEnabled, setPropinaEnabled] = useState(false);

  if (!isOpen) return null;

  const sriBreakdown = calculateSriTotals(cartItems, settings.defaultTaxRate, propinaEnabled);
  const finalTotalToPay = sriBreakdown.valorAPagar;

  const amountTendered = parseFloat(amountTenderedStr) || 0;
  const changeGiven = amountTendered - finalTotalToPay;
  const isCashValid = documentType === 'COTIZACION' || paymentMethod !== 'EFECTIVO' || amountTendered >= finalTotalToPay - 0.01;

  // Credit check
  const isCreditAllowed =
    paymentMethod !== 'CREDITO_CLIENTE' ||
    customer.creditLimit >= customer.currentBalance + total;

  const handleBillPreset = (bill: number) => {
    setAmountTenderedStr(bill.toString());
  };

  const handleExactCash = () => {
    setAmountTenderedStr(total.toFixed(4));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCashValid) return;
    if (!isCreditAllowed) return;

    onCompleteSale(
      paymentMethod,
      paymentMethod === 'EFECTIVO' ? amountTendered : undefined,
      paymentMethod === 'EFECTIVO' ? Math.max(0, changeGiven) : undefined,
      notes.trim() || undefined
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] ring-1 ring-slate-900/10">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                {documentType === 'COTIZACION' ? 'Guardar Cotización / Proforma' : `Cobrar Venta — ${getDocumentTypeName(documentType)}`}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cliente: <span className="font-extrabold text-orange-400">{customer.name}</span> ({customer.docNumber})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-850 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Total Amount Banner & SRI Table Direct */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 border border-orange-200 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-700 block">
                  {documentType === 'COTIZACION' ? 'Monto Total Cotizado' : 'Valor a Pagar (Total Comprobante)'}
                </span>
                <div className="text-3xl sm:text-4xl font-black text-slate-950 font-mono mt-0.5 tracking-tight">
                  {formatCurrency(finalTotalToPay, settings.currencySymbol)}
                </div>
              </div>
            </div>

            {/* Direct SriTotalsTable */}
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
              <SriTotalsTable
                breakdown={sriBreakdown}
                currencySymbol={settings.currencySymbol}
                onTogglePropina={setPropinaEnabled}
                totalLabel={documentType === 'COTIZACION' ? 'Monto Total Cotizado:' : 'Valor a pagar:'}
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
              Seleccionar Forma de Pago
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'EFECTIVO', label: 'Efectivo', icon: <DollarSign className="w-4 h-4" /> },
                { id: 'TARJETA_DEBITO', label: 'T. Débito', icon: <CreditCard className="w-4 h-4" /> },
                { id: 'TARJETA_CREDITO', label: 'T. Crédito', icon: <CreditCard className="w-4 h-4" /> },
                { id: 'TRANSFERENCIA', label: 'Transferencia', icon: <ArrowLeftRight className="w-4 h-4" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-xs font-black transition cursor-pointer ${
                    paymentMethod === m.id
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90'
                  }`}
                >
                  <div className="mb-1">{m.icon}</div>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Contractor Credit Method Button if customer has credit limit */}
            {customer.creditLimit > 0 && (
              <button
                type="button"
                onClick={() => setPaymentMethod('CREDITO_CLIENTE')}
                className={`w-full mt-2.5 p-3.5 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  paymentMethod === 'CREDITO_CLIENTE'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-orange-700 border-slate-200/90'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-orange-600" />
                  <span>Cargar a Cuenta Corriente / Crédito</span>
                </div>
                <span className="text-[11px] font-mono font-black bg-white/20 px-2 py-0.5 rounded">
                  Disponible: ${Math.max(0, customer.creditLimit - customer.currentBalance).toLocaleString()}
                </span>
              </button>
            )}
          </div>

          {/* Cash Payment Details (Amount Tendered & Change) */}
          {paymentMethod === 'EFECTIVO' && (
            <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-900">
                  Efectivo Entregado por Cliente
                </label>
                <button
                  type="button"
                  onClick={handleExactCash}
                  className="text-xs font-black text-orange-600 hover:text-orange-700 cursor-pointer bg-orange-50 px-2 py-0.5 rounded border border-orange-200"
                >
                  Monto Exacto
                </button>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl font-black text-orange-600 font-mono">
                  {settings.currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={amountTenderedStr}
                  onChange={(e) => setAmountTenderedStr(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 text-slate-950 font-mono font-black text-2xl rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs"
                  autoFocus
                />
              </div>

              {/* Quick Bill Presets */}
              <div className="flex flex-wrap gap-2 pt-1 items-center">
                <span className="text-[11px] text-slate-500 font-extrabold uppercase">Billetes:</span>
                {PRESET_BILLS.map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => handleBillPreset(bill)}
                    className="px-3 py-1 bg-white hover:bg-orange-50 text-slate-900 text-xs font-mono font-black rounded-lg border border-slate-200 hover:border-orange-300 transition shadow-2xs cursor-pointer"
                  >
                    ${bill}
                  </button>
                ))}
              </div>

              {/* Change Calculation Box */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  changeGiven >= 0
                    ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-900'
                    : 'bg-rose-50/90 border-rose-200/90 text-rose-900'
                }`}
              >
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  {changeGiven >= 0 ? 'Cambio / Vuelto a Entregar:' : 'Monto Faltante:'}
                </span>
                <span className="text-xl font-mono font-black">
                  {formatCurrency(Math.abs(changeGiven), settings.currencySymbol)}
                </span>
              </div>
            </div>
          )}

          {/* Credit Limit Error Warning */}
          {paymentMethod === 'CREDITO_CLIENTE' && !isCreditAllowed && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>
                El crédito excede el límite disponible del cliente (${(customer.creditLimit - customer.currentBalance).toFixed(4)} libre).
              </span>
            </div>
          )}

          {/* Optional Invoice Notes */}
          <div>
            <label className="block text-xs font-extrabold text-slate-800 mb-1">
              Notas u Observaciones (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Entregar en obra, Pedido especial, P.O. #102..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isCashValid || !isCreditAllowed}
              className={`px-6 py-2.5 rounded-xl text-xs font-black transition flex items-center space-x-2 ${
                isCashValid && isCreditAllowed
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/25 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>{documentType === 'COTIZACION' ? 'Guardar Cotización' : `Emitir ${getDocumentTypeName(documentType)}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
