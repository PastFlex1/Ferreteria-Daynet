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
  FileText,
  Clock,
  Building,
  Truck,
  ShieldAlert,
  AlertCircle,
  Eye,
  MapPin,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { InventorySubTab, Product, ProductCategory, Promotion, PromotionItem, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { InventoryManager } from './InventoryManager';
import { BarcodeLabelsManager } from './BarcodeLabelsManager';
import { BulkProductImporterModal } from './BulkProductImporterModal';
import { KardexManager, StockAdjustmentRecord } from './KardexManager';
import { Select } from '../Shared/Select';
import { useModal } from '../../context/ModalContext';
import { defaultCategories } from '../../data/initialData';
import { downloadTomaFisicaPdf, PhysicalInventoryPdfItem } from '../../utils/tomaFisicaPdfGenerator';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { exportToModernExcel } from '../../utils/excelExport';
import { validateEcuadorianDocument } from '../../utils/ecuadorianValidator';

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
  category: 'LONGITUD' | 'PESO' | 'VOLUMEN' | 'SUPERFICIE' | 'CANTIDAD';
}



// Batch / Expiry (Sincronizado con Facturas de Compra y Almacén)
interface ProductBatch {
  id: string;
  productId: string;
  sku?: string;
  productName: string;
  category?: string;
  unit?: string;
  batchNumber: string;
  expiryDate: string;
  purchaseDate?: string;
  supplierName?: string;
  invoiceNumber?: string;
  quantity: number;
  location: string;
  status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
  daysRemaining: number;
  costPrice?: number;
}

// Warehouse / Bodegas Management
export interface WarehouseLocation {
  id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  phone?: string;
  isMain?: boolean;
}

export const defaultWarehouseLocations: WarehouseLocation[] = [
  { id: 'wh-1', name: 'Bodega Principal', code: 'BOD-01', address: 'Matriz Principal', city: 'Quito', isMain: true },
  { id: 'wh-2', name: 'Bodega Central Norte', code: 'BOD-02', address: 'Av. Amazonas y Colón', city: 'Quito', isMain: false },
  { id: 'wh-3', name: 'Tienda POS / Salón de Ventas', code: 'POS-01', address: 'Local Comercial', city: 'Quito', isMain: false },
];

// Warehouse Transfer Items & Guia Remisión
export interface TransferItem {
  productId: string;
  sku: string;
  productName: string;
  category?: string;
  unit?: string;
  quantity: number;
  costPrice: number;
  receivedQuantity?: number;
  notes?: string;
}

export interface TransferGuiaRemision {
  number: string;
  driverName: string;
  driverIdNumber: string;
  licensePlate: string;
  vehicleModel?: string;
  route: string;
  transferStartDate: string;
  transferEndDate: string;
  transferReason: string;
  status: 'EMITIDA' | 'EN_TRANSITO';
}

