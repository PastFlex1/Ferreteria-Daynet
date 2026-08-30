import React, { useState, useMemo } from 'react';
import { 
  Barcode, 
  Printer, 
  Sparkles, 
  Save, 
  Copy, 
  Check, 
  Layers, 
  Eye, 
  X, 
  Sliders, 
  RefreshCw,
  Search,
  Tag,
  DollarSign,
  MapPin,
  FileSpreadsheet
} from 'lucide-react';
import { Product, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { BarcodeSvg } from '../Shared/BarcodeSvg';
import { generateEan13Barcode, generateCode128Barcode, generateNumericBarcode } from '../../utils/barcodeGenerator';
import { useModal } from '../../context/ModalContext';
import { Select } from '../Shared/Select';

interface BarcodeLabelsManagerProps {
  products: Product[];
  settings: StoreSettings;
  onSaveProduct: (product: Product) => void;
}

type LabelFormatType = 'A4_24_LABELS' | 'A4_40_LABELS' | 'THERMAL_58MM' | 'THERMAL_80MM' | 'STICKER_50X30';

export const BarcodeLabelsManager: React.FC<BarcodeLabelsManagerProps> = ({
  products,
  settings,
  onSaveProduct,
}) => {
  const { showAlert, showToast } = useModal();

  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [productSearch, setProductSearch] = useState('');
  
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || products[0] || null;
  }, [products, selectedProductId]);

  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState<string>(
    selectedProduct?.barcode || selectedProduct?.sku || '78610001001'
  );

  // Label settings
  const [labelFormat, setLabelFormat] = useState<LabelFormatType>('A4_24_LABELS');
  const [quantity, setQuantity] = useState<number>(24);
  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showSku, setShowSku] = useState<boolean>(true);
  const [showLocation, setShowLocation] = useState<boolean>(true);
  const [showCategory, setShowCategory] = useState<boolean>(false);

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Handle product selection change
  const handleSelectProduct = (p: Product) => {
    setSelectedProductId(p.id);
    setBarcodeInput(p.barcode || p.sku || generateEan13Barcode('786'));
  };

  // Generate EAN-13 (Ecuador 786)
  const handleGenEan13 = () => {
    const code = generateEan13Barcode('786');
    setBarcodeInput(code);
    showToast('Código EAN-13 generado (Prefijo 786)', 'info');
  };

  // Generate Internal Store Code (200...)
  const handleGenInternal = () => {
    const code = generateEan13Barcode('200');
    setBarcodeInput(code);
    showToast('Código Interno generado (Prefijo 200)', 'info');
  };

  // Generate SKU-based Code128
  const handleGenFromSku = () => {
    const code = generateCode128Barcode(selectedProduct?.sku);
    setBarcodeInput(code);
    showToast('Código Alfanumérico generado basado en SKU', 'info');
  };

  // Generate Numeric
  const handleGenNumeric = () => {
    const code = generateNumericBarcode();
    setBarcodeInput(code);
    showToast('Código numérico generado', 'info');
  };

  // Save barcode to product
  const handleSaveToProduct = () => {
    if (!selectedProduct) {
      showAlert('Seleccione Producto', 'Debe seleccionar un producto primero.');
      return;
    }
    const cleanCode = barcodeInput.trim();
    if (!cleanCode) {
      showAlert('Código Vacío', 'Por favor ingrese o genere un código de barras.');
      return;
    }

    const updated: Product = {
      ...selectedProduct,
      barcode: cleanCode,
    };

    onSaveProduct(updated);
    showToast(`Código "${cleanCode}" guardado en "${selectedProduct.name}"`, 'success');
  };

  // Copy barcode to clipboard
  const handleCopyBarcode = () => {
    if (!barcodeInput) return;
    navigator.clipboard.writeText(barcodeInput);
    setIsCopied(true);
    showToast('Código copiado al portapapeles', 'info');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Filtered products for quick selector
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q) || 
      p.barcode.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const barcodeValue = barcodeInput.trim() || selectedProduct?.sku || '786000000000';

  // Render Single Label Item
  const renderLabelItem = (key?: number) => {
    if (!selectedProduct) return null;

    let containerStyle = 'p-2.5 w-[210px] min-h-[120px]';
    let barcodeHeight = 36;
    let barcodeWidth = 1.3;

    if (labelFormat === 'A4_40_LABELS' || labelFormat === 'STICKER_50X30') {
      containerStyle = 'p-2 w-[180px] min-h-[105px]';
      barcodeHeight = 28;
      barcodeWidth = 1.1;
    } else if (labelFormat === 'THERMAL_80MM') {
      containerStyle = 'p-3 w-[260px] min-h-[135px]';
      barcodeHeight = 44;
      barcodeWidth = 1.5;
    } else if (labelFormat === 'THERMAL_58MM') {
      containerStyle = 'p-2 w-[190px] min-h-[115px]';
      barcodeHeight = 32;
      barcodeWidth = 1.2;
    }

    return (
      <div
        key={key}
        className={`bg-white border-2 border-slate-900 rounded-xl flex flex-col justify-between items-center text-center shadow-xs ${containerStyle}`}
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        {/* Store Name Header */}
        {showStoreName && (
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-600 truncate w-full border-b border-slate-200 pb-0.5">
            {settings.storeName}
          </div>
        )}

        {/* Product Name + Unit of Measure */}
        <div className="text-[12px] font-black text-slate-950 leading-tight px-1 py-0.5 w-full flex items-center justify-center gap-1.5 flex-wrap">
          <span>{selectedProduct.name}</span>
          {selectedProduct.unit && (
            <span className="inline-block text-[9px] font-black font-mono uppercase px-1.5 py-0.5 rounded bg-slate-950 text-white tracking-wider shrink-0">
              {selectedProduct.unit}
            </span>
          )}
        </div>

        {/* Category & Location */}
        <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-slate-500 w-full">
          {showCategory && <span className="truncate">{selectedProduct.category}</span>}
          {showCategory && showLocation && selectedProduct.location && <span>•</span>}
          {showLocation && selectedProduct.location && (
            <span className="truncate bg-slate-100 px-1.5 py-0.5 rounded text-[8px] text-slate-700 font-mono font-bold">
              {selectedProduct.location}
            </span>
          )}
        </div>

        {/* Price Tag */}
        {showPrice && (
          <div className="text-sm font-black text-slate-950 font-mono tracking-tight my-0.5 flex items-center gap-1 justify-center">
            <span className="text-[10px] text-slate-500 font-bold">PVP:</span>
            <span className="text-orange-600 font-black text-base">
              {formatCurrency(selectedProduct.price, settings.currencySymbol)}
            </span>
          </div>
        )}

        {/* Real Barcode SVG */}
        <div className="w-full flex flex-col items-center justify-center bg-white pt-1 pb-0.5">
          <BarcodeSvg 
            value={barcodeValue}
            height={barcodeHeight}
            width={barcodeWidth}
            fontSize={9}
            displayValue={true}
            className="w-full"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
            <Barcode className="w-5 h-5 text-purple-600" />
            <span>Generador de Códigos de Barra & Impresión de Etiquetas</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Crea tus propios códigos de barra estándar (EAN-13, SKU, Code128) y genera planillas de etiquetas listas para perchas o estanterías.
          </p>
        </div>

        <button
          onClick={() => setIsPrintModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Printer className="w-4 h-4" />
          <span>Vista Previa & Imprimir Planilla</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        {/* Left Form Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* STEP 1: Seleccionar Producto */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] font-mono font-black">1</span>
                <span>Seleccionar Producto del Inventario</span>
              </span>
              <span className="text-[10px] text-slate-500 font-bold">{products.length} productos disponibles</span>
            </div>

            <Select
              value={selectedProductId}
              onChange={(e) => {
                const p = products.find((item) => item.id === e.target.value);
                if (p) handleSelectProduct(p);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl font-black text-xs focus:ring-2 focus:ring-orange-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit}) — [SKU: {p.sku || p.barcode || 'N/A'}] — {formatCurrency(p.price, settings.currencySymbol)}
                </option>
              ))}
            </Select>

            {selectedProduct && (
              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-bold">
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="block text-[9px] text-slate-400 font-extrabold uppercase">SKU</span>
                  <span className="font-mono text-orange-600 font-black truncate block">{selectedProduct.sku}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="block text-[9px] text-slate-400 font-extrabold uppercase">Categoría</span>
                  <span className="text-slate-800 truncate block">{selectedProduct.category}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="block text-[9px] text-slate-400 font-extrabold uppercase">Precio Venta</span>
                  <span className="font-mono text-emerald-600 font-black truncate block">
                    {formatCurrency(selectedProduct.price, settings.currencySymbol)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Crear / Generar Código de Barras Propio */}
          <div className="p-4 bg-purple-50/50 border border-purple-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                <span className="w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px] font-mono font-black">2</span>
                <span>Crear o Generar Código de Barras Propio</span>
              </span>
              <span className="text-[10px] text-purple-700 font-mono font-bold bg-purple-100 px-2 py-0.5 rounded-md">
                {barcodeValue.length} caracteres
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-800">
                Código de Barras Actual / Personalizado:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Escribe tu código personalizado (ej: 786123456789 o FERR-001)"
                  className="flex-1 px-3.5 py-2.5 bg-white border border-purple-300 font-mono text-purple-950 font-black rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleCopyBarcode}
                  className="px-3 py-2 bg-white hover:bg-purple-100 border border-purple-300 text-purple-800 font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                  title="Copiar código al portapapeles"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Quick Generator Buttons */}
            <div className="space-y-1.5 pt-1">
              <span className="block text-[10px] font-black uppercase tracking-wider text-purple-800">
                Generadores Automáticos con 1 Clic:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleGenEan13}
                  className="p-2 bg-white hover:bg-orange-50 border border-orange-200 text-orange-700 hover:text-orange-900 rounded-xl font-extrabold text-[10px] transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span>EAN-13 (Ecuador 786)</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenInternal}
                  className="p-2 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 hover:text-blue-900 rounded-xl font-extrabold text-[10px] transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                >
                  <Barcode className="w-3.5 h-3.5 text-blue-500" />
                  <span>Interno (Prefijo 200)</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenFromSku}
                  className="p-2 bg-white hover:bg-purple-50 border border-purple-200 text-purple-700 hover:text-purple-900 rounded-xl font-extrabold text-[10px] transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                >
                  <Tag className="w-3.5 h-3.5 text-purple-500" />
                  <span>Basado en SKU</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenNumeric}
                  className="p-2 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 hover:text-emerald-900 rounded-xl font-extrabold text-[10px] transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Numérico Simple</span>
                </button>
              </div>
            </div>

            {/* Save to product button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveToProduct}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar este Código de Barras en el Producto</span>
              </button>
            </div>
          </div>

          {/* STEP 3: Configuración de la Etiqueta e Impresión */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="w-5 h-5 bg-slate-800 text-white rounded-full flex items-center justify-center text-[10px] font-mono font-black">3</span>
              <span>Formato de Papel & Contenido de la Etiqueta</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Formato de Impresora / Papel</label>
                <Select
                  value={labelFormat}
                  onChange={(e) => setLabelFormat(e.target.value as LabelFormatType)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                >
                  <option value="A4_24_LABELS">Planilla A4 (24 Etiquetas por Hoja - 3x8)</option>
                  <option value="A4_40_LABELS">Planilla A4 Compacta (40 Etiquetas - 4x10)</option>
                  <option value="THERMAL_58MM">Rollo Térmico 58mm (Continua)</option>
                  <option value="THERMAL_80MM">Rollo Térmico 80mm (Ancha)</option>
                  <option value="STICKER_50X30">Adhesivo Individual (50x30mm)</option>
                </Select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cantidad de Copias a Generar</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-black text-center"
                  />
                  <div className="flex gap-1 flex-1">
                    {[1, 12, 24, 40].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuantity(q)}
                        className={`flex-1 py-1.5 rounded-lg font-mono font-bold text-[10px] border transition cursor-pointer ${
                          quantity === q
                            ? 'bg-orange-500 text-white border-orange-600 font-black'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Checkboxes for what to include on the label */}
            <div className="pt-2 border-t border-slate-200">
              <span className="block text-[10px] font-black uppercase text-slate-500 mb-2">
                Campos Visibles en la Etiqueta:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-xl border border-slate-200 hover:bg-slate-100/80">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400"
                  />
                  <span>Nombre Tienda</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-xl border border-slate-200 hover:bg-slate-100/80">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400"
                  />
                  <span>Precio de Venta</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-xl border border-slate-200 hover:bg-slate-100/80">
                  <input
                    type="checkbox"
                    checked={showLocation}
                    onChange={(e) => setShowLocation(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400"
                  />
                  <span>Ubicación Estante</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Preview Column (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="p-6 bg-gradient-to-b from-slate-100 to-slate-200/80 border border-slate-300 rounded-2xl flex-1 flex flex-col items-center justify-center space-y-4 shadow-inner">
            <div className="flex items-center justify-between w-full px-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-orange-600" />
                <span>Previsualización en Tiempo Real</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                100% Escaneable
              </span>
            </div>

            {/* Label Card Preview */}
            <div className="p-4 bg-slate-900/5 rounded-2xl border border-slate-300/60 shadow-lg flex items-center justify-center">
              {renderLabelItem()}
            </div>

            <div className="text-center space-y-1 max-w-xs">
              <p className="text-[11px] font-bold text-slate-700">
                Código generado: <span className="font-mono text-purple-700 font-black">{barcodeValue}</span>
              </p>
              <p className="text-[10px] text-slate-500 leading-tight">
                Compatible con lectores láser USB, inalámbricos y cámaras de smartphone para facturación rápida en POS.
              </p>
            </div>
          </div>

          {/* Action Print Button */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="w-full py-3.5 bg-slate-950 hover:bg-slate-900 text-orange-400 hover:text-orange-300 font-black rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg ring-1 ring-slate-800"
          >
            <Printer className="w-5 h-5 text-orange-500" />
            <span className="text-sm">Generar e Imprimir {quantity} Etiquetas</span>
          </button>
        </div>
      </div>

      {/* ── PRINT SHEET MODAL ────────────────────────────────────────────────── */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] ring-1 ring-slate-900/10">
            {/* Modal Actions Header */}
            <div className="px-6 py-4 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between no-print shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base tracking-tight">
                    Planilla de Impresión de Etiquetas ({quantity} copias)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedProduct?.name} — Cód: <span className="font-mono text-orange-400">{barcodeValue}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Ahora (Ctrl+P)</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Labels Container */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 custom-scrollbar">
              <div id="printable-labels" className="bg-white p-4 rounded-2xl border border-slate-300 shadow-sm mx-auto min-h-[500px]">
                <div className="flex flex-wrap gap-3 items-center justify-center">
                  {Array.from({ length: quantity }).map((_, index) => (
                    renderLabelItem(index)
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
