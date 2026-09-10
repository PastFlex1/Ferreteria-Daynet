import React, { useState, useMemo } from 'react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RotateCcw, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Package, 
  DollarSign, 
  Boxes, 
  Calendar,
  Layers,
  Sliders,
  CheckCircle2, 
  X,
  Percent,
  Building,
  ArrowRightLeft,
  ArrowUpDown
} from 'lucide-react';
import { Product, StoreSettings, Invoice, ProductCategory } from '../../types';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { formatCurrency, formatCostCurrency } from '../../utils/formatters';
import { exportKardexToModernExcel } from '../../utils/excelExport';
import { Select } from '../Shared/Select';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { useModal } from '../../context/ModalContext';

export interface StockAdjustmentRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  reason: string;
  user: string;
  costPrice: number;
}

export interface KardexMovement {
  id: string;
  seqId: number;
  date: string;
  dateOnly: string;
  timeOnly: string;
  type: 'SALDO_INICIAL' | 'COMPRA' | 'VENTA' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA' | 'DEVOLUCION_VENTA' | 'MERMA_DANO' | 'TRANSFERENCIA_ENTRADA' | 'TRANSFERENCIA_SALIDA';
  typeLabel: string;
  tipoBadge: 'Ingreso' | 'Egreso';
  motivo: string;
  stockAnt: number;
  cantidad: number;
  stockNuevo: number;
  precio: number;
  referencia: string;
  docNumber: string;
  warehouse?: string; // Bodega / Sucursal / Ubicación
  entityName: string; // Cliente, Proveedor o Motivo
  user: string;
  productId?: string;
  productName?: string;
  sku?: string;
  unit?: string;
  inQty: number;
  inCost: number;
  inTotal: number;
  outQty: number;
  outCost: number;
  outTotal: number;
  balanceQty: number;
  balanceCost: number;
  balanceTotal: number;
  notes?: string;
}

const getMotivo = (type: KardexMovement['type']): string => {
  switch (type) {
    case 'VENTA':
      return 'Venta';
    case 'COMPRA':
      return 'Compra';
    case 'AJUSTE_ENTRADA':
    case 'AJUSTE_SALIDA':
    case 'MERMA_DANO':
      return 'Ajuste de stock';
    case 'DEVOLUCION_VENTA':
      return 'Devolución';
    case 'TRANSFERENCIA_ENTRADA':
    case 'TRANSFERENCIA_SALIDA':
      return 'Transferencia';
    case 'SALDO_INICIAL':
      return 'Saldo Inicial';
    default:
      return 'Ajuste de stock';
  }
};