// Warehouse Transfer (Doble Fase Transaccional)
export interface StockTransfer {
  id: string;
  code: string;
  date: string;
  dispatchedAt?: string;
  receivedAt?: string;
  originStore: string;
  destinationStore: string;
  itemCount: number;
  items: TransferItem[];
  totalValue: number;
  status: 'EN_TRANSITO' | 'COMPLETADA' | 'CANCELADA';
  responsible: string;
  receivedBy?: string;
  notes?: string;
  receptionNotes?: string;
  guiaRemision?: TransferGuiaRemision;
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
  const [isCreatingPromo, setIsCreatingPromo] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoName, setPromoName] = useState('Campaña Promocional');
  const [promoCode, setPromoCode] = useState('');
  const [promoStartDate, setPromoStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [promoEndDate, setPromoEndDate] = useState('2026-12-31');
  const [massDiscount, setMassDiscount] = useState<number>(0);
  const [promoSearchQuery, setPromoSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isPromoSettingsOpen, setIsPromoSettingsOpen] = useState(false);
  const [promoItems, setPromoItems] = useState<PromotionItem[]>([]);
  const [promoCurrentPage, setPromoCurrentPage] = useState(1);
  const promoPageSize = 10;

  const handleOpenCreatePromo = (promoToEdit?: Promotion) => {
    if (promoToEdit) {
      setEditingPromoId(promoToEdit.id);
      setPromoName(promoToEdit.name || 'Campaña Promocional');
      setPromoCode(promoToEdit.code || '');
      setPromoStartDate(promoToEdit.startDate || new Date().toISOString().split('T')[0]);
      setPromoEndDate(promoToEdit.endDate || '2026-12-31');
      setMassDiscount(promoToEdit.discountPercent || 0);
      setPromoItems(promoToEdit.items || []);
    } else {
      setEditingPromoId(null);
      const generatedCode = `PROMO-${Math.floor(1000 + Math.random() * 9000)}`;
      setPromoCode(generatedCode);
      setPromoName('Campaña Promocional');
      const today = new Date().toISOString().split('T')[0];
      setPromoStartDate(today);
      setPromoEndDate('2026-12-31');
      setMassDiscount(0);
      setPromoItems([]);
    }
    setPromoSearchQuery('');
    setIsSearchDropdownOpen(false);
    setIsPromoSettingsOpen(false);
    setPromoCurrentPage(1);
    setIsCreatingPromo(true);
  };

  const handleApplyMassDiscount = () => {
    const val = Math.max(0, Math.min(100, massDiscount));
    setPromoItems((prev) =>
      prev.map((item) => {
        const discountAmount = Number((item.currentPrice * (val / 100)).toFixed(4));
        const finalPrice = Number(Math.max(0, item.currentPrice - discountAmount).toFixed(4));
        return {
          ...item,
          discountPercent: val,
          discountAmount,
          finalPrice,
        };
      })
    );
  };

  const handleAddProductToPromo = (product: Product) => {
    if (promoItems.some((item) => item.productId === product.id)) {
      setPromoSearchQuery('');
      setIsSearchDropdownOpen(false);
      return;
    }
    const currentPrice = Number((product.price || 0).toFixed(4));
    const discountPercent = massDiscount > 0 ? massDiscount : 10;
    const discountAmount = Number((currentPrice * (discountPercent / 100)).toFixed(4));
    const finalPrice = Number(Math.max(0, currentPrice - discountAmount).toFixed(4));

    const newItem: PromotionItem = {
      productId: product.id,
      productName: product.name.toUpperCase(),
      sku: product.sku,
      barcode: product.barcode || product.sku,
      currentPrice,
      discountPercent,
      discountAmount,
      finalPrice,
    };

    setPromoItems((prev) => [newItem, ...prev]);
    setPromoSearchQuery('');
    setIsSearchDropdownOpen(false);
  };

  const handleUpdateItemDiscount = (indexInItems: number, delta: number) => {
    setPromoItems((prev) => {
      const updated = [...prev];
      const target = updated[indexInItems];
      if (!target) return prev;
      const newPercent = Math.max(0, Math.min(100, (target.discountPercent || 0) + delta));
      const discountAmount = Number((target.currentPrice * (newPercent / 100)).toFixed(4));
      const finalPrice = Number(Math.max(0, target.currentPrice - discountAmount).toFixed(4));
      updated[indexInItems] = {
        ...target,
        discountPercent: newPercent,
        discountAmount,
        finalPrice,
      };
      return updated;
    });
  };

  const handleSetItemDiscountDirect = (indexInItems: number, newPercentVal: number) => {
    setPromoItems((prev) => {
      const updated = [...prev];
      const target = updated[indexInItems];
      if (!target) return prev;
      const newPercent = Math.max(0, Math.min(100, isNaN(newPercentVal) ? 0 : newPercentVal));
      const discountAmount = Number((target.currentPrice * (newPercent / 100)).toFixed(4));
      const finalPrice = Number(Math.max(0, target.currentPrice - discountAmount).toFixed(4));
      updated[indexInItems] = {
        ...target,
        discountPercent: newPercent,
        discountAmount,
        finalPrice,
      };
      return updated;
    });
  };

  const handleRemovePromoItem = (indexInItems: number) => {
    setPromoItems((prev) => prev.filter((_, idx) => idx !== indexInItems));
  };

  const handleLoadDemoPromoItems = () => {
    const demoItems: PromotionItem[] = [
      {
        productId: 'demo-1',
        productName: 'BORRADOR GRANDE PZ 20',
        sku: '7703064446502',
        barcode: '7703064446502',
        currentPrice: 2.8156,
        discountPercent: 10,
        discountAmount: 0.2816,
        finalPrice: 2.5340,
      },
      {
        productId: 'demo-2',
        productName: 'PINTURA MI NOTA LARGA X 12',
        sku: '7707323871147',
        barcode: '7707323871147',
        currentPrice: 10.6080,
        discountPercent: 10,
        discountAmount: 1.0608,
        finalPrice: 9.5472,
      },
      {
        productId: 'demo-3',
        productName: 'CERVEZA PILSENER 355ML',
        sku: '7861002700010',
        barcode: '7861002700010',
        currentPrice: 1.2500,
        discountPercent: 10,
        discountAmount: 0.1250,
        finalPrice: 1.1250,
      },
    ];
    setPromoItems(demoItems);
    setIsPromoSettingsOpen(false);
  };

  const handleSavePromoRecord = () => {
    if (promoItems.length === 0) {
      alert('Debe agregar al menos un producto a la promoción.');
      return;
    }
    const promoId = editingPromoId || `promo-${Date.now()}`;
    const code = promoCode.trim() || `PROMO-${Date.now().toString().slice(-4)}`;
    const name = promoName.trim() || `Campaña ${promoItems.length} Productos`;
    const avgDiscount = Math.round(
      promoItems.reduce((acc, curr) => acc + curr.discountPercent, 0) / promoItems.length
    );

    const savedPromo: Promotion = {
      id: promoId,
      code,
      name,
      discountPercent: avgDiscount,
      startDate: promoStartDate,
      endDate: promoEndDate,
      status: 'ACTIVA',
      minQuantity: 1,
      appliedCategory: 'TODOS',
      items: promoItems,
    };

    if (editingPromoId) {
      setPromotions((prev) => prev.map((p) => (p.id === editingPromoId ? savedPromo : p)));
    } else {
      setPromotions((prev) => [savedPromo, ...prev]);
    }
    setIsCreatingPromo(false);
  };

  // 2. Unidades de Medida State removed in favor of global props
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [newUnit, setNewUnit] = useState<any>({
    code: '',
    name: '',
    symbol: '',
    baseRatio: 1,
    category: 'CANTIDAD'
  });

  // 3. Lotes & Vencimientos State (Sincronizado directamente con Compras y Lotes de Almacén)
  const [purchases] = useFirestoreSync<any[]>('ferreteria_purchases', []);
  const [manualBatches, setManualBatches] = useFirestoreSync<ProductBatch[]>('ferreteria_product_batches', []);
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState<'TODOS' | 'POR_VENCER' | 'VENCIDOS' | 'VIGENTES'>('TODOS');
  const [batchLocationFilter, setBatchLocationFilter] = useState('TODAS');

  // Modal para registrar nuevo lote manual
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [newBatchProductId, setNewBatchProductId] = useState('');
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newBatchExpiryDate, setNewBatchExpiryDate] = useState('');
  const [newBatchQty, setNewBatchQty] = useState('');
  const [newBatchLocation, setNewBatchLocation] = useState('Bodega Principal');

  // Consolidar lotes desde Facturas de Compra Reales + Lotes Manuales + Demostración
  const consolidatedBatches = useMemo(() => {
    const list: ProductBatch[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Extraer desde Facturas de Compra registradas (ferreteria_purchases)
    (purchases || []).forEach((purch: any) => {
      if (purch.paymentStatus === 'ANULADA') return;
      const purchDate = purch.purchaseDate || purch.date || (purch.createdAt ? purch.createdAt.split('T')[0] : '');
      const supplierName = purch.supplier?.name || purch.supplierName || 'Proveedor Directo';
      const invNumber = purch.invoiceNumber || purch.orderNumber || `#${(purch.id || '').substring(0, 6)}`;

      if (purch.items && Array.isArray(purch.items)) {
        purch.items.forEach((item: any, idx: number) => {
          if (item.batchNumber || item.expiryDate) {
            const prod = products.find(p => p.id === item.productId || (p.sku && p.sku.toLowerCase() === (item.sku || '').toLowerCase()));
            const expDateStr = item.expiryDate || '';
            
            let daysRemaining = 9999;
            let status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' = 'VIGENTE';

            if (expDateStr && expDateStr !== 'Sin caducidad' && expDateStr !== 'N/A') {
              const expDate = new Date(expDateStr);
              expDate.setHours(0, 0, 0, 0);
              const diffTime = expDate.getTime() - today.getTime();
              daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (daysRemaining < 0) {
                status = 'VENCIDO';
              } else if (daysRemaining <= 30) {
                status = 'POR_VENCER';
              } else {
                status = 'VIGENTE';
              }
            }

            list.push({
              id: `pur-batch-${purch.id}-${item.productId || idx}`,
              productId: item.productId || prod?.id || `prod-${idx}`,
              sku: item.sku || prod?.sku || 'S/SKU',
              productName: item.productName || prod?.name || 'Producto sin nombre',
              category: prod?.category || 'General',
              unit: prod?.unit || 'u.',
              batchNumber: item.batchNumber || 'S/L',
              expiryDate: expDateStr || 'Sin caducidad',
              purchaseDate: purchDate,
              supplierName,
              invoiceNumber: invNumber,
              quantity: Number(item.quantity) || 1,
              location: prod?.location || (purch as any).warehouse || 'Bodega Principal',
              status,
              daysRemaining,
              costPrice: item.costPrice || prod?.costPrice || 0,
            });
          }
        });
      }
    });

    // 2. Extraer desde Lotes manuales (ferreteria_product_batches)
    (manualBatches || []).forEach((b: any) => {
      if (list.some(item => item.id === b.id || (item.batchNumber === b.batchNumber && item.productId === b.productId))) return;

      const prod = products.find(p => p.id === b.productId);
      const expDateStr = b.expiryDate || '';
      let daysRemaining = 9999;
      let status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' = b.status || 'VIGENTE';

      if (expDateStr && expDateStr !== 'Sin caducidad' && expDateStr !== 'N/A') {
        const expDate = new Date(expDateStr);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          status = 'VENCIDO';
        } else if (daysRemaining <= 30) {
          status = 'POR_VENCER';
        } else {
          status = 'VIGENTE';
        }
      }

      list.push({
        id: b.id,
        productId: b.productId,
        sku: prod?.sku || b.sku || 'S/SKU',
        productName: b.productName || prod?.name || 'Producto',
        category: prod?.category || 'General',
        unit: prod?.unit || 'u.',
        batchNumber: b.batchNumber || 'S/L',
        expiryDate: expDateStr || 'Sin caducidad',
        purchaseDate: b.purchaseDate || b.date || '',
        supplierName: b.supplierName || 'Registro Almacén',
        invoiceNumber: b.invoiceNumber || 'ING-INTERNO',
        quantity: Number(b.quantity) || 1,
        location: b.location || prod?.location || 'Bodega Principal',
        status,
        daysRemaining,
        costPrice: b.costPrice || prod?.costPrice || 0,
      });
    });

    // Ordenar con lógica FEFO: fechas más próximas a vencer primero
    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [purchases, manualBatches, products]);

  // Filtros de Lotes
  const filteredBatches = useMemo(() => {
    return consolidatedBatches.filter((b) => {
      if (batchStatusFilter === 'POR_VENCER' && b.status !== 'POR_VENCER') return false;
      if (batchStatusFilter === 'VENCIDOS' && b.status !== 'VENCIDO') return false;
      if (batchStatusFilter === 'VIGENTES' && b.status !== 'VIGENTE') return false;

      if (batchLocationFilter !== 'TODAS' && b.location !== batchLocationFilter) return false;

      if (batchSearchTerm.trim()) {
        const term = batchSearchTerm.toLowerCase().trim();
        const matchName = b.productName.toLowerCase().includes(term);
        const matchSku = (b.sku || '').toLowerCase().includes(term);
        const matchBatch = b.batchNumber.toLowerCase().includes(term);
        const matchSupp = (b.supplierName || '').toLowerCase().includes(term);
        const matchInv = (b.invoiceNumber || '').toLowerCase().includes(term);
        if (!matchName && !matchSku && !matchBatch && !matchSupp && !matchInv) return false;
      }

      return true;
    });
  }, [consolidatedBatches, batchStatusFilter, batchLocationFilter, batchSearchTerm]);

  // Resumen Métricas de Lotes (KPIs)
  const batchMetrics = useMemo(() => {
    const total = consolidatedBatches.length;
    const vigentes = consolidatedBatches.filter(b => b.status === 'VIGENTE').length;
    const porVencer = consolidatedBatches.filter(b => b.status === 'POR_VENCER').length;
    const vencidos = consolidatedBatches.filter(b => b.status === 'VENCIDO').length;
    const totalUnits = consolidatedBatches.reduce((acc, b) => acc + b.quantity, 0);

    return { total, vigentes, porVencer, vencidos, totalUnits };
  }, [consolidatedBatches]);

  // Gestión de Bodegas y Almacenes Reales (Sincronizado con Firestore ferreteria_warehouses)
  const [warehouses, setWarehouses] = useFirestoreSync<WarehouseLocation[]>('ferreteria_warehouses', defaultWarehouseLocations);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isEditWarehouseModalOpen, setIsEditWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseLocation | null>(null);
  const [warehouseFormData, setWarehouseFormData] = useState<Omit<WarehouseLocation, 'id'>>({
    name: '',
    code: '',
    address: '',
    city: 'Quito',
    phone: '',
    isMain: false,
  });

  // Ubicaciones / Bodegas disponibles
  const availableBatchLocations = useMemo(() => {
    const list: string[] = [];
    (warehouses || []).forEach((w) => {
      if (w.name && !list.includes(w.name)) list.push(w.name);
    });
    products.forEach((p) => {
      if (p.location && !list.includes(p.location)) list.push(p.location);
    });
    consolidatedBatches.forEach((b) => {
      if (b.location && !list.includes(b.location)) list.push(b.location);
    });
    if (list.length === 0) list.push('Bodega Principal');
    return list;
  }, [warehouses, products, consolidatedBatches]);

  // Guardar / Actualizar Bodega Real
  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = warehouseFormData.name.trim();
    if (!cleanName) {
      showAlert('El nombre de la bodega es obligatorio.', 'Campo Requerido', 'warning');
      return;
    }

    if (editingWarehouse) {
      setWarehouses(
        (warehouses || []).map((w) =>
          w.id === editingWarehouse.id
            ? { ...editingWarehouse, ...warehouseFormData, name: cleanName }
            : w
        )
      );
      showToast(`Bodega "${cleanName}" actualizada con éxito.`, 'success');
      setIsEditWarehouseModalOpen(false);
      setEditingWarehouse(null);
    } else {
      const newWh: WarehouseLocation = {
        id: `wh-${Date.now()}`,
        name: cleanName,
        code: warehouseFormData.code?.trim() || `BOD-${String((warehouses || []).length + 1).padStart(2, '0')}`,
        address: warehouseFormData.address?.trim() || '',
        city: warehouseFormData.city?.trim() || 'Quito',
        phone: warehouseFormData.phone?.trim() || '',
        isMain: warehouseFormData.isMain || false,
      };
      setWarehouses([...(warehouses || []), newWh]);
      showToast(`Bodega "${cleanName}" agregada con éxito.`, 'success');
      setTransferDestination(cleanName);
    }

    setWarehouseFormData({ name: '', code: '', address: '', city: 'Quito', phone: '', isMain: false });
  };

  // Eliminar Bodega (Permite limpiar bodegas de prueba)
  const handleDeleteWarehouse = (wh: WarehouseLocation) => {
    showConfirm(
      `¿Está seguro de eliminar la bodega "${wh.name}"? Ya no aparecerá en las opciones de transferencias.`,
      () => {
        setWarehouses((warehouses || []).filter((w) => w.id !== wh.id));
        showToast(`Bodega "${wh.name}" eliminada.`, 'info');
      },
      'Confirmar Eliminación de Bodega',
      'Sí, Eliminar',
      'Cancelar'
    );
  };

  // Guardar Lote Manual
  const handleSaveManualBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === newBatchProductId);
    if (!prod) {
      showAlert('Seleccione un producto del catálogo.', 'Producto Requerido', 'warning');
      return;
    }
    const qty = parseFloat(newBatchQty) || 0;
    if (qty <= 0) {
      showAlert('Ingrese una cantidad válida mayor a 0.', 'Cantidad Inválida', 'warning');
      return;
    }
    const bNumber = newBatchNumber.trim() || 'S/L';
    const expDate = newBatchExpiryDate || 'Sin caducidad';

    let status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' = 'VIGENTE';
    let daysRemaining = 9999;
    if (expDate && expDate !== 'Sin caducidad') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(expDate);
      expiry.setHours(0, 0, 0, 0);
      daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) status = 'VENCIDO';
      else if (daysRemaining <= 30) status = 'POR_VENCER';
    }

    const newBatch: ProductBatch = {
      id: `batch-${Date.now()}`,
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      category: prod.category,
      unit: prod.unit,
      batchNumber: bNumber,
      expiryDate: expDate,
      purchaseDate: new Date().toISOString().split('T')[0],
      supplierName: 'Registro Manual Almacén',
      invoiceNumber: 'ING-MANUAL',
      quantity: qty,
      location: newBatchLocation || prod.location || 'Bodega Principal',
      status,
      daysRemaining,
      costPrice: prod.costPrice
    };

    setManualBatches([newBatch, ...(manualBatches || [])]);
    setIsNewBatchModalOpen(false);
    setNewBatchProductId('');
    setNewBatchNumber('');
    setNewBatchExpiryDate('');
    setNewBatchQty('');
    showToast(`Lote "${bNumber}" para ${prod.name} registrado con éxito.`, 'success');
  };

  // Exportar a Excel
  const handleExportBatchesExcel = () => {
    const columns = [
      { header: 'Producto', key: 'productName', width: 32 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'N° de Lote', key: 'batchNumber', width: 18 },
      { header: 'Fecha de Caducidad', key: 'expiryDate', width: 20 },
      { header: 'Días Restantes', key: 'daysLabel', width: 16 },
      { header: 'Estado FEFO', key: 'status', width: 16 },
      { header: 'Cantidad en Stock', key: 'qtyLabel', width: 18 },
      { header: 'Bodega / Ubicación', key: 'location', width: 22 },
      { header: 'Proveedor Origen', key: 'supplierName', width: 28 },
      { header: 'Factura Compra', key: 'invoiceNumber', width: 20 },
      { header: 'Fecha de Compra', key: 'purchaseDate', width: 18 },
    ];

    const data = filteredBatches.map(b => ({
      productName: b.productName,
      sku: b.sku || 'S/SKU',
      category: b.category || 'General',
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      daysLabel: b.daysRemaining === 9999 ? 'Sin fecha' : b.daysRemaining < 0 ? `Vencido hace ${Math.abs(b.daysRemaining)}d` : `Faltan ${b.daysRemaining} días`,
      status: b.status,
      qtyLabel: `${b.quantity} ${b.unit || 'u.'}`,
      location: b.location,
      supplierName: b.supplierName || 'N/A',
      invoiceNumber: b.invoiceNumber || 'N/A',
      purchaseDate: b.purchaseDate || 'N/A',
    }));

    exportToModernExcel({
      filename: `Reporte_Lotes_Vencimientos_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Lotes y Vencimientos',
      title: 'Control de Lotes y Fechas de Caducidad (FEFO) - Ferretería',
      columns,
      data,
    });
    showToast('Reporte de lotes y vencimientos descargado en Excel.', 'success');
  };

  // 5. Cambio Masivo (Precios, Costos y Stock) State
  const [selectedCategoryForPrice, setSelectedCategoryForPrice] = useState('TODAS');
  const [bulkTargetField, setBulkTargetField] = useState<'PRECIO_VENTA' | 'COSTO' | 'STOCK'>('PRECIO_VENTA');
  const [bulkAdjustType, setBulkAdjustType] = useState<'PORCENTAJE_AUMENTO' | 'PORCENTAJE_DESCUENTO' | 'INCREMENTO_FIJO' | 'DESCUENTO_FIJO' | 'VALOR_EXACTO'>('PORCENTAJE_AUMENTO');
  const [priceAdjustValue, setPriceAdjustValue] = useState('');
  const [priceChangeSuccessMsg, setPriceChangeSuccessMsg] = useState<string | null>(null);

  // 6. Ajuste de Stock Formal State
  const [adjustProductId, setAdjustProductId] = useState(products[0]?.id || '');
  const [adjustQtyVal, setAdjustQtyVal] = useState('');
  const [adjustTypeReason, setAdjustTypeReason] = useState<'ENTRADA_COMPRA' | 'ENTRADA_DEVOLUCION' | 'SALIDA_MERMA' | 'SALIDA_ROBO' | 'CORRECCION'>('CORRECCION');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustHistory, setAdjustHistory] = useState<{ id: string; date: string; product: string; qty: number; reason: string; user: string; }[]>([]);
  const [stockAdjustments, setStockAdjustments] = useFirestoreSync<StockAdjustmentRecord[]>('ferreteria_stock_adjustments', []);

  // Interactive Multi-Product Stock Adjustment Rows State (matching image design)
  const [adjustMovementType, setAdjustMovementType] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [adjustRows, setAdjustRows] = useState<{
    productId: string;
    sku: string;
    name: string;
    unit: string;
    category?: string;
    currentStock: number;
    adjustQty: number;
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
        unit: p.unit || 'UND',
        category: p.category,
        currentStock: p.stock,
        adjustQty: 1,
      },
    ]);
    setAdjustSearch('');
    setIsAdjustSearchOpen(false);
  };

  const handleRemoveAdjustRow = (productId: string) => {
    setAdjustRows((prev) => prev.filter((r) => r.productId !== productId));
  };

  const handleUpdateAdjustRowQty = (productId: string, val: number) => {
    setAdjustRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, adjustQty: Math.max(0, val) } : r))
    );
  };

  const handleSaveBatchAdjust = () => {
    if (adjustRows.length === 0) {
      showToast('Agregue al menos un producto para guardar el ajuste de stock.', 'warning');
      return;
    }

    let modifiedCount = 0;
    const newHistoryEntries: any[] = [];
    const newStockAdjustments: StockAdjustmentRecord[] = [];
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    adjustRows.forEach((r) => {
      if (r.adjustQty > 0) {
        const diff = adjustMovementType === 'INGRESO' ? r.adjustQty : -r.adjustQty;
        const finalStock = r.currentStock + diff;
        onStockAdjust(r.productId, diff);
        modifiedCount++;
        newHistoryEntries.push({
          id: `adj-${Date.now()}-${Math.random()}`,
          date: nowStr,
          product: r.name,
          qty: diff,
          reason: `Ajuste (${adjustMovementType}): ${r.currentStock} ➔ ${finalStock}`,
          user: 'Administrador POS',
        });

        const prod = products.find((p) => p.id === r.productId);
        newStockAdjustments.push({
          id: `adj-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          date: nowStr,
          productId: r.productId,
          productName: r.name,
          sku: r.sku,
          qty: diff,
          reason: `Ajuste de Stock (${adjustMovementType}): ${r.currentStock} ➔ ${finalStock}`,
          user: 'Administrador POS',
          costPrice: prod?.costPrice || 0,
          type: 'AJUSTE',
        });
      }
    });

    if (newHistoryEntries.length > 0) {
      setAdjustHistory((prev) => [...newHistoryEntries, ...prev]);
    }
    if (newStockAdjustments.length > 0) {
      setStockAdjustments([...newStockAdjustments, ...stockAdjustments]);
    }

    showToast(
      modifiedCount > 0
        ? `¡Ajuste de stock (${adjustMovementType}) guardado y registrado en el Kardex! (${modifiedCount} productos actualizados)`
        : 'Registro guardado sin cambios en existencias.',
      'success'
    );
    setAdjustRows([]);
  };

  // 7. Transferencias State (Doble Fase Transaccional sincronizada con ferreteria_transfers)
  const [transfers, setTransfers] = useFirestoreSync<StockTransfer[]>('ferreteria_transfers', []);
  const [transferSearchTerm, setTransferSearchTerm] = useState('');
  const [transferStatusFilter, setTransferStatusFilter] = useState<'TODAS' | 'EN_TRANSITO' | 'COMPLETADA' | 'CANCELADA'>('TODAS');

  // Modal Fase 1: Nueva Transferencia & Despacho con Guía de Remisión
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferOrigin, setTransferOrigin] = useState('Bodega Central Norte');
  const [transferDestination, setTransferDestination] = useState('Sucursal Centro POS');
  const [transferResponsible, setTransferResponsible] = useState('Bodega Central');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItemsList, setTransferItemsList] = useState<TransferItem[]>([]);
  
  // Agregar item en Modal Fase 1
  const [transferAddProdId, setTransferAddProdId] = useState('');
  const [transferAddQty, setTransferAddQty] = useState('');

  // Datos de la Guía de Remisión (Fase 1)
  const [guiaDriverName, setGuiaDriverName] = useState('');
  const [guiaDriverId, setGuiaDriverId] = useState('');
  const [guiaLicensePlate, setGuiaLicensePlate] = useState('');
  const [guiaVehicleModel, setGuiaVehicleModel] = useState('');
  const [guiaRoute, setGuiaRoute] = useState('');
  const [guiaStartDate, setGuiaStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [guiaEndDate, setGuiaEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Modal Fase 2: Validar y Confirmar Recepción Física en Destino
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [transferToReceive, setTransferToReceive] = useState<StockTransfer | null>(null);
  const [receivingStaff, setReceivingStaff] = useState('Administrador Sucursal');
  const [receivingNotesInput, setReceivingNotesInput] = useState('');
  const [receptionQuantities, setReceptionQuantities] = useState<{ [productId: string]: number }>({});

  // Modal Visor e Impresión de Guía de Remisión Oficial
  const [isGuiaPrintModalOpen, setIsGuiaPrintModalOpen] = useState(false);
  const [transferToViewGuia, setTransferToViewGuia] = useState<StockTransfer | null>(null);

  // Filtrado de Transferencias
  const filteredTransfers = useMemo(() => {
    return (transfers || []).filter((t) => {
      if (transferStatusFilter !== 'TODAS' && t.status !== transferStatusFilter) return false;

      if (transferSearchTerm.trim()) {
        const term = transferSearchTerm.toLowerCase().trim();
        const matchCode = t.code.toLowerCase().includes(term);
        const matchOrigin = t.originStore.toLowerCase().includes(term);
        const matchDest = t.destinationStore.toLowerCase().includes(term);
        const matchResp = t.responsible.toLowerCase().includes(term);
        const matchDriver = (t.guiaRemision?.driverName || '').toLowerCase().includes(term);
        const matchGuia = (t.guiaRemision?.number || '').toLowerCase().includes(term);
        const matchItem = (t.items || []).some(item => item.productName.toLowerCase().includes(term) || item.sku.toLowerCase().includes(term));
        if (!matchCode && !matchOrigin && !matchDest && !matchResp && !matchDriver && !matchGuia && !matchItem) return false;
      }

      return true;
    });
  }, [transfers, transferStatusFilter, transferSearchTerm]);

  // Métricas de Transferencias
  const transferMetrics = useMemo(() => {
    const all = transfers || [];
    const total = all.length;
    const enTransito = all.filter(t => t.status === 'EN_TRANSITO').length;
    const completadas = all.filter(t => t.status === 'COMPLETADA').length;
    const canceladas = all.filter(t => t.status === 'CANCELADA').length;
    
    // Total de unidades y valor actualmente en tránsito (activo preservado en calle)
    const transitUnits = all.filter(t => t.status === 'EN_TRANSITO').reduce((sum, t) => sum + (t.itemCount || 0), 0);
    const transitValue = all.filter(t => t.status === 'EN_TRANSITO').reduce((sum, t) => sum + (t.totalValue || 0), 0);

    return { total, enTransito, completadas, canceladas, transitUnits, transitValue };
  }, [transfers]);

  // Agregar artículo al carrito de transferencia (Fase 1)
  const handleAddItemToTransferList = () => {
    if (!transferAddProdId) {
      showAlert('Seleccione un artículo del inventario para transferir.', 'Producto Requerido', 'warning');
      return;
    }
    const qty = parseFloat(transferAddQty) || 0;
    if (qty <= 0) {
      showAlert('Ingrese una cantidad válida mayor a 0.', 'Cantidad Inválida', 'warning');
      return;
    }

    const prod = products.find(p => p.id === transferAddProdId);
    if (!prod) return;

    if (qty > prod.stock) {
      showAlert(
        `Stock insuficiente: El producto "${prod.name}" solo dispone de ${prod.stock} ${prod.unit} en existencias.`,
        'Existencias Insuficientes',
        'warning'
      );
      return;
    }

    // Verificar si ya está en la lista
    const existingIndex = transferItemsList.findIndex(i => i.productId === prod.id);
    if (existingIndex >= 0) {
      const updated = [...transferItemsList];
      const newTotalQty = updated[existingIndex].quantity + qty;
      if (newTotalQty > prod.stock) {
        showAlert(
          `La cantidad total a transferir (${newTotalQty}) supera las existencias disponibles (${prod.stock} ${prod.unit}).`,
          'Exceso de Stock',
          'warning'
        );
        return;
      }
      updated[existingIndex].quantity = newTotalQty;
      setTransferItemsList(updated);
    } else {
      setTransferItemsList([
        ...transferItemsList,
        {
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          category: prod.category,
          unit: prod.unit,
          quantity: qty,
          costPrice: prod.costPrice || 0,
        }
      ]);
    }

    setTransferAddProdId('');
    setTransferAddQty('');
  };

  const handleRemoveTransferItem = (productId: string) => {
    setTransferItemsList(transferItemsList.filter(i => i.productId !== productId));
  };

  // Fase 1: Autorizar Salida y Despachar en Tránsito con Guía de Remisión
  const handleCreateAndDispatchTransfer = (e: React.FormEvent) => {
    e.preventDefault();

    if (transferOrigin === transferDestination) {
      showAlert('La bodega de origen y la bodega de destino no pueden ser la misma.', 'Ubicaciones Inválidas', 'warning');
      return;
    }

    if (transferItemsList.length === 0) {
      showAlert('Debe agregar al menos un artículo a la transferencia.', 'Lista Vacía', 'warning');
      return;
    }

    if (!guiaDriverName.trim() || !guiaLicensePlate.trim() || !guiaDriverId.trim()) {
      showAlert(
        'Para amparar el traslado de mercadería es obligatorio registrar los datos del transportista (Nombre, Cédula/RUC y Placa del vehículo).',
        'Guía de Remisión Requerida',
        'warning'
      );
      return;
    }

    const idVal = validateEcuadorianDocument('AUTO', guiaDriverId.trim());
    if (!idVal.isValid) {
      showAlert(idVal.message || 'El documento de identificación del conductor no es válido.', 'Identificación Inválida', 'warning');
      return;
    }

    const totalUnits = transferItemsList.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = transferItemsList.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
    const trfCode = `TRF-2026-${String((transfers || []).length + 1).padStart(4, '0')}`;
    const guiaNumber = `001-002-${String(Math.floor(100000 + Math.random() * 900000))}`;

    // Descontar inmediatamente stock físico en Bodega de Origen
    transferItemsList.forEach(item => {
      onStockAdjust(item.productId, -item.quantity);
    });

    const newTrfRecord: StockTransfer = {
      id: `trf-${Date.now()}`,
      code: trfCode,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      dispatchedAt: new Date().toISOString(),
      originStore: transferOrigin,
      destinationStore: transferDestination,
      itemCount: totalUnits,
      items: transferItemsList,
      totalValue,
      status: 'EN_TRANSITO',
      responsible: transferResponsible || 'Bodega Central',
      notes: transferNotes.trim() || undefined,
      guiaRemision: {
        number: guiaNumber,
        driverName: guiaDriverName.trim(),
        driverIdNumber: guiaDriverId.trim(),
        licensePlate: guiaLicensePlate.trim().toUpperCase(),
        vehicleModel: guiaVehicleModel.trim() || undefined,
        route: guiaRoute.trim() || `${transferOrigin} ➔ ${transferDestination}`,
        transferStartDate: guiaStartDate,
        transferEndDate: guiaEndDate,
        transferReason: 'Traslado entre establecimientos de la misma empresa',
        status: 'EN_TRANSITO'
      }
    };

    setTransfers([newTrfRecord, ...(transfers || [])]);

    // Limpiar formulario y cerrar modal
    setIsTransferModalOpen(false);
    setTransferItemsList([]);
    setTransferNotes('');
    setGuiaDriverName('');
    setGuiaDriverId('');
    setGuiaLicensePlate('');
    setGuiaVehicleModel('');
    setGuiaRoute('');

    showToast(
      `Transferencia ${trfCode} autorizada y despachada. ${totalUnits} unidades en tránsito con Guía de Remisión N° ${guiaNumber}.`,
      'success'
    );

    // Abrir automáticamente el visor de Guía de Remisión para imprimir
    setTransferToViewGuia(newTrfRecord);
    setIsGuiaPrintModalOpen(true);
  };

  // Fase 2: Abrir modal de recepción física
  const handleOpenReceiveModal = (trf: StockTransfer) => {
    setTransferToReceive(trf);
    const initialQtys: { [id: string]: number } = {};
    (trf.items || []).forEach(item => {
      initialQtys[item.productId] = item.quantity;
    });
    setReceptionQuantities(initialQtys);
    setReceivingStaff('Administrador Sucursal');
    setReceivingNotesInput('');
    setIsReceiveModalOpen(true);
  };

  // Fase 2: Confirmar recepción física e ingresar al stock de destino
  const handleConfirmPhysicalReception = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferToReceive) return;

    const receivedItems = (transferToReceive.items || []).map(item => {
      const recQty = receptionQuantities[item.productId] !== undefined ? receptionQuantities[item.productId] : item.quantity;
      return {
        ...item,
        receivedQuantity: recQty
      };
    });

    // Ingresar unidades validadas al stock físico de destino
    receivedItems.forEach(item => {
      const qtyToAdd = item.receivedQuantity !== undefined ? item.receivedQuantity : item.quantity;
      if (qtyToAdd > 0) {
        onStockAdjust(item.productId, qtyToAdd);
      }
    });

    const updatedTransfers = (transfers || []).map(t => {
      if (t.id === transferToReceive.id) {
        return {
          ...t,
          status: 'COMPLETADA' as const,
          receivedAt: new Date().toISOString(),
          receivedBy: receivingStaff || 'Recepción Sucursal',
          receptionNotes: receivingNotesInput.trim() || undefined,
          items: receivedItems,
          guiaRemision: t.guiaRemision ? { ...t.guiaRemision, status: 'EMITIDA' as const } : undefined
        };
      }
      return t;
    });

    setTransfers(updatedTransfers);
    setIsReceiveModalOpen(false);
    setTransferToReceive(null);

    showToast(
      `Recepción física confirmada para ${transferToReceive.code}. Mercadería ingresada exitosamente a ${transferToReceive.destinationStore}.`,
      'success'
    );
  };

  // Anular / Cancelar transferencia en tránsito (Retorna mercadería a origen)
  const handleCancelTransfer = (trf: StockTransfer) => {
    showConfirm(
      `¿Está seguro de cancelar la transferencia ${trf.code}? Las ${trf.itemCount} unidades en tránsito serán retornadas automáticamente al stock de ${trf.originStore}.`,
      () => {
        // Reintegrar mercadería al origen
        (trf.items || []).forEach(item => {
          onStockAdjust(item.productId, item.quantity);
        });

        const updated = (transfers || []).map(t => {
          if (t.id === trf.id) {
            return {
              ...t,
              status: 'CANCELADA' as const,
              notes: `${t.notes ? t.notes + ' • ' : ''}Cancelada y retornada a origen por anulación de traslado.`
            };
          }
          return t;
        });

        setTransfers(updated);
        showToast(`Transferencia ${trf.code} cancelada. Mercadería reincorporada a ${trf.originStore}.`, 'info');
      },
      'Confirmar Cancelación de Traslado',
      'Sí, Cancelar Traslado',
      'Volver'
    );
  };

  // Exportar reporte de transferencias a Excel
  const handleExportTransfersExcel = () => {
    const columns = [
      { header: 'Código Traslado', key: 'code', width: 16 },
      { header: 'Fecha Salida', key: 'date', width: 20 },
      { header: 'Bodega Origen', key: 'originStore', width: 24 },
      { header: 'Bodega Destino', key: 'destinationStore', width: 24 },
      { header: 'Estado Transaccional', key: 'status', width: 18 },
      { header: 'Total Unidades', key: 'itemCount', width: 16 },
      { header: 'Valorización ($)', key: 'totalValue', width: 18 },
      { header: 'N° Guía Remisión', key: 'guiaNumber', width: 20 },
      { header: 'Conductor / Transportista', key: 'driverName', width: 26 },
      { header: 'Placa Vehículo', key: 'licensePlate', width: 16 },
      { header: 'Despachado Por', key: 'responsible', width: 20 },
      { header: 'Recibido Por', key: 'receivedBy', width: 20 },
      { header: 'Fecha Recepción', key: 'receivedAt', width: 20 },
    ];

    const data = filteredTransfers.map(t => ({
      code: t.code,
      date: t.date,
      originStore: t.originStore,
      destinationStore: t.destinationStore,
      status: t.status,
      itemCount: t.itemCount,
      totalValue: formatCurrency(t.totalValue, settings.currencySymbol),
      guiaNumber: t.guiaRemision?.number || 'S/N',
      driverName: t.guiaRemision?.driverName || 'N/A',
      licensePlate: t.guiaRemision?.licensePlate || 'N/A',
      responsible: t.responsible,
      receivedBy: t.receivedBy || 'Pendiente',
      receivedAt: t.receivedAt ? t.receivedAt.replace('T', ' ').substring(0, 16) : 'Pendiente',
    }));

    exportToModernExcel({
      filename: `Reporte_Transferencias_Bodegas_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Transferencias',
      title: 'Registro de Transferencias de Mercadería entre Almacenes (Doble Fase)',
      columns,
      data,
    });

    showToast('Reporte de transferencias exportado a Excel.', 'success');
  };

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

  // Simulación en Vivo para Cambio Masivo
  const bulkChangePreview = useMemo(() => {
    const val = parseFloat(priceAdjustValue) || 0;
    const filteredProds = products.filter((p) =>
      selectedCategoryForPrice === 'TODAS' || p.category === selectedCategoryForPrice
    );

    return filteredProds.map((p) => {
      let currentVal = p.price;
      if (bulkTargetField === 'COSTO') currentVal = p.costPrice || 0;
      if (bulkTargetField === 'STOCK') currentVal = p.stock || 0;

      let newVal = currentVal;
      if (priceAdjustValue.trim() !== '' && !isNaN(val)) {
        if (bulkAdjustType === 'PORCENTAJE_AUMENTO') {
          newVal = currentVal * (1 + val / 100);
        } else if (bulkAdjustType === 'PORCENTAJE_DESCUENTO') {
          newVal = Math.max(0, currentVal * (1 - val / 100));
        } else if (bulkAdjustType === 'INCREMENTO_FIJO') {
          newVal = currentVal + val;
        } else if (bulkAdjustType === 'DESCUENTO_FIJO') {
          newVal = Math.max(0, currentVal - val);
        } else if (bulkAdjustType === 'VALOR_EXACTO') {
          newVal = Math.max(0, val);
        }
      }

      if (bulkTargetField === 'STOCK') {
        newVal = p.allowFractional ? Math.round(newVal * 100) / 100 : Math.round(newVal);
      } else {
        newVal = Math.round(newVal * 100) / 100;
      }

      const diff = newVal - currentVal;

      return {
        product: p,
        currentVal,
        newVal,
        diff,
      };
    });
  }, [products, selectedCategoryForPrice, bulkTargetField, bulkAdjustType, priceAdjustValue]);

  // Exec bulk price, cost, or stock change
  const handleExecutePriceChange = () => {
    if (!priceAdjustValue || isNaN(parseFloat(priceAdjustValue))) {
      showAlert('Por favor ingrese un valor o porcentaje numérico válido.', 'Valor Requerido', 'warning');
      return;
    }

    const val = parseFloat(priceAdjustValue);
    if (val <= 0 && bulkAdjustType !== 'VALOR_EXACTO') {
      showAlert('El porcentaje o valor de ajuste debe ser mayor a 0.', 'Valor Inválido', 'warning');
      return;
    }

    if (bulkChangePreview.length === 0) {
      showAlert('No hay productos en la categoría seleccionada para actualizar.', 'Sin Productos', 'warning');
      return;
    }

    const targetLabel = bulkTargetField === 'PRECIO_VENTA'
      ? 'Precios de Venta'
      : bulkTargetField === 'COSTO'
      ? 'Precios de Costo'
      : 'Stock / Existencias';

    showConfirm(
      `¿Está seguro de aplicar este cambio masivo en los ${targetLabel} de ${bulkChangePreview.length} producto(s)?`,
      () => {
        let count = 0;
        bulkChangePreview.forEach(({ product, newVal, currentVal }) => {
          if (bulkTargetField === 'PRECIO_VENTA') {
            onSaveProduct({ ...product, price: newVal });
            count++;
          } else if (bulkTargetField === 'COSTO') {
            onSaveProduct({ ...product, costPrice: newVal });
            count++;
          } else if (bulkTargetField === 'STOCK') {
            const diff = newVal - currentVal;
            if (diff !== 0) {
              onStockAdjust(product.id, diff);
              count++;
            }
          }
        });

        showToast(`¡Se actualizaron masivamente ${count} productos con éxito!`, 'success');
        setPriceChangeSuccessMsg(`¡${targetLabel} actualizados exitosamente para ${count} productos en [${selectedCategoryForPrice}]!`);
        setPriceAdjustValue('');
      },
      'Confirmar Cambio Masivo',
      'Sí, Aplicar Ahora',
      'Cancelar'
    );
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

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newRecord: StockAdjustmentRecord = {
      id: `adj-${Date.now()}`,
      date: nowStr,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      qty: finalChange,
      reason: `Ajuste de Stock: ${adjustTypeReason.replace(/_/g, ' ')} (${adjustNotes.trim() || 'Sin notas adicionales'})`,
      user: 'Administrador POS',
      costPrice: p.costPrice || 0,
      type: 'AJUSTE',
    };

    setStockAdjustments([newRecord, ...stockAdjustments]);

    setAdjustHistory([
      {
        id: newRecord.id,
        date: newRecord.date,
        product: p.name,
        qty: finalChange,
        reason: `${adjustTypeReason} (${adjustNotes || 'Sin nota'})`,
        user: 'Administrador POS'
      },
      ...adjustHistory
    ]);

    setAdjustNotes('');
    setAdjustQtyVal('10');
    showToast('Ajuste formal guardado y registrado con éxito en el Kardex.', 'success');
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
      `Se ajustarán ${itemsToAdjust.length} productos que presentan discrepancias entre el conteo físico y el sistema.\n\n¿Desea aplicar los ajustes al inventario real y asentarlos en el Kardex?`,
      () => {
        let adjustedCount = 0;
        const auditRecords: StockAdjustmentRecord[] = [];
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

        itemsToAdjust.forEach((item) => {
          onStockAdjust(item.productId, item.diff);
          adjustedCount++;

          const prod = products.find((p) => p.id === item.productId);
          const isSobrante = item.diff > 0;
          auditRecords.push({
            id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            date: nowStr,
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            qty: item.diff,
            reason: `Toma Física (${isSobrante ? 'Sobrante' : 'Faltante'}): Conteo ${item.physicalStock} vs Sistema ${item.systemStock} (Dif: ${item.diff > 0 ? '+' : ''}${item.diff})${auditorName ? ` • Auditor: ${auditorName}` : ''}`,
            user: auditorName ? `Auditor: ${auditorName}` : 'Auditor de Inventario',
            costPrice: prod?.costPrice || 0,
            type: 'TOMA_FISICA',
          });
        });

        if (auditRecords.length > 0) {
          setStockAdjustments([...auditRecords, ...stockAdjustments]);
        }

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

        showToast(`¡Ajuste de inventario aplicado! Se corrigieron ${adjustedCount} productos en el sistema y se registraron en el Kardex.`, 'success');
        setAuditSuccessMsg(`¡Auditoría aplicada exitosamente! Se corrigieron las existencias de ${adjustedCount} productos y quedaron asentadas en el Kardex.`);
      },
      'Confirmar Ajuste de Auditoría Física',
      'Sí, Aplicar Ajustes y Registrar en Kardex',
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
        <div className="space-y-6">
          {isCreatingPromo ? (
            /* + CREACIÓN DE UNA PROMOCIÓN VIEW (MATCHING THE SCREENSHOT) */
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 font-sans">
              {/* Header Title */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="text-blue-600 text-2xl leading-none font-bold">+</span>
                  <span>{editingPromoId ? 'Editar Promoción' : 'Creación de una Promoción'}</span>
                </h2>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold text-slate-500">
                    Código: <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{promoCode}</span>
                  </div>
                </div>
              </div>

              {/* Row 1: Fecha de inicio y finalización | Descuento masivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                {/* Left: Fecha de inicio y finalización */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Fecha de inicio y finalización:
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 shadow-inner">
                    <input
                      type="date"
                      value={promoStartDate}
                      onChange={(e) => setPromoStartDate(e.target.value)}
                      className="bg-transparent border-none outline-none font-mono text-slate-800 cursor-pointer"
                    />
                    <span className="mx-2 text-slate-400 font-bold">-</span>
                    <input
                      type="date"
                      value={promoEndDate}
                      onChange={(e) => setPromoEndDate(e.target.value)}
                      className="bg-transparent border-none outline-none font-mono text-slate-800 cursor-pointer"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 ml-auto" />
                  </div>
                </div>

                {/* Right: Descuento masivo */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Descuento masivo:
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-stretch border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => setMassDiscount((prev) => Math.max(0, prev - 1))}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border-r border-slate-300 transition text-sm cursor-pointer"
                      >
                        -
                      </button>
                      <div className="flex items-center px-2.5 bg-slate-50 text-slate-500 font-bold text-xs border-r border-slate-200">
                        %
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={massDiscount}
                        onChange={(e) => setMassDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                        className="w-16 px-2 py-1.5 text-center font-mono font-bold text-slate-800 text-xs outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setMassDiscount((prev) => Math.min(100, prev + 1))}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border-l border-slate-300 transition text-sm cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyMassDiscount}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aplicar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Buscador de productos + Config Options */}
              <div className="space-y-1.5 relative">
                <label className="block text-xs font-bold text-slate-700">
                  Buscador de productos:
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={promoSearchQuery}
                      onChange={(e) => {
                        setPromoSearchQuery(e.target.value);
                        setIsSearchDropdownOpen(true);
                      }}
                      onFocus={() => setIsSearchDropdownOpen(true)}
                      placeholder="Ingrese un nombre o código de producto"
                      className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />

                    {/* Live Autocomplete Dropdown */}
                    {isSearchDropdownOpen && promoSearchQuery.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {products
                          .filter(
                            (p) =>
                              (p.name && p.name.toLowerCase().includes(promoSearchQuery.toLowerCase())) ||
                              (p.sku && p.sku.toLowerCase().includes(promoSearchQuery.toLowerCase())) ||
                              (p.barcode && p.barcode.toLowerCase().includes(promoSearchQuery.toLowerCase()))
                          )
                          .slice(0, 15)
                          .map((prod) => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => handleAddProductToPromo(prod)}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50/80 transition flex items-center justify-between text-xs cursor-pointer group"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 group-hover:border-blue-300">
                                  {prod.barcode || prod.sku}
                                </span>
                                <span className="font-bold text-slate-800 group-hover:text-blue-600">
                                  {prod.name}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-emerald-600">
                                ${prod.price?.toFixed(4) || '0.0000'}
                              </span>
                            </button>
                          ))}
                        {products.filter(
                          (p) =>
                            (p.name && p.name.toLowerCase().includes(promoSearchQuery.toLowerCase())) ||
                            (p.sku && p.sku.toLowerCase().includes(promoSearchQuery.toLowerCase())) ||
                            (p.barcode && p.barcode.toLowerCase().includes(promoSearchQuery.toLowerCase()))
                        ).length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-500 text-center">
                            No se encontraron productos con "{promoSearchQuery}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Settings Gear Popover Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsPromoSettingsOpen(!isPromoSettingsOpen)}
                      className="p-2 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-slate-600 shadow-sm transition cursor-pointer"
                      title="Opciones de Productos"
                    >
                      <Settings className="w-4 h-4" />
                    </button>

                    {isPromoSettingsOpen && (
                      <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 divide-y divide-slate-100 text-xs">
                        <button
                          type="button"
                          onClick={handleLoadDemoPromoItems}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 cursor-pointer"
                        >
                          <span>✨</span>
                          <span>Cargar productos demo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            products.slice(0, 50).forEach((p) => handleAddProductToPromo(p));
                            setIsPromoSettingsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 cursor-pointer"
                        >
                          <span>📦</span>
                          <span>Agregar inventario activo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPromoItems([]);
                            setIsPromoSettingsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 font-bold flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Limpiar lista</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Table matching screenshot */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#24303f] text-white uppercase text-[11px] font-black tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-16">ELIMINAR</th>
                        <th className="py-2.5 px-4 w-40">CÓDIGO</th>
                        <th className="py-2.5 px-4">PRODUCTO</th>
                        <th className="py-2.5 px-4 w-32">P. / ACTUAL</th>
                        <th className="py-2.5 px-4 text-center w-48">DESCUENTO</th>
                        <th className="py-2.5 px-4 w-32">T. / DSCTO</th>
                        <th className="py-2.5 px-4 w-32">P. / FINAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {promoItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-bold text-slate-600">No hay productos agregados a la promoción</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Utilice el buscador arriba o cargue los productos de demostración.
                            </p>
                            <button
                              type="button"
                              onClick={handleLoadDemoPromoItems}
                              className="mt-3 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 transition cursor-pointer text-xs"
                            >
                              Cargar productos demo
                            </button>
                          </td>
                        </tr>
                      ) : (
                        promoItems
                          .slice((promoCurrentPage - 1) * promoPageSize, promoCurrentPage * promoPageSize)
                          .map((item, localIdx) => {
                            const actualIdx = (promoCurrentPage - 1) * promoPageSize + localIdx;
                            return (
                              <tr key={item.productId || actualIdx} className="hover:bg-slate-50/80 transition">
                                {/* ELIMINAR */}
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePromoItem(actualIdx)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition cursor-pointer inline-flex items-center justify-center"
                                    title="Eliminar producto"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>

                                {/* CÓDIGO */}
                                <td className="py-2.5 px-4 font-mono text-slate-700 font-semibold text-[11px]">
                                  {item.barcode || item.sku}
                                </td>

                                {/* PRODUCTO */}
                                <td className="py-2.5 px-4 font-bold text-slate-900 uppercase">
                                  {item.productName}
                                </td>

                                {/* P. / ACTUAL */}
                                <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                                  ${item.currentPrice.toFixed(4)}
                                </td>

                                {/* DESCUENTO (STEPPER) */}
                                <td className="py-2.5 px-4 text-center">
                                  <div className="inline-flex items-center gap-1.5 justify-center">
                                    <div className="inline-flex items-stretch border border-slate-300 rounded overflow-hidden bg-white shadow-xs">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateItemDiscount(actualIdx, -1)}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border-r border-slate-300 transition text-xs cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={item.discountPercent}
                                        onChange={(e) =>
                                          handleSetItemDiscountDirect(actualIdx, parseFloat(e.target.value) || 0)
                                        }
                                        className="w-12 px-1.5 py-1 text-center font-mono font-bold text-slate-800 text-xs outline-none bg-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateItemDiscount(actualIdx, 1)}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border-l border-slate-300 transition text-xs cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>
                                    <span className="text-slate-600 font-bold text-xs">%</span>
                                  </div>
                                </td>

                                {/* T. / DSCTO */}
                                <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                                  ${item.discountAmount.toFixed(4)}
                                </td>

                                {/* P. / FINAL */}
                                <td className="py-2.5 px-4 font-mono font-bold text-blue-700">
                                  ${item.finalPrice.toFixed(4)}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer: Mostrando registros + Paginación */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium">
                  <div>
                    {promoItems.length > 0 ? (
                      <span>
                        Mostrando {(promoCurrentPage - 1) * promoPageSize + 1} a{' '}
                        {Math.min(promoCurrentPage * promoPageSize, promoItems.length)} de {promoItems.length} registros
                      </span>
                    ) : (
                      <span>Mostrando 0 a 0 de 0 registros</span>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={promoCurrentPage <= 1}
                      onClick={() => setPromoCurrentPage(1)}
                      className="p-1 rounded border border-slate-300 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Primera página"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={promoCurrentPage <= 1}
                      onClick={() => setPromoCurrentPage((prev) => Math.max(1, prev - 1))}
                      className="p-1 rounded border border-slate-300 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    {Array.from(
                      { length: Math.ceil(promoItems.length / promoPageSize) || 1 },
                      (_, i) => i + 1
                    ).map((pg) => (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setPromoCurrentPage(pg)}
                        className={`px-2.5 py-1 rounded border text-xs font-bold transition cursor-pointer ${
                          pg === promoCurrentPage
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {pg}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={promoCurrentPage >= (Math.ceil(promoItems.length / promoPageSize) || 1)}
                      onClick={() =>
                        setPromoCurrentPage((prev) =>
                          Math.min(Math.ceil(promoItems.length / promoPageSize) || 1, prev + 1)
                        )
                      }
                      className="p-1 rounded border border-slate-300 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Página siguiente"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={promoCurrentPage >= (Math.ceil(promoItems.length / promoPageSize) || 1)}
                      onClick={() => setPromoCurrentPage(Math.ceil(promoItems.length / promoPageSize) || 1)}
                      className="p-1 rounded border border-slate-300 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Última página"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 4: Bottom Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSavePromoRecord}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar registro</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreatingPromo(false)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Cancelar</span>
                </button>
              </div>
            </div>
          ) : (
            /* DASHBOARD / LIST OF PROMOTIONS */
            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-pink-500" />
                    <span>Gestor de Ofertas & Promociones</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configura campañas de descuento por porcentaje, combos o volúmenes de compra con vigencia programada.
                  </p>
                </div>

                <button
                  onClick={() => handleOpenCreatePromo()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
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
                      <th className="py-3 px-4">Alcance / Productos</th>
                      <th className="py-3 px-4 text-center">Descuento</th>
                      <th className="py-3 px-4 text-center">Vigencia</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {promotions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400">
                          <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="font-bold text-slate-600">No hay promociones registradas</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Haz clic en "Nueva Promoción" para crear una campaña de descuentos.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      promotions.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-black text-slate-900">
                            <span className="font-mono text-blue-600 text-[11px] block">{p.code}</span>
                            {p.name}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-700">
                            {p.items && p.items.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                                📦 {p.items.length} producto{p.items.length > 1 ? 's' : ''} en campaña
                              </span>
                            ) : p.productName ? (
                              <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                                📦 {p.productName}
                              </span>
                            ) : p.appliedCategory && p.appliedCategory !== 'TODOS' ? (
                              <span className="inline-flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
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
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenCreatePromo(p)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                                title="Editar Promoción"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPromotions(promotions.filter((item) => item.id !== p.id))}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                title="Eliminar Promoción"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-amber-500/10 text-amber-600 rounded-2xl border border-amber-500/20 shadow-xs">
                <Calendar className="w-7 h-7 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black text-slate-950 tracking-tight">
                    Control de Lotes y Fechas de Caducidad (FEFO)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-orange-50 text-orange-700 border border-orange-200">
                    Sincronizado con Compras
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed font-medium">
                  Rastreo cronológico de lotes ingresados mediante <strong>Facturas de Compra a Proveedores</strong> y almacén. 
                  Aplica el principio <strong>FEFO</strong> (<em>First Expired, First Out</em>) para garantizar que la mercadería con vencimiento más próximo rote primero en ventas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end lg:self-center">
              <button
                type="button"
                onClick={handleExportBatchesExcel}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-2 border border-slate-200"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setIsNewBatchModalOpen(true)}
                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Lote Manual</span>
              </button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                  Total Lotes Rastreados
                </span>
                <Boxes className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-3xl font-black font-mono text-slate-950">
                  {batchMetrics.total}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {batchMetrics.totalUnits} u. en almacén
                </span>
              </div>
            </div>

            {/* Vigentes */}
            <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-xs space-y-1 bg-gradient-to-br from-emerald-50/40 to-transparent">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">
                  Lotes Vigentes
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-3xl font-black font-mono text-emerald-700">
                  {batchMetrics.vigentes}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Óptimo
                </span>
              </div>
            </div>

            {/* Por Vencer */}
            <div className="bg-white border border-amber-200/80 rounded-2xl p-5 shadow-xs space-y-1 bg-gradient-to-br from-amber-50/40 to-transparent">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-amber-700 tracking-wider">
                  Por Vencer (≤ 30 días)
                </span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-3xl font-black font-mono text-amber-700">
                  {batchMetrics.porVencer}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                  Priorizar Venta
                </span>
              </div>
            </div>

            {/* Vencidos */}
            <div className="bg-white border border-rose-200/80 rounded-2xl p-5 shadow-xs space-y-1 bg-gradient-to-br from-rose-50/40 to-transparent">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-rose-700 tracking-wider">
                  Lotes Vencidos
                </span>
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-3xl font-black font-mono text-rose-700">
                  {batchMetrics.vencidos}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                  {batchMetrics.vencidos > 0 ? 'Retirar / Devolver' : 'Cero vencidos'}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por producto, SKU, número de lote, proveedor o factura..."
                value={batchSearchTerm}
                onChange={(e) => setBatchSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBatchStatusFilter('TODOS')}
                className={`px-3 py-2 rounded-xl font-bold transition cursor-pointer ${
                  batchStatusFilter === 'TODOS'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({batchMetrics.total})
              </button>
              <button
                type="button"
                onClick={() => setBatchStatusFilter('POR_VENCER')}
                className={`px-3 py-2 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                  batchStatusFilter === 'POR_VENCER'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <span>⚠️ Por Vencer</span>
                <span className="font-mono">({batchMetrics.porVencer})</span>
              </button>
              <button
                type="button"
                onClick={() => setBatchStatusFilter('VENCIDOS')}
                className={`px-3 py-2 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                  batchStatusFilter === 'VENCIDOS'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <span>⛔ Vencidos</span>
                <span className="font-mono">({batchMetrics.vencidos})</span>
              </button>
              <button
                type="button"
                onClick={() => setBatchStatusFilter('VIGENTES')}
                className={`px-3 py-2 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                  batchStatusFilter === 'VIGENTES'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <span>✅ Vigentes</span>
                <span className="font-mono">({batchMetrics.vigentes})</span>
              </button>
            </div>

            {/* Location Filter */}
            <div className="w-full md:w-56">
              <Select
                value={batchLocationFilter}
                onChange={(e) => setBatchLocationFilter(e.target.value)}
                className="w-full py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              >
                <option value="TODAS">Todas las Bodegas</option>
                {availableBatchLocations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Batches Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Producto & SKU</th>
                    <th className="py-3 px-4">N° de Lote</th>
                    <th className="py-3 px-4">Factura Compra / Proveedor</th>
                    <th className="py-3 px-4 text-center">Fecha Compra</th>
                    <th className="py-3 px-4 text-center">Fecha Caducidad</th>
                    <th className="py-3 px-4 text-right">Cantidad Stock</th>
                    <th className="py-3 px-4">Bodega / Ubicación</th>
                    <th className="py-3 px-4 text-center">Alerta FEFO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-2">
                          <Boxes className="w-6 h-6" />
                        </div>
                        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                          No se encontraron lotes registrados
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 font-medium">
                          {batchSearchTerm || batchStatusFilter !== 'TODOS'
                            ? 'Intenta ajustar los filtros de búsqueda o seleccionar otra condición de vencimiento.'
                            : 'Los lotes registrados al ingresar facturas de compra de proveedores aparecerán automáticamente en esta lista.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Producto & SKU */}
                        <td className="py-3 px-4">
                          <div className="font-black text-slate-950 text-xs">{b.productName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                              SKU: {b.sku}
                            </span>
                            {b.category && (
                              <span className="text-[10px] text-slate-400">
                                • {b.category}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* N° de Lote */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                            <Boxes className="w-3 h-3 text-slate-500" />
                            <span>{b.batchNumber}</span>
                          </span>
                        </td>

                        {/* Factura Compra & Proveedor */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900 text-xs flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                            <span>{b.invoiceNumber}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]" title={b.supplierName}>
                            {b.supplierName}
                          </div>
                        </td>

                        {/* Fecha Compra */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="font-mono font-semibold text-slate-600 text-xs">
                            {b.purchaseDate || '—'}
                          </span>
                        </td>

                        {/* Fecha Caducidad & Días */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="font-mono font-black text-xs text-slate-900">
                            {b.expiryDate}
                          </div>
                          {b.daysRemaining !== 9999 && (
                            <div className="mt-0.5">
                              {b.daysRemaining < 0 ? (
                                <span className="text-[10px] font-black text-rose-600">
                                  Vencido hace {Math.abs(b.daysRemaining)} días
                                </span>
                              ) : b.daysRemaining <= 30 ? (
                                <span className="text-[10px] font-black text-amber-600">
                                  Caduca en {b.daysRemaining} días
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-400">
                                  {b.daysRemaining} días restantes
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Cantidad Stock */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="font-mono font-black text-slate-900 text-xs">
                            {b.quantity} <span className="text-[10px] font-bold text-slate-500">{b.unit}</span>
                          </span>
                          {b.costPrice ? (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Costo: {formatCurrency(b.costPrice, settings.currencySymbol)}
                            </div>
                          ) : null}
                        </td>

                        {/* Ubicación Bodega */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>{b.location}</span>
                          </span>
                        </td>

                        {/* Estado Alerta */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                              b.status === 'VIGENTE'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : b.status === 'POR_VENCER'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-rose-50 border-rose-200 text-rose-700'
                            }`}
                          >
                            {b.status === 'VIGENTE' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : b.status === 'POR_VENCER' ? (
                              <Clock className="w-3 h-3 text-amber-600" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                            )}
                            <span>{b.status === 'POR_VENCER' ? 'Por Vencer' : b.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
              <div>
                Mostrando <strong className="text-slate-900 font-bold">{filteredBatches.length}</strong> de <strong className="text-slate-900 font-bold">{consolidatedBatches.length}</strong> lotes registrados en inventario
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Vigente (&gt; 30d)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Por Vencer (≤ 30d)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Vencido
                </span>
              </div>
            </div>
          </div>

          {/* Modal para Registrar Lote Manual */}
          {isNewBatchModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black tracking-tight">Registrar Lote de Inventario</h3>
                      <p className="text-[11px] text-slate-400">Asocia un número de lote y fecha de vencimiento a un artículo</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewBatchModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveManualBatch} className="p-6 space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Seleccionar Producto *</label>
                    <Select
                      value={newBatchProductId}
                      onChange={(e) => setNewBatchProductId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="">-- Seleccionar producto del catálogo --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (SKU: {p.sku}) - Stock: {p.stock} {p.unit}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Número de Lote</label>
                      <input
                        type="text"
                        placeholder="ej: LOT-2026-X1"
                        value={newBatchNumber}
                        onChange={(e) => setNewBatchNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Fecha de Caducidad</label>
                      <CustomDatePicker
                        value={newBatchExpiryDate}
                        onChange={setNewBatchExpiryDate}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Cantidad en Lote *</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        placeholder="Cantidad"
                        value={newBatchQty}
                        onChange={(e) => setNewBatchQty(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Bodega / Ubicación</label>
                      <Select
                        value={newBatchLocation}
                        onChange={(e) => setNewBatchLocation(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                      >
                        {availableBatchLocations.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsNewBatchModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                    >
                      Guardar Lote
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 6: CAMBIO DE PRECIO MASIVO
         --------------------------------------------------------------------- */}
      {subTab === 'CAMBIO_PRECIO_MASIVO' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                <span>Actualización Masiva de Precios, Costos y Stock</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aplica incrementos, descuentos o valores exactos a categorías completas de artículos o al catálogo general.
              </p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-full">
                {bulkChangePreview.length} Productos Seleccionados
              </span>
            </div>
          </div>

          {priceChangeSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{priceChangeSuccessMsg}</span>
              </div>
              <button onClick={() => setPriceChangeSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
            </div>
          )}

          {/* Form controls grid */}
          <div className="p-5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-4 text-xs shadow-inner">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Target Field */}
              <div>
                <label className="block font-black text-slate-800 mb-1">1. Campo a Ajustar</label>
                <CustomSelect
                  value={bulkTargetField}
                  onChange={(val) => setBulkTargetField(val as any)}
                  options={[
                    { value: 'PRECIO_VENTA', label: 'Precio de Venta ($)', color: 'emerald' },
                    { value: 'COSTO', label: 'Precio de Costo ($)', color: 'amber' },
                    { value: 'STOCK', label: 'Stock / Existencias (unid)', color: 'blue' }
                  ]}
                  variant="dark"
                  className="w-full"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block font-black text-slate-800 mb-1">2. Categoría de Productos</label>
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

              {/* Adjust Operation Type */}
              <div>
                <label className="block font-black text-slate-800 mb-1">3. Tipo de Operación</label>
                <CustomSelect
                  value={bulkAdjustType}
                  onChange={(val) => setBulkAdjustType(val as any)}
                  options={[
                    { value: 'PORCENTAJE_AUMENTO', label: 'Aumento Porcentual (+%)', color: 'emerald' },
                    { value: 'PORCENTAJE_DESCUENTO', label: 'Descuento Porcentual (-%)', color: 'rose' },
                    { value: 'INCREMENTO_FIJO', label: 'Incremento Fijo (+monto/unid)', color: 'blue' },
                    { value: 'DESCUENTO_FIJO', label: 'Descuento Fijo (-monto/unid)', color: 'amber' },
                    { value: 'VALOR_EXACTO', label: 'Establecer Valor Fijo Exacto', color: 'purple' }
                  ]}
                  variant="dark"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end pt-1">
              <div>
                <label className="block font-black text-slate-800 mb-1">
                  4. Valor / Porcentaje a Aplicar
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="Ej: 10 para 10% o $10"
                    value={priceAdjustValue}
                    onChange={(e) => setPriceAdjustValue(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl font-mono font-bold text-slate-900 text-sm shadow-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {bulkAdjustType.includes('PORCENTAJE') ? '%' : bulkTargetField === 'STOCK' ? 'unid' : '$'}
                  </span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleExecutePriceChange}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Aplicar Cambio Masivo Ahora ({bulkChangePreview.length} Productos)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 tracking-wide uppercase flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-600" />
                <span>Simulación en Vivo / Vista Previa de Cambios</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Mostrando la simulación del resultado final antes de confirmar
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-96">
              <table className="w-full text-left text-xs text-slate-800">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-900 font-black sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 w-28">Código SKU</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3 text-right">Valor Actual</th>
                    <th className="py-2.5 px-3 text-right">Nuevo Valor Proyectado</th>
                    <th className="py-2.5 px-3 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium">
                  {bulkChangePreview.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No hay productos que coincidan con la categoría seleccionada.
                      </td>
                    </tr>
                  ) : (
                    bulkChangePreview.map(({ product, currentVal, newVal, diff }) => {
                      const isMoney = bulkTargetField !== 'STOCK';
                      const isUp = diff > 0;
                      const isDown = diff < 0;

                      return (
                        <tr key={product.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {product.sku}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {product.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {product.category}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            {isMoney ? formatCurrency(currentVal, settings.currencySymbol) : `${currentVal} ${product.unit || 'u.'}`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/50">
                            {isMoney ? formatCurrency(newVal, settings.currencySymbol) : `${newVal} ${product.unit || 'u.'}`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {diff === 0 ? (
                              <span className="text-slate-400">0.00</span>
                            ) : isUp ? (
                              <span className="text-emerald-600">
                                +{isMoney ? formatCurrency(diff, settings.currencySymbol) : `${diff} ${product.unit || 'u.'}`}
                              </span>
                            ) : (
                              <span className="text-rose-600">
                                {isMoney ? formatCurrency(diff, settings.currencySymbol) : `${diff} ${product.unit || 'u.'}`}
                              </span>
                            )}
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
          SUBTAB 7: AJUSTE DE STOCK DE PRODUCTOS
         --------------------------------------------------------------------- */}
      {subTab === 'AJUSTE_STOCK' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-5 shadow-sm">
          {/* Breadcrumb / Top Indicator */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 border-b border-slate-100 pb-3">
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-slate-400" /> Panel</span>
            <span>/</span>
            <span className="text-slate-900 flex items-center gap-1"><Boxes className="w-3.5 h-3.5 text-orange-500" /> Productos</span>
          </div>

          {/* Title Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-950 flex items-center gap-2 tracking-tight">
              <Sliders className="w-6 h-6 text-slate-800" />
              <span>Ajuste de Stock de Productos</span>
            </h2>
          </div>

          {/* 1. Tipo de Movimiento Section */}
          <div className="max-w-xs space-y-1">
            <label className="block text-xs font-bold text-slate-800">
              Tipo de Movimento:
            </label>
            <Select
              value={adjustMovementType}
              onChange={(e) => setAdjustMovementType(e.target.value as 'INGRESO' | 'EGRESO')}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            >
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
            </Select>
          </div>

          {/* 2. Buscador de productos Section */}
          <div className="space-y-1 relative">
            <label className="block text-xs font-bold text-slate-800">
              Buscador de productos:
            </label>

            <div className="flex items-center">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Ingrese un nombre o código de producto"
                  value={adjustSearch}
                  onChange={(e) => {
                    setAdjustSearch(e.target.value);
                    setIsAdjustSearchOpen(true);
                  }}
                  onFocus={() => setIsAdjustSearchOpen(true)}
                  className="w-full pl-3.5 pr-10 py-2 bg-white border border-slate-300 focus:border-blue-500 text-slate-900 text-xs font-medium rounded-l-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
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
                className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-r-xl border border-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <Sliders className="w-4 h-4" />
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
                          Código: {p.sku} • {p.unit || 'UND'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-700 block">Stock: {p.stock}</span>
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

          {/* 3. Table: Ajuste de Stock */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold text-xs">
                <tr>
                  <th className="py-2.5 px-3 text-center w-20">Eliminar</th>
                  <th className="py-2.5 px-3 w-40">Código</th>
                  <th className="py-2.5 px-3">Producto</th>
                  <th className="py-2.5 px-3 text-center w-36">Unidad de Medida</th>
                  <th className="py-2.5 px-3 text-center w-36">Stock actual</th>
                  <th className="py-2.5 px-3 text-center w-48">Cantidad de ajuste</th>
                  <th className="py-2.5 px-3 text-center w-36">Nuevo stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-medium">
                {adjustRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-500" />
                      <p className="font-bold text-slate-700 text-sm">No hay productos seleccionados para ajuste</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Utilice el buscador superior para agregar productos a la lista de ajuste.
                      </p>
                    </td>
                  </tr>
                ) : (
                  adjustRows.map((row) => {
                    const nuevoStock = adjustMovementType === 'INGRESO'
                      ? row.currentStock + row.adjustQty
                      : Math.max(0, row.currentStock - row.adjustQty);

                    return (
                      <tr key={row.productId} className="hover:bg-slate-50/80 transition">
                        {/* Eliminar Button */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveAdjustRow(row.productId)}
                            className="w-7 h-7 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition flex items-center justify-center mx-auto cursor-pointer shadow-2xs"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>

                        {/* Código */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {row.sku}
                        </td>

                        {/* Producto */}
                        <td className="py-2.5 px-3 font-bold text-slate-900 uppercase">
                          {row.name}
                        </td>

                        {/* Unidad de Medida */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700 uppercase">
                          {row.unit || 'UND'}
                        </td>

                        {/* Stock actual Badge */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-mono font-bold text-xs rounded-full inline-block">
                            {row.currentStock.toFixed(2)}
                          </span>
                        </td>

                        {/* Cantidad de ajuste with - and + buttons */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleUpdateAdjustRowQty(row.productId, Math.max(0, row.adjustQty - 1))}
                              className="px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white font-black rounded-l-md transition cursor-pointer text-xs"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={row.adjustQty === 0 ? '' : row.adjustQty}
                              onChange={(e) => handleUpdateAdjustRowQty(row.productId, parseFloat(e.target.value) || 0)}
                              className="w-20 py-1 px-2 border-y border-slate-300 text-center font-mono font-bold text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateAdjustRowQty(row.productId, row.adjustQty + 1)}
                              className="px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white font-black rounded-r-md transition cursor-pointer text-xs"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Nuevo stock */}
                        <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 text-xs">
                          {nuevoStock.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 4. Footer info & Pagination */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-600 font-medium">
              Mostrando {adjustRows.length > 0 ? 1 : 0} a {adjustRows.length} de {adjustRows.length} registros
            </div>
            {adjustRows.length > 0 && (
              <div className="flex items-center space-x-1 text-xs">
                <button type="button" disabled className="px-2 py-1 bg-slate-100 text-slate-400 rounded cursor-not-allowed">&laquo;</button>
                <button type="button" disabled className="px-2 py-1 bg-slate-100 text-slate-400 rounded cursor-not-allowed">&lt;</button>
                <span className="px-3 py-1 bg-blue-600 text-white rounded font-bold">1</span>
                <button type="button" disabled className="px-2 py-1 bg-slate-100 text-slate-400 rounded cursor-not-allowed">&gt;</button>
                <button type="button" disabled className="px-2 py-1 bg-slate-100 text-slate-400 rounded cursor-not-allowed">&raquo;</button>
              </div>
            )}
          </div>

          {/* 5. Action Buttons: Guardar registro & Cancelar */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={handleSaveBatchAdjust}
              disabled={adjustRows.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Guardar registro</span>
            </button>

            <button
              type="button"
              onClick={() => setAdjustRows([])}
              disabled={adjustRows.length === 0}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer shadow-xs"
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
          {/* Header Banner & Action Buttons */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 text-blue-600 rounded-2xl border border-blue-500/30 shadow-xs mt-0.5">
                <ArrowLeftRight className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-slate-950 tracking-tight">Transferencias de Mercadería entre Almacenes</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                    Doble Fase Transaccional
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    Guía de Remisión SRI
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-3xl">
                  Movimiento en dos tiempos: Despacho y descuento en bodega de origen con emisión obligatoria de Guía de Remisión, clasificación como mercadería en tránsito y posterior validación e ingreso oficial al stock en destino.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => {
                  setEditingWarehouse(null);
                  setWarehouseFormData({ name: '', code: '', address: '', city: 'Quito', phone: '', isMain: false });
                  setIsWarehouseModalOpen(true);
                }}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 border border-slate-300 cursor-pointer shrink-0"
                title="Administrar bodegas reales, almacenes y sucursales"
              >
                <Building className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                <span>Gestionar Bodegas</span>
              </button>

              <button
                type="button"
                onClick={handleExportTransfersExcel}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 border border-slate-800 cursor-pointer shrink-0"
                title="Exportar historial de traslados a Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                <span>Exportar Excel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransferItemsList([]);
                  setGuiaDriverName('');
                  setGuiaDriverId('');
                  setGuiaLicensePlate('');
                  setGuiaVehicleModel('');
                  setGuiaRoute(`${transferOrigin} ➔ ${transferDestination}`);
                  setIsTransferModalOpen(true);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Nueva Transferencia & Despacho</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total de Traslados</p>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">{transferMetrics.total}</span>
                <span className="text-xs text-slate-500 font-bold">registros</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Historial consolidado</p>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Mercadería en Tránsito</p>
                {transferMetrics.enTransito > 0 && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                )}
              </div>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-black text-amber-900 font-mono">{transferMetrics.enTransito}</span>
                <span className="text-xs text-amber-700 font-bold">en camino</span>
              </div>
              <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                {transferMetrics.transitUnits} unidades en calle amparadas
              </p>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
              <p className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Recepciones Completadas</p>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-black text-emerald-900 font-mono">{transferMetrics.completadas}</span>
                <span className="text-xs text-emerald-700 font-bold">ingresadas</span>
              </div>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Stock en destino confirmado</p>
            </div>

            <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
              <p className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Activo en Tránsito (CPP)</p>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl font-black text-blue-900 font-mono">
                  {formatCurrency(transferMetrics.transitValue, settings.currencySymbol)}
                </span>
              </div>
              <p className="text-[10px] text-blue-600 font-medium mt-0.5">Valoración global intacta</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código, bodega, chofer, placa, guía o producto..."
                value={transferSearchTerm}
                onChange={(e) => setTransferSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['TODAS', 'EN_TRANSITO', 'COMPLETADA', 'CANCELADA'] as const).map((st) => {
                const isSelected = transferStatusFilter === st;
                const label = st === 'TODAS' ? 'Todas' : st === 'EN_TRANSITO' ? 'En Tránsito' : st === 'COMPLETADA' ? 'Completadas' : 'Canceladas';
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTransferStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transfers Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código / Fecha</th>
                  <th className="py-3 px-4">Ruta del Traslado</th>
                  <th className="py-3 px-4 text-center">Unidades / Valor</th>
                  <th className="py-3 px-4">Guía de Remisión & Transporte</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
                      <p className="font-bold text-slate-600 text-sm">No se encontraron transferencias</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {transferSearchTerm || transferStatusFilter !== 'TODAS'
                          ? 'Ajuste los filtros o términos de búsqueda.'
                          : 'Haga clic en "+ Nueva Transferencia & Despacho" para iniciar el proceso transaccional.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((t) => {
                    const isTransit = t.status === 'EN_TRANSITO';
                    const isCompleted = t.status === 'COMPLETADA';
                    const isCancelled = t.status === 'CANCELADA';

                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-black text-orange-600 block text-xs">{t.code}</span>
                          <span className="text-[10px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {t.date}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase text-slate-400">Origen</span>
                              <span className="font-bold text-slate-900 flex items-center gap-1">
                                <Building className="w-3 h-3 text-slate-500" />
                                {t.originStore}
                              </span>
                            </div>
                            <span className="text-slate-400 font-black px-1">➔</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase text-slate-400">Destino</span>
                              <span className="font-bold text-emerald-800 flex items-center gap-1">
                                <Building className="w-3 h-3 text-emerald-600" />
                                {t.destinationStore}
                              </span>
                            </div>
                          </div>
                          {t.responsible && (
                            <span className="text-[10px] text-slate-400 block mt-1">
                              Autorizado por: <strong className="text-slate-600">{t.responsible}</strong>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="font-black font-mono text-slate-900 text-xs block">
                            {t.itemCount} unidades
                          </span>
                          <span className="text-[11px] font-bold font-mono text-slate-600 block mt-0.5">
                            {formatCurrency(t.totalValue, settings.currencySymbol)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {(t.items || []).length} ítems en despacho
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {t.guiaRemision ? (
                            <div className="space-y-0.5">
                              <span className="font-black text-slate-900 font-mono text-[11px] flex items-center gap-1">
                                <FileText className="w-3 h-3 text-amber-500" />
                                N° {t.guiaRemision.number}
                              </span>
                              <p className="text-[11px] text-slate-600 font-medium">
                                <strong>Chofer:</strong> {t.guiaRemision.driverName}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                <strong>Placa:</strong> {t.guiaRemision.licensePlate} • CI/RUC: {t.guiaRemision.driverIdNumber}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Sin guía asignada</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {isTransit && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                              </span>
                              En Tránsito
                            </span>
                          )}
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Completada
                            </span>
                          )}
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                              <X className="w-3 h-3 text-rose-600" />
                              Cancelada
                            </span>
                          )}

                          {isCompleted && t.receivedAt && (
                            <span className="block text-[9px] text-slate-400 mt-1 font-mono">
                              Recibido: {t.receivedAt.replace('T', ' ').substring(0, 16)}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver / Imprimir Guía */}
                            <button
                              type="button"
                              onClick={() => {
                                setTransferToViewGuia(t);
                                setIsGuiaPrintModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                              title="Ver e Imprimir Guía de Remisión Oficial"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-600" />
                              <span className="hidden sm:inline">Guía</span>
                            </button>

                            {/* Fase 2: Recepción Física (solo si está EN_TRANSITO) */}
                            {isTransit && (
                              <button
                                type="button"
                                onClick={() => handleOpenReceiveModal(t)}
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                                title="Confirmar recepción física de mercadería en bodega de destino"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Recibir en Destino</span>
                              </button>
                            )}

                            {/* Cancelar (solo si está EN_TRANSITO) */}
                            {isTransit && (
                              <button
                                type="button"
                                onClick={() => handleCancelTransfer(t)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                title="Anular traslado y retornar mercadería a bodega de origen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
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
            <div className="text-slate-400 text-[11px] font-medium">
              Usa los botones principales de la cabecera para descargar la planilla o aplicar los ajustes.
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

      {/* ---------------------------------------------------------------------
          MODAL 1: NUEVA TRANSFERENCIA Y DESPACHO (FASE 1: CON GUÍA DE REMISIÓN)
         --------------------------------------------------------------------- */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp my-auto">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-orange-500/30 to-amber-500/20 text-orange-400 rounded-2xl border border-orange-500/30">
                  <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black tracking-tight text-white">
                      Nueva Transferencia & Despacho de Mercadería
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30">
                      Fase 1: Despacho
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Descuenta inmediatamente el stock de origen y emite la Guía de Remisión obligatoria para el traslado en tránsito.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateAndDispatchTransfer} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Sección 1: Bodegas de Origen y Destino */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                      1. Definición de Ruta y Responsable
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWarehouse(null);
                      setWarehouseFormData({ name: '', code: '', address: '', city: 'Quito', phone: '', isMain: false });
                      setIsWarehouseModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg transition flex items-center gap-1 border border-blue-200 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Administrar / Crear Bodegas Reales</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Bodega de Origen (Salida) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWarehouse(null);
                          setWarehouseFormData({ name: '', code: '', address: '', city: 'Quito', phone: '', isMain: false });
                          setIsWarehouseModalOpen(true);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                        title="Crear nueva bodega real"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nueva</span>
                      </button>
                    </div>
                    <select
                      value={transferOrigin}
                      onChange={(e) => {
                        setTransferOrigin(e.target.value);
                        const origWh = (warehouses || []).find(w => w.name === e.target.value);
                        const destWh = (warehouses || []).find(w => w.name === transferDestination);
                        const origCity = origWh?.city ? ` (${origWh.city})` : '';
                        const destCity = destWh?.city ? ` (${destWh.city})` : '';
                        setGuiaRoute(`${e.target.value}${origCity} ➔ ${transferDestination}${destCity}`);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      {availableBatchLocations.map((loc) => (
                        <option key={`orig-${loc}`} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">El stock se descontará de aquí</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        Bodega de Destino (Llegada) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWarehouse(null);
                          setWarehouseFormData({ name: '', code: '', address: '', city: 'Quito', phone: '', isMain: false });
                          setIsWarehouseModalOpen(true);
                        }}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
                        title="Crear nueva bodega real"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nueva</span>
                      </button>
                    </div>
                    <select
                      value={transferDestination}
                      onChange={(e) => {
                        setTransferDestination(e.target.value);
                        const origWh = (warehouses || []).find(w => w.name === transferOrigin);
                        const destWh = (warehouses || []).find(w => w.name === e.target.value);
                        const origCity = origWh?.city ? ` (${origWh.city})` : '';
                        const destCity = destWh?.city ? ` (${destWh.city})` : '';
                        setGuiaRoute(`${transferOrigin}${origCity} ➔ ${e.target.value}${destCity}`);
                      }}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {availableBatchLocations.map((loc) => (
                        <option key={`dest-${loc}`} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-emerald-600 font-medium mt-1 block">Ingresará tras confirmar recepción</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Responsable del Despacho *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Juan Pérez (Jefe de Bodega)"
                      value={transferResponsible}
                      onChange={(e) => setTransferResponsible(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Selección y Agregado de Artículos */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                      2. Artículos a Despachar
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    {transferItemsList.length} ítems agregados
                  </span>
                </div>

                {/* Fila para agregar artículo */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Seleccionar Producto del Catálogo
                    </label>
                    <select
                      value={transferAddProdId}
                      onChange={(e) => setTransferAddProdId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      <option value="">-- Buscar / Seleccionar producto --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} {p.sku ? `(${p.sku})` : ''} • Disp: {p.stock} {p.unit || 'u.'} {p.stock <= 0 ? ' [SIN STOCK]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Cantidad a Trasladar
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="0.00"
                      value={transferAddQty}
                      onChange={(e) => setTransferAddQty(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItemToTransferList}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>

                {/* Tabla de artículos agregados */}
                {transferItemsList.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Producto / SKU</th>
                          <th className="py-2.5 px-3 text-center">Cantidad</th>
                          <th className="py-2.5 px-3 text-right">Costo CPP</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                          <th className="py-2.5 px-3 text-center">Quitar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transferItemsList.map((item) => (
                          <tr key={item.productId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{item.productName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{item.sku || 'S/SKU'}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900">
                              {item.quantity} {item.unit || 'u.'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {formatCurrency(item.costPrice, settings.currencySymbol)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(item.quantity * item.costPrice, settings.currencySymbol)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTransferItem(item.productId)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td className="py-2 px-3 text-slate-700 uppercase tracking-wider text-[10px]">Totales de Despacho:</td>
                          <td className="py-2 px-3 text-center font-mono text-orange-600 font-black">
                            {transferItemsList.reduce((sum, it) => sum + it.quantity, 0)} unidades
                          </td>
                          <td></td>
                          <td className="py-2 px-3 text-right font-mono text-slate-900 font-black">
                            {formatCurrency(
                              transferItemsList.reduce((sum, it) => sum + it.quantity * it.costPrice, 0),
                              settings.currencySymbol
                            )}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl text-center text-slate-400">
                    <p className="font-medium">No hay productos agregados al traslado.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Seleccione un producto arriba y haga clic en "Agregar".</p>
                  </div>
                )}
              </div>

              {/* Sección 3: Datos de Transporte y Guía de Remisión Oficial */}
              <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-amber-200 pb-2.5">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-black uppercase text-amber-950 tracking-wider">
                    3. Datos Legales de Transporte para Guía de Remisión (SRI)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre del Transportista / Conductor *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Carlos Alberto Morales"
                      value={guiaDriverName}
                      onChange={(e) => setGuiaDriverName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Cédula o RUC del Conductor *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 1713334455 / 1790012345001"
                      value={guiaDriverId}
                      onChange={(e) => setGuiaDriverId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Placa del Vehículo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: PBX-4589"
                      value={guiaLicensePlate}
                      onChange={(e) => setGuiaLicensePlate(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Modelo / Marca del Vehículo (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Chevrolet Hino 3.5T Blanco"
                      value={guiaVehicleModel}
                      onChange={(e) => setGuiaVehicleModel(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Fecha Inicio Traslado *
                    </label>
                    <CustomDatePicker
                      value={guiaStartDate}
                      onChange={setGuiaStartDate}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium text-slate-900 focus-within:ring-2 focus-within:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Fecha Fin Estimada *
                    </label>
                    <CustomDatePicker
                      value={guiaEndDate}
                      onChange={setGuiaEndDate}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium text-slate-900 focus-within:ring-2 focus-within:ring-amber-500"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Ruta Declarada de Traslado
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Bodega Central Norte (Av. Amazonas) ➔ Sucursal Centro POS (Av. 10 de Agosto)"
                      value={guiaRoute}
                      onChange={(e) => setGuiaRoute(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Observaciones generales */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notas / Observaciones del Envío (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Instrucciones especiales de manejo, fragilidad o precintos de seguridad..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={transferItemsList.length === 0}
                  className={`px-6 py-2.5 font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer ${
                    transferItemsList.length > 0
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Truck className="w-4 h-4 stroke-[2.5]" />
                  <span>Autorizar Salida, Descontar Origen y Emitir Guía</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL 2: VALIDAR Y CONFIRMAR RECEPCIÓN FÍSICA EN DESTINO (FASE 2)
         --------------------------------------------------------------------- */}
      {isReceiveModalOpen && transferToReceive && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp my-auto">
            {/* Header */}
            <div className="px-6 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500/30 to-teal-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black tracking-tight text-white">
                      Confirmar Recepción Física en Destino
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Fase 2: Ingreso Oficial
                    </span>
                  </div>
                  <p className="text-xs text-emerald-300/80">
                    Valida las cantidades recibidas físicamente para ingresarlas al stock de {transferToReceive.destinationStore}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-900 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmPhysicalReception} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Resumen del Traslado */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Código Traslado</span>
                  <span className="font-mono font-black text-orange-600 text-xs block">{transferToReceive.code}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Guía de Remisión</span>
                  <span className="font-mono font-bold text-slate-900 text-xs block">
                    N° {transferToReceive.guiaRemision?.number || 'S/N'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Origen ➔ Destino</span>
                  <span className="font-bold text-slate-800 text-xs block truncate" title={`${transferToReceive.originStore} ➔ ${transferToReceive.destinationStore}`}>
                    {transferToReceive.originStore} ➔ {transferToReceive.destinationStore}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Transportista</span>
                  <span className="font-medium text-slate-700 text-xs block truncate" title={transferToReceive.guiaRemision?.driverName}>
                    {transferToReceive.guiaRemision?.driverName || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Personal que recibe */}
              <div>
                <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Personal que Valida y Recibe la Mercadería *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: María José (Encargada Sucursal Centro)"
                  value={receivingStaff}
                  onChange={(e) => setReceivingStaff(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Tabla de Conteo Físico */}
              <div>
                <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wider mb-2">
                  Verificación de Unidades Físicas Recibidas
                </label>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-3">Producto / SKU</th>
                        <th className="py-3 px-3 text-center">Despachado</th>
                        <th className="py-3 px-3 text-center">Recibido Físico</th>
                        <th className="py-3 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(transferToReceive.items || []).map((item) => {
                        const recVal = receptionQuantities[item.productId] !== undefined ? receptionQuantities[item.productId] : item.quantity;
                        const isMatch = recVal === item.quantity;

                        return (
                          <tr key={item.productId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{item.productName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{item.sku || 'S/SKU'}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                              {item.quantity} {item.unit || 'u.'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max={item.quantity}
                                step="any"
                                value={recVal}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setReceptionQuantities({
                                    ...receptionQuantities,
                                    [item.productId]: val
                                  });
                                }}
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-center font-mono font-black text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isMatch ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  Conforme
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Dif: {recVal - item.quantity}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Observaciones de Recepción */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observaciones de Recepción (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre el estado del embalaje, sellos o novedades en la entrega..."
                  value={receivingNotesInput}
                  onChange={(e) => setReceivingNotesInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Mensaje de Garantía Contable */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Garantía de Consistencia Transaccional:</strong> Al confirmar, las unidades validadas ingresarán automáticamente al stock físico de <strong>{transferToReceive.destinationStore}</strong> y se asentará en el Kárdex como <strong>TRANSFERENCIA_ENTRADA</strong> preservando la valoración económica sin mermas ni distorsiones.
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirmar Recepción e Ingresar a Inventario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL 3: VISOR / IMPRESIÓN OFICIAL DE GUÍA DE REMISIÓN (SRI)
         --------------------------------------------------------------------- */}
      {isGuiaPrintModalOpen && transferToViewGuia && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-300 rounded-3xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp my-auto">
            {/* Modal Header con botones de acción */}
            <div className="px-6 py-3.5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-2.5">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-black text-white">
                    Guía de Remisión Oficial N° {transferToViewGuia.guiaRemision?.number}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Documento reglamentario para el transporte inter-almacenes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Guía</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsGuiaPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Hoja Imprimible Oficial (Estilo SRI / Documento Legal) */}
            <div className="p-8 overflow-y-auto space-y-6 bg-white text-slate-900 font-sans text-xs flex-1">
              {/* Cabecera de la Guía */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b-2 border-slate-900 pb-5">
                {/* Datos de la Empresa Emisora */}
                <div className="space-y-1">
                  <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                    {settings.legalName || settings.storeName || 'FERRETERÍA & SUMINISTROS'}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    <strong>RUC:</strong> {settings.taxId || '1790012345001'}
                  </p>
                  <p className="text-xs text-slate-600 font-medium">
                    <strong>Matriz:</strong> {settings.address || 'Quito - Ecuador'}
                  </p>
                  {settings.phone && (
                    <p className="text-xs text-slate-600">
                      <strong>Teléfono:</strong> {settings.phone}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 italic mt-1">
                    Obligado a llevar contabilidad: SÍ • Régimen General
                  </p>
                </div>

                {/* Recuadro Legal SRI Guía de Remisión */}
                <div className="p-4 border-2 border-slate-900 rounded-xl bg-slate-50 text-right md:text-right space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                    DOCUMENTO COMPLEMENTARIO
                  </span>
                  <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">
                    GUÍA DE REMISIÓN
                  </h2>
                  <p className="font-mono text-sm font-black text-orange-600">
                    No. {transferToViewGuia.guiaRemision?.number || '001-002-000000000'}
                  </p>
                  <div className="pt-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        transferToViewGuia.status === 'EN_TRANSITO'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : transferToViewGuia.status === 'COMPLETADA'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      {transferToViewGuia.status === 'EN_TRANSITO'
                        ? 'MERCADERÍA EN TRÁNSITO'
                        : transferToViewGuia.status === 'COMPLETADA'
                        ? 'MERCADERÍA RECIBIDA'
                        : 'ANULADA'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Datos del Traslado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1">
                  <p><strong>Fecha de Emisión / Despacho:</strong> {transferToViewGuia.date}</p>
                  <p><strong>Fecha Inicio de Traslado:</strong> {transferToViewGuia.guiaRemision?.transferStartDate}</p>
                  <p><strong>Fecha Fin de Traslado:</strong> {transferToViewGuia.guiaRemision?.transferEndDate}</p>
                  <p>
                    <strong>Motivo del Traslado:</strong>{' '}
                    <span className="font-bold text-slate-900">
                      {transferToViewGuia.guiaRemision?.transferReason || 'Traslado entre establecimientos de la misma empresa'}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p><strong>Punto de Partida (Origen):</strong> <span className="font-bold text-blue-900">{transferToViewGuia.originStore}</span></p>
                  <p><strong>Punto de Llegada (Destino):</strong> <span className="font-bold text-emerald-900">{transferToViewGuia.destinationStore}</span></p>
                  <p><strong>Ruta Declarada:</strong> {transferToViewGuia.guiaRemision?.route}</p>
                  <p><strong>Código de Transferencia Interna:</strong> <span className="font-mono font-bold text-orange-600">{transferToViewGuia.code}</span></p>
                </div>
              </div>

              {/* Datos del Transportista */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  Identificación del Transportista & Vehículo
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">Conductor / Transportista:</span>
                    <span className="font-bold text-slate-900">{transferToViewGuia.guiaRemision?.driverName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">Cédula / RUC Conductor:</span>
                    <span className="font-mono font-bold text-slate-900">{transferToViewGuia.guiaRemision?.driverIdNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">Placa del Vehículo:</span>
                    <span className="font-mono font-black text-slate-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      {transferToViewGuia.guiaRemision?.licensePlate || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabla Detallada de Mercadería Amparada */}
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-2 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-blue-600" />
                  Detalle de la Mercadería Transportada
                </h3>
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-white font-black uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">N°</th>
                        <th className="py-2.5 px-3">Código / SKU</th>
                        <th className="py-2.5 px-3">Descripción del Producto</th>
                        <th className="py-2.5 px-3 text-center">Cant. Despachada</th>
                        <th className="py-2.5 px-3 text-right">Costo Unit. CPP</th>
                        <th className="py-2.5 px-3 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(transferToViewGuia.items || []).map((item, idx) => (
                        <tr key={item.productId || idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">{item.sku || 'S/SKU'}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{item.productName}</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-slate-900">
                            {item.quantity} {item.unit || 'u.'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {formatCurrency(item.costPrice, settings.currencySymbol)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.quantity * item.costPrice, settings.currencySymbol)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-right font-black uppercase text-slate-700">
                          Totales Amparados:
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-orange-600 font-black">
                          {transferToViewGuia.itemCount} unidades
                        </td>
                        <td></td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-950 font-black">
                          {formatCurrency(transferToViewGuia.totalValue, settings.currencySymbol)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Cuadro de Firmas Legales */}
              <div className="grid grid-cols-3 gap-6 pt-10 pb-4 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">{transferToViewGuia.responsible || 'Bodega Origen'}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                    Despacho Autorizado (Origen)
                  </p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">{transferToViewGuia.guiaRemision?.driverName || 'Transportista'}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                    Firma Transportista / Conductor
                  </p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">{transferToViewGuia.receivedBy || 'Bodega Destino'}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                    Recepción Conforme (Destino)
                  </p>
                </div>
              </div>

              {/* Pie Legal */}
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-[10px] text-slate-500 text-center leading-relaxed">
                Este documento ampara legalmente el traslado de mercadería dentro del territorio ecuatoriano según las disposiciones del Servicio de Rentas Internas (SRI) y la Agencia Nacional de Tránsito (ANT). La mercadería viaja bajo custodia del transportista hasta la entrega formal en la bodega de destino.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL 4: ADMINISTRACIÓN DE BODEGAS, ALMACENES Y SUCURSALES REALES
         --------------------------------------------------------------------- */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp my-auto">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-blue-500/30 to-indigo-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                  <Building className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white">
                    Gestión de Bodegas y Almacenes Reales
                  </h3>
                  <p className="text-xs text-slate-400">
                    Crea tus bodegas físicas reales y elimina las de prueba para transferencias y Guías de Remisión.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWarehouseModalOpen(false);
                  setEditingWarehouse(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Formulario de Alta */}
              <form onSubmit={handleSaveWarehouse} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="font-black text-slate-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-orange-600" />
                    Agregar Nueva Bodega o Sucursal
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre de la Bodega / Sucursal *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Bodega Matriz Norte / Sucursal Cumbayá"
                      value={warehouseFormData.name}
                      onChange={(e) => setWarehouseFormData({ ...warehouseFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Código Interno (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: BOD-01 / SUC-02"
                      value={warehouseFormData.code}
                      onChange={(e) => setWarehouseFormData({ ...warehouseFormData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Dirección Física (Para Guía de Remisión)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Av. 10 de Agosto N45-12 y Gaspar de Villarroel"
                      value={warehouseFormData.address}
                      onChange={(e) => setWarehouseFormData({ ...warehouseFormData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Ciudad
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Quito / Guayaquil / Cuenca"
                      value={warehouseFormData.city}
                      onChange={(e) => setWarehouseFormData({ ...warehouseFormData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 02 2456789 / 0998765432"
                      value={warehouseFormData.phone}
                      onChange={(e) => setWarehouseFormData({ ...warehouseFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <input
                      type="checkbox"
                      id="isMainWh"
                      checked={warehouseFormData.isMain}
                      onChange={(e) => setWarehouseFormData({ ...warehouseFormData, isMain: e.target.checked })}
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor="isMainWh" className="text-xs font-bold text-slate-800 cursor-pointer">
                      Es Bodega Principal / Matriz
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Guardar Bodega Real</span>
                  </button>
                </div>
              </form>

              {/* Lista de Bodegas Registradas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Bodegas Registradas en el Sistema ({(warehouses || []).length})
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Puedes editar o eliminar las bodegas con los botones de acción.
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {(warehouses || []).map((wh) => (
                    <div key={wh.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-black text-slate-900 text-xs">{wh.name}</span>
                          {wh.code && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-600">
                              {wh.code}
                            </span>
                          )}
                          {wh.isMain && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Matriz Principal
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 pl-6">
                          {wh.address ? `${wh.address} • ` : ''}{wh.city || 'Ecuador'} {wh.phone ? `• Tel: ${wh.phone}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWarehouse(wh);
                            setWarehouseFormData({
                              name: wh.name,
                              code: wh.code || '',
                              address: wh.address || '',
                              city: wh.city || 'Quito',
                              phone: wh.phone || '',
                              isMain: wh.isMain || false,
                            });
                            setIsEditWarehouseModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Editar datos de la bodega"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWarehouse(wh)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Eliminar bodega"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL 5: EDITAR BODEGA O SUCURSAL
         --------------------------------------------------------------------- */}
      {isEditWarehouseModalOpen && editingWarehouse && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-slideUp my-auto">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-amber-500/30 to-orange-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Edit2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white">
                    Editar Bodega / Sucursal
                  </h3>
                  <p className="text-xs text-slate-400">
                    Modifica los datos de "{editingWarehouse.name}"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditWarehouseModalOpen(false);
                  setEditingWarehouse(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleSaveWarehouse} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre de la Bodega / Sucursal *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Bodega Matriz Norte"
                  value={warehouseFormData.name}
                  onChange={(e) => setWarehouseFormData({ ...warehouseFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Código Interno
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: BOD-01"
                    value={warehouseFormData.code}
                    onChange={(e) => setWarehouseFormData({ ...warehouseFormData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Quito"
                    value={warehouseFormData.city}
                    onChange={(e) => setWarehouseFormData({ ...warehouseFormData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dirección Física (Para Guía de Remisión)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Av. 10 de Agosto N45-12"
                  value={warehouseFormData.address}
                  onChange={(e) => setWarehouseFormData({ ...warehouseFormData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  placeholder="Ej: 02 2456789"
                  value={warehouseFormData.phone}
                  onChange={(e) => setWarehouseFormData({ ...warehouseFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isMainWhEdit"
                  checked={warehouseFormData.isMain}
                  onChange={(e) => setWarehouseFormData({ ...warehouseFormData, isMain: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="isMainWhEdit" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Es Bodega Principal / Matriz
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditWarehouseModalOpen(false);
                    setEditingWarehouse(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
