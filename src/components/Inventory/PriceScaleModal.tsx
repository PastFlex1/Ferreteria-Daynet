import React, { useState, useEffect } from 'react';
import { X, Layers, Plus, Trash2 } from 'lucide-react';
import { Product, PriceScale } from '../../types';

interface PriceScaleModalProps {
  product: Product;
  onSave: (product: Product) => void;
  onClose: () => void;
  defaultTaxRate: number;
}

export const PriceScaleModal: React.FC<PriceScaleModalProps> = ({
  product,
  onSave,
  onClose,
  defaultTaxRate
}) => {
  const [priceScales, setPriceScales] = useState<PriceScale[]>([]);

  useEffect(() => {
    setPriceScales(product.priceScales || []);
  }, [product]);

  const handleAddPriceScale = () => {
    const newScale: PriceScale = {
      id: `scale-${Date.now()}`,
      name: `Escala ${priceScales.length + 1}`,
      minQty: 1,
      price: 0
    };
    setPriceScales([...priceScales, newScale]);
  };

  const handleUpdatePriceScale = (id: string, field: keyof PriceScale, value: string | number) => {
    setPriceScales(scales => scales.map(s => {
      if (s.id !== id) return s;
      return { ...s, [field]: value };
    }));
  };

  const handleRemovePriceScale = (id: string) => {
    setPriceScales(scales => scales.filter(s => s.id !== id));
  };

  const handleSave = () => {
    const updatedProduct = {
      ...product,
      priceScales: priceScales.map(s => ({
        ...s,
        minQty: parseFloat(s.minQty.toString()) || 1,
        maxQty: s.maxQty ? (parseFloat(s.maxQty.toString()) || undefined) : undefined,
        price: parseFloat(s.price.toString()) || 0
      }))
    };
    onSave(updatedProduct);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ring-1 ring-slate-900/10">
        <div className="px-6 py-4.5 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                Escalas de Precios por Volumen
              </h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                Producto: <span className="text-emerald-400">{product.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">
              Configuración de Rangos Dinámicos
            </h3>
            <button
              type="button"
              onClick={handleAddPriceScale}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Escala</span>
            </button>
          </div>

          {priceScales.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No hay escalas definidas. Haz clic en "Agregar Escala" para comenzar.
            </div>
          ) : (
            <div className="space-y-3">
              {priceScales.map((scale) => {
                const scalePriceParsed = parseFloat(scale.price.toString()) || 0;
                const scaleCostParsed = parseFloat(product.costPrice.toString()) || 0;
                const currentTaxRate = typeof product.taxRate === 'number' ? product.taxRate : defaultTaxRate;
                const scalePriceWithTax = scalePriceParsed * (1 + currentTaxRate / 100);
                const scaleGananciaRaw = scalePriceParsed - scaleCostParsed;
                const scaleGananciaPct = scaleCostParsed > 0 ? (scaleGananciaRaw / scaleCostParsed) * 100 : 0;
                const allowFractional = product.allowFractional;

                return (
                  <div key={scale.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-white border border-slate-200 rounded-xl items-center relative shadow-sm">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre</label>
                      <input
                        type="text"
                        value={scale.name}
                        onChange={(e) => handleUpdatePriceScale(scale.id, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                        placeholder="Ej: Mayorista"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cant. Desde</label>
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        value={scale.minQty}
                        onChange={(e) => handleUpdatePriceScale(scale.id, 'minQty', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 font-mono rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cant. Hasta</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="∞"
                        value={scale.maxQty || ''}
                        onChange={(e) => handleUpdatePriceScale(scale.id, 'maxQty', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 font-mono rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Precio Un. ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={scale.price}
                        onChange={(e) => handleUpdatePriceScale(scale.id, 'price', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-bold rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Precio + IVA</label>
                      <div className="px-2.5 py-1.5 bg-slate-100 text-slate-600 font-mono font-bold rounded-lg text-xs border border-transparent">
                        ${scalePriceWithTax.toFixed(2)}
                      </div>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ganancia</label>
                      <div className={`px-1 py-1.5 font-bold rounded-lg text-[11px] ${scaleGananciaPct < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {scaleGananciaPct.toFixed(0)}%
                      </div>
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemovePriceScale(scale.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition"
                        title="Eliminar Escala"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-bold transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-500/20"
          >
            Guardar Escalas
          </button>
        </div>
      </div>
    </div>
  );
};
