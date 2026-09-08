import React, { useState, useEffect, useMemo } from 'react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { CustomSelect } from '../CustomSelect';
import { 
  Package, 
  Tag, 
  Scale, 
  TrendingUp, 
  Calendar, 
  RefreshCw, 
  Sliders, 
  ArrowLeftRight, 
  Barcode, 
  ClipboardList, 
  ClipboardCheck, 
  UploadCloud, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Boxes, 
  DollarSign, 
  FileSpreadsheet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Check, 
  X,
  Save,
  Minus,
  Layers,
  Percent,
  RotateCcw,
  FileText
} from 'lucide-react';
import { InventorySubTab, Product, ProductCategory, Promotion, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { InventoryManager } from './InventoryManager';
import { BarcodeLabelsManager } from './BarcodeLabelsManager';
import { BulkProductImporterModal } from './BulkProductImporterModal';
import { KardexManager } from './KardexManager';
import { Select } from '../Shared/Select';
import { useModal } from '../../context/ModalContext';
import { defaultCategories } from '../../data/initialData';
import { downloadTomaFisicaPdf, PhysicalInventoryPdfItem } from '../../utils/tomaFisicaPdfGenerator';

interface InventoryModuleViewProps {
  subTab: InventorySubTab;
  products: Product[];
  settings: StoreSettings;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onStockAdjust: (productId: string, adjustmentQty: number) => void;
  onBulkImportProducts?: (products: Product[]) => void;
  units: any[];
  onUpdateUnits: (units: any[]) => void;
  categories?: ProductCategory[];
  onUpdateCategories?: (categories: ProductCategory[]) => void;
}

// Promotion type is imported from '../../types'

// Sample Unit of Measure
interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  symbol: string;
  baseRatio: number; // e.g. 1 Box = 24 Units
  category: 'PESO' | 'LONGIT' | 'VOLUMEN' | 'CANTIDAD' | 'EMPAQUE';
}



// Batch / Expiry
interface ProductBatch {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  location: string;
  status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
}

// Warehouse Transfer
interface StockTransfer {
  id: string;
  code: string;
  date: string;
  originStore: string;
  destinationStore: string;
  itemCount: number;
  status: 'PENDIENTE' | 'EN_TRANSITO' | 'COMPLETADA' | 'CANCELADA';
  responsible: string;
}

// Physical Count Audit Item
interface AuditItem {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  category: string;
  location?: string;
  unit?: string;
  systemStock: number;
  physicalStock: number | '';
  diff: number;
  unitCost: number;
}

