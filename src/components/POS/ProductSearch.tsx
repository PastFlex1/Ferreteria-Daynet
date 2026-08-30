import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Scan, 
  Plus, 
  AlertCircle, 
  Layers, 
  Check, 
  Wrench, 
  Zap, 
  Droplet, 
  Paintbrush, 
  Hammer, 
  Key, 
  ShieldAlert, 
  Building2, 
  Grid, 
  List,
  Sparkles,
  Tag,
  LayoutGrid
} from 'lucide-react';
import { Category, Product, ProductCategory } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ProductSearchProps {
  products: Product[];
  categories?: ProductCategory[];
  onAddToCart: (product: Product, qty?: number) => void;
  currencySymbol: string;
  defaultTaxRate?: number;
}

const CATEGORIES: { name: 'TODAS' | Category; icon: React.ReactNode; color?: string }[] = [
  { name: 'TODAS', icon: <LayoutGrid className="w-3 h-3" /> },
  { name: 'Tornillería & Fijaciones', icon: <Wrench className="w-3 h-3" /> },
  { name: 'Herramientas Manuales', icon: <Hammer className="w-3 h-3" /> },
  { name: 'Herramientas Eléctricas', icon: <Zap className="w-3 h-3" /> },
  { name: 'Plomería & Gas', icon: <Droplet className="w-3 h-3" /> },
  { name: 'Electricidad & Iluminación', icon: <Zap className="w-3 h-3" />, color: '#f59e0b' },
  { name: 'Pinturas & Solventes', icon: <Paintbrush className="w-3 h-3" />, color: '#3b82f6' },
  { name: 'Materiales de Construcción', icon: <Building2 className="w-3 h-3" /> },
  { name: 'Cerrajería & Herrajes', icon: <Key className="w-3 h-3" /> },
  { name: 'Seguridad Industrial', icon: <ShieldAlert className="w-3 h-3" />, color: '#ef4444' },
];

