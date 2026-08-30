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
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

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
      <div className="space-y-6 no-print">
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

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center space-x-2 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              <span>Imprimir Arqueo / Cierre</span>
            </button>

            {session.status === 'ABIERTA' ? (
              <button
                type="button"
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
      </div>

      {/* Close Register Audit Modal */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
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

      {/* ── MODAL DE IMPRESIÓN OFICIAL DEL ARQUEO / CIERRE DE CAJA ──────────────── */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-6 sm:p-8 space-y-6 shadow-2xl my-auto">
            {/* Modal Header Actions (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-orange-500 text-white rounded-2xl shadow-sm">
                  <Printer className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                    <span>Comprobante de Arqueo y Cierre de Caja</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                      session.status === 'ABIERTA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {session.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Apertura: {formatFullDate(session.openedAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4 text-orange-400" />
                  <span>Imprimir / Guardar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Documento Imprimible Formal */}
            <div id="printable-cash-close" className="space-y-6 text-xs text-slate-900 bg-white p-4">
              {/* Membrete Corporativo */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-14 h-14 object-contain border border-slate-200 rounded-xl p-1" />
                  ) : (
                    <div className="p-2.5 bg-slate-900 text-white rounded-xl font-black text-base">
                      <DollarSign className="w-6 h-6 text-orange-400" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-base font-black text-slate-950 uppercase tracking-tight">
                      {settings.storeName || 'FERRETERÍA INDUSTRIAL'}
                    </h2>
                    <p className="text-xs font-bold text-slate-700">{settings.legalName || settings.storeName}</p>
                    <p className="text-[11px] text-slate-600">RUC: <strong className="font-mono text-slate-900">{settings.taxId}</strong> • Tel: {settings.phone}</p>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4 space-y-0.5">
                  <span className="px-2.5 py-0.5 bg-slate-900 text-white font-black text-[9px] rounded uppercase tracking-wider block text-center">
                    ARQUEO DE CAJA
                  </span>
                  <p className="text-[11px] font-bold text-slate-900">Control de Turno POS</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Emisión: {new Date().toLocaleString('es-EC')}
                  </p>
                </div>
              </div>

              {/* Datos de la Sesión */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Fecha y Hora Apertura:</span>
                  <strong className="text-slate-900">{formatFullDate(session.openedAt)}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Estado del Turno:</span>
                  <strong className={session.status === 'ABIERTA' ? 'text-emerald-700' : 'text-rose-700'}>
                    {session.status}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Fondo Inicial de Caja:</span>
                  <strong className="font-mono text-slate-900 text-sm">{formatCurrency(session.initialCash, settings.currencySymbol)}</strong>
                </div>
              </div>

              {/* Resumen de Ventas por Medio de Pago */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Recaudación por Medio de Pago</h4>
                <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900 text-white font-black text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5">Medio de Pago</th>
                        <th className="p-2.5 text-center">Tipo de Movimiento</th>
                        <th className="p-2.5 text-right">Total Recaudado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2.5 font-bold flex items-center gap-2">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Efectivo en Ventas</span>
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">Ingreso Líquido</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatCurrency(todaySalesCash, settings.currencySymbol)}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                          <span>Tarjetas Débito / Crédito</span>
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">Datafast / Medianet</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(todaySalesCard, settings.currencySymbol)}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold flex items-center gap-2">
                          <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
                          <span>Transferencias Bancarias</span>
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">Depósito / Transferencia</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(todaySalesTransfer, settings.currencySymbol)}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-amber-600" />
                          <span>Ventas a Crédito</span>
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">Cuentas por Cobrar</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(todaySalesCredit, settings.currencySymbol)}</td>
                      </tr>
                      <tr className="bg-slate-100 font-black border-t border-slate-300">
                        <td colSpan={2} className="p-2.5 text-slate-900 uppercase">Total General Facturado en Turno:</td>
                        <td className="p-2.5 text-right font-mono text-base text-slate-950">{formatCurrency(grandTotalSales, settings.currencySymbol)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Conciliación y Cuadre de Caja */}
              <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Conciliación Física de Efectivo</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Fondo Inicial:</span>
                    <strong className="font-mono text-slate-900">{formatCurrency(session.initialCash, settings.currencySymbol)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Ventas en Efectivo:</span>
                    <strong className="font-mono text-emerald-700">{formatCurrency(todaySalesCash, settings.currencySymbol)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Efectivo Esperado:</span>
                    <strong className="font-mono text-slate-950 font-black">{formatCurrency(expectedCashInDrawer, settings.currencySymbol)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Efectivo Real Contado:</span>
                    <strong className="font-mono text-orange-600 font-black">
                      {actualCountInput ? formatCurrency(parseFloat(actualCountInput) || 0, settings.currencySymbol) : formatCurrency(expectedCashInDrawer, settings.currencySymbol)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Firma Cajero(a) Responsable</p>
                  <p className="text-slate-500 text-[10px]">Entregué conforme</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Firma Supervisor / Administrador</p>
                  <p className="text-slate-500 text-[10px]">Recibí y verifiqué conforme</p>
                </div>
              </div>
            </div>

            {/* Modal Footer (Hidden in Print) */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 no-print">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-xl text-xs transition shadow-lg shadow-orange-500/20 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Descargar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