export const InventoryModuleView: React.FC<InventoryModuleViewProps> = ({
  subTab,
  products,
  settings,
  onSaveProduct,
  onDeleteProduct,
  onStockAdjust,
  onBulkImportProducts,
  units,
  onUpdateUnits,
  categories,
  onUpdateCategories
}) => {
  const { showAlert, showToast, showConfirm } = useModal();
  const currentCategories = categories || [];
  const [searchTerm, setSearchTerm] = useState('');

  // Categorias State
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<{
    name: string;
    description: string;
    color: string;
  }>({
    name: '',
    description: '',
    color: '#f97316'
  });

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({
      name: '',
      description: '',
      color: '#f97316'
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: ProductCategory) => {
    setEditingCategory(cat);
    setCategoryFormData({
      name: cat.name,
      description: cat.description || '',
      color: cat.color || '#f97316'
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = categoryFormData.name.trim();
    if (!cleanName) {
      showAlert('Nombre Requerido', 'Por favor ingrese el nombre de la categoría.');
      return;
    }

    const isDuplicate = currentCategories.some(
      (c) => c.name.toLowerCase() === cleanName.toLowerCase() && c.id !== editingCategory?.id
    );

    if (isDuplicate) {
      showAlert('Categoría Duplicada', `Ya existe una categoría con el nombre "${cleanName}".`);
      return;
    }

    let updatedList: ProductCategory[];
    if (editingCategory) {
      const oldName = editingCategory.name;
      updatedList = currentCategories.map((c) =>
        c.id === editingCategory.id
          ? {
              ...c,
              name: cleanName,
              description: categoryFormData.description.trim() || undefined,
              color: categoryFormData.color
            }
          : c
      );

      // Sincronizar productos asociados si el nombre cambió
      if (oldName !== cleanName) {
        products.forEach((p) => {
          if (p.category === oldName) {
            onSaveProduct({
              ...p,
              category: cleanName
            });
          }
        });
      }
      showToast('Categoría actualizada exitosamente.', 'success');
    } else {
      const newCat: ProductCategory = {
        id: `cat-${Date.now()}`,
        name: cleanName,
        description: categoryFormData.description.trim() || undefined,
        color: categoryFormData.color
      };
      updatedList = [...currentCategories, newCat];
      showToast('Categoría creada exitosamente.', 'success');
    }

    if (onUpdateCategories) {
      onUpdateCategories(updatedList);
    }
    setIsCategoryModalOpen(false);
  };

  const handleDeleteCategory = (cat: ProductCategory) => {
    const productsInCat = products.filter((p) => p.category === cat.name).length;
    if (productsInCat > 0) {
      showAlert(
        'Atención',
        `Hay ${productsInCat} producto(s) en tu inventario con la categoría "${cat.name}". Si la eliminas, esos productos conservarán el nombre pero la categoría ya no figurará en la lista general.`
      );
    }

    const updatedList = currentCategories.filter((c) => c.id !== cat.id);
    if (onUpdateCategories) {
      onUpdateCategories(updatedList);
    }
    showToast(`Categoría "${cat.name}" eliminada correctamente.`, 'info');
  };

  const filteredCategories = React.useMemo(() => {
    return currentCategories.filter((c) =>
      c.name.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(categorySearchTerm.toLowerCase()))
    );
  }, [currentCategories, categorySearchTerm]);

  const categoryWithMostProducts = React.useMemo(() => {
    if (currentCategories.length === 0) return '-';
    let maxCat = currentCategories[0].name;
    let maxCount = 0;
    currentCategories.forEach((c) => {
      const count = products.filter((p) => p.category === c.name).length;
      if (count > maxCount) {
        maxCount = count;
        maxCat = c.name;
      }
    });
    return maxCount > 0 ? `${maxCat} (${maxCount})` : currentCategories[0].name;
  }, [currentCategories, products]);

  // 1. Promociones State (persisted in Firestore so POS can read them)
  const [promotions, setPromotions] = useFirestoreSync<Promotion[]>('ferreteria_promotions', []);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [newPromo, setNewPromo] = useState<Partial<Promotion>>({
    code: '',
    name: '',
    discountPercent: 10,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '2026-12-31',
    status: 'ACTIVA',
    minQuantity: 1,
    appliedCategory: 'Herramientas Manuales'
  });

  // 2. Unidades de Medida State removed in favor of global props
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [newUnit, setNewUnit] = useState<any>({
    code: '',
    name: '',
    symbol: '',
    baseRatio: 1,
    category: 'CANTIDAD'
  });

  // 3. Lotes & Vencimientos State
  const [batches, setBatches] = useFirestoreSync<ProductBatch[]>('ferreteria_product_batches', []);

  // 5. Cambio de Precio Masivo State
  const [selectedCategoryForPrice, setSelectedCategoryForPrice] = useState('TODAS');
  const [priceAdjustType, setPriceAdjustType] = useState<'PORCENTAJE_AUMENTO' | 'PORCENTAJE_DESCUENTO' | 'FIJO'>('PORCENTAJE_AUMENTO');
  const [priceAdjustValue, setPriceAdjustValue] = useState('');
  const [priceChangeSuccessMsg, setPriceChangeSuccessMsg] = useState<string | null>(null);

  // 6. Ajuste de Stock Formal State
  const [adjustProductId, setAdjustProductId] = useState(products[0]?.id || '');
  const [adjustQtyVal, setAdjustQtyVal] = useState('');
  const [adjustTypeReason, setAdjustTypeReason] = useState<'ENTRADA_COMPRA' | 'ENTRADA_DEVOLUCION' | 'SALIDA_MERMA' | 'SALIDA_ROBO' | 'CORRECCION'>('CORRECCION');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustHistory, setAdjustHistory] = useState<{ id: string; date: string; product: string; qty: number; reason: string; user: string; }[]>([]);

  // Interactive Multi-Product Stock Adjustment Rows State (matching image design)
  const [adjustRows, setAdjustRows] = useState<{
    productId: string;
    sku: string;
    name: string;
    category?: string;
    currentStock: number;
    newStock: number;
  }[]>([]);
  const [adjustSearch, setAdjustSearch] = useState('');
  const [isAdjustSearchOpen, setIsAdjustSearchOpen] = useState(false);

  const handleAddProductToAdjustRows = (p: Product) => {
    if (adjustRows.some((r) => r.productId === p.id)) {
      showToast(`El producto "${p.name}" ya fue agregado a la tabla.`, 'info');
      setAdjustSearch('');
      setIsAdjustSearchOpen(false);
      return;
    }
    setAdjustRows((prev) => [
      ...prev,
      {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        currentStock: p.stock,
        newStock: p.stock,
      },
    ]);
    setAdjustSearch('');
    setIsAdjustSearchOpen(false);
  };

  const handleRemoveAdjustRow = (productId: string) => {
    setAdjustRows((prev) => prev.filter((r) => r.productId !== productId));
  };

  const handleUpdateAdjustRowStock = (productId: string, val: number) => {
    setAdjustRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, newStock: val } : r))
    );
  };

  const handleSaveBatchAdjust = () => {
    if (adjustRows.length === 0) {
      showToast('Agregue al menos un producto para guardar el ajuste de stock.', 'warning');
      return;
    }

    let modifiedCount = 0;
    const newHistoryEntries: any[] = [];

    adjustRows.forEach((r) => {
      const diff = r.newStock - r.currentStock;
      if (diff !== 0) {
        onStockAdjust(r.productId, diff);
        modifiedCount++;
        newHistoryEntries.push({
          id: `adj-${Date.now()}-${Math.random()}`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          product: r.name,
          qty: diff,
          reason: `Ajuste manual de stock (${r.currentStock} ➔ ${r.newStock})`,
          user: 'Administrador POS',
        });
      }
    });

    if (newHistoryEntries.length > 0) {
      setAdjustHistory((prev) => [...newHistoryEntries, ...prev]);
    }

    showToast(
      modifiedCount > 0
        ? `¡Ajuste de stock guardado exitosamente! (${modifiedCount} productos actualizados)`
        : 'Registro guardado sin cambios en existencias.',
      'success'
    );
    setAdjustRows([]);
  };

  // 7. Transferencias State
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [newTransfer, setNewTransfer] = useState({
    origin: 'Bodega Central Norte',
    destination: 'Sucursal Centro POS',
    responsible: 'Administrador'
  });

  // 8. Etiquetas & Códigos de Barra managed by BarcodeLabelsManager
  // 9. Kardex managed by KardexManager

  // 10. Toma Física Audit State
  const [selectedAuditCategory, setSelectedAuditCategory] = useState<string>('TODAS');
  const [auditSearchTerm, setAuditSearchTerm] = useState<string>('');
  const [auditorName, setAuditorName] = useState<string>('');
  const [auditSuccessMsg, setAuditSuccessMsg] = useState<string | null>(null);
  const [auditItems, setAuditItems] = useState<AuditItem[]>(() =>
    products.map((p) => ({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      location: p.location,
      unit: p.unit,
      systemStock: p.stock,
      physicalStock: p.stock,
      diff: 0,
      unitCost: p.costPrice || 0
    }))
  );

  // Sync if products load asynchronously
  useEffect(() => {
    if (auditItems.length === 0 && products.length > 0) {
      setAuditItems(
        products.map((p) => ({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category,
          location: p.location,
          unit: p.unit,
          systemStock: p.stock,
          physicalStock: p.stock,
          diff: 0,
          unitCost: p.costPrice || 0
        }))
      );
    }
  }, [products]);

  // Set all physical counts blank for manual entry from printed sheet
  const handleSetAuditBlank = () => {
    setAuditItems(prev => prev.map(item => ({
      ...item,
      physicalStock: '',
      diff: 0
    })));
    showToast('Los campos de conteo físico están ahora en blanco para ingresar manualmente.', 'info');
  };

  // Pre-fill physical counts with current system stock
  const handleResetAuditToSystem = () => {
    setAuditItems(prev => prev.map(item => ({
      ...item,
      physicalStock: item.systemStock,
      diff: 0
    })));
    showToast('Conteos físicos restablecidos al stock actual del sistema.', 'info');
  };

  // Reload products according to category
  const handleReloadAuditProducts = (category: string = selectedAuditCategory) => {
    const list = category === 'TODAS' ? products : products.filter(p => p.category === category);
    setAuditItems(list.map(p => ({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      location: p.location,
      unit: p.unit,
      systemStock: p.stock,
      physicalStock: p.stock,
      diff: 0,
      unitCost: p.costPrice || 0
    })));
    showToast(`Se cargaron ${list.length} productos en la lista de auditoría.`, 'info');
  };

  // Filtered audit items for display
  const filteredAuditItems = useMemo(() => {
    return auditItems.filter(item => {
      const matchesCat = selectedAuditCategory === 'TODAS' || item.category === selectedAuditCategory;
      if (!matchesCat) return false;
      if (!auditSearchTerm.trim()) return true;
      const q = auditSearchTerm.toLowerCase();
      return (
        item.productName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q))
      );
    });
  }, [auditItems, selectedAuditCategory, auditSearchTerm]);

  // Metrics summary
  const auditMetrics = useMemo(() => {
    let totalCounted = 0;
    let pendingCount = 0;
    let surplusCount = 0;
    let deficitCount = 0;
    let matchingCount = 0;
    let totalFinancialImpact = 0;

    auditItems.forEach(item => {
      if (item.physicalStock === '') {
        pendingCount++;
      } else {
        totalCounted++;
        const diff = Number(item.physicalStock) - item.systemStock;
        totalFinancialImpact += diff * item.unitCost;
        if (diff > 0) surplusCount++;
        else if (diff < 0) deficitCount++;
        else matchingCount++;
      }
    });

    return {
      totalItems: auditItems.length,
      totalCounted,
      pendingCount,
      surplusCount,
      deficitCount,
      matchingCount,
      totalFinancialImpact
    };
  }, [auditItems]);

  // 11. Cargar Productos Bulk CSV State
  const [rawCsvProducts, setRawCsvProducts] = useState('');
  const [parsedProductsPreview, setParsedProductsPreview] = useState<
    { product: Product; isValid: boolean; error?: string }[]
  >([]);
  const [importProductsSuccess, setImportProductsSuccess] = useState<string | null>(null);

  // Exec price change
  const handleExecutePriceChange = () => {
    const val = parseFloat(priceAdjustValue) || 0;
    if (val === 0) return;

    products.forEach((p) => {
      if (selectedCategoryForPrice === 'TODAS' || p.category === selectedCategoryForPrice) {
        let newPrice = p.price;
        if (priceAdjustType === 'PORCENTAJE_AUMENTO') {
          newPrice = p.price * (1 + val / 100);
        } else if (priceAdjustType === 'PORCENTAJE_DESCUENTO') {
          newPrice = Math.max(0, p.price * (1 - val / 100));
        } else {
          newPrice = val;
        }

        onSaveProduct({
          ...p,
          price: Math.round(newPrice * 100) / 100
        });
      }
    });

    setPriceChangeSuccessMsg(`¡Precios actualizados exitosamente para la categoría [${selectedCategoryForPrice}]!`);
  };

  // Submit Formal Adjust
  const handleSaveFormalAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    const p = products.find((prod) => prod.id === adjustProductId);
    if (!p) return;

    const qty = parseFloat(adjustQtyVal) || 0;
    const isOut = adjustTypeReason.startsWith('SALIDA');
    const finalChange = isOut ? -qty : qty;

    onStockAdjust(p.id, finalChange);

    setAdjustHistory([
      {
        id: `adj-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        product: p.name,
        qty: finalChange,
        reason: `${adjustTypeReason} (${adjustNotes || 'Sin nota'})`,
        user: 'Administrador POS'
      },
      ...adjustHistory
    ]);

    setAdjustNotes('');
    setAdjustQtyVal('10');
  };

  // Download PDF Planilla for Manual Counting
  const handleDownloadTomaFisicaPdf = () => {
    const sourceItems = filteredAuditItems.length > 0 ? filteredAuditItems : auditItems;

    if (sourceItems.length === 0) {
      showAlert('No hay productos disponibles para exportar en la planilla de toma física.', 'Atención', 'warning');
      return;
    }

    const itemsForPdf: PhysicalInventoryPdfItem[] = sourceItems.map(it => ({
      sku: it.sku,
      barcode: it.barcode,
      name: it.productName,
      category: it.category,
      location: it.location,
      unit: it.unit,
      systemStock: it.systemStock,
    }));

    downloadTomaFisicaPdf(itemsForPdf, settings, {
      categoryFilter: selectedAuditCategory === 'TODAS' ? 'Todas las Categorías' : selectedAuditCategory,
      auditorName: auditorName || undefined,
    });

    showToast(`Planilla PDF descargada (${itemsForPdf.length} productos) con recuadro en blanco para conteo manual.`, 'success');
  };

  // Execute Physical Audit Adjustment
  const handleApplyPhysicalAudit = () => {
    const itemsToAdjust = auditItems.filter(
      item => item.physicalStock !== '' && item.diff !== 0
    );

    if (itemsToAdjust.length === 0) {
      showAlert('No hay discrepancias registradas entre el conteo físico y el sistema para ajustar.', 'Sin Diferencias', 'info');
      return;
    }

    showConfirm(
      `Se ajustarán ${itemsToAdjust.length} productos que presentan discrepancias entre el conteo físico y el sistema.\n\n¿Desea aplicar los ajustes al inventario real?`,
      () => {
        let adjustedCount = 0;
        itemsToAdjust.forEach((item) => {
          onStockAdjust(item.productId, item.diff);
          adjustedCount++;
        });

        // Update local items so systemStock now matches physicalStock
        setAuditItems(prev => prev.map(item => {
          if (item.physicalStock !== '' && item.diff !== 0) {
            const newStock = Number(item.physicalStock);
            return {
              ...item,
              systemStock: newStock,
              diff: 0
            };
          }
          return item;
        }));

        showToast(`¡Ajuste de inventario aplicado! Se corrigieron ${adjustedCount} productos en el sistema.`, 'success');
        setAuditSuccessMsg(`¡Auditoría aplicada exitosamente! Se corrigieron las existencias de ${adjustedCount} productos.`);
      },
      'Confirmar Ajuste de Auditoría Física',
      'Sí, Aplicar Ajustes',
      'Cancelar'
    );
  };

  // CSV Importer for Products
  const handleDownloadProductCsvTemplate = () => {
    const header = "sku,barcode,name,category,price,costPrice,stock,minStock,unit,location\n";
    const sample = [
      "STAN-1002,786100029301,Martillo Stanley 16oz Uña Recta,Herramientas Manuales,18.50,12.00,45,10,Unidad,Estante A-01",
      "HOLC-50KG,786100029302,Cemento Holcim Fuerte 50kg,Construcción,8.75,7.10,200,50,Saco,Bodega B-02",
      "TUB-PVC3,786100029303,Tubo PVC Sanitaria 3 Pulgadas,Plomería y Tubos,12.00,8.50,80,20,Metro,Estante C-10"
    ].join("\n");

    const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Plantilla_Productos_Ferreteria.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleParseProductsCsv = (text: string) => {
    setRawCsvProducts(text);
    if (!text.trim()) {
      setParsedProductsPreview([]);
      return;
    }

    const lines = text.trim().split('\n');
    const previewList: { product: Product; isValid: boolean; error?: string }[] = [];
    const startIndex = lines[0].toLowerCase().includes('sku') || lines[0].toLowerCase().includes('nombre') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 4) {
        previewList.push({
          product: {
            id: `temp-${i}`,
            sku: cols[0] || 'SKU-00',
            barcode: cols[1] || '00000',
            name: line,
            category: 'Herramientas Manuales' as any,
            price: 1,
            costPrice: 0.5,
            stock: 10,
            minStock: 2,
            unit: units && units.length > 0 ? units[0].code : 'UND',
            taxRate: settings.defaultTaxRate,
            allowFractional: false
          },
          isValid: false,
          error: 'Columnas insuficientes (se requiere al menos SKU, Nombre, Categoria, Precio)'
        });
        continue;
      }

      const sku = cols[0];
      const barcode = cols[1] || sku;
      const name = cols[2];
      const category = (cols[3] || 'Herramientas Manuales') as any;
      const price = parseFloat(cols[4]) || 0;
      const costPrice = parseFloat(cols[5]) || (price * 0.7);
      const stock = parseFloat(cols[6]) || 0;
      const minStock = parseFloat(cols[7]) || 5;
      const unit = cols[8] || (units && units.length > 0 ? units[0].code : 'UND');
      const location = cols[9] || 'Estante A-1';

      const isDuplicate = products.some((p) => p.sku === sku);
      const isValid = Boolean(sku && name && price > 0);

      previewList.push({
        product: {
          id: `imp-${Date.now()}-${i}`,
          sku,
          barcode,
          name,
          category,
          price,
          costPrice,
          stock,
          minStock,
          unit,
          location,
          taxRate: settings.defaultTaxRate,
          allowFractional: false
        },
        isValid: isValid && !isDuplicate,
        error: isDuplicate ? 'SKU ya registrado' : (!isValid ? 'Datos inválidos' : undefined)
      });
    }

    setParsedProductsPreview(previewList);
  };

  const handleExecuteProductImport = () => {
    const valids = parsedProductsPreview.filter((p) => p.isValid).map((p) => p.product);
    if (valids.length === 0) return;

    if (onBulkImportProducts) {
      onBulkImportProducts(valids);
    } else {
      valids.forEach((p) => onSaveProduct(p));
    }

    setImportProductsSuccess(`¡Se importaron ${valids.length} productos correctamente al catálogo!`);
    setRawCsvProducts('');
    setParsedProductsPreview([]);
  };

  // Switch Subtabs
  if (subTab === 'INVENTARIO') {
    return (
      <InventoryManager
        products={products}
        settings={settings}
        categories={currentCategories}
        onSaveProduct={onSaveProduct}
        onDeleteProduct={onDeleteProduct}
        onStockAdjust={onStockAdjust}
        units={units}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------
          SUBTAB 1.5: CATEGORIAS (Gestión de Categorías)
         --------------------------------------------------------------------- */}
      {subTab === 'CATEGORIAS' && (
        <div className="space-y-6">
          {/* Top Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Total Categorías</span>
                <span className="text-2xl font-black text-slate-950 font-mono mt-0.5 block">{currentCategories.length}</span>
              </div>
              <div className="p-3 bg-slate-900 text-amber-400 rounded-xl border border-slate-800 shadow-2xs">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Productos Registrados</span>
                <span className="text-2xl font-black text-emerald-600 font-mono mt-0.5 block">{products.length}</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                <Boxes className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Categoría con Mayor Stock</span>
                <span className="text-sm font-black text-slate-900 mt-1 block truncate max-w-[200px]" title={categoryWithMostProducts}>
                  {categoryWithMostProducts}
                </span>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Main Card Container */}
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-500" />
                  <span>Gestor de Categorías de Productos</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Agrega, edita o elimina las categorías de tu inventario para organizar tu catálogo y terminal POS.
                </p>
              </div>

              <button
                onClick={handleOpenCreateCategory}
                className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Nueva Categoría</span>
              </button>
            </div>

            {/* Search filter */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar categoría por nombre o descripción..."
                value={categorySearchTerm}
                onChange={(e) => setCategorySearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              />
            </div>

            {/* Categories Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Color / Tag</th>
                    <th className="py-3 px-4">Nombre de Categoría</th>
                    <th className="py-3 px-4">Descripción</th>
                    <th className="py-3 px-4 text-center">Productos Asociados</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <Layers className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                        <p className="font-semibold text-slate-600">No se encontraron categorías registradas</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat) => {
                      const prodCount = products.filter((p) => p.category === cat.name).length;
                      return (
                        <tr key={cat.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-4 h-4 rounded-full shadow-2xs border border-black/10 shrink-0"
                                style={{ backgroundColor: cat.color || '#f97316' }}
                              />
                              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">
                                {cat.color || '#f97316'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900 text-xs">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-800 border border-slate-200">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color || '#f97316' }}
                              />
                              {cat.name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-sm">
                            {cat.description || <span className="text-slate-400 italic">Sin descripción</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                              <Boxes className="w-3 h-3 text-amber-600" />
                              {prodCount} productos
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditCategory(cat)}
                                title="Editar Categoría"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4 text-slate-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat)}
                                title="Eliminar Categoría"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 2: PROMOCIONES
         --------------------------------------------------------------------- */}
      {subTab === 'PROMOCIONES' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Tag className="w-5 h-5 text-pink-500" />
                <span>Gestor de Ofertas & Promociones</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configura campañas de descuento por porcentaje, combos o volúmenes de compra.
              </p>
            </div>

            <button
              onClick={() => setIsPromoModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Promoción</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código / Nombre</th>
                  <th className="py-3 px-4">Aplica A (Producto / Alcance)</th>
                  <th className="py-3 px-4 text-center">Descuento</th>
                  <th className="py-3 px-4 text-center">Min. Cantidad</th>
                  <th className="py-3 px-4 text-center">Vigencia</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {promotions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-black text-slate-900">
                      <span className="font-mono text-orange-600 text-[11px] block">{p.code}</span>
                      {p.name}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-700">
                      {p.productName ? (
                        <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                          📦 {p.productName}
                        </span>
                      ) : p.appliedCategory && p.appliedCategory !== 'TODOS' ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                          📁 Categoría: {p.appliedCategory}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          🌐 Todos los Productos
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-emerald-600 text-sm">
                      {p.discountPercent}% OFF
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">{p.minQuantity} u.</td>
                    <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-600">
                      {p.startDate} al {p.endDate}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          p.status === 'ACTIVA'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setPromotions(promotions.filter((item) => item.id !== p.id))}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                        title="Eliminar Promoción"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Promo Modal */}
          {isPromoModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl my-auto">
                <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-orange-500" />
                  <span>Crear Nueva Campaña Promocional</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-black text-slate-800 mb-1">Producto Específico (Opcional)</label>
                    <Select
                      value={newPromo.productId || ''}
                      onChange={(e) => {
                        const pid = e.target.value;
                        if (pid) {
                          const selectedProd = products.find((p) => p.id === pid);
                          if (selectedProd) {
                            setNewPromo({
                              ...newPromo,
                              productId: selectedProd.id,
                              productName: selectedProd.name,
                              appliedCategory: selectedProd.category,
                            });
                          }
                        } else {
                          setNewPromo({
                            ...newPromo,
                            productId: '',
                            productName: '',
                          });
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="">-- Aplicar por Categoría o General --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          📦 {p.name} ({p.sku})
                        </option>
                      ))}
                    </Select>
                  </div>

                  {!newPromo.productId && (
                    <div>
                      <label className="block font-black text-slate-800 mb-1">Categoría Aplicada</label>
                      <Select
                        value={newPromo.appliedCategory || 'TODOS'}
                        onChange={(e) => setNewPromo({ ...newPromo, appliedCategory: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl font-bold"
                      >
                        <option value="TODOS">🌐 Todas las Categorías</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            📁 {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div>
                    <label className="block font-black text-slate-800 mb-1">Código Promocional *</label>
                    <input
                      type="text"
                      value={newPromo.code}
                      onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value })}
                      placeholder="ej: PROMO-HERRAMIENTAS10"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-black text-slate-800 mb-1">Nombre de la Oferta *</label>
                    <input
                      type="text"
                      value={newPromo.name}
                      onChange={(e) => setNewPromo({ ...newPromo, name: e.target.value })}
                      placeholder="ej: 15% OFF en Martillos Stanley"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-black text-slate-800 mb-1">% Descuento *</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="100"
                        value={newPromo.discountPercent}
                        onChange={(e) => setNewPromo({ ...newPromo, discountPercent: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-black text-slate-800 mb-1">Mínimo Unidades *</label>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        value={newPromo.minQuantity}
                        onChange={(e) => setNewPromo({ ...newPromo, minQuantity: parseFloat(e.target.value) || 1 })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-black text-slate-800 mb-1">Fecha Inicio</label>
                      <input
                        type="date"
                        value={newPromo.startDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setNewPromo({ ...newPromo, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-black text-slate-800 mb-1">Fecha Fin</label>
                      <input
                        type="date"
                        value={newPromo.endDate || '2026-12-31'}
                        onChange={(e) => setNewPromo({ ...newPromo, endDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => setIsPromoModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        if (newPromo.code && newPromo.name) {
                          setPromotions([
                            ...promotions,
                            {
                              id: `promo-${Date.now()}`,
                              code: newPromo.code,
                              name: newPromo.name,
                              discountPercent: newPromo.discountPercent || 10,
                              startDate: newPromo.startDate || new Date().toISOString().split('T')[0],
                              endDate: newPromo.endDate || '2026-12-31',
                              status: 'ACTIVA',
                              minQuantity: newPromo.minQuantity || 1,
                              appliedCategory: newPromo.appliedCategory || 'TODOS',
                              productId: newPromo.productId || undefined,
                              productName: newPromo.productName || undefined,
                            }
                          ]);
                          setIsPromoModalOpen(false);
                          setNewPromo({
                            code: '',
                            name: '',
                            discountPercent: 10,
                            startDate: new Date().toISOString().split('T')[0],
                            endDate: '2026-12-31',
                            status: 'ACTIVA',
                            minQuantity: 1,
                            appliedCategory: 'TODOS',
                            productId: '',
                            productName: ''
                          });
                        }
                      }}
                      className="px-5 py-2 bg-orange-500 text-white font-black rounded-xl shadow-md cursor-pointer"
                    >
                      Guardar Promoción
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 3: UNIDADES DE MEDIDAS
         --------------------------------------------------------------------- */}
      {subTab === 'UNIDADES_MEDIDAS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Scale className="w-5 h-5 text-cyan-500" />
                <span>Unidades de Medida</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define las unidades de medida aplicables a los productos (Litros, Kilogramos, Metros, etc).
              </p>
            </div>

            <button
              onClick={() => {
                setNewUnit({ id: '', code: '', name: '', symbol: '', baseRatio: 1, category: 'CANTIDAD' });
                setIsUnitModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Unidad</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(units || []).map((u) => (
              <div key={u.id} className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2 relative group hover:border-orange-300 transition">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-slate-900 text-orange-400 font-mono font-black text-xs rounded-lg border border-slate-800">
                    {u.code}
                  </span>
                </div>

                <h3 className="font-black text-slate-900 text-sm pr-12">{u.name}</h3>
                <div className="text-xs text-slate-600 font-mono space-y-0.5">
                  <div>Símbolo: <strong className="text-slate-900">{u.symbol}</strong></div>
                </div>
                <div className="absolute top-3 right-3 flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setNewUnit(u);
                      setIsUnitModalOpen(true);
                    }}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-200 transition shadow-sm"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (units.length === 1) {
                        // Silent block to avoid alert in iframe, or could use toast if available
                        return;
                      }
                      onUpdateUnits(units.filter(x => x.id !== u.id));
                    }}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-red-600 hover:border-red-200 transition shadow-sm"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Unit Modal */}
          {isUnitModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-orange-500" />
                  <span>{newUnit.id ? 'Editar Unidad de Medida' : 'Agregar Unidad de Medida'}</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-black text-slate-800 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="ej: Metro"
                      value={newUnit.name}
                      onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-black text-slate-800 mb-1">Símbolo</label>
                    <input
                      type="text"
                      placeholder="ej: m"
                      value={newUnit.symbol}
                      onChange={(e) => setNewUnit({ ...newUnit, symbol: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                    <button onClick={() => setIsUnitModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl">Cancelar</button>
                    <button
                      onClick={() => {
                        if (newUnit.name && newUnit.symbol) {
                          const generatedCode = newUnit.symbol.toUpperCase();
                          if (newUnit.id) {
                            // Edit existing
                            onUpdateUnits(
                              (units || []).map(u => u.id === newUnit.id ? {
                                ...u,
                                code: generatedCode,
                                name: newUnit.name,
                                symbol: newUnit.symbol
                              } : u)
                            );
                          } else {
                            // Add new
                            onUpdateUnits([
                              ...units,
                              {
                                id: `u-${Date.now()}`,
                                code: generatedCode,
                                name: newUnit.name,
                                symbol: newUnit.symbol,
                                baseRatio: 1,
                                category: 'CANTIDAD',
                                fractional: true
                              }
                            ]);
                          }
                          setIsUnitModalOpen(false);
                          setNewUnit({ id: '', code: '', name: '', symbol: '', baseRatio: 1, category: 'CANTIDAD' });
                        }
                      }}
                      className="px-5 py-2 bg-orange-500 text-white font-black rounded-xl shadow-md"
                    >
                      {newUnit.id ? 'Actualizar' : 'Guardar Unidad'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}





      {/* ---------------------------------------------------------------------
          SUBTAB 5: LOTES / VENCIMIENTOS
         --------------------------------------------------------------------- */}
      {subTab === 'LOTES_VENCIMIENTOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                <span>Control de Lotes y Fechas de Caducidad (FEFO)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoreo de vencimientos para pinturas, resinas, cementos y químicos de construcción.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">N° de Lote</th>
                  <th className="py-3 px-4 text-center">Fecha Caducidad</th>
                  <th className="py-3 px-4 text-right">Cantidad Stock</th>
                  <th className="py-3 px-4">Ubicación Bodega</th>
                  <th className="py-3 px-4 text-center">Estado Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-black text-slate-900">{b.productName}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{b.batchNumber}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold">{b.expiryDate}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{b.quantity} u.</td>
                    <td className="py-3 px-4 text-slate-600">{b.location}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          b.status === 'VIGENTE'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : b.status === 'POR_VENCER'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 6: CAMBIO DE PRECIO MASIVO
         --------------------------------------------------------------------- */}
      {subTab === 'CAMBIO_PRECIO_MASIVO' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-500" />
              <span>Actualización Masiva de Precios de Venta</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aplica incrementos o descuentos globales por porcentaje a categorías completas de artículos.
            </p>
          </div>

          {priceChangeSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between">
              <span>{priceChangeSuccessMsg}</span>
              <button onClick={() => setPriceChangeSuccessMsg(null)}>✕</button>
            </div>
          )}

          <div className="p-5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-4 max-w-xl text-xs">
            <div>
              <label className="block font-black text-slate-800 mb-1">Seleccionar Categoría de Productos</label>
              <CustomSelect
                value={selectedCategoryForPrice}
                onChange={(val) => setSelectedCategoryForPrice(val)}
                options={[
                  { value: 'TODAS', label: `Todas las Categorías (${products.length} productos)` },
                  ...Array.from(new Set(products.map((p) => p.category))).map((cat) => ({ value: cat, label: cat }))
                ]}
                variant="dark"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-black text-slate-800 mb-1">Tipo de Ajuste</label>
                <CustomSelect
                  value={priceAdjustType}
                  onChange={(val) => setPriceAdjustType(val as any)}
                  options={[
                    { value: 'PORCENTAJE_AUMENTO', label: 'Aumento Porcentual (+%)', color: 'emerald' },
                    { value: 'PORCENTAJE_DESCUENTO', label: 'Descuento Porcentual (-%)', color: 'rose' },
                    { value: 'FIJO', label: 'Monto Fijo Exacto ($)', color: 'blue' }
                  ]}
                  variant="dark"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Valor / Porcentaje</label>
                <input
                  type="number"
                  step="0.1"
                  value={priceAdjustValue}
                  onChange={(e) => setPriceAdjustValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-indigo-600 text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleExecutePriceChange}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              Aplicar Cambio de Precios Masivo Ahora
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 7: AJUSTE DE STOCK DE PRODUCTOS
         --------------------------------------------------------------------- */}
      {subTab === 'AJUSTE_STOCK' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Breadcrumb / Top Indicator */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 border-b border-slate-100 pb-3">
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-slate-400" /> Panel</span>
            <span>/</span>
            <span className="text-slate-900 flex items-center gap-1"><Boxes className="w-3.5 h-3.5 text-orange-500" /> Productos</span>
          </div>

          {/* Title Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-950 flex items-center gap-2 tracking-tight">
              <Search className="w-6 h-6 text-slate-800" />
              <span>Ajuste de Stock de Productos</span>
            </h2>
          </div>

          {/* Búsqueda de Productos Section */}
          <div className="space-y-1.5 relative">
            <label className="block text-xs font-black text-slate-900">
              Búsqueda de productos:
            </label>

            <div className="flex items-center">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Ingrese el nombre de un producto"
                  value={adjustSearch}
                  onChange={(e) => {
                    setAdjustSearch(e.target.value);
                    setIsAdjustSearchOpen(true);
                  }}
                  onFocus={() => setIsAdjustSearchOpen(true)}
                  className="w-full pl-3 pr-10 py-2 bg-white border border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-900 text-xs font-medium rounded-l-xl focus:outline-none"
                />
                {adjustSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustSearch('');
                      setIsAdjustSearchOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsAdjustSearchOpen(!isAdjustSearchOpen)}
                className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-r-xl border border-blue-600 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Dropdown list of matching products */}
            {isAdjustSearchOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto p-1 divide-y divide-slate-100">
                {products
                  .filter((p) =>
                    !adjustSearch ||
                    p.name.toLowerCase().includes(adjustSearch.toLowerCase()) ||
                    p.sku.toLowerCase().includes(adjustSearch.toLowerCase()) ||
                    (p.barcode && p.barcode.toLowerCase().includes(adjustSearch.toLowerCase()))
                  )
                  .slice(0, 15)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProductToAdjustRows(p)}
                      className="w-full text-left p-2.5 hover:bg-blue-50 transition cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Código: {p.sku} • Cat: {p.category}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-700 block">Stock: {p.stock} u.</span>
                        <span className="text-[10px] text-blue-600 font-bold">+ Agregar</span>
                      </div>
                    </button>
                  ))}
                {products.filter((p) =>
                  !adjustSearch ||
                  p.name.toLowerCase().includes(adjustSearch.toLowerCase()) ||
                  p.sku.toLowerCase().includes(adjustSearch.toLowerCase())
                ).length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No se encontraron productos coincidentes.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Table: Ajuste de Stock de Productos */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-900 font-black text-xs">
                <tr>
                  <th className="py-3 px-4 text-center w-16">Eliminar</th>
                  <th className="py-3 px-4 w-36">Código</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4 text-center w-28">Stock actual</th>
                  <th className="py-3 px-4 text-center w-44">Stock nuevo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-medium">
                {adjustRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-500" />
                      <p className="font-bold text-slate-700 text-sm">No hay productos seleccionados para ajuste</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Utilice el campo de búsqueda arriba para ingresar productos y modificar sus existencias.
                      </p>
                    </td>
                  </tr>
                ) : (
                  adjustRows.map((row) => (
                    <tr key={row.productId} className="hover:bg-slate-50 transition">
                      {/* Eliminar Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveAdjustRow(row.productId)}
                          className="w-7 h-7 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                          title="Eliminar de la lista"
                        >
                          <X className="w-4 h-4 font-black" />
                        </button>
                      </td>

                      {/* Código */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {row.sku}
                      </td>

                      {/* Producto */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{row.name}</span>
                        {row.category && (
                          <span className="text-[10px] text-slate-500 font-medium">({row.category})</span>
                        )}
                      </td>

                      {/* Stock actual */}
                      <td className={`py-3 px-4 text-center font-mono font-bold text-sm ${
                        row.currentStock < 0 ? 'text-rose-600' : 'text-slate-900'
                      }`}>
                        {row.currentStock}
                      </td>

                      {/* Stock nuevo with - / + controls */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleUpdateAdjustRowStock(row.productId, Math.max(0, row.newStock - 1))}
                            className="px-2.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-black rounded-l-md transition cursor-pointer text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="any"
                            value={row.newStock}
                            onChange={(e) => handleUpdateAdjustRowStock(row.productId, parseFloat(e.target.value) || 0)}
                            className="w-20 py-1 px-2 border-y border-slate-300 text-center font-mono font-black text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateAdjustRowStock(row.productId, row.newStock + 1)}
                            className="px-2.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-black rounded-r-md transition cursor-pointer text-xs"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Summary text */}
          <div className="text-xs text-slate-600 font-medium">
            Mostrando registros del {adjustRows.length > 0 ? 1 : 0} al {adjustRows.length} de un total de {adjustRows.length} registros
          </div>

          {/* Action Buttons: Guardar registro & Cancelar */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={handleSaveBatchAdjust}
              disabled={adjustRows.length === 0}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>Guardar registro</span>
            </button>

            <button
              type="button"
              onClick={() => setAdjustRows([])}
              disabled={adjustRows.length === 0}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <X className="w-4 h-4" />
              <span>Cancelar</span>
            </button>
          </div>

          {/* Historial Auditoría */}
          {adjustHistory.length > 0 && (
            <div className="pt-6 border-t border-slate-200 space-y-3">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider">Historial Reciente de Ajustes Realizados</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3 text-center">Ajuste</th>
                      <th className="py-2.5 px-3">Detalle / Motivo</th>
                      <th className="py-2.5 px-3">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {adjustHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{item.date}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{item.product}</td>
                        <td
                          className={`py-2 px-3 text-center font-mono font-black ${
                            item.qty > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {item.qty > 0 ? `+${item.qty}` : item.qty}
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-[11px]">{item.reason}</td>
                        <td className="py-2 px-3 font-bold text-slate-700 text-[11px]">{item.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 8: TRANSFERENCIAS
         --------------------------------------------------------------------- */}
      {subTab === 'TRANSFERENCIAS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-500" />
                <span>Transferencias de Mercadería entre Almacenes</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Envía inventario entre Bodega Central, Salón de Ventas y Sucursales externas.
              </p>
            </div>

            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Transferencia</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código / Fecha</th>
                  <th className="py-3 px-4">Bodega Origen</th>
                  <th className="py-3 px-4">Bodega Destino</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-black text-slate-900">
                      <span className="text-orange-600 block">{t.code}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{t.date}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-700">{t.originStore}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">{t.destinationStore}</td>
                    <td className="py-3 px-4 text-center font-mono font-black text-slate-900">{t.itemCount} u.</td>
                    <td className="py-3 px-4 font-medium text-slate-600">{t.responsible}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-blue-50 border-blue-200 text-blue-700">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 9: ETIQUETAS Y GENERADOR DE CÓDIGOS DE BARRA
         --------------------------------------------------------------------- */}
      {subTab === 'ETIQUETAS' && (
        <BarcodeLabelsManager
          products={products}
          settings={settings}
          onSaveProduct={onSaveProduct}
        />
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 10: KARDEX REAL & VALORIZADO
         --------------------------------------------------------------------- */}
      {subTab === 'KARDEX' && (
        <KardexManager
          products={products}
          settings={settings}
          categories={categories}
          onStockAdjust={onStockAdjust}
          onSaveProduct={onSaveProduct}
        />
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 11: TOMA FISICA
         --------------------------------------------------------------------- */}
      {subTab === 'TOMA_FISICA' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          {/* Header Banner */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-gradient-to-br from-lime-500/20 to-emerald-500/10 text-lime-600 rounded-2xl border border-lime-500/30 shadow-xs mt-0.5">
                <ClipboardCheck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-950 tracking-tight">Toma Física de Inventario & Auditoría</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-lime-50 text-lime-700 border border-lime-200">
                    Conteo en Perchas
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-2xl">
                  Descarga la planilla en PDF con recuadros en blanco para hacer el conteo a mano con lápiz en almacén, y luego ingresa manualmente los datos en el sistema para ajustar existencias.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <button
                type="button"
                onClick={handleDownloadTomaFisicaPdf}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 border border-slate-800 cursor-pointer"
                title="Descargar hoja en PDF con recuadros en blanco para imprimir y contar a mano"
              >
                <Download className="w-4 h-4 text-orange-400 stroke-[2.5]" />
                <span>Descargar Planilla PDF (Conteo en Blanco)</span>
              </button>

              <button
                type="button"
                onClick={handleApplyPhysicalAudit}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Aplicar Ajuste Auditoría</span>
              </button>
            </div>
          </div>

          {auditSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{auditSuccessMsg}</span>
              </div>
              <button
                onClick={() => setAuditSuccessMsg(null)}
                className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* 5 KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total en Auditoría</p>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">{auditMetrics.totalItems}</span>
                <span className="text-xs text-slate-500 font-bold">ítems</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Catálogo seleccionado</p>
            </div>

            <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
              <p className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Digitados / Contados</p>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl font-black text-blue-900 font-mono">{auditMetrics.totalCounted}</span>
                <span className="text-xs text-blue-600 font-bold">/ {auditMetrics.totalItems}</span>
              </div>
              <div className="w-full bg-blue-200/60 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${auditMetrics.totalItems > 0 ? (auditMetrics.totalCounted / auditMetrics.totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
              <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Pendientes de Conteo</p>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl font-black text-amber-900 font-mono">{auditMetrics.pendingCount}</span>
                <span className="text-xs text-amber-600 font-bold">en blanco</span>
              </div>
              <p className="text-[10px] text-amber-600/90 mt-0.5">Por ingresar de la hoja</p>
            </div>

            <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl">
              <p className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Discrepancias</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono font-bold text-xs" title="Sobrantes">
                  +{auditMetrics.surplusCount}
                </span>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-mono font-bold text-xs" title="Faltantes">
                  -{auditMetrics.deficitCount}
                </span>
              </div>
              <p className="text-[10px] text-purple-600 mt-1">{auditMetrics.matchingCount} coinciden exacto</p>
            </div>

            <div className="p-4 bg-slate-900 text-white border border-slate-800 rounded-2xl col-span-2 sm:col-span-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Impacto Neto ($)</p>
              <p className={`text-xl font-black font-mono mt-1 ${auditMetrics.totalFinancialImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(auditMetrics.totalFinancialImpact, settings.currencySymbol)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Costo de mercadería</p>
            </div>
          </div>

          {/* Controls & Quick Actions Bar */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por producto, SKU, código de barras o percha..."
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
                />
                {auditSearchTerm && (
                  <button
                    onClick={() => setAuditSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div className="min-w-[190px]">
                <select
                  value={selectedAuditCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setSelectedAuditCategory(cat);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs cursor-pointer"
                >
                  <option value="TODAS">Todas las Categorías</option>
                  {currentCategories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Auditor Name (Optional for PDF) */}
              <div className="min-w-[180px]">
                <input
                  type="text"
                  placeholder="Nombre de quien cuenta..."
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
                  title="Nombre del responsable que aparecerá en el PDF"
                />
              </div>
            </div>

            {/* Quick Bulk Tools */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSetAuditBlank}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Deja todos los casilleros de conteo en blanco para ir digitando uno por uno lo que dice la hoja de papel"
              >
                <FileText className="w-3.5 h-3.5 text-orange-600" />
                <span>Poner Conteos en Blanco</span>
              </button>

              <button
                type="button"
                onClick={handleResetAuditToSystem}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Rellena las casillas con el stock actual del sistema para que solo cambies las diferencias"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                <span>Copiar Stock Sistema</span>
              </button>

              <button
                type="button"
                onClick={() => handleReloadAuditProducts(selectedAuditCategory)}
                className="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs transition cursor-pointer"
                title="Recargar productos desde la base de datos"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Audit Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-3">SKU / Código</th>
                  <th className="py-3 px-3">Producto & Ubicación</th>
                  <th className="py-3 px-3 text-center">Unidad</th>
                  <th className="py-3 px-3 text-right">Stock Sistema</th>
                  <th className="py-3 px-4 text-center bg-orange-600 text-white min-w-[150px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Stock Físico Real (Conteo)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Diferencia</th>
                  <th className="py-3 px-3 text-right">Impacto Costo</th>
                  <th className="py-3 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAuditItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <ClipboardList className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold text-sm text-slate-600">No se encontraron productos en esta auditoría</p>
                      <p className="text-xs text-slate-400 mt-1">Prueba seleccionando otra categoría o borrando el término de búsqueda.</p>
                    </td>
                  </tr>
                ) : (
                  filteredAuditItems.map((item, idx) => {
                    const isBlank = item.physicalStock === '';
                    const diffVal = isBlank ? 0 : (Number(item.physicalStock) - item.systemStock);
                    const financialImpact = isBlank ? 0 : (diffVal * item.unitCost);

                    return (
                      <tr 
                        key={item.productId} 
                        className={`hover:bg-slate-50/90 transition-colors ${
                          !isBlank && diffVal !== 0 ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* Index */}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold text-[11px]">
                          {idx + 1}
                        </td>

                        {/* SKU / Barcode */}
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-black text-slate-900 block">{item.sku}</span>
                          {item.barcode && (
                            <span className="font-mono text-[10px] text-slate-400 block">{item.barcode}</span>
                          )}
                        </td>

                        {/* Product Name & Location / Category */}
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{item.productName}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.category}
                            </span>
                            {item.location && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                {item.location}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                          {item.unit || 'u.'}
                        </td>

                        {/* System Stock */}
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-mono font-black text-slate-800 text-sm">
                            {item.systemStock}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1 font-bold">u.</span>
                        </td>

                        {/* Physical Stock Real (Interactive Input for Manual Entry) */}
                        <td className="py-2 px-4 text-center bg-orange-50/40">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              step="any"
                              placeholder="En blanco"
                              value={item.physicalStock === '' ? '' : item.physicalStock}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const rawVal = e.target.value;
                                const updated = [...auditItems];
                                const targetIdx = updated.findIndex((it) => it.productId === item.productId);
                                if (targetIdx !== -1) {
                                  if (rawVal === '') {
                                    updated[targetIdx].physicalStock = '';
                                    updated[targetIdx].diff = 0;
                                  } else {
                                    const num = parseFloat(rawVal) || 0;
                                    updated[targetIdx].physicalStock = num;
                                    updated[targetIdx].diff = num - updated[targetIdx].systemStock;
                                  }
                                  setAuditItems(updated);
                                }
                              }}
                              className={`w-28 px-3 py-1.5 bg-white border-2 rounded-xl font-mono font-black text-right text-sm shadow-xs transition focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                                isBlank
                                  ? 'border-slate-300 text-slate-400 placeholder-slate-400'
                                  : diffVal === 0
                                  ? 'border-slate-300 text-slate-900'
                                  : diffVal > 0
                                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50/20'
                                  : 'border-rose-500 text-rose-700 bg-rose-50/20'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Difference */}
                        <td className="py-2.5 px-3 text-right">
                          {isBlank ? (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-400">
                              Pendiente
                            </span>
                          ) : (
                            <span
                              className={`inline-block font-mono font-black px-2 py-0.5 rounded-lg text-xs ${
                                diffVal === 0
                                  ? 'text-slate-600 bg-slate-100'
                                  : diffVal > 0
                                  ? 'text-emerald-800 bg-emerald-100 border border-emerald-200'
                                  : 'text-rose-800 bg-rose-100 border border-rose-200'
                              }`}
                            >
                              {diffVal > 0 ? `+${diffVal}` : diffVal}
                            </span>
                          )}
                        </td>

                        {/* Financial Impact */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-xs">
                          {isBlank ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className={diffVal === 0 ? 'text-slate-400' : diffVal > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {formatCurrency(financialImpact, settings.currencySymbol)}
                            </span>
                          )}
                        </td>

                        {/* Action: Quick Match */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...auditItems];
                              const targetIdx = updated.findIndex((it) => it.productId === item.productId);
                              if (targetIdx !== -1) {
                                updated[targetIdx].physicalStock = updated[targetIdx].systemStock;
                                updated[targetIdx].diff = 0;
                                setAuditItems(updated);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title="Marcar como exacto / conforme al sistema"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Summary Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-600 font-medium">
              Mostrando <span className="font-bold text-slate-900">{filteredAuditItems.length}</span> productos en esta vista •{' '}
              <span className="text-orange-600 font-bold">{auditItems.filter(i => i.physicalStock !== '' && i.diff !== 0).length}</span> con discrepancia listos para ajuste.
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTomaFisicaPdf}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-orange-500" />
                <span>Descargar PDF</span>
              </button>

              <button
                type="button"
                onClick={handleApplyPhysicalAudit}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Aplicar Ajuste</span>
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Category Modal (Crear / Editar Categoría) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl ring-1 ring-slate-900/10 animate-slideUp">
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide text-white">
                    {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingCategory ? 'Modifica los datos de la categoría' : 'Agrega una nueva categoría al catálogo'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Materiales Eléctricos, Pinturas..."
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-bold rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Breve descripción de los productos que componen esta categoría..."
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  Color Identificador (Tag / Pill)
                </label>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {[
                    { color: '#f97316', label: 'Naranja' },
                    { color: '#f59e0b', label: 'Ámbar' },
                    { color: '#10b981', label: 'Esmeralda' },
                    { color: '#06b6d4', label: 'Cian' },
                    { color: '#3b82f6', label: 'Azul' },
                    { color: '#6366f1', label: 'Índigo' },
                    { color: '#8b5cf6', label: 'Púrpura' },
                    { color: '#ec4899', label: 'Rosa' },
                    { color: '#ef4444', label: 'Rojo' },
                    { color: '#64748b', label: 'Pizarra' },
                  ].map((preset) => {
                    const isSelected = categoryFormData.color === preset.color;
                    return (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setCategoryFormData({ ...categoryFormData, color: preset.color })}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${
                          isSelected ? 'scale-110 border-slate-950 shadow-md' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset.color }}
                        title={preset.label}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-600">Vista previa:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-white text-slate-900 border border-slate-200 shadow-2xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: categoryFormData.color }}
                    />
                    {categoryFormData.name.trim() || 'Nombre Categoría'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingCategory ? 'Actualizar' : 'Guardar Categoría'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