const getReferencia = (type: KardexMovement['type'], isInput: boolean, docNumber: string): string => {
  const cleanDoc = (docNumber || '').replace(/^#/, '').trim();
  if (type === 'VENTA') {
    return cleanDoc.toUpperCase().startsWith('FACTURA') ? cleanDoc : `FACTURA ${cleanDoc}`;
  }
  if (type === 'COMPRA') {
    return cleanDoc.toUpperCase().startsWith('FACTURA') || cleanDoc.toUpperCase().startsWith('COMPRA')
      ? cleanDoc
      : `FACTURA COMPRA ${cleanDoc}`;
  }
  if (type === 'AJUSTE_ENTRADA' || type === 'AJUSTE_SALIDA' || type === 'MERMA_DANO') {
    return `Ajuste de stock (${isInput ? 'INGRESO' : 'EGRESO'})`;
  }
  if (type === 'DEVOLUCION_VENTA') {
    return `NC ${cleanDoc}`;
  }
  if (type === 'TRANSFERENCIA_ENTRADA' || type === 'TRANSFERENCIA_SALIDA') {
    return `TRANSF ${cleanDoc}`;
  }
  if (type === 'SALDO_INICIAL') {
    return 'SALDO INICIAL';
  }
  return cleanDoc || '-';
};

interface KardexManagerProps {
  products: Product[];
  settings: StoreSettings;
  categories?: ProductCategory[];
  onStockAdjust: (productId: string, adjustmentQty: number) => void;
  onSaveProduct: (product: Product) => void;
}

export const KardexManager: React.FC<KardexManagerProps> = ({
  products,
  settings,
  categories,
  onStockAdjust,
  onSaveProduct,
}) => {
  const { showAlert, showToast } = useModal();

  // ── Sync with Real Database Collections ────────────────────────────────────
  const [invoices] = useFirestoreSync<Invoice[]>('ferreteria_invoices', []);
  const [purchases] = useFirestoreSync<any[]>('ferreteria_purchases', []);
  const [creditNotes] = useFirestoreSync<any[]>('ferreteria_credit_notes', []);
  const [stockAdjustments, setStockAdjustments] = useFirestoreSync<StockAdjustmentRecord[]>(
    'ferreteria_stock_adjustments', 
    []
  );
  const [transfers] = useFirestoreSync<any[]>('ferreteria_transfers', []);

  // ── Selection & Filter State ───────────────────────────────────────────────
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('TODOS');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('TODAS');
  const [filterText, setFilterText] = useState('');

  // ── Table Sorting State ────────────────────────────────────────────────────
  const [sortColumn, setSortColumn] = useState<string>('seqId');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortOrder(column === 'seqId' ? 'desc' : 'asc');
    }
  };

  // ── Quick Adjust Modal State ───────────────────────────────────────────────
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustQtyInput, setAdjustQtyInput] = useState('');
  const [adjustTypeReason, setAdjustTypeReason] = useState<'ENTRADA_COMPRA' | 'ENTRADA_DEVOLUCION' | 'SALIDA_MERMA' | 'SALIDA_ROBO' | 'CORRECCION_SOBRANTE' | 'CORRECCION_FALTANTE'>('CORRECCION_SOBRANTE');
  const [adjustNotes, setAdjustNotes] = useState('');

  // ── Official Print Modal State ─────────────────────────────────────────────
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // ── Fast Product Lookup Map ────────────────────────────────────────────────
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p);
      if (p.sku) map.set(p.sku.toLowerCase(), p);
    });
    return map;
  }, [products]);

  // ── Build Chronological Real Kardex Movements ──────────────────────────────
  const allMovements = useMemo(() => {
    const rawMovements: {
      id: string;
      timestamp: number;
      dateStr: string;
      type: KardexMovement['type'];
      typeLabel: string;
      docNumber: string;
      warehouse?: string;
      entityName: string;
      user: string;
      productId: string;
      productName: string;
      sku: string;
      unit: string;
      qty: number;
      cost: number;
      price: number;
      notes?: string;
    }[] = [];

    const isSingleProduct = !!selectedProduct;
    const prodId = selectedProduct?.id;
    const prodSku = selectedProduct?.sku.toLowerCase();

    const isTargetProduct = (pId?: string, pSku?: string) => {
      if (!isSingleProduct) return true;
      const lowerSku = (pSku || '').toLowerCase();
      return pId === prodId || (lowerSku && lowerSku === prodSku);
    };

    // 1. Invoices / Sales from POS
    invoices.forEach((inv) => {
      if (inv.paymentStatus === 'ANULADA' || inv.documentType === 'COTIZACION') return;
      const invDate = inv.createdAt || (inv as any).date || new Date().toISOString();
      const timestamp = new Date(invDate).getTime() || Date.now();
      const docNum = inv.series ? `${inv.series}-${inv.number || inv.fullNumber || inv.id}` : (inv.fullNumber || `#${inv.number || inv.id}`);

      inv.items.forEach((item) => {
        const itemProdId = item.productId || (item as any).product?.id;
        const itemSku = item.sku || (item as any).product?.sku || '';

        if (isTargetProduct(itemProdId, itemSku)) {
          const matchedProd = productMap.get(itemProdId) || productMap.get(itemSku.toLowerCase());
          const cost = selectedProduct ? (selectedProduct.costPrice || 0) : (matchedProd?.costPrice || (item as any).costPrice || 0);
          const price = item.unitPrice || (item as any).price || (matchedProd?.price || cost);

          rawMovements.push({
            id: `sale-${inv.id}-${item.productId || Math.random()}`,
            timestamp,
            dateStr: invDate.replace('T', ' ').substring(0, 16),
            type: 'VENTA',
            typeLabel: inv.documentType === 'FACTURA' ? 'Venta Factura' : 'Venta POS',
            docNumber: docNum,
            warehouse: (inv as any).branch || 'Tienda POS / Salón de Ventas',
            entityName: inv.customer?.name || 'Consumidor Final',
            user: inv.sellerName || 'Caja POS',
            productId: matchedProd?.id || itemProdId || '',
            productName: matchedProd?.name || item.productName || item.description || 'Producto Varios',
            sku: matchedProd?.sku || itemSku || 'N/A',
            unit: matchedProd?.unit || 'Unid',
            qty: item.quantity,
            cost,
            price,
            notes: `Venta POS (${inv.paymentMethod || 'Contado'})`,
          });
        }
      });
    });

    // 2. Purchase Invoices from Suppliers
    purchases.forEach((purch) => {
      const purchDate = purch.issueDate || purch.date || purch.createdAt || new Date().toISOString();
      const timestamp = new Date(purchDate).getTime() || Date.now();
      const docNum = purch.invoiceNumber || purch.orderNumber || `#${purch.id}`;

      if (purch.items && Array.isArray(purch.items)) {
        purch.items.forEach((item: any) => {
          const itemProdId = item.productId;
          const itemSku = item.sku || '';

          if (isTargetProduct(itemProdId, itemSku)) {
            const matchedProd = productMap.get(itemProdId) || productMap.get(itemSku.toLowerCase());
            const cost = item.costPrice || item.unitCost || matchedProd?.costPrice || 0;
            const price = item.costPrice || item.unitCost || cost;

            rawMovements.push({
              id: `purch-${purch.id}-${item.productId || Math.random()}`,
              timestamp,
              dateStr: purchDate.replace('T', ' ').substring(0, 16),
              type: 'COMPRA',
              typeLabel: 'Compra Proveedor',
              docNumber: docNum,
              warehouse: (purch as any).warehouse || 'Bodega Central Norte',
              entityName: purch.supplier?.name || 'Proveedor Directo',
              user: purch.receivedBy || 'Bodega',
              productId: matchedProd?.id || itemProdId || '',
              productName: matchedProd?.name || item.name || item.description || 'Producto Varios',
              sku: matchedProd?.sku || itemSku || 'N/A',
              unit: matchedProd?.unit || 'Unid',
              qty: item.quantity,
              cost,
              price,
              notes: `Ingreso factura proveedor (${purch.paymentCondition || 'Contado'})`,
            });
          }
        });
      }
    });

    // 3. Stock Adjustments (Physical audits, mermas, manual corrections)
    stockAdjustments.forEach((adj) => {
      if (isTargetProduct(adj.productId, adj.sku)) {
        const matchedProd = productMap.get(adj.productId) || productMap.get((adj.sku || '').toLowerCase());
        const adjDate = adj.date || new Date().toISOString();
        const timestamp = new Date(adjDate).getTime() || Date.now();
        const isEntry = adj.qty > 0;
        const isMerma = adj.reason?.toLowerCase().includes('merma') || adj.reason?.toLowerCase().includes('daño') || adj.reason?.toLowerCase().includes('robo');
        const cost = adj.costPrice || matchedProd?.costPrice || 0;

        rawMovements.push({
          id: `adj-${adj.id}`,
          timestamp,
          dateStr: adjDate.replace('T', ' ').substring(0, 16),
          type: isEntry ? 'AJUSTE_ENTRADA' : (isMerma ? 'MERMA_DANO' : 'AJUSTE_SALIDA'),
          typeLabel: isEntry ? 'Ajuste Entrada (+)' : (isMerma ? 'Salida por Merma (-)' : 'Ajuste Salida (-)'),
          docNumber: `AJU-${adj.id.substring(adj.id.length - 6)}`,
          warehouse: matchedProd?.location || 'Bodega Principal',
          entityName: adj.reason || 'Ajuste Manual de Inventario',
          user: adj.user || 'Administrador',
          productId: matchedProd?.id || adj.productId || '',
          productName: matchedProd?.name || adj.productName || 'Producto Varios',
          sku: matchedProd?.sku || adj.sku || 'N/A',
          unit: matchedProd?.unit || 'Unid',
          qty: Math.abs(adj.qty),
          cost,
          price: cost,
          notes: adj.reason || '',
        });
      }
    });

    // 4. Credit Notes / Customer Returns
    creditNotes.forEach((cn) => {
      const cnDate = cn.date || cn.createdAt || new Date().toISOString();
      const timestamp = new Date(cnDate).getTime() || Date.now();

      if (cn.items && Array.isArray(cn.items)) {
        cn.items.forEach((item: any) => {
          if (isTargetProduct(item.productId, item.sku)) {
            const matchedProd = productMap.get(item.productId) || productMap.get((item.sku || '').toLowerCase());
            const cost = matchedProd?.costPrice || 0;
            const price = item.unitPrice || (item as any).price || (matchedProd?.price || cost);

            rawMovements.push({
              id: `cn-${cn.id}-${Math.random()}`,
              timestamp,
              dateStr: cnDate.replace('T', ' ').substring(0, 16),
              type: 'DEVOLUCION_VENTA',
              typeLabel: 'Devolución Cliente (+)',
              docNumber: cn.creditNoteNumber || `NC-${cn.id.substring(0, 8)}`,
              warehouse: 'Tienda POS / Salón de Ventas',
              entityName: cn.customerName || 'Cliente',
              user: cn.createdByName || 'Caja',
              productId: matchedProd?.id || item.productId || '',
              productName: matchedProd?.name || item.name || item.description || 'Producto Varios',
              sku: matchedProd?.sku || item.sku || 'N/A',
              unit: matchedProd?.unit || 'Unid',
              qty: item.quantity,
              cost,
              price,
              notes: cn.reason || 'Reingreso a inventario por devolución',
            });
          }
        });
      }
    });

    // 5. Inter-warehouse Transfers
    transfers.forEach((trf: any) => {
      if (trf.status === 'CANCELADA') return;

      const trfDate = trf.dispatchedAt || trf.date || trf.createdAt || new Date().toISOString();
      const timestamp = new Date(trfDate).getTime() || Date.now();
      const origin = trf.originStore || trf.origin || 'Bodega Central Norte';
      const destination = trf.destinationStore || trf.destination || 'Sucursal Centro POS';
      const docNum = trf.code || `TRF-${(trf.id || '').substring(0, 6)}`;
      const guiaNum = trf.guiaRemision?.number ? ` • Guía: ${trf.guiaRemision.number}` : '';

      if (trf.items && Array.isArray(trf.items)) {
        trf.items.forEach((item: any) => {
          if (isTargetProduct(item.productId, item.sku)) {
            const matchedProd = productMap.get(item.productId) || productMap.get((item.sku || '').toLowerCase());
            const qty = Number(item.quantity) || 1;
            const cost = item.costPrice || matchedProd?.costPrice || 0;

            rawMovements.push({
              id: `trf-out-${trf.id}-${item.productId || Math.random()}`,
              timestamp,
              dateStr: trfDate.replace('T', ' ').substring(0, 16),
              type: 'TRANSFERENCIA_SALIDA',
              typeLabel: trf.status === 'EN_TRANSITO' ? 'Traslado Salida (En Tránsito)' : 'Transferencia Salida (-)',
              docNumber: `${docNum}${guiaNum}`,
              warehouse: origin,
              entityName: `Despacho hacia ${destination}${trf.status === 'EN_TRANSITO' ? ' (En Tránsito)' : ''}`,
              user: trf.responsible || 'Bodega Origen',
              productId: matchedProd?.id || item.productId || '',
              productName: matchedProd?.name || item.name || 'Producto Varios',
              sku: matchedProd?.sku || item.sku || 'N/A',
              unit: matchedProd?.unit || 'Unid',
              qty,
              cost,
              price: cost,
              notes: trf.status === 'EN_TRANSITO'
                ? `Mercadería en tránsito amparada con Guía de Remisión. Transportista: ${trf.guiaRemision?.driverName || 'N/A'} (Placa: ${trf.guiaRemision?.licensePlate || 'N/A'})`
                : `Salida física confirmada hacia ${destination}`,
            });

            if (trf.status === 'COMPLETADA') {
              const recDate = trf.receivedAt || trfDate;
              const recTimestamp = new Date(recDate).getTime() || (timestamp + 1000);
              const recQty = Number(item.receivedQuantity !== undefined ? item.receivedQuantity : qty);

              rawMovements.push({
                id: `trf-in-${trf.id}-${item.productId || Math.random()}`,
                timestamp: recTimestamp,
                dateStr: recDate.replace('T', ' ').substring(0, 16),
                type: 'TRANSFERENCIA_ENTRADA',
                typeLabel: 'Transferencia Entrada (+)',
                docNumber: `${docNum}${guiaNum}`,
                warehouse: destination,
                entityName: `Recepción desde ${origin}`,
                user: trf.receivedBy || 'Recepción Sucursal',
                productId: matchedProd?.id || item.productId || '',
                productName: matchedProd?.name || item.name || 'Producto Varios',
                sku: matchedProd?.sku || item.sku || 'N/A',
                unit: matchedProd?.unit || 'Unid',
                qty: recQty,
                cost,
                price: cost,
                notes: `Mercadería recibida físicamente en ${destination}. ${trf.receptionNotes ? 'Obs: ' + trf.receptionNotes : ''}`,
              });
            }
          }
        });
      }
    });

    // Group raw movements by product to compute exact running stock balance per product
    const movementsByProduct = new Map<string, typeof rawMovements>();

    rawMovements.forEach((m) => {
      const pKey = m.productId || (m.sku || 'VARIOS').toLowerCase();
      if (!movementsByProduct.has(pKey)) {
        movementsByProduct.set(pKey, []);
      }
      movementsByProduct.get(pKey)!.push(m);
    });

    const calculatedMovements: KardexMovement[] = [];

    movementsByProduct.forEach((mList) => {
      // Sort chronologically ascending for stock trace
      mList.sort((a, b) => a.timestamp - b.timestamp);

      const firstItem = mList[0];
      const matchedProd = productMap.get(firstItem.productId) || productMap.get((firstItem.sku || '').toLowerCase()) || (selectedProduct?.id === firstItem.productId ? selectedProduct : null);
      const currentStock = matchedProd ? matchedProd.stock : 0;
      const initialCost = matchedProd ? (matchedProd.costPrice || 0) : firstItem.cost;

      // Net change across this product's movements
      const netDelta = mList.reduce((acc, m) => {
        const isInput = ['COMPRA', 'AJUSTE_ENTRADA', 'DEVOLUCION_VENTA', 'TRANSFERENCIA_ENTRADA'].includes(m.type);
        return acc + (isInput ? m.qty : -m.qty);
      }, 0);

      const initialEstimatedQty = Math.max(0, currentStock - netDelta);
      let runningQty = initialEstimatedQty;
      let runningCost = initialCost || 0;

      mList.forEach((m) => {
        const isInput = ['COMPRA', 'AJUSTE_ENTRADA', 'DEVOLUCION_VENTA', 'TRANSFERENCIA_ENTRADA', 'SALDO_INICIAL'].includes(m.type);
        const stockAnt = runningQty;
        const cantidad = m.qty;
        let stockNuevo = 0;

        const effectiveCost = m.cost > 0 ? m.cost : runningCost;
        if (isInput) {
          stockNuevo = stockAnt + cantidad;
          const prevTotalValue = runningQty * runningCost;
          runningQty = stockNuevo;
          runningCost = runningQty > 0 ? (prevTotalValue + (cantidad * effectiveCost)) / runningQty : effectiveCost;
        } else {
          stockNuevo = Math.max(0, stockAnt - cantidad);
          runningQty = stockNuevo;
        }

        const dateParts = (m.dateStr || '').split(' ');
        const dateOnly = dateParts[0] || m.dateStr;
        const timeOnly = dateParts[1] || '';

        const motivo = getMotivo(m.type);
        const referencia = getReferencia(m.type, isInput, m.docNumber);
        const tipoBadge: 'Ingreso' | 'Egreso' = isInput ? 'Ingreso' : 'Egreso';

        calculatedMovements.push({
          id: m.id,
          seqId: 0, // Assigned sequentially after global chronological ordering
          date: m.dateStr,
          dateOnly,
          timeOnly,
          type: m.type,
          typeLabel: m.typeLabel,
          tipoBadge,
          motivo,
          stockAnt,
          cantidad,
          stockNuevo,
          precio: m.price > 0 ? m.price : effectiveCost,
          referencia,
          docNumber: m.docNumber,
          warehouse: m.warehouse || 'Bodega Central',
          entityName: m.entityName,
          user: m.user,
          productId: m.productId,
          productName: m.productName,
          sku: m.sku,
          unit: m.unit,
          inQty: isInput ? cantidad : 0,
          inCost: isInput ? effectiveCost : 0,
          inTotal: isInput ? cantidad * effectiveCost : 0,
          outQty: !isInput ? cantidad : 0,
          outCost: !isInput ? runningCost : 0,
          outTotal: !isInput ? cantidad * runningCost : 0,
          balanceQty: runningQty,
          balanceCost: runningCost,
          balanceTotal: runningQty * runningCost,
          notes: m.notes,
        });
      });
    });

    // Sort all calculated movements chronologically ascending to assign global sequence IDs
    calculatedMovements.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeA - timeB;
    });

    calculatedMovements.forEach((m, idx) => {
      m.seqId = idx + 1;
    });

    return calculatedMovements;
  }, [selectedProduct, invoices, purchases, stockAdjustments, creditNotes, transfers, productMap]);

  // ── Filtered & Sorted Movements ────────────────────────────────────────────
  const filteredMovements = useMemo(() => {
    const list = allMovements.filter((m) => {
      // Date Range Filter
      if (dateFrom && m.date.substring(0, 10) < dateFrom) return false;
      if (dateTo && m.date.substring(0, 10) > dateTo) return false;

      // Warehouse Filter
      if (selectedWarehouseFilter !== 'TODAS') {
        const term = selectedWarehouseFilter.toLowerCase();
        const mWarehouse = (m.warehouse || '').toLowerCase();
        if (!mWarehouse.includes(term)) return false;
      }

      // Type Filter
      if (movementTypeFilter === 'VENTAS' && m.type !== 'VENTA') return false;
      if (movementTypeFilter === 'COMPRAS' && m.type !== 'COMPRA') return false;
      if (movementTypeFilter === 'AJUSTES' && !['AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'MERMA_DANO'].includes(m.type)) return false;
      if (movementTypeFilter === 'DEVOLUCIONES' && m.type !== 'DEVOLUCION_VENTA') return false;
      if (movementTypeFilter === 'TRANSFERENCIAS' && !['TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA'].includes(m.type)) return false;

      // Text Search
      if (filterText) {
        const term = filterText.toLowerCase();
        const matchesDoc = m.docNumber.toLowerCase().includes(term);
        const matchesEntity = m.entityName.toLowerCase().includes(term);
        const matchesUser = m.user.toLowerCase().includes(term);
        const matchesType = m.typeLabel.toLowerCase().includes(term);
        const matchesMotivo = m.motivo.toLowerCase().includes(term);
        const matchesRef = m.referencia.toLowerCase().includes(term);
        const matchesWarehouse = (m.warehouse || '').toLowerCase().includes(term);
        const matchesProd = (m.productName || '').toLowerCase().includes(term);
        const matchesSku = (m.sku || '').toLowerCase().includes(term);
        if (!matchesDoc && !matchesEntity && !matchesUser && !matchesType && !matchesMotivo && !matchesRef && !matchesWarehouse && !matchesProd && !matchesSku) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      let valA: any = (a as any)[sortColumn];
      let valB: any = (b as any)[sortColumn];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allMovements, dateFrom, dateTo, selectedWarehouseFilter, movementTypeFilter, filterText, sortColumn, sortOrder]);

  // ── General Statistics for Consolidated View ──────────────────────────────
  const generalStats = useMemo(() => {
    let totalInValue = 0;
    let totalOutValue = 0;
    const uniqueProductIds = new Set<string>();

    allMovements.forEach((m) => {
      if (m.type !== 'SALDO_INICIAL') {
        totalInValue += m.inTotal;
        totalOutValue += m.outTotal;
        if (m.productId || m.sku) {
          uniqueProductIds.add(m.productId || m.sku);
        }
      }
    });

    return {
      totalMovementsCount: allMovements.length,
      totalInValue,
      totalOutValue,
      uniqueProductsCount: uniqueProductIds.size,
    };
  }, [allMovements]);

  // ── Summary Totals for Selected Product ────────────────────────────────────
  const totals = useMemo(() => {
    let totalInQty = 0;
    let totalInValue = 0;
    let totalOutQty = 0;
    let totalOutValue = 0;

    allMovements.forEach((m) => {
      if (m.type !== 'SALDO_INICIAL') {
        totalInQty += m.inQty;
        totalInValue += m.inTotal;
        totalOutQty += m.outQty;
        totalOutValue += m.outTotal;
      }
    });

    const lastRow = allMovements[allMovements.length - 1];
    const currentStock = lastRow ? lastRow.balanceQty : (selectedProduct?.stock || 0);
    const avgCost = lastRow ? lastRow.balanceCost : (selectedProduct?.costPrice || 0);
    const totalValuation = currentStock * avgCost;

    return {
      totalInQty,
      totalInValue,
      totalOutQty,
      totalOutValue,
      currentStock,
      avgCost,
      totalValuation,
    };
  }, [allMovements, selectedProduct]);

  // ── Cost & Profitability Analysis (Historical vs Current CPP vs PVP) ───────
  const costAnalysis = useMemo(() => {
    if (!selectedProduct) return null;

    const initialCost = selectedProduct.costPrice || 0;
    const purchaseMovements = allMovements.filter((m) => m.type === 'COMPRA');
    const lastPurchase = purchaseMovements.length > 0 ? purchaseMovements[purchaseMovements.length - 1] : null;
    const lastPurchaseCost = lastPurchase ? lastPurchase.inCost : initialCost;
    const currentAvgCost = totals.avgCost;
    const salePrice = selectedProduct.price || 0;

    const unitGrossProfit = Math.max(0, salePrice - currentAvgCost);
    const grossMarginPercent = salePrice > 0 ? (unitGrossProfit / salePrice) * 100 : 0;
    const markupPercent = currentAvgCost > 0 ? ((salePrice - currentAvgCost) / currentAvgCost) * 100 : 0;

    const costVariationPercent = initialCost > 0
      ? ((currentAvgCost - initialCost) / initialCost) * 100
      : 0;

    const lastPurchaseDiffPercent = currentAvgCost > 0
      ? ((lastPurchaseCost - currentAvgCost) / currentAvgCost) * 100
      : 0;

    return {
      initialCost,
      lastPurchaseCost,
      currentAvgCost,
      salePrice,
      unitGrossProfit,
      grossMarginPercent,
      markupPercent,
      costVariationPercent,
      lastPurchaseDiffPercent,
    };
  }, [selectedProduct, allMovements, totals]);

  // ── Handle Register Quick Adjustment ───────────────────────────────────────
  const handleSaveStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = parseFloat(adjustQtyInput) || 0;
    if (qty <= 0) {
      showAlert('La cantidad debe ser un número mayor a 0.', 'Cantidad Inválida', 'warning');
      return;
    }

    const isOut = ['SALIDA_MERMA', 'SALIDA_ROBO', 'CORRECCION_FALTANTE'].includes(adjustTypeReason);
    const finalChange = isOut ? -qty : qty;

    const newRecord: StockAdjustmentRecord = {
      id: `adj-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      qty: finalChange,
      reason: `${adjustTypeReason.replace(/_/g, ' ')}: ${adjustNotes.trim() || 'Ajuste de inventario'}`,
      user: 'Administrador POS',
      costPrice: selectedProduct.costPrice,
    };

    // Save adjustment to database
    setStockAdjustments([newRecord, ...stockAdjustments]);

    // Update physical product stock
    onStockAdjust(selectedProduct.id, finalChange);

    setIsAdjustModalOpen(false);
    setAdjustQtyInput('');
    setAdjustNotes('');
    showToast(`Ajuste de stock (${finalChange > 0 ? '+' : ''}${finalChange} ${selectedProduct.unit}) aplicado con éxito al Kardex.`, 'success');
  };

  // ── Export Kardex to Modern Excel (.xlsx) ──────────────────────────────────
  const handleExportExcel = () => {
    const isSingle = !!selectedProduct;

    exportKardexToModernExcel({
      filename: isSingle && selectedProduct
        ? `Kardex_${selectedProduct.sku}_${new Date().toISOString().split('T')[0]}.xlsx`
        : `Kardex_Consolidado_General_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: isSingle ? 'Tarjeta Kardex' : 'Bitacora Movimientos',
      title: isSingle && selectedProduct
        ? `TARJETA KARDEX (VALORIZADO POR COSTO PROMEDIO) - ${selectedProduct.name.toUpperCase()}`
        : `BITÁCORA GENERAL DE MOVIMIENTOS DE INVENTARIO (CONSOLIDADO)`,
      storeName: settings?.storeName || 'Ferretería Industrial',
      taxId: settings?.taxId || '',
      selectedProduct,
      movements: filteredMovements,
    });

    showToast('Kardex exportado exitosamente a Excel en formato ejecutivo.', 'success');
  };

  const handlePrintKardex = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 no-print">
        {/* Top Banner & Title */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 bg-slate-950 text-orange-400 rounded-2xl border border-slate-800 shadow-md">
              <ClipboardList className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-950">
                  {selectedProduct ? `Tarjeta Kardex Valorizada` : `Bitácora General & Movimientos de Inventario`}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-50 text-orange-700 border border-orange-200">
                  {selectedProduct ? 'Promedio Ponderado • SRI' : 'Consolidado General'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {selectedProduct
                  ? `Control cronológico real de entradas, salidas y saldos valorizados para ${selectedProduct.name} (${selectedProduct.sku}).`
                  : `Historial consolidado de todas las transacciones de inventario (ventas POS, compras, ajustes y transferencias).`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrintKardex}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Product Selector Bar */}
        <div className="bg-slate-950 text-white rounded-3xl p-5 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex-1 relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>Filtrar Producto para Kardex Individual:</span>
                </label>
                {selectedProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductId('');
                      setProductSearch('');
                    }}
                    className="text-[10px] text-orange-400 hover:text-white font-bold underline cursor-pointer flex items-center gap-1"
                  >
                    <Layers className="w-3 h-3" />
                    <span>Ver Todos (Consolidado General)</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    Modo: Consolidado General (Todos los Productos)
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  placeholder="Escriba el nombre, SKU o código de barras del producto para filtrar..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700 text-white rounded-xl font-bold text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-slate-500"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch('');
                      setSelectedProductId('');
                      setIsSearchDropdownOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Live Dropdown List */}
              {isSearchDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto p-1 divide-y divide-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductId('');
                      setProductSearch('');
                      setIsSearchDropdownOpen(false);
                    }}
                    className="w-full text-left p-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-bold transition cursor-pointer flex items-center justify-between text-xs rounded-lg mb-1 border border-orange-500/20"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      <span>Ver Todos los Productos (Vista General Consolidada)</span>
                    </div>
                    <span className="text-[10px] bg-orange-500/20 px-2 py-0.5 rounded text-orange-300 font-mono">
                      {allMovements.length} Movimientos
                    </span>
                  </button>

                  {products
                    .filter((p) =>
                      !productSearch.trim() ||
                      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                      p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
                      (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase()))
                    )
                    .slice(0, 15)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setProductSearch(p.name);
                          setIsSearchDropdownOpen(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-slate-800 transition cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white block">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            SKU: {p.sku} {p.barcode ? `• Cód: ${p.barcode}` : ''}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-orange-400 block">
                            Stock: {p.stock} {p.unit}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Costo: {formatCostCurrency(p.costPrice, settings.currencySymbol)}
                          </span>
                        </div>
                      </button>
                    ))}
                  {products.filter((p) =>
                    !productSearch.trim() ||
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    p.sku.toLowerCase().includes(productSearch.toLowerCase())
                  ).length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No se encontraron productos coincidentes.
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="flex flex-wrap items-center gap-3 bg-slate-900/80 border border-slate-800 px-4 py-3 rounded-2xl text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Categoría</span>
                  <span className="font-bold text-white">{selectedProduct.category}</span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Unidad</span>
                  <span className="font-bold text-orange-400 font-mono">{selectedProduct.unit}</span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">PVP Venta</span>
                  <span className="font-black text-emerald-400 font-mono">
                    {formatCurrency(selectedProduct.price, settings.currencySymbol)}
                  </span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductId('');
                      setProductSearch('');
                    }}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Quitar filtro de producto"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Ver Todos</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metric Summary Cards */}
        {selectedProduct ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                Existencia Actual en Físico
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-slate-950">
                  {selectedProduct.stock} <span className="text-sm font-bold text-slate-500">{selectedProduct.unit}</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedProduct.stock <= selectedProduct.minStock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {selectedProduct.stock <= selectedProduct.minStock ? 'Stock Bajo' : 'Stock Normal'}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                Costo Promedio Ponderado
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-emerald-700">
                  {formatCurrency(totals.avgCost, settings.currencySymbol)}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Unitario</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                Valor Total en Inventario
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-slate-950">
                  {formatCurrency(totals.totalValuation, settings.currencySymbol)}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Capital Activo</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                Flujo de Ventas Realizadas
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-orange-600">
                  {totals.totalOutQty} <span className="text-sm font-bold text-slate-500">{selectedProduct.unit}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Salidas registradas
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                Total Movimientos Registrados
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-slate-950">
                  {generalStats.totalMovementsCount}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Transacciones</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">
                Ingresos / Compras Totales ($)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-emerald-700">
                  {formatCurrency(generalStats.totalInValue, settings.currencySymbol)}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Entradas</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-rose-700 tracking-wider">
                Salidas / Ventas Totales ($)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-rose-700">
                  {formatCurrency(generalStats.totalOutValue, settings.currencySymbol)}
                </span>
                <span className="text-[10px] font-bold text-rose-600 uppercase">Despachos</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                Artículos Operados
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-orange-600">
                  {generalStats.uniqueProductsCount} <span className="text-xs text-slate-400 font-normal">/ {products.length}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Con Actividad</span>
              </div>
            </div>
          </div>
        )}

        {/* Historical Cost vs Price & Profitability Comparison Panel (Single Product Only) */}
        {selectedProduct && costAnalysis && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-2xl border border-orange-500/30 shadow-xs">
                  <Percent className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
                    <span>Análisis Financiero de Rentabilidad & Comparativo de Costos</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Costo Promedio Ponderado (CPP)
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Comparación en tiempo real entre el costo de reposición, costo promedio y margen sobre el PVP de venta.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                  costAnalysis.grossMarginPercent >= 25
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : costAnalysis.grossMarginPercent >= 12
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {costAnalysis.grossMarginPercent >= 25 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>Margen {costAnalysis.grossMarginPercent >= 25 ? 'Saludable' : costAnalysis.grossMarginPercent >= 12 ? 'Moderado' : 'Crítico / Riesgo'}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
              {/* 1. Costo Inicial */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo Apertura</span>
                <span className="text-base font-black font-mono text-slate-300 mt-0.5 block">
                  {formatCurrency(costAnalysis.initialCost, settings.currencySymbol)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Saldo inicial</span>
              </div>

              {/* 2. Última Compra */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Última Compra</span>
                <span className="text-base font-black font-mono text-sky-400 mt-0.5 block">
                  {formatCurrency(costAnalysis.lastPurchaseCost, settings.currencySymbol)}
                </span>
                <span className="text-[10px] text-sky-500 font-medium">Reposición</span>
              </div>

              {/* 3. Costo Promedio Ponderado */}
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">Costo Promedio (CPP)</span>
                <span className="text-lg font-black font-mono text-emerald-300 mt-0.5 block">
                  {formatCurrency(costAnalysis.currentAvgCost, settings.currencySymbol)}
                </span>
                <span className="text-[10px] text-emerald-400/80 font-bold">
                  {costAnalysis.costVariationPercent >= 0 ? `+${costAnalysis.costVariationPercent.toFixed(1)}%` : `${costAnalysis.costVariationPercent.toFixed(1)}%`} vs inicio
                </span>
              </div>

              {/* 4. PVP Venta */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PVP al Público</span>
                <span className="text-lg font-black font-mono text-orange-400 mt-0.5 block">
                  {formatCurrency(costAnalysis.salePrice, settings.currencySymbol)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Precio factura</span>
              </div>

              {/* 5. Ganancia Unitaria */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ganancia Bruta</span>
                <span className="text-base font-black font-mono text-white mt-0.5 block">
                  {formatCurrency(costAnalysis.unitGrossProfit, settings.currencySymbol)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Por unidad</span>
              </div>

              {/* 6. Margen Real % */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Margen Bruto</span>
                <span className={`text-lg font-black font-mono mt-0.5 block ${
                  costAnalysis.grossMarginPercent >= 25 ? 'text-emerald-400' : costAnalysis.grossMarginPercent >= 12 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {costAnalysis.grossMarginPercent.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Sobre venta</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por comprobante, producto, SKU, bodega, cliente o motivo..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div className="w-48">
              <Select
                value={selectedWarehouseFilter}
                onChange={(e: any) => setSelectedWarehouseFilter(e.target.value)}
                className="bg-slate-50 border-slate-200 font-bold text-xs"
              >
                <option value="TODAS">Todas las Bodegas & Sucursales</option>
                <option value="Bodega Central">Bodega Central Norte</option>
                <option value="Tienda POS">Salón de Ventas / Tienda POS</option>
                <option value="Sucursal">Sucursales Externas</option>
              </Select>
            </div>

            <div className="w-48">
              <Select
                value={movementTypeFilter}
                onChange={(e: any) => setMovementTypeFilter(e.target.value)}
                className="bg-slate-50 border-slate-200 font-bold text-xs"
              >
                <option value="TODOS">Todos los Movimientos</option>
                <option value="VENTAS">Solo Ventas (POS)</option>
                <option value="COMPRAS">Solo Compras (Proveedores)</option>
                <option value="AJUSTES">Solo Ajustes & Toma Física</option>
                <option value="DEVOLUCIONES">Solo Devoluciones</option>
                <option value="TRANSFERENCIAS">Solo Transferencias Bodega</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500">Desde:</span>
              <div className="w-36">
                <CustomDatePicker
                  value={dateFrom}
                  onChange={setDateFrom}
                  className="py-1.5 px-2.5 text-xs bg-slate-50 border-slate-200"
                  placeholder="Inicio"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500">Hasta:</span>
              <div className="w-36">
                <CustomDatePicker
                  value={dateTo}
                  onChange={setDateTo}
                  className="py-1.5 px-2.5 text-xs bg-slate-50 border-slate-200"
                  placeholder="Fin"
                />
              </div>
            </div>

            {(dateFrom || dateTo || movementTypeFilter !== 'TODOS' || selectedWarehouseFilter !== 'TODAS' || filterText) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setMovementTypeFilter('TODOS');
                  setSelectedWarehouseFilter('TODAS');
                  setFilterText('');
                }}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                title="Limpiar Filtros"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Kardex 11-Column Table (Matching exact user specification) */}
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[620px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-xs sticky top-0 z-10">
                <tr className="divide-x divide-slate-200/60">
                  <th
                    onClick={() => handleSort('seqId')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'seqId' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Id</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('date')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'date' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Fecha</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('productName')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'productName' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Producto</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('tipoBadge')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'tipoBadge' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Tipo</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('motivo')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'motivo' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Motivo</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('stockAnt')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'stockAnt' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Stock ant.</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('cantidad')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'cantidad' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Cantidad</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('stockNuevo')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'stockNuevo' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Stock nuevo</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('precio')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'precio' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Precio</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('referencia')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'referencia' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Referencia</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('user')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortColumn === 'user' ? 'text-orange-500 font-black' : 'text-slate-400'}`} />
                      <span>Usuario</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No se encontraron movimientos registrados para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const isEgreso = m.tipoBadge === 'Egreso';

                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-50/90 transition-colors border-b border-slate-100"
                      >
                        {/* 1. Id */}
                        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800 text-xs">
                          {m.seqId}
                        </td>

                        {/* 2. Fecha */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] leading-tight">
                          <div className="text-slate-800 font-semibold">{m.dateOnly}</div>
                          <div className="text-slate-400 text-[10px] mt-0.5">{m.timeOnly}</div>
                        </td>

                        {/* 3. Producto */}
                        <td className="py-3 px-3 max-w-[280px]">
                          <button
                            type="button"
                            onClick={() => {
                              if (m.productId) {
                                setSelectedProductId(m.productId);
                                setProductSearch(m.productName || '');
                              }
                            }}
                            className="text-left font-bold text-slate-900 hover:text-orange-600 transition truncate block w-full cursor-pointer"
                            title="Filtrar kardex por este producto"
                          >
                            <span className="font-mono font-normal text-slate-500 mr-1.5">{m.sku}</span>
                            <span className="uppercase text-slate-900 font-semibold">{m.productName}</span>
                          </button>
                        </td>

                        {/* 4. Tipo */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white shadow-xs ${
                              isEgreso ? 'bg-[#dc2626]' : 'bg-[#15803d]'
                            }`}
                          >
                            {m.tipoBadge}
                          </span>
                        </td>

                        {/* 5. Motivo */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-800 text-xs">
                          {m.motivo}
                        </td>

                        {/* 6. Stock ant. */}
                        <td className="py-3 px-3 text-right font-mono text-slate-800 text-xs whitespace-nowrap">
                          {m.stockAnt.toFixed(2)}
                        </td>

                        {/* 7. Cantidad */}
                        <td className="py-3 px-3 text-right font-mono text-slate-800 text-xs whitespace-nowrap">
                          {m.cantidad.toFixed(2)}
                        </td>

                        {/* 8. Stock nuevo */}
                        <td className="py-3 px-3 text-right font-mono text-slate-800 text-xs whitespace-nowrap">
                          {m.stockNuevo.toFixed(2)}
                        </td>

                        {/* 9. Precio */}
                        <td className="py-3 px-3 text-right font-mono text-slate-800 text-xs whitespace-nowrap">
                          ${m.precio.toFixed(4)}
                        </td>

                        {/* 10. Referencia */}
                        <td className="py-3 px-3 text-slate-800 font-mono text-xs whitespace-nowrap">
                          {m.referencia}
                        </td>

                        {/* 11. Usuario */}
                        <td className="py-3 px-3 text-slate-800 text-xs whitespace-nowrap">
                          {m.user}
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

      {/* Modal: Registrar Ajuste Rápido de Stock */}
      {isAdjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn no-print">
          <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl ring-1 ring-slate-900/10 p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-orange-500/15 text-orange-600 rounded-xl">
                  <Sliders className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">Ajuste de Stock para Kardex</h3>
                  <p className="text-xs text-slate-500">Producto: <strong>{selectedProduct.name}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo / Motivo del Ajuste:</label>
                <Select
                  value={adjustTypeReason}
                  onChange={(e: any) => setAdjustTypeReason(e.target.value)}
                  className="bg-slate-50 border-slate-200 font-bold"
                >
                  <option value="CORRECCION_SOBRANTE">Entrada (+): Corrección de Inventario Físico (Sobrante)</option>
                  <option value="ENTRADA_COMPRA">Entrada (+): Compra / Ingreso Adicional</option>
                  <option value="ENTRADA_DEVOLUCION">Entrada (+): Devolución / Reingreso</option>
                  <option value="CORRECCION_FALTANTE">Salida (-): Corrección de Inventario Físico (Faltante)</option>
                  <option value="SALIDA_MERMA">Salida (-): Merma o Producto Dañado</option>
                  <option value="SALIDA_ROBO">Salida (-): Pérdida / Robo</option>
                </Select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cantidad a Ajustar ({selectedProduct.unit}):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  placeholder="0"
                  value={adjustQtyInput}
                  onChange={(e) => setAdjustQtyInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-lg rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Stock Actual:</span>
                  <strong className="font-mono">{selectedProduct.stock} {selectedProduct.unit}</strong>
                </div>
                <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                  <span>Nuevo Stock Estimado:</span>
                  <span className="font-mono text-emerald-600 font-black">
                    {Math.max(
                      0,
                      selectedProduct.stock +
                        (['SALIDA_MERMA', 'SALIDA_ROBO', 'CORRECCION_FALTANTE'].includes(adjustTypeReason)
                          ? -(parseFloat(adjustQtyInput) || 0)
                          : parseFloat(adjustQtyInput) || 0)
                    )}{' '}
                    {selectedProduct.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observación / Justificación:</label>
                <textarea
                  rows={2}
                  placeholder="Explique el motivo del ajuste para la auditoría de Kardex..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aplicar Ajuste a Kardex</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE IMPRESIÓN OFICIAL DEL KARDEX (A4) ────────────────────────── */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl p-6 sm:p-8 space-y-6 shadow-2xl my-auto">
            {/* Modal Header Actions (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-orange-500 text-white rounded-2xl shadow-sm">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                    <span>Vista Previa de Impresión / PDF - {selectedProduct ? `Tarjeta Kardex` : `Bitácora General de Inventario`}</span>
                    <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black rounded-full uppercase">
                      Documento Oficial SRI
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedProduct
                      ? `${selectedProduct.sku} - ${selectedProduct.name} • Método: Promedio Ponderado`
                      : `Consolidado General de Movimientos (${filteredMovements.length} registros)`}
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
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Documento Imprimible Formal */}
            <div id="printable-kardex" className="bg-white p-4 sm:p-6 space-y-5 text-slate-900 text-xs">
              {/* Membrete Corporativo */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain border border-slate-200 rounded-xl p-1" />
                  ) : (
                    <div className="p-3 bg-slate-900 text-white rounded-xl font-black text-lg">
                      <ClipboardList className="w-8 h-8 text-orange-400" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-lg font-black text-slate-950 uppercase tracking-tight">
                      {settings.storeName || 'FERRETERÍA INDUSTRIAL'}
                    </h1>
                    <p className="text-xs font-bold text-slate-700">{settings.legalName || settings.storeName}</p>
                    <p className="text-[11px] text-slate-600">RUC: <strong className="font-mono text-slate-900">{settings.taxId}</strong></p>
                    <p className="text-[11px] text-slate-600">{settings.address} • Tel: {settings.phone}</p>
                    <p className="text-[10px] text-slate-500">
                      Régimen: {settings.rimpe || 'General'} • Obligado a Contabilidad: {settings.accountingRequired ? 'SÍ' : 'NO'}
                    </p>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-slate-200 sm:pl-6 space-y-1">
                  <span className="px-3 py-1 bg-slate-900 text-white font-black text-[10px] rounded-lg uppercase tracking-wider block text-center">
                    {selectedProduct ? 'TARJETA KARDEX' : 'BITÁCORA DE INVENTARIO'}
                  </span>
                  <p className="text-[11px] font-bold text-slate-900">
                    {selectedProduct ? 'Control Valorizado de Existencias' : 'Reporte Consolidado de Movimientos'}
                  </p>
                  <p className="text-[10px] text-slate-600 font-mono">
                    Método: <strong>Promedio Ponderado</strong>
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Fecha de Emisión: {new Date().toLocaleString('es-EC')}
                  </p>
                </div>
              </div>

              {/* Ficha Técnica del Artículo o Resumen Consolidado */}
              {selectedProduct ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Código / SKU:</span>
                    <strong className="font-mono text-slate-900 text-sm">{selectedProduct.sku}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Artículo / Descripción:</span>
                    <strong className="text-slate-900">{selectedProduct.name}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Categoría / Unidad:</span>
                    <span className="text-slate-800">{selectedProduct.category} ({selectedProduct.unit})</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Stock Actual / Costo Prom.:</span>
                    <strong className="font-mono text-emerald-700">
                      {selectedProduct.stock} {selectedProduct.unit} • {formatCostCurrency(selectedProduct.costPrice, settings.currencySymbol)}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Alcance del Reporte:</span>
                    <strong className="text-slate-900">Consolidado General (Todos los Artículos)</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Transacciones:</span>
                    <strong className="font-mono text-slate-900">{filteredMovements.length} Registros</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Compras / Entradas:</span>
                    <strong className="font-mono text-emerald-700">${generalStats.totalInValue.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Ventas / Salidas:</span>
                    <strong className="font-mono text-rose-700">${generalStats.totalOutValue.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              {/* Tabla Formal de Movimientos (11 Columnas Exactas) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 text-slate-900 uppercase font-black text-[9px] border-b border-slate-300">
                    <tr className="divide-x divide-slate-300">
                      <th className="p-1.5 text-center">Id</th>
                      <th className="p-1.5">Fecha</th>
                      <th className="p-1.5">Producto</th>
                      <th className="p-1.5 text-center">Tipo</th>
                      <th className="p-1.5">Motivo</th>
                      <th className="p-1.5 text-right">Stock ant.</th>
                      <th className="p-1.5 text-right">Cantidad</th>
                      <th className="p-1.5 text-right">Stock nuevo</th>
                      <th className="p-1.5 text-right">Precio</th>
                      <th className="p-1.5">Referencia</th>
                      <th className="p-1.5">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 divide-x divide-slate-200">
                        <td className="p-1.5 font-mono text-center text-slate-800">{m.seqId}</td>
                        <td className="p-1.5 font-mono text-[9px] text-slate-800">
                          <div>{m.dateOnly}</div>
                          <div className="text-slate-500 text-[8px]">{m.timeOnly}</div>
                        </td>
                        <td className="p-1.5 text-slate-900">
                          <span className="font-mono text-slate-500 mr-1">{m.sku}</span>
                          <span className="font-bold uppercase">{m.productName}</span>
                        </td>
                        <td className="p-1.5 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold text-white ${
                              m.tipoBadge === 'Egreso' ? 'bg-[#dc2626]' : 'bg-[#15803d]'
                            }`}
                          >
                            {m.tipoBadge}
                          </span>
                        </td>
                        <td className="p-1.5 text-slate-800">{m.motivo}</td>
                        <td className="p-1.5 text-right font-mono text-slate-800">{m.stockAnt.toFixed(2)}</td>
                        <td className="p-1.5 text-right font-mono text-slate-800">{m.cantidad.toFixed(2)}</td>
                        <td className="p-1.5 text-right font-mono text-slate-800">{m.stockNuevo.toFixed(2)}</td>
                        <td className="p-1.5 text-right font-mono text-slate-800">${m.precio.toFixed(4)}</td>
                        <td className="p-1.5 font-mono text-[9px] text-slate-800">{m.referencia}</td>
                        <td className="p-1.5 text-slate-800 text-[9px]">{m.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Firmas de Responsabilidad */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Responsable de Bodega / Inventario</p>
                  <p className="text-slate-500 text-[10px]">Custodia física de existencias</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Contabilidad / Auditoría</p>
                  <p className="text-slate-500 text-[10px]">Control valorizado de libros SRI</p>
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