export const ProductSearch: React.FC<ProductSearchProps> = ({
  products,
  categories,
  onAddToCart,
  currencySymbol,
  defaultTaxRate = 15,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'TODAS' | Category>('TODAS');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const dynamicCategories = useMemo(() => {
    const defaultList: { name: 'TODAS' | Category; icon: React.ReactNode; color?: string }[] = [
      { name: 'TODAS', icon: <LayoutGrid className="w-3 h-3" /> },
    ];
    if (categories && categories.length > 0) {
      const mapped = categories.map((c) => ({
        name: c.name,
        icon: <Tag className="w-3 h-3" style={{ color: c.color || '#f97316' }} />,
        color: c.color,
      }));
      return [...defaultList, ...mapped];
    }
    return defaultList;
  }, [categories]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { TODAS: products.length };
    products.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.location && product.location.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory =
        selectedCategory === 'TODAS' || product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Global Barcode Scanner Listener
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e || !e.key) return;
      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = '';
      }
      if (e.key === 'Enter' && barcodeBuffer.length > 2) {
        const scannedCode = barcodeBuffer.trim().toLowerCase();
        const foundProduct = products.find(p =>
          (p.sku && p.sku.toLowerCase() === scannedCode) ||
          (p.barcode && p.barcode.toLowerCase() === scannedCode)
        );
        if (foundProduct) {
          handleAddClick(foundProduct);
          setSearchTerm('');
        } else {
          setSearchTerm(scannedCode);
        }
        barcodeBuffer = '';
        e.stopPropagation();
        e.preventDefault();
      } else if (typeof e.key === 'string' && e.key.length === 1) {
        barcodeBuffer += e.key;
      }
      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [products]);

  const handleAddClick = (product: Product) => {
    onAddToCart(product);
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 600);
  };

  const handleSimulateScan = () => {
    if (products.length === 0) return;
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    setSearchTerm(randomProduct.barcode);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/90 ring-1 ring-slate-200/50 p-4 sm:p-5 space-y-3 shadow-sm">
      {/* Search Header & Actions */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por Nombre, SKU, Código de Barras o Estante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchTerm) {
                const exactMatch = products.find(p =>
                  p.sku.toLowerCase() === searchTerm.toLowerCase() ||
                  p.barcode.toLowerCase() === searchTerm.toLowerCase()
                );
                if (exactMatch) {
                  handleAddClick(exactMatch);
                  setSearchTerm('');
                } else if (filteredProducts.length === 1) {
                  handleAddClick(filteredProducts[0]);
                  setSearchTerm('');
                }
              }
            }}
            className="w-full pl-10 pr-16 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition shadow-2xs font-medium"
            autoFocus
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 font-bold cursor-pointer transition"
            >
              Limpiar
            </button>
          ) : (
            <span className="hidden md:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded border border-slate-300">
              ⌘K
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleSimulateScan}
            title="Simular Lectura de Escáner Laser"
            className="flex items-center space-x-2 px-3.5 py-2.5 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border border-orange-200/80 text-orange-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <Scan className="w-4 h-4 text-orange-600 animate-pulse" />
            <span className="hidden sm:inline">Escanear</span>
          </button>

          <div className="flex bg-slate-100 border border-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'GRID' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista de Tarjetas"
            >
              <Grid className="w-3.5 h-3.5 text-orange-500" />
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista de Lista"
            >
              <List className="w-3.5 h-3.5 text-orange-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Pills — horizontal scrollable strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar shrink-0">
        {dynamicCategories.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          const count = categoryCounts[cat.name] || 0;
          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition whitespace-nowrap cursor-pointer shrink-0 border ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm border-slate-800'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 border-slate-200/60 hover:border-slate-300'
              }`}
            >
              <span className={isSelected ? 'text-orange-400' : 'text-slate-400'}>
                {cat.icon}
              </span>
              <span className="hidden sm:inline">{cat.name === 'TODAS' ? 'Todos' : cat.name}</span>
              <span className="sm:hidden">{cat.name === 'TODAS' ? 'Todo' : cat.name.split(' ')[0]}</span>
              <span
                className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full ${
                  isSelected ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Products Grid or List */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <Layers className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No hay coincidencias en el catálogo</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Prueba con otro código SKU, nombre o cambia la categoría.
            </p>
          </div>
        ) : viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProducts.map((product) => {
              const isLowStock = product.stock <= product.minStock;
              const isOutStock = product.stock <= 0;
              const isJustAdded = addedProductId === product.id;
              const stockMax = Math.max(product.minStock * 3, 20);
              const stockPct = Math.min(100, Math.max(0, (product.stock / stockMax) * 100));
              const taxRate = typeof product.taxRate === 'number' ? product.taxRate : defaultTaxRate;
              const priceWithTax = product.price * (1 + taxRate / 100);

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutStock && handleAddClick(product)}
                  className={`group relative bg-white border rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md ${
                    isOutStock
                      ? 'border-slate-200 opacity-60 pointer-events-none'
                      : isLowStock
                      ? 'border-amber-300/80 hover:border-orange-500 ring-1 ring-amber-200/60'
                      : 'border-slate-200/80 hover:border-orange-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
                        {product.sku}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200/80">
                        {product.unit}
                      </span>
                    </div>

                    <h3 className="text-xs font-black text-slate-900 group-hover:text-orange-600 transition line-clamp-2 mb-1.5 leading-snug">
                      {product.name}
                    </h3>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                      <span className="font-medium truncate">{product.category}</span>
                      {product.location && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {product.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div>
                      <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                        <span className="text-slate-400 uppercase">Stock:</span>
                        <span className={`flex items-center gap-1 font-mono ${
                          isOutStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {isLowStock && <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse" />}
                          <span>{product.stock} {product.unit}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOutStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${stockPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-end justify-between pt-0.5">
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[9px] uppercase font-extrabold text-slate-400 block">P.V.P (con IVA)</span>
                          {taxRate > 0 ? (
                            <span className="text-[8px] font-bold text-orange-700 bg-orange-100/80 px-1 rounded border border-orange-200/90">
                              {taxRate}% IVA
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold text-emerald-700 bg-emerald-100/80 px-1 rounded border border-emerald-200/90">
                              0% IVA
                            </span>
                          )}
                        </div>
                        <div className="text-base font-black text-slate-900 font-mono tracking-tight">
                          {formatCurrency(priceWithTax, currencySymbol)}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Sin IVA: {formatCurrency(product.price, currencySymbol)}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddClick(product);
                        }}
                        disabled={isOutStock}
                        className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shadow-sm ${
                          isJustAdded
                            ? 'bg-emerald-500 text-white scale-105'
                            : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-orange-500/20'
                        }`}
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>¡Listo!</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Añadir</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/80 text-slate-600 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3 text-center">Unidad</th>
                  <th className="py-3 px-3 text-center">Stock</th>
                  <th className="py-3 px-3 text-right">Precio (con IVA)</th>
                  <th className="py-3 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProducts.map((product) => {
                  const isLowStock = product.stock <= product.minStock;
                  const taxRate = typeof product.taxRate === 'number' ? product.taxRate : defaultTaxRate;
                  const priceWithTax = product.price * (1 + taxRate / 100);

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50 transition group cursor-pointer"
                      onClick={() => onAddToCart(product)}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{product.sku}</td>
                      <td className="py-2.5 px-3 font-black text-slate-900 group-hover:text-orange-600">
                        {product.name}
                        {product.location && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            Ubicación: {product.location}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-medium">{product.category}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold">
                          {product.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-mono font-bold ${isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-black text-slate-900 text-sm">
                          {formatCurrency(priceWithTax, currencySymbol)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Sin IVA: {formatCurrency(product.price, currencySymbol)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(product);
                          }}
                          className="px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-white font-black rounded-xl text-xs transition inline-flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Añadir</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
