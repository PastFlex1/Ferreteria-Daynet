import React, { useState, useEffect } from 'react';
import { X, PackagePlus, Save, Package, Sparkles, Barcode, Layers, Plus, Trash2, TrendingUp } from 'lucide-react';
import { Category, Product, ProductCategory, UnitOfMeasure, PriceScale, TaxRateItem } from '../../types';
import { Select } from '../Shared/Select';
import { BarcodeSvg } from '../Shared/BarcodeSvg';
import { generateEan13Barcode, generateCode128Barcode } from '../../utils/barcodeGenerator';
import { useModal } from '../../context/ModalContext';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { defaultTaxRates } from '../../data/initialData';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit: Product | null;
  onSaveProduct: (product: Product) => void;
  units: any[];
  categories?: ProductCategory[];
  defaultTaxRate?: number;
  taxRates?: TaxRateItem[];
}

const CATEGORIES: Category[] = [
  'Tornillería & Fijaciones',
  'Herramientas Manuales',
  'Herramientas Eléctricas',
  'Plomería & Gas',
  'Electricidad & Iluminación',
  'Pinturas & Solventes',
  'Materiales de Construcción',
  'Cerrajería & Herrajes',
  'Seguridad Industrial',
];



export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSaveProduct,
  units,
  categories,
  defaultTaxRate = 15,
  taxRates,
}) => {
  const { showAlert, showToast } = useModal();
  const [syncedTaxRates] = useFirestoreSync<TaxRateItem[]>('ferreteria_settings_tax_rates', defaultTaxRates);
  const availableTaxRates = (taxRates && taxRates.length > 0 ? taxRates : syncedTaxRates).filter(t => t.active !== false);
  const categoryOptions = categories && categories.length > 0 ? categories.map((c) => c.name) : ['General'];
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(categoryOptions[0] || 'General');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<string>('UND');
  const [price, setPrice] = useState('0');
  const [priceWithTax, setPriceWithTax] = useState('0');
  const [costPrice, setCostPrice] = useState('0');
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [location, setLocation] = useState('');
  const [allowFractional, setAllowFractional] = useState(false);
  const [taxRate, setTaxRate] = useState(defaultTaxRate.toString());
  const [priceScales, setPriceScales] = useState<PriceScale[]>([]);

  useEffect(() => {
    if (productToEdit) {
      setSku(productToEdit.sku);
      setBarcode(productToEdit.barcode);
      setName(productToEdit.name);
      setCategory(productToEdit.category);
      setDescription(productToEdit.description || '');
      setUnit(productToEdit.unit);
      setPrice(productToEdit.price.toString());
      setCostPrice(productToEdit.costPrice.toString());
      setStock(productToEdit.stock.toString());
      setMinStock(productToEdit.minStock.toString());
      setLocation(productToEdit.location || '');
      setAllowFractional(productToEdit.allowFractional);
      const currentTax = productToEdit.taxRate ?? defaultTaxRate;
      setTaxRate(currentTax.toString());
      setPriceWithTax((productToEdit.price * (1 + currentTax / 100)).toFixed(4));
      setPriceScales(productToEdit.priceScales || []);
    } else {
      // Reset defaults
      setSku('');
      setBarcode('');
      setName('');
      setCategory(categoryOptions[0] || 'Herramientas Manuales');
      setDescription('');
      setUnit(units && units.length > 0 ? units[0].code : 'UND');
      setPrice('');
      setCostPrice('');
      setStock('');
      setMinStock('');
      setLocation('Pasillo 1');
      setAllowFractional(false);
      setTaxRate(defaultTaxRate.toString());
      setPriceWithTax('');
      setPriceScales([]);
    }
  }, [productToEdit, isOpen, defaultTaxRate]);

  const handleUnitChange = (selectedUnit: string) => {
    setUnit(selectedUnit);
    const unitConfig = units.find((u) => u.code === selectedUnit);
    if (unitConfig) {
      setAllowFractional(!!unitConfig.fractional);
    }
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    const p = parseFloat(val) || 0;
    const t = parseFloat(taxRate);
    const finalT = isNaN(t) ? defaultTaxRate : t;
    setPriceWithTax((p * (1 + finalT / 100)).toFixed(4));
  };

  const handlePriceWithTaxChange = (val: string) => {
    setPriceWithTax(val);
    const pWithTax = parseFloat(val) || 0;
    const t = parseFloat(taxRate);
    const finalT = isNaN(t) ? defaultTaxRate : t;
    setPrice((pWithTax / (1 + finalT / 100)).toFixed(4));
  };

  const handleTaxRateChange = (val: string) => {
    setTaxRate(val);
    const p = parseFloat(price) || 0;
    const t = parseFloat(val);
    const finalT = isNaN(t) ? defaultTaxRate : t;
    setPriceWithTax((p * (1 + finalT / 100)).toFixed(4));
  };

  const handleAddScale = () => {
    const defaultMinQty = priceScales.length > 0 ? (priceScales[priceScales.length - 1].minQty * 2) : 6;
    const basePrice = parseFloat(price) || 0;
    const suggestedPrice = basePrice > 0 ? Math.round(basePrice * 0.9 * 10000) / 10000 : 0;

    const newScale: PriceScale = {
      id: `scale-${Date.now()}`,
      name: `Mayorista ${priceScales.length + 1}`,
      minQty: defaultMinQty,
      price: suggestedPrice,
    };
    setPriceScales([...priceScales, newScale]);
  };

  const handleUpdateScale = (id: string, field: keyof PriceScale, value: string | number | undefined) => {
    setPriceScales(scales => scales.map(s => {
      if (s.id !== id) return s;
      return { ...s, [field]: value };
    }));
  };

  const handleRemoveScale = (id: string) => {
    setPriceScales(scales => scales.filter(s => s.id !== id));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    const isNew = !productToEdit;

    const finalSku = (sku.trim() || barcode.trim() || `FERR-${Date.now().toString().slice(-6)}`).toUpperCase();
    const finalBarcode = barcode.trim() || finalSku;

    const savedProduct: Product = {
      id: productToEdit ? productToEdit.id : `prod-${Date.now()}`,
      sku: finalSku,
      barcode: finalBarcode,
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      unit,
      price: parseFloat(price) || 0,
      costPrice: parseFloat(costPrice) || 0,
      stock: parseFloat(stock) || 0,
      minStock: parseFloat(minStock) || 0,
      location: location.trim() || undefined,
      taxRate: parseFloat(taxRate) || defaultTaxRate,
      allowFractional,
      priceScales: priceScales.filter(s => s.minQty > 0 && s.price > 0),
    };

    onSaveProduct(savedProduct);
    onClose();
    
    if (isNew) {
      showToast('Producto registrado exitosamente.', 'success');
    } else {
      showToast('Producto actualizado exitosamente.', 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ring-1 ring-slate-900/10">
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                {productToEdit ? 'Editar Producto Ferretero' : 'Registrar Nuevo Producto'}
              </h2>
              <p className="text-xs text-slate-400">
                Complete las especificaciones de catálogo e inventario
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-extrabold text-slate-800">
                  Código SKU / Referencia *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const prefix = category ? category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'FER') : 'FER';
                    const randomDigits = Math.floor(10000 + Math.random() * 90000);
                    const generatedSku = `${prefix}-${randomDigits}`;
                    setSku(generatedSku);
                    if (!barcode || barcode.startsWith('FER') || barcode === sku) {
                      setBarcode(generatedSku);
                    }
                    showToast(`SKU generado: ${generatedSku}`, 'info');
                  }}
                  className="text-[10px] text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 cursor-pointer transition border border-orange-200"
                  title="Generar código SKU automático"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Gen. SKU</span>
                </button>
              </div>
              <input
                type="text"
                placeholder="Ej: FERR-001 o MART-16OZ"
                value={sku}
                onChange={(e) => {
                  const val = e.target.value;
                  setSku(val);
                  // If barcode was empty or identical to previous SKU, keep in sync
                  if (!barcode || barcode === sku) {
                    setBarcode(val);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 font-mono text-orange-600 font-black rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-extrabold text-slate-800">
                  Código de Barras (EAN / Barcode)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const newCode = generateEan13Barcode('786');
                    setBarcode(newCode);
                    // Also populate SKU if it was empty
                    if (!sku.trim()) {
                      setSku(newCode);
                    }
                    showToast('Código de barras EAN-13 generado', 'info');
                  }}
                  className="text-[10px] text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 cursor-pointer transition border border-slate-200"
                  title="Generar código de barras EAN-13 (Ecuador 786)"
                >
                  <Barcode className="w-3 h-3 text-slate-600" />
                  <span>Gen. EAN-13</span>
                </button>
              </div>
              <input
                type="text"
                placeholder="Ej: 786100029301 o igual al SKU"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
              {barcode && barcode.trim().length >= 3 && (
                <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center">
                  <BarcodeSvg value={barcode.trim()} height={32} fontSize={10} width={1.3} />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-800 mb-1">
              Nombre del Producto Ferretero *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Martillo Galponero 16oz Mango Fibra"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-950 font-black rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                Categoría *
              </label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 font-bold rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unidad de Medida *
              </label>
              <Select
                value={unit}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
              >
                {(units || []).map((u) => (
                  <option key={u.id} value={u.code}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Fractional Sales Checkbox */}
          <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="fractionalCheck"
              checked={allowFractional}
              onChange={(e) => setAllowFractional(e.target.checked)}
              className="rounded text-orange-600 focus:ring-orange-500 bg-white border-slate-300 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="fractionalCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
              Permitir venta fraccionada (ej: 0.5 kg de clavos o 3.5 metros de manguera/cable)
            </label>
          </div>

          {/* Pricing Row */}
          <div className={`grid grid-cols-1 ${parseFloat(taxRate) > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 bg-orange-50/50 p-3 rounded-xl border border-orange-200/80`}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Precio Costo ($)
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 font-mono rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-orange-700 mb-1">
                {parseFloat(taxRate) > 0 ? 'P. Venta sin IVA ($) *' : 'Precio de Venta ($) *'}
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                required
                placeholder="0.00"
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-orange-300 text-orange-600 font-mono font-bold rounded-xl text-sm focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {parseFloat(taxRate) > 0 && (
              <div>
                <label className="block text-xs font-bold text-orange-700 mb-1">
                  P. Venta con IVA ($)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.00"
                  value={priceWithTax}
                  onChange={(e) => handlePriceWithTaxChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-orange-300 text-slate-900 font-mono font-bold rounded-xl text-sm focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-orange-700 mb-1">
                Tarifa IVA
              </label>
              <Select
                value={taxRate}
                onChange={(e) => handleTaxRateChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-orange-300 text-orange-600 font-mono font-bold rounded-xl text-sm focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                {availableTaxRates.map(t => (
                  <option key={t.id} value={t.rate}>
                    {t.name} ({t.rate}%)
                  </option>
                ))}
                {!availableTaxRates.some(t => t.rate === parseFloat(taxRate)) && (
                  <option value={taxRate}>IVA {taxRate}% (Tarifa Actual)</option>
                )}
              </Select>
            </div>
          </div>

          {/* Stock & Location Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stock Actual en Tienda
              </label>
              <input
                type="number"
                step={allowFractional ? '0.1' : '1'}
                placeholder="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-emerald-700 font-mono font-bold rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stock Mínimo (Alerta)
              </label>
              <input
                type="number"
                step="1"
                placeholder="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-orange-600 font-mono font-bold rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ubicación / Estante
              </label>
              <input
                type="text"
                placeholder="Ej: Pasillo 2 - Estante B"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Escalas de Precios por Volumen / Mayorista */}
          <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-500 text-white rounded-lg shadow-2xs">
                  <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                    Escalas de Precios por Volumen / Mayorista
                  </h4>
                  <p className="text-[11px] text-emerald-700">
                    Aplica automáticamente precios especiales cuando el cliente compre por mayor en el POS.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddScale}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Agregar Escala</span>
              </button>
            </div>

            {priceScales.length === 0 ? (
              <div className="text-center py-3 px-4 bg-white/80 rounded-xl border border-dashed border-emerald-300 text-xs text-emerald-800 font-medium">
                No hay escalas configuradas para este producto. Haz clic en <strong>"+ Agregar Escala"</strong> si deseas ofrecer precio por docena, caja o mayorista.
              </div>
            ) : (
              <div className="space-y-2.5">
                {priceScales.map((scale, index) => {
                  const scalePrice = parseFloat(scale.price.toString()) || 0;
                  const currentCost = parseFloat(costPrice) || 0;
                  const currentTax = parseFloat(taxRate) || defaultTaxRate;
                  const scalePriceWithTax = scalePrice * (1 + currentTax / 100);
                  const marginPct = currentCost > 0 ? (((scalePrice - currentCost) / currentCost) * 100) : 0;

                  return (
                    <div
                      key={scale.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 bg-white border border-emerald-200 rounded-xl items-center shadow-2xs text-xs"
                    >
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Nombre / Rango
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Mayorista / Caja"
                          value={scale.name}
                          onChange={(e) => handleUpdateScale(scale.id, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Desde (Cant.)
                        </label>
                        <input
                          type="number"
                          step={allowFractional ? '0.1' : '1'}
                          min="1"
                          placeholder="1"
                          value={scale.minQty === 0 ? '' : scale.minQty}
                          onChange={(e) => handleUpdateScale(scale.id, 'minQty', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-center rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Hasta (Opcional)
                        </label>
                        <input
                          type="number"
                          step={allowFractional ? '0.1' : '1'}
                          placeholder="∞"
                          value={scale.maxQty ? scale.maxQty : ''}
                          onChange={(e) => handleUpdateScale(scale.id, 'maxQty', e.target.value === '' ? undefined : parseFloat(e.target.value) || undefined)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-center rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">
                          Precio Unit. ($)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.00"
                          value={scale.price === 0 ? '' : scale.price}
                          onChange={(e) => handleUpdateScale(scale.id, 'price', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono font-bold rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Con IVA / Margen
                        </label>
                        <div className="text-[11px] font-mono">
                          <span className="font-bold text-slate-900">${scalePriceWithTax.toFixed(2)}</span>
                          <span className={`ml-1 font-bold ${marginPct < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ({marginPct >= 0 ? '+' : ''}{marginPct.toFixed(0)}%)
                          </span>
                        </div>
                      </div>

                      <div className="sm:col-span-1 flex justify-end items-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveScale(scale.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descripción o Especificación Técnica
            </label>
            <textarea
              rows={2}
              placeholder="Especificaciones, material, compatibilidad..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white text-xs font-black rounded-xl transition inline-flex items-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>Guardar Producto</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
