import React from 'react';
import { useModal } from '../../context/ModalContext';
import { 
  X, 
  PackageCheck, 
  User, 
  MapPin, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2, 
  Printer, 
  Download, 
  Pencil 
} from 'lucide-react';
import { Order } from './CreateOrderModal';
import { formatCurrency, formatFullDate } from '../../utils/formatters';
import { StoreSettings } from '../../types';
import { printOrderDocument, downloadOrderPdf } from '../../utils/orderPdfGenerator';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onUpdateStatus: (orderId: string, newStatus: Order['status']) => void;
  onDeleteOrder: (orderId: string) => void;
  onEditOrder?: (order: Order) => void;
  onInvoiceOrder?: (order: Order) => void;
  settings: StoreSettings;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
  onUpdateStatus,
  onDeleteOrder,
  onEditOrder,
  onInvoiceOrder,
  settings,
}) => {
  const { showConfirm } = useModal();

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
              <PackageCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">{order.id}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  order.status === 'DESPACHADO' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  order.status === 'EN PREPARACION' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  order.status === 'ANULADO' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                  order.status === 'FACTURADO' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {formatFullDate(order.date)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => printOrderDocument(order, settings)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-slate-900 border border-slate-700"
              title="Imprimir Pedido"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              type="button"
              onClick={() => downloadOrderPdf(order, settings)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-slate-900 border border-slate-700"
              title="Descargar en PDF"
            >
              <Download className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            {onEditOrder && order.status !== 'FACTURADO' && order.status !== 'ANULADO' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditOrder(order);
                }}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-slate-900 border border-slate-700"
                title="Editar Pedido"
              >
                <Pencil className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Editar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
          {/* Customer info */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Cliente</span>
              <span className="font-bold text-slate-900 text-sm">{order.customerName}</span>
              {order.customerRuc && (
                <div className="text-slate-500 text-[11px] font-mono">RUC: {order.customerRuc}</div>
              )}
            </div>
            {order.deliveryAddress && (
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Dirección de Entrega</span>
                <span className="text-slate-800 font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  {order.deliveryAddress}
                </span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="space-y-2">
            <h4 className="font-black text-slate-900 uppercase text-[11px]">Productos Solicitados ({order.items.length})</h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-900">{item.productName}</div>
                    <div className="text-[11px] text-slate-500">
                      Cant: <strong className="text-slate-900">{item.qty}</strong> x {formatCurrency(item.unitPrice, settings.currencySymbol)}
                    </div>
                  </div>
                  <div className="font-mono font-extrabold text-slate-950">
                    {formatCurrency(item.subtotal, settings.currencySymbol)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 text-amber-900">
              <span className="font-bold block text-[11px] text-amber-800">Notas Adicionales:</span>
              <p className="text-xs">{order.notes}</p>
            </div>
          )}

          {/* Totals */}
          <div className="bg-slate-950 text-white rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-slate-300">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(order.subtotal, settings.currencySymbol)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>IVA ({settings.defaultTaxRate}%):</span>
              <span className="font-mono">{formatCurrency(order.tax, settings.currencySymbol)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-orange-400 pt-2 border-t border-slate-800">
              <span>Monto Total:</span>
              <span className="font-mono text-lg">{formatCurrency(order.total, settings.currencySymbol)}</span>
            </div>
          </div>

          {/* Change Status Action */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <span className="font-bold text-slate-700 block text-[11px]">Cambiar Estado del Pedido:</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                onClick={() => onUpdateStatus(order.id, 'PENDIENTE')}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold cursor-pointer transition ${
                  order.status === 'PENDIENTE'
                    ? 'bg-blue-600 text-white font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                PENDIENTE
              </button>
              <button
                onClick={() => onUpdateStatus(order.id, 'EN PREPARACION')}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold cursor-pointer transition ${
                  order.status === 'EN PREPARACION'
                    ? 'bg-amber-500 text-white font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                EN PREPARACIÓN
              </button>
              <button
                onClick={() => onUpdateStatus(order.id, 'DESPACHADO')}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold cursor-pointer transition ${
                  order.status === 'DESPACHADO'
                    ? 'bg-teal-600 text-white font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                DESPACHADO
              </button>
              <button
                onClick={() => onUpdateStatus(order.id, 'FACTURADO')}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold cursor-pointer transition ${
                  order.status === 'FACTURADO'
                    ? 'bg-emerald-600 text-white font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                FACTURADO
              </button>
              <button
                onClick={() => onUpdateStatus(order.id, 'ANULADO')}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold cursor-pointer transition ${
                  order.status === 'ANULADO'
                    ? 'bg-rose-600 text-white font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                ANULADO
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => {
              showConfirm(
                '¿Está seguro de eliminar este pedido del sistema?',
                () => {
                  onDeleteOrder(order.id);
                  onClose();
                },
                'Eliminar Pedido',
                'Sí, Eliminar',
                'Cancelar'
              );
            }}
            className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Eliminar Pedido</span>
          </button>

          <div className="flex items-center gap-2">
            {onInvoiceOrder && order.status !== 'ANULADO' && (
              <button
                type="button"
                onClick={() => {
                  onInvoiceOrder(order);
                  onClose();
                }}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition"
              >
                <FileText className="w-4 h-4" />
                <span>Facturar Pedido en POS</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
