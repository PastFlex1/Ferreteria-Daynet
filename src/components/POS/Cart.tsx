import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  User, 
  FileText, 
  Receipt, 
  Calculator, 
  Minus, 
  Plus, 
  Tag, 
  Check, 
  Sparkles,
  Percent,
  ChevronDown,
  ChevronUp,
  Table,
  Briefcase,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import { CartItem, Customer, DocumentType, StoreSettings } from '../../types';
import { formatCurrency, getDocumentTypeName } from '../../utils/formatters';
import { SriTotalsTable } from './SriTotalsTable';
import { calculateSriTotals } from '../../utils/sriCalculations';

interface CartProps {
  cartItems: CartItem[];
  documentType: DocumentType;
  setDocumentType: (docType: DocumentType) => void;
  customer: Customer;
  onOpenCustomerModal: () => void;
  onUpdateQuantity: (productId: string, newQty: number) => void;
  onUpdateDiscount: (productId: string, discountPercent: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  settings: StoreSettings;
  sellerName?: string;
  setSellerName?: (name: string) => void;
  sellerOptions?: string[];
}

export const Cart: React.FC<CartProps> = ({
  cartItems,
  documentType,
  setDocumentType,
  customer,
  onOpenCustomerModal,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
  subtotal,
  discountTotal,
  taxTotal,
  total,
  settings,
  sellerName,
  setSellerName,
  sellerOptions = [],
}) => {
  const [propinaEnabled, setPropinaEnabled] = useState(false);
  const [showSriBreakdown, setShowSriBreakdown] = useState(false);
  const [isSellerMenuOpen, setIsSellerMenuOpen] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (isSellerMenuOpen && !(e.target as HTMLElement).closest('[data-cart-seller]')) {
        setIsSellerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isSellerMenuOpen]);

  const sriBreakdown = calculateSriTotals(cartItems, settings.defaultTaxRate, propinaEnabled);
  const totalItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
      
