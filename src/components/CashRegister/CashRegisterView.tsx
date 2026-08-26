import React, { useState } from 'react';
import { 
  DollarSign, 
  CreditCard, 
  ArrowLeftRight, 
  Users, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Calendar 
} from 'lucide-react';
import { CashRegisterSession, Invoice, StoreSettings } from '../../types';
import { formatCurrency, formatFullDate } from '../../utils/formatters';

interface CashRegisterViewProps {
  session: CashRegisterSession;
  invoices: Invoice[];
  settings: StoreSettings;
  onOpenRegister: (initialCash: number) => void;
  onCloseRegister: (actualCashCount: number) => void;
}

export const CashRegisterView: React.FC<CashRegisterViewProps> = ({
  session,
  invoices,
  settings,
  onOpenRegister,
  onCloseRegister,
}) => {
  const [initialCashInput, setInitialCashInput] = useState('');
  const [actualCountInput, setActualCountInput] = useState('');
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

  // Calculate live sales breakdown for active session
  const todaySalesCash = invoices
    .filter((i) => i.documentType !== 'COTIZACION' && i.paymentMethod === 'EFECTIVO' && i.paymentStatus === 'PAGADA')
    .reduce((sum, i) => sum + i.total, 0);

  const todaySalesCard = invoices
    .filter(
      (i) =>
        i.documentType !== 'COTIZACION' &&
        (i.paymentMethod === 'TARJETA_DEBITO' || i.paymentMethod === 'TARJETA_CREDITO') &&
        i.paymentStatus === 'PAGADA'
    )
    .reduce((sum, i) => sum + i.total, 0);

  const todaySalesTransfer = invoices
    .filter((i) => i.documentType !== 'COTIZACION' && i.paymentMethod === 'TRANSFERENCIA' && i.paymentStatus === 'PAGADA')
    .reduce((sum, i) => sum + i.total, 0);

  const todaySalesCredit = invoices
    .filter((i) => i.documentType !== 'COTIZACION' && i.paymentMethod === 'CREDITO_CLIENTE')
    .reduce((sum, i) => sum + i.total, 0);

  const expectedCashInDrawer = session.initialCash + todaySalesCash;
  const grandTotalSales = todaySalesCash + todaySalesCard + todaySalesTransfer + todaySalesCredit;

  const handleOpenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenRegister(parseFloat(initialCashInput) || 0);
  };

  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCloseRegister(parseFloat(actualCountInput) || 0);
    setIsClosingModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Session Status Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 ring-1 ring-slate-200/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div
            className={`p-3 rounded-2xl font-black ${
              session.status === 'ABIERTA'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
            }`}
          >
            {session.status === 'ABIERTA' ? (
              <Unlock className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <Lock className="w-6 h-6 stroke-[2.5]" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-black text-slate-950">
                Caja {session.status === 'ABIERTA' ? 'Abierta para Ventas' : 'Cerrada'}
              </h2>
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  session.status === 'ABIERTA'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {session.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Apertura: {formatFullDate(session.openedAt)}
            </p>
          </div>
        </div>

        {session.status === 'ABIERTA' ? (
          <button
            onClick={() => {
              setActualCountInput(expectedCashInDrawer.toFixed(4));
              setIsClosingModalOpen(true);
            }}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs transition shadow-md shadow-rose-600/20 flex items-center space-x-2 cursor-pointer"
          >
            <Lock className="w-4 h-4 stroke-[2.5]" />
            <span>Arqueo y Cierre de Caja</span>
          </button>
        ) : (
          <form onSubmit={handleOpenSubmit} className="flex items-center gap-2">
            <input
              type="number"
              step="0.0001"
              min="0"
              placeholder="Fondo Inicial ($)"
              value={initialCashInput}
              onChange={(e) => setInitialCashInput(e.target.value)}
              className="w-36 px-3.5 py-2 bg-slate-50 border border-slate-200 text-orange-600 font-mono font-black text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-md shadow-orange-500/20"
            >
              Abrir Caja
            </button>
          </form>
        )}
      </div>

      {/* Sales Breakdown Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-wider">
            <span>Efectivo en Caja</span>
            <DollarSign className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono">
            {formatCurrency(expectedCashInDrawer, settings.currencySymbol)}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            Fondo: {formatCurrency(session.initialCash, settings.currencySymbol)} + Ventas: {formatCurrency(todaySalesCash, settings.currencySymbol)}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-wider">
            <span>Ventas con Tarjeta</span>
            <CreditCard className="w-4 h-4 text-blue-600 stroke-[2.5]" />
          </div>
          <div className="text-xl font-black text-blue-600 font-mono">
            {formatCurrency(todaySalesCard, settings.currencySymbol)}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Débito y Crédito en POS</div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-wider">
            <span>Transferencias</span>
            <ArrowLeftRight className="w-4 h-4 text-purple-600 stroke-[2.5]" />
          </div>
          <div className="text-xl font-black text-purple-600 font-mono">
            {formatCurrency(todaySalesTransfer, settings.currencySymbol)}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Acreditadas a banco</div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-wider">
            <span>Ventas a Crédito</span>
            <Users className="w-4 h-4 text-orange-600 stroke-[2.5]" />
          </div>
          <div className="text-xl font-black text-orange-600 font-mono">
            {formatCurrency(todaySalesCredit, settings.currencySymbol)}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Cargadas a clientes</div>
        </div>
      </div>

      {/* Total Consolidated Box */}
      <div className="bg-slate-950 text-white rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border border-slate-800">
        <div>
          <h3 className="text-base font-black text-white tracking-wide">Ventas Totales de la Sesión</h3>
          <p className="text-xs text-slate-400 mt-0.5">Suma consolidada de todos los medios de pago recibidos.</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black text-orange-400 font-mono tracking-tight">
            {formatCurrency(grandTotalSales, settings.currencySymbol)}
          </span>
        </div>
      </div>

      {/* Close Register Audit Modal */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-600" />
              <span>Arqueo y Cierre de Caja</span>
            </h3>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Efectivo Esperado en Cajón:</span>
                <span className="font-mono text-emerald-700 font-bold">
                  {formatCurrency(expectedCashInDrawer, settings.currencySymbol)}
                </span>
              </div>
            </div>

            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Efectivo Real Contado en Cajón ($)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  required
                  value={actualCountInput}
                  onChange={(e) => setActualCountInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-orange-600 font-mono font-extrabold text-xl rounded-xl focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>

              {/* Difference Preview */}
              {(() => {
                const diff = (parseFloat(actualCountInput) || 0) - expectedCashInDrawer;
                return (
                  <div
                    className={`p-3 rounded-xl border text-xs flex justify-between font-bold ${
                      Math.abs(diff) < 0.01
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : diff > 0
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <span>Diferencia de Arqueo:</span>
                    <span className="font-mono">
                      {diff === 0
                        ? 'Cuadre Perfecto ($0.00)'
                        : diff > 0
                        ? `Sobrante (+${formatCurrency(diff, settings.currencySymbol)})`
                        : `Faltante (${formatCurrency(diff, settings.currencySymbol)})`}
                    </span>
                  </div>
                );
              })()}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsClosingModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-500/20 cursor-pointer"
                >
                  Finalizar Cierre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
