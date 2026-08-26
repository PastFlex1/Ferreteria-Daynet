import React, { useState, useMemo } from 'react';
import { Layers, Search, Plus, UploadCloud, Download, AlertTriangle, Boxes, BadgeDollarSign, TrendingUp, Filter, MapPin, ArrowUpDown, Edit3, Trash2 } from 'lucide-react';
import { Category, Product, ProductCategory, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { exportToModernExcel } from '../../utils/excelExport';
import { ProductModal } from './ProductModal';
import { BulkProductImporterModal } from './BulkProductImporterModal';
import { Select } from '../Shared/Select';

interface InventoryManagerProps {
  products: Product[];
  settings: StoreSettings;
  categories?: ProductCategory[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onStockAdjust: (productId: string, adjustmentQty: number) => void;
  units: any[];
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  settings,
  categories,
  onSaveProduct,
  onDeleteProduct,
  onStockAdjust,
  units,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [stockFilter, setStockFilter] = useState<'TODOS' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('TODOS');
  
  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Quick Stock Adjust State
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.location && p.location.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat = selectedCategory === 'TODAS' || p.category === selectedCategory;

      let matchesStock = true;
      if (stockFilter === 'LOW_STOCK') matchesStock = p.stock <= p.minStock && p.stock > 0;
      if (stockFilter === 'OUT_OF_STOCK') matchesStock = p.stock <= 0;

      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, searchTerm, selectedCategory, stockFilter]);

  // Inventory Totals
  const totalInventoryValue = useMemo(() => {
    return products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
  }, [products]);

  const totalRetailValue = useMemo(() => {
    return products.reduce((sum, p) => sum + p.price * p.stock, 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock <= p.minStock).length;
  }, [products]);

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const handleCreateClick = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    const qty = parseFloat(adjustQty) || 0;
    const finalQty = adjustType === 'ENTRADA' ? qty : -qty;
    onStockAdjust(adjustingProduct.id, finalQty);
    setAdjustingProduct(null);
  };

  const handleExportCSV = () => {
    const data = products.map((p) => {
      const taxRate = (typeof p.taxRate === 'number' ? p.taxRate : settings.defaultTaxRate) / 100;
      const priceWithTax = p.price * (1 + taxRate);
      const marginPct = p.costPrice > 0 ? (((p.price - p.costPrice) / p.costPrice) * 100).toFixed(0) : '100';

      return {
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        category: p.category,
        unit: p.unit,
        costPrice: p.costPrice,
        price: p.price,
        priceWithTax: priceWithTax,
        margin: `+${marginPct}%`,
        stock: p.stock,
        minStock: p.minStock,
        location: p.location || ''
      };
    });

    exportToModernExcel({
      filename: `Inventario_Ferreteria_${new Date().toLocaleDateString('en-CA')}.xlsx`,
      sheetName: 'Inventario',
      title: 'Reporte de Inventario',
      columns: [
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Cód. Barras', key: 'barcode', width: 20 },
        { header: 'Nombre / Descripción', key: 'name', width: 40 },
        { header: 'Categoría', key: 'category', width: 25 },
        { header: 'Unidad', key: 'unit', width: 10, format: 'center' },
        { header: 'Costo', key: 'costPrice', width: 15, format: 'currency' },
        { header: 'P. Venta (Sin IVA)', key: 'price', width: 15, format: 'currency' },
        { header: 'P. Venta (Con IVA)', key: 'priceWithTax', width: 15, format: 'currency' },
        { header: 'Margen', key: 'margin', width: 10, format: 'center' },
        { header: 'Stock Actual', key: 'stock', width: 15, format: 'center' },
        { header: 'Stock Min.', key: 'minStock', width: 15, format: 'center' },
        { header: 'Ubicación', key: 'location', width: 20 }
      ],
      data
    });
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Total Productos Registrados</span>
            <span className="text-2xl font-black text-slate-950 font-mono mt-0.5 block">{products.length}</span>
          </div>
          <div className="p-3 bg-slate-900 text-orange-400 rounded-xl border border-slate-800 shadow-2xs">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Valor Inversión (Costo)</span>
            <span className="text-xl font-black text-orange-600 font-mono mt-0.5 block">
              {formatCurrency(totalInventoryValue, settings.currencySymbol)}
            </span>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl border border-orange-200">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Valor Vitrina (Venta)</span>
            <span className="text-xl font-black text-emerald-600 font-mono mt-0.5 block">
              {formatCurrency(totalRetailValue, settings.currencySymbol)}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Alertas de Reposición</span>
            <span className="text-2xl font-black text-rose-600 font-mono mt-0.5 block">{lowStockCount}</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-5 space-y-4 shadow-sm">
        {/* Search & Actions Header */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Nombre, SKU, Código de Barras o Estante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter Dropdown */}
            <div className="w-48">
              <Select
                value={selectedCategory}
                onChange={(e: any) => setSelectedCategory(e.target.value)}
                className="bg-slate-100 border-slate-200 text-slate-800 text-xs font-bold"
              >
                <option value="TODAS">Todas las Categorías</option>
                {categories && categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Filter Low Stock Toggle */}
            <button
              onClick={() => setStockFilter(stockFilter === 'LOW_STOCK' ? 'TODOS' : 'LOW_STOCK')}
              className={`px-3 py-2 rounded-xl text-xs font-black border transition inline-flex items-center gap-1.5 cursor-pointer ${
                stockFilter === 'LOW_STOCK'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 shadow-2xs'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Stock Bajo ({lowStockCount})</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-black rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-orange-600" />
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-black rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <UploadCloud className="w-3.5 h-3.5 text-sky-600" />
              <span>Importar Excel / CSV</span>
            </button>

            <button
              onClick={handleCreateClick}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white text-xs font-black rounded-xl transition inline-flex items-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">SKU / Código</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-center">Unidad</th>
                <th className="py-3 px-4 text-right">Costo</th>
                <th className="py-3 px-4 text-right">P. Venta (Sin IVA)</th>
                <th className="py-3 px-4 text-right">P. Venta (Con IVA)</th>
                <th className="py-3 px-4 text-center">Margen</th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4 text-center">Ubicación</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <Layers className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                    <p className="font-semibold text-slate-600">No hay productos en esta búsqueda</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLowStock = p.stock <= p.minStock;
                  const isOutStock = p.stock <= 0;
                  const marginPct = p.costPrice > 0 ? (((p.price - p.costPrice) / p.costPrice) * 100).toFixed(0) : '100';
                  const taxRate = (typeof p.taxRate === 'number' ? p.taxRate : settings.defaultTaxRate) / 100;
                  const priceWithTax = p.price * (1 + taxRate);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition group">
                      <td className="py-3 px-4 font-mono font-bold text-slate-600">
                        {p.sku}
                        <span className="block text-[10px] text-slate-400 font-normal">{p.barcode}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-orange-600 max-w-xs">
                        {p.name}
                        {p.description && (
                          <span className="block text-[10px] text-slate-400 font-normal truncate">
                            {p.description}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: categories?.find(c => c.name === p.category)?.color || '#f97316' }}
                          />
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono">
                          {p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {formatCurrency(p.costPrice, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-orange-600">
                        {formatCurrency(p.price, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 bg-slate-50">
                        {formatCurrency(priceWithTax, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-mono font-bold border border-emerald-200">
                          +{marginPct}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isOutStock
                                ? 'text-rose-600'
                                : isLowStock
                                ? 'text-orange-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {p.stock}
                          </span>
                          {isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
                        </div>
                        <span className="text-[9px] text-slate-400 block">Min: {p.minStock}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500 text-[11px]">
                        {p.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                            <span>{p.location}</span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Stock Adjustment Trigger */}
                          <button
                            onClick={() => setAdjustingProduct(p)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-orange-600 rounded-lg text-xs transition cursor-pointer"
                            title="Ajustar Stock (Ingreso / Salida)"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Product */}
                          <button
                            onClick={() => handleEditClick(p)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-lg text-xs transition cursor-pointer"
                            title="Editar Producto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Product */}
                          <button
                            onClick={() => onDeleteProduct(p.id)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg text-xs transition cursor-pointer"
                            title="Eliminar Producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        productToEdit={editingProduct}
        onSaveProduct={onSaveProduct}
        units={units}
        categories={categories}
        defaultTaxRate={settings.defaultTaxRate}
      />

      {/* Bulk Product Importer Modal */}
      <BulkProductImporterModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        products={products}
        categories={categories}
        units={units}
        settings={settings}
        onSaveProduct={onSaveProduct}
      />

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-orange-500" />
              <span>Ajuste de Stock: {adjustingProduct.name}</span>
            </h3>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Movimiento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('ENTRADA')}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      adjustType === 'ENTRADA'
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    + Entrada de Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('SALIDA')}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      adjustType === 'SALIDA'
                        ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    - Salida / Pérdida
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cantidad ({adjustingProduct.unit})
                </label>
                <input
                  type="number"
                  step={adjustingProduct.allowFractional ? '0.1' : '1'}
                  min="0.1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-lg rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
                Stock Actual: <strong className="text-orange-600">{adjustingProduct.stock} {adjustingProduct.unit}</strong> →{' '}
                Nuevo Stock Estimado:{' '}
                <strong className="text-emerald-600 font-bold">
                  {Math.max(
                    0,
                    adjustingProduct.stock +
                      (adjustType === 'ENTRADA' ? parseFloat(adjustQty) || 0 : -(parseFloat(adjustQty) || 0))
                  )}{' '}
                  {adjustingProduct.unit}
                </strong>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