      {/* 1. Header: Document Type, Customer & Seller */}
      <div className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200 space-y-2.5 shrink-0">
        {/* Document Type Switcher */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs flex-1">
            {(['FACTURA', 'BOLETA', 'COTIZACION'] as DocumentType[]).map((doc) => {
              const isActive = documentType === doc;
              return (
                <button
                  key={doc}
                  onClick={() => setDocumentType(doc)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer text-center truncate ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {doc === 'FACTURA' ? 'Factura' : doc === 'BOLETA' ? 'Nota Venta' : 'Cotización'}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-200 shrink-0">
            SRI
          </span>
        </div>

        {/* Customer & Seller in a neat dual bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Customer button */}
          <button
            onClick={onOpenCustomerModal}
            className="flex items-center justify-between p-2 bg-white hover:bg-orange-50/50 border border-slate-200 hover:border-orange-300 rounded-xl text-xs transition cursor-pointer text-left group shadow-2xs"
            title="Seleccionar o crear cliente"
          >
            <div className="flex items-center space-x-2 truncate">
              <div className="p-1.5 bg-orange-500/10 text-orange-600 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <span className="block text-[9px] text-slate-400 font-extrabold uppercase leading-none">Cliente</span>
                <span className="font-extrabold text-slate-900 truncate block text-xs mt-0.5">{customer.name}</span>
              </div>
            </div>
            <span className="text-orange-500 text-[10px] font-bold shrink-0 ml-1">Cambiar</span>
          </button>

          {/* Seller dropdown (Custom Modern Dropdown) */}
          {sellerOptions.length > 0 && setSellerName ? (
            <div className="relative" data-cart-seller>
              <button
                type="button"
                onClick={() => setIsSellerMenuOpen(!isSellerMenuOpen)}
                className="w-full flex items-center space-x-2 p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs text-left cursor-pointer transition"
              >
                <div className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg shrink-0">
                  <Briefcase className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[9px] text-slate-400 font-extrabold uppercase leading-none">Vendedor</span>
                  <span className="block text-xs font-black text-slate-900 truncate mt-0.5">{sellerName}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSellerMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSellerMenuOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5 animate-fadeIn ring-1 ring-slate-900/10">
                  {sellerOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSellerName(opt);
                        setIsSellerMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                        sellerName === opt
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold'
                          : 'hover:bg-orange-50/80 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {sellerName === opt && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. Cart Items List (Takes Main Height) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2 custom-scrollbar min-h-[160px]">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center text-slate-500 p-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <div className="p-3 bg-slate-100 text-slate-400 rounded-2xl mb-2">
              <Receipt className="w-8 h-8" />
            </div>
            <p className="text-xs font-black text-slate-800">El carrito está vacío</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
              Haz clic en los productos del catálogo a la izquierda para agregarlos.
            </p>
          </div>
        ) : (
          cartItems.map((item) => (
            <div
              key={item.product.id}
              className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 hover:border-orange-300 rounded-xl p-2.5 space-y-2 transition shadow-2xs"
            >
              {/* Product Title & Delete Button */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black text-slate-900 leading-snug line-clamp-2">
                    {item.product.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-mono font-semibold text-slate-500">
                      SKU: {item.product.sku}
                    </span>
                    <span className="text-[10px] font-black text-slate-700 px-1.5 py-0.2 rounded bg-slate-200/70">
                      {item.product.unit.toUpperCase()}
                    </span>
                    {(() => {
                      const itemTaxRate = typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate;
                      const unitPriceWithTax = item.unitPrice * (1 + itemTaxRate / 100);
                      return (
                        <span 
                          className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200"
                          title={`Precio sin IVA: ${formatCurrency(item.unitPrice, settings.currencySymbol)}`}
                        >
                          P.U (IVA incl.): {formatCurrency(unitPriceWithTax, settings.currencySymbol)}
                        </span>
                      );
                    })()}
                  </div>
                  {/* Promo Badge */}
                  {item.appliedPromo && (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 mt-1">
                      <Tag className="w-2.5 h-2.5" />
                      <span>{item.appliedPromo}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onRemoveItem(item.product.id)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer shrink-0"
                  title="Eliminar de la venta"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quantity, Discount & Subtotal Row */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-xs">
                {/* Tactile Quantity Buttons */}
                <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    onClick={() =>
                      onUpdateQuantity(
                        item.product.id,
                        Math.max(
                          item.product.allowFractional ? 0.25 : 1,
                          item.quantity - (item.product.allowFractional ? 0.5 : 1)
                        )
                      )
                    }
                    className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="number"
                    step={item.product.allowFractional ? '0.1' : '1'}
                    min="0.1"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (val > 0) onUpdateQuantity(item.product.id, val);
                    }}
                    className="w-10 text-center font-mono font-black text-slate-900 bg-transparent focus:outline-none text-xs"
                  />

                  <button
                    onClick={() =>
                      onUpdateQuantity(
                        item.product.id,
                        item.quantity + (item.product.allowFractional ? 0.5 : 1)
                      )
                    }
                    className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Line Discount Input */}
                <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                  <Percent className="w-3 h-3 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={item.discountPercent || ''}
                    onChange={(e) =>
                      onUpdateDiscount(item.product.id, parseFloat(e.target.value) || 0)
                    }
                    className="w-9 px-1 py-0.5 bg-white border border-slate-200 text-slate-800 text-center font-mono font-bold rounded text-[11px] focus:ring-1 focus:ring-orange-500"
                    title="Descuento %"
                  />
                  <span className="font-bold">%</span>
                </div>

                {/* Item Total */}
                <div className="text-right">
                  {item.appliedPromo && item.discountPercent > 0 && (
                    <span className="block text-[9px] font-mono text-slate-400 line-through">
                      {formatCurrency(item.quantity * item.unitPrice, settings.currencySymbol)}
                    </span>
                  )}
                  <span className="font-mono font-black text-slate-950 text-sm">
                    {formatCurrency(item.total, settings.currencySymbol)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Compact Financial Summary & Action Bar Footer */}
      <div className="p-3.5 sm:p-4 bg-slate-950 text-white border-t border-slate-800 space-y-3 shrink-0 shadow-xl">
        
        {/* Clean, Compact Financial Breakdown */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-400 font-medium text-[11px]">
            <span>Subtotal sin impuestos:</span>
            <span className="font-mono text-slate-200 font-bold">{formatCurrency(subtotal, settings.currencySymbol)}</span>
          </div>

          {discountTotal > 0 && (
            <div className="flex justify-between text-rose-400 font-medium text-[11px]">
              <span>Descuento aplicado:</span>
              <span className="font-mono font-bold">-{formatCurrency(discountTotal, settings.currencySymbol)}</span>
            </div>
          )}

          <div className="flex justify-between text-slate-400 font-medium text-[11px]">
            <span>IVA ({settings.defaultTaxRate}%):</span>
            <span className="font-mono text-slate-200 font-bold">{formatCurrency(taxTotal, settings.currencySymbol)}</span>
          </div>

          {/* SRI Breakdown Toggle Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowSriBreakdown(!showSriBreakdown)}
              className="text-[10px] text-slate-400 hover:text-orange-400 flex items-center gap-1 transition cursor-pointer"
            >
              <Info className="w-3 h-3" />
              <span>{showSriBreakdown ? 'Ocultar desglose SRI' : 'Ver desglose tributario SRI (0%, 5%, 15%)'}</span>
              {showSriBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Collapsible SRI Breakdown Table */}
            {showSriBreakdown && (
              <div className="mt-2 rounded-lg border border-slate-800 overflow-hidden bg-slate-900/90 shadow-2xs max-h-48 overflow-y-auto custom-scrollbar">
                <SriTotalsTable
                  breakdown={sriBreakdown}
                  currencySymbol={settings.currencySymbol}
                  onTogglePropina={setPropinaEnabled}
                  theme="dark"
                />
              </div>
            )}
          </div>
        </div>

        {/* Grand Total Display */}
        <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-orange-400 block">
              Total a Pagar
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {cartItems.length} {cartItems.length === 1 ? 'producto' : 'productos'} ({totalItemCount} und)
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white tracking-tight">
              {formatCurrency(total, settings.currencySymbol)}
            </span>
          </div>
        </div>

        {/* Action Buttons: Clear & Big Vibrant Cobrar */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClearCart}
            disabled={cartItems.length === 0}
            className="p-3 bg-slate-900 hover:bg-slate-850 disabled:opacity-30 text-slate-400 hover:text-rose-400 font-bold rounded-xl text-xs transition flex items-center justify-center cursor-pointer border border-slate-800 shrink-0"
            title="Vaciar Carrito"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={onProceedToCheckout}
            disabled={cartItems.length === 0}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-30 text-white font-black rounded-xl text-sm transition shadow-lg shadow-orange-500/20 flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98]"
          >
            <Calculator className="w-5 h-5 stroke-[2.5]" />
            <span>
              {documentType === 'COTIZACION' ? 'Guardar Cotización' : `Cobrar ${formatCurrency(total, settings.currencySymbol)}`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
