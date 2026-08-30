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
  Package, 
  DollarSign, 
  Boxes, 
  Calendar,
  Layers,
  Sliders,
  CheckCircle2,
  X
} from 'lucide-react';
import { Product, StoreSettings, Invoice, ProductCategory } from '../../types';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { formatCurrency } from '../../utils/formatters';
import { exportToModernExcel } from '../../utils/excelExport';
import { Select } from '../Shared/Select';
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
  date: string;
  type: 'SALDO_INICIAL' | 'COMPRA' | 'VENTA' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA' | 'DEVOLUCION_VENTA' | 'MERMA_DANO';
  typeLabel: string;
  docNumber: string;
  entityName: string; // Cliente, Proveedor o Motivo
  user: string;
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

  // ── Selection & Filter State ───────────────────────────────────────────────
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('TODOS');
  const [filterText, setFilterText] = useState('');

  // ── Quick Adjust Modal State ───────────────────────────────────────────────
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustQtyInput, setAdjustQtyInput] = useState('');
  const [adjustTypeReason, setAdjustTypeReason] = useState<'ENTRADA_COMPRA' | 'ENTRADA_DEVOLUCION' | 'SALIDA_MERMA' | 'SALIDA_ROBO' | 'CORRECCION_SOBRANTE' | 'CORRECCION_FALTANTE'>('CORRECCION_SOBRANTE');
  const [adjustNotes, setAdjustNotes] = useState('');

  // ── Official Print Modal State ─────────────────────────────────────────────
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0] || null;
  }, [products, selectedProductId]);

  // ── Build Chronological Real Kardex Movements ──────────────────────────────
  const allMovements = useMemo(() => {
    if (!selectedProduct) return [];

    const rawMovements: {
      id: string;
      timestamp: number;
      dateStr: string;
      type: KardexMovement['type'];
      typeLabel: string;
      docNumber: string;
      entityName: string;
      user: string;
      qty: number;
      cost: number;
      notes?: string;
    }[] = [];

    const prodId = selectedProduct.id;
    const prodSku = selectedProduct.sku.toLowerCase();

    // 1. Invoices / Sales from POS
    invoices.forEach((inv) => {
      if (inv.paymentStatus === 'ANULADA' || inv.documentType === 'COTIZACION') return;
      const invDate = inv.createdAt || (inv as any).date || new Date().toISOString();
      const timestamp = new Date(invDate).getTime() || Date.now();
      const docNum = inv.series ? `${inv.series}-${inv.number || inv.fullNumber || inv.id}` : (inv.fullNumber || `#${inv.number || inv.id}`);

      inv.items.forEach((item) => {
        const itemProdId = item.productId || (item as any).product?.id;
        const itemSku = (item.sku || (item as any).product?.sku || '').toLowerCase();

        if (itemProdId === prodId || (itemSku && itemSku === prodSku)) {
          rawMovements.push({
            id: `sale-${inv.id}-${item.productId || Math.random()}`,
            timestamp,
            dateStr: invDate.replace('T', ' ').substring(0, 16),
            type: 'VENTA',
            typeLabel: inv.documentType === 'FACTURA' ? 'Venta Factura' : 'Venta POS',
            docNumber: docNum,
            entityName: inv.customer?.name || 'Consumidor Final',
            user: inv.sellerName || 'Caja POS',
            qty: item.quantity,
            cost: selectedProduct.costPrice || 0,
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
          const itemSku = (item.sku || '').toLowerCase();

          if (itemProdId === prodId || (itemSku && itemSku === prodSku)) {
            rawMovements.push({
              id: `purch-${purch.id}-${item.productId || Math.random()}`,
              timestamp,
              dateStr: purchDate.replace('T', ' ').substring(0, 16),
              type: 'COMPRA',
              typeLabel: 'Compra Proveedor',
              docNumber: docNum,
              entityName: purch.supplier?.name || 'Proveedor Directo',
              user: purch.receivedBy || 'Bodega',
              qty: item.quantity,
              cost: item.costPrice || item.unitCost || selectedProduct.costPrice || 0,
              notes: `Ingreso factura proveedor (${purch.paymentCondition || 'Contado'})`,
            });
          }
        });
      }
    });

    // 3. Stock Adjustments (Physical audits, mermas, manual corrections)
    stockAdjustments.forEach((adj) => {
      if (adj.productId === prodId || (adj.sku && adj.sku.toLowerCase() === prodSku)) {
        const adjDate = adj.date || new Date().toISOString();
        const timestamp = new Date(adjDate).getTime() || Date.now();
        const isEntry = adj.qty > 0;
        const isMerma = adj.reason?.toLowerCase().includes('merma') || adj.reason?.toLowerCase().includes('daño') || adj.reason?.toLowerCase().includes('robo');

        rawMovements.push({
          id: `adj-${adj.id}`,
          timestamp,
          dateStr: adjDate.replace('T', ' ').substring(0, 16),
          type: isEntry ? 'AJUSTE_ENTRADA' : (isMerma ? 'MERMA_DANO' : 'AJUSTE_SALIDA'),
          typeLabel: isEntry ? 'Ajuste Entrada (+)' : (isMerma ? 'Salida por Merma (-)' : 'Ajuste Salida (-)'),
          docNumber: `AJU-${adj.id.substring(adj.id.length - 6)}`,
          entityName: adj.reason || 'Ajuste Manual de Inventario',
          user: adj.user || 'Administrador',
          qty: Math.abs(adj.qty),
          cost: adj.costPrice || selectedProduct.costPrice || 0,
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
          if (item.productId === prodId || (item.sku && item.sku.toLowerCase() === prodSku)) {
            rawMovements.push({
              id: `cn-${cn.id}-${Math.random()}`,
              timestamp,
              dateStr: cnDate.replace('T', ' ').substring(0, 16),
              type: 'DEVOLUCION_VENTA',
              typeLabel: 'Devolución Cliente (+)',
              docNumber: cn.creditNoteNumber || `NC-${cn.id.substring(0, 8)}`,
              entityName: cn.customerName || 'Cliente',
              user: cn.createdByName || 'Caja',
              qty: item.quantity,
              cost: selectedProduct.costPrice || 0,
              notes: cn.reason || 'Reingreso a inventario por devolución',
            });
          }
        });
      }
    });

    // Sort all movements chronologically (Ascending: oldest to newest)
    rawMovements.sort((a, b) => a.timestamp - b.timestamp);

    // If there are no historical records yet, register the initial balance
    let runningQty = 0;
    let runningCost = selectedProduct.costPrice || 0;

    // Determine initial balance if movements do not account for full current stock
    const netMovementsQty = rawMovements.reduce((acc, m) => {
      if (['COMPRA', 'AJUSTE_ENTRADA', 'DEVOLUCION_VENTA'].includes(m.type)) {
        return acc + m.qty;
      } else {
        return acc - m.qty;
      }
    }, 0);

    const initialEstimatedQty = Math.max(0, selectedProduct.stock - netMovementsQty);

    const kardexRows: KardexMovement[] = [];

    // Row 0: Initial Balance / Inventario Inicial
    runningQty = initialEstimatedQty;
    kardexRows.push({
      id: `ini-${prodId}`,
      date: '2026-01-01 08:00',
      type: 'SALDO_INICIAL',
      typeLabel: 'Inventario Inicial',
      docNumber: 'INV-INI-2026',
      entityName: 'Apertura de Sistema / Saldo Inicial',
      user: 'Sistema',
      inQty: initialEstimatedQty,
      inCost: runningCost,
      inTotal: initialEstimatedQty * runningCost,
      outQty: 0,
      outCost: 0,
      outTotal: 0,
      balanceQty: runningQty,
      balanceCost: runningCost,
      balanceTotal: runningQty * runningCost,
      notes: 'Saldo de existencias inicial registrado',
    });

    // Process all chronological events with Weighted Average Cost (Promedio Ponderado)
    rawMovements.forEach((m) => {
      const isInput = ['COMPRA', 'AJUSTE_ENTRADA', 'DEVOLUCION_VENTA'].includes(m.type);

      if (isInput) {
        const inQty = m.qty;
        const inCost = m.cost > 0 ? m.cost : runningCost;
        const inTotal = inQty * inCost;

        const prevTotalValue = runningQty * runningCost;
        runningQty += inQty;
        // Weighted Average Cost recalculation
        runningCost = runningQty > 0 ? (prevTotalValue + inTotal) / runningQty : inCost;

        kardexRows.push({
          id: m.id,
          date: m.dateStr,
          type: m.type,
          typeLabel: m.typeLabel,
          docNumber: m.docNumber,
          entityName: m.entityName,
          user: m.user,
          inQty,
          inCost,
          inTotal,
          outQty: 0,
          outCost: 0,
          outTotal: 0,
          balanceQty: runningQty,
          balanceCost: runningCost,
          balanceTotal: runningQty * runningCost,
          notes: m.notes,
        });
      } else {
        const outQty = m.qty;
        const outCost = runningCost; // Sales exit at current weighted average cost
        const outTotal = outQty * outCost;

        runningQty = Math.max(0, runningQty - outQty);

        kardexRows.push({
          id: m.id,
          date: m.dateStr,
          type: m.type,
          typeLabel: m.typeLabel,
          docNumber: m.docNumber,
          entityName: m.entityName,
          user: m.user,
          inQty: 0,
          inCost: 0,
          inTotal: 0,
          outQty,
          outCost,
          outTotal,
          balanceQty: runningQty,
          balanceCost: runningCost,
          balanceTotal: runningQty * runningCost,
          notes: m.notes,
        });
      }
    });

    return kardexRows;
  }, [selectedProduct, invoices, purchases, stockAdjustments, creditNotes]);

  // ── Filtered Movements ─────────────────────────────────────────────────────
  const filteredMovements = useMemo(() => {
    return allMovements.filter((m) => {
      // Date Range Filter
      if (dateFrom && m.date.substring(0, 10) < dateFrom) return false;
      if (dateTo && m.date.substring(0, 10) > dateTo) return false;

      // Type Filter
      if (movementTypeFilter === 'VENTAS' && m.type !== 'VENTA') return false;
      if (movementTypeFilter === 'COMPRAS' && m.type !== 'COMPRA') return false;
      if (movementTypeFilter === 'AJUSTES' && !['AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'MERMA_DANO'].includes(m.type)) return false;
      if (movementTypeFilter === 'DEVOLUCIONES' && m.type !== 'DEVOLUCION_VENTA') return false;

      // Text Search
      if (filterText) {
        const term = filterText.toLowerCase();
        const matchesDoc = m.docNumber.toLowerCase().includes(term);
        const matchesEntity = m.entityName.toLowerCase().includes(term);
        const matchesUser = m.user.toLowerCase().includes(term);
        const matchesType = m.typeLabel.toLowerCase().includes(term);
        if (!matchesDoc && !matchesEntity && !matchesUser && !matchesType) return false;
      }

      return true;
    });
  }, [allMovements, dateFrom, dateTo, movementTypeFilter, filterText]);

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
    if (!selectedProduct) return;

    const columns = [
      { header: 'Fecha y Hora', key: 'date', width: 18 },
      { header: 'Tipo Movimiento', key: 'typeLabel', width: 22 },
      { header: 'Documento / Comprobante', key: 'docNumber', width: 20 },
      { header: 'Detalle / Cliente / Proveedor', key: 'entityName', width: 35 },
      { header: 'Responsable', key: 'user', width: 18 },
      { header: 'Entrada Cant.', key: 'inQty', width: 14 },
      { header: 'Entrada Costo ($)', key: 'inCost', width: 16 },
      { header: 'Entrada Total ($)', key: 'inTotal', width: 16 },
      { header: 'Salida Cant.', key: 'outQty', width: 14 },
      { header: 'Salida Costo ($)', key: 'outCost', width: 16 },
      { header: 'Salida Total ($)', key: 'outTotal', width: 16 },
      { header: 'Saldo Existencia', key: 'balanceQty', width: 16 },
      { header: 'Costo Promedio ($)', key: 'balanceCost', width: 18 },
      { header: 'Valor Inventario ($)', key: 'balanceTotal', width: 18 },
    ];

    const dataToExport = filteredMovements.map((m) => ({
      date: m.date,
      typeLabel: m.typeLabel,
      docNumber: m.docNumber,
      entityName: m.entityName,
      user: m.user,
      inQty: m.inQty > 0 ? m.inQty : '-',
      inCost: m.inQty > 0 ? m.inCost : '-',
      inTotal: m.inQty > 0 ? m.inTotal : '-',
      outQty: m.outQty > 0 ? m.outQty : '-',
      outCost: m.outQty > 0 ? m.outCost : '-',
      outTotal: m.outQty > 0 ? m.outTotal : '-',
      balanceQty: m.balanceQty,
      balanceCost: m.balanceCost,
      balanceTotal: m.balanceTotal,
    }));

    exportToModernExcel({
      filename: `Kardex_${selectedProduct.sku}_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Tarjeta Kardex',
      title: `TARJETA KARDEX (VALORIZADO) - ${selectedProduct.sku} ${selectedProduct.name}`,
      columns,
      data: dataToExport,
    });

    showToast('Kardex exportado exitosamente a Excel.', 'success');
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
                  Tarjeta Kardex & Movimientos de Inventario
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-50 text-orange-700 border border-orange-200">
                  Promedio Ponderado • SRI
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Control cronológico real de entradas, compras, ventas POS y saldos valorizados por artículo.
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
          <div className="flex-1">
            <label className="block text-[11px] font-black text-orange-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              <span>Selecciona el Producto para Consultar Kardex:</span>
            </label>
            <Select
              value={selectedProductId}
              onChange={(e: any) => setSelectedProductId(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white text-xs font-bold w-full"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (Stock: {p.stock} {p.unit} | Costo: ${p.costPrice.toFixed(2)})
                </option>
              ))}
            </Select>
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
            </div>
          )}
        </div>
      </div>

      {/* Metric Summary Cards */}
      {selectedProduct && (
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
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por comprobante, cliente o motivo..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div className="w-44">
            <Select
              value={movementTypeFilter}
              onChange={(e: any) => setMovementTypeFilter(e.target.value)}
              className="bg-slate-50 border-slate-200 font-bold"
            >
              <option value="TODOS">Todos los Movimientos</option>
              <option value="VENTAS">Solo Ventas (POS)</option>
              <option value="COMPRAS">Solo Compras (Proveedores)</option>
              <option value="AJUSTES">Solo Ajustes & Mermas</option>
              <option value="DEVOLUCIONES">Solo Devoluciones</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">Desde:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">Hasta:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          {(dateFrom || dateTo || movementTypeFilter !== 'TODOS' || filterText) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setMovementTypeFilter('TODOS');
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

      {/* Main Kardex Multi-Column Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-white font-black uppercase text-[10px] sticky top-0 z-10">
              {/* Top grouping row */}
              <tr className="border-b border-slate-800">
                <th colSpan={4} className="py-2.5 px-3 bg-slate-950 text-slate-400 border-r border-slate-800">
                  Datos de la Transacción
                </th>
                <th colSpan={3} className="py-2.5 px-3 bg-emerald-950/70 text-emerald-300 text-center border-r border-slate-800">
                  Entradas (+)
                </th>
                <th colSpan={3} className="py-2.5 px-3 bg-rose-950/70 text-rose-300 text-center border-r border-slate-800">
                  Salidas (-)
                </th>
                <th colSpan={3} className="py-2.5 px-3 bg-amber-950/70 text-amber-300 text-center">
                  Existencias & Saldos
                </th>
              </tr>
              {/* Detailed columns */}
              <tr className="border-b border-slate-800 text-slate-300">
                <th className="py-2.5 px-3">Fecha & Hora</th>
                <th className="py-2.5 px-3">Operación</th>
                <th className="py-2.5 px-3">Comprobante</th>
                <th className="py-2.5 px-3 border-r border-slate-800">Detalle / Cliente / Prov.</th>
                
                {/* Entradas */}
                <th className="py-2.5 px-2 text-right bg-emerald-950/40 text-emerald-300">Cant.</th>
                <th className="py-2.5 px-2 text-right bg-emerald-950/40 text-emerald-300">Costo ($)</th>
                <th className="py-2.5 px-2 text-right bg-emerald-950/40 text-emerald-300 border-r border-slate-800">Total ($)</th>
                
                {/* Salidas */}
                <th className="py-2.5 px-2 text-right bg-rose-950/40 text-rose-300">Cant.</th>
                <th className="py-2.5 px-2 text-right bg-rose-950/40 text-rose-300">Costo ($)</th>
                <th className="py-2.5 px-2 text-right bg-rose-950/40 text-rose-300 border-r border-slate-800">Total ($)</th>
                
                {/* Saldos */}
                <th className="py-2.5 px-2 text-right bg-amber-950/40 text-amber-300">Cant.</th>
                <th className="py-2.5 px-2 text-right bg-amber-950/40 text-amber-300">Costo Prom.</th>
                <th className="py-2.5 px-3 text-right bg-amber-950/40 text-amber-300 font-bold">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No se encontraron movimientos registrados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isSale = m.type === 'VENTA';
                  const isPurchase = m.type === 'COMPRA';
                  const isInitial = m.type === 'SALDO_INICIAL';
                  const isEntry = ['COMPRA', 'AJUSTE_ENTRADA', 'DEVOLUCION_VENTA'].includes(m.type);

                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isInitial ? 'bg-slate-50/70 font-semibold' : ''
                      }`}
                    >
                      {/* Fecha */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {m.date}
                      </td>

                      {/* Operación badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                            isInitial
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : isPurchase
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isSale
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : m.type === 'DEVOLUCION_VENTA'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : isEntry
                              ? 'bg-teal-50 text-teal-700 border border-teal-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isEntry ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                          <span>{m.typeLabel}</span>
                        </span>
                      </td>

                      {/* Comprobante */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {m.docNumber}
                      </td>

                      {/* Detalle */}
                      <td className="py-2.5 px-3 max-w-[220px] truncate border-r border-slate-100 text-slate-600" title={`${m.entityName} (${m.user})`}>
                        <div className="font-semibold text-slate-800 truncate">{m.entityName}</div>
                        <div className="text-[10px] text-slate-400 truncate">Resp: {m.user}</div>
                      </td>

                      {/* Entradas */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                        {m.inQty > 0 ? m.inQty : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 bg-emerald-50/20">
                        {m.inQty > 0 ? `$${m.inCost.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-black text-emerald-800 bg-emerald-50/20 border-r border-slate-100">
                        {m.inQty > 0 ? `$${m.inTotal.toFixed(2)}` : '-'}
                      </td>

                      {/* Salidas */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-rose-600 bg-rose-50/20">
                        {m.outQty > 0 ? m.outQty : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 bg-rose-50/20">
                        {m.outQty > 0 ? `$${m.outCost.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-black text-rose-700 bg-rose-50/20 border-r border-slate-100">
                        {m.outQty > 0 ? `$${m.outTotal.toFixed(2)}` : '-'}
                      </td>

                      {/* Saldos */}
                      <td className="py-2.5 px-2 text-right font-mono font-black text-slate-950 bg-amber-50/30">
                        {m.balanceQty}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-800 bg-amber-50/30">
                        ${m.balanceCost.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950 bg-amber-50/30">
                        ${m.balanceTotal.toFixed(2)}
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
                  step={selectedProduct.allowFractional ? '0.1' : '1'}
                  min="0.1"
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
      {isPrintModalOpen && selectedProduct && (
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
                    <span>Vista Previa de Impresión / PDF - Tarjeta Kardex</span>
                    <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black rounded-full uppercase">
                      Documento Oficial SRI
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedProduct.sku} - {selectedProduct.name} • Método: Promedio Ponderado
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
                    TARJETA KARDEX
                  </span>
                  <p className="text-[11px] font-bold text-slate-900">Control Valorizado de Existencias</p>
                  <p className="text-[10px] text-slate-600 font-mono">
                    Método: <strong>Promedio Ponderado</strong>
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Fecha de Emisión: {new Date().toLocaleString('es-EC')}
                  </p>
                </div>
              </div>

              {/* Ficha Técnica del Artículo */}
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
                    {selectedProduct.stock} {selectedProduct.unit} • ${selectedProduct.costPrice.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Tabla Formal de Movimientos */}
              <table className="w-full text-left text-[11px] border border-slate-300">
                <thead className="bg-slate-100 text-slate-900 uppercase font-black text-[9px] border-b border-slate-300">
                  <tr>
                    <th rowSpan={2} className="p-2 border-r border-slate-300">Fecha</th>
                    <th rowSpan={2} className="p-2 border-r border-slate-300">Movimiento</th>
                    <th rowSpan={2} className="p-2 border-r border-slate-300">Doc / Ref</th>
                    <th colSpan={3} className="p-1.5 text-center border-r border-b border-slate-300 bg-emerald-50 text-emerald-900">ENTRADAS</th>
                    <th colSpan={3} className="p-1.5 text-center border-r border-b border-slate-300 bg-rose-50 text-rose-900">SALIDAS</th>
                    <th colSpan={3} className="p-1.5 text-center border-b border-slate-300 bg-blue-50 text-blue-900">SALDOS</th>
                  </tr>
                  <tr>
                    <th className="p-1.5 text-right border-r border-slate-300 bg-emerald-50/50">Cant</th>
                    <th className="p-1.5 text-right border-r border-slate-300 bg-emerald-50/50">Costo</th>
                    <th className="p-1.5 text-right border-r border-slate-300 bg-emerald-50/50">Total</th>
                    <th className="p-1.5 text-right border-r border-slate-300 bg-rose-50/50">Cant</th>
                    <th className="p-1.5 text-right border-r border-slate-300 bg-rose-50/50">Costo</th>
                    <th className="p-1.5 text-right border-r border-slate-300 bg-rose-50/50">Total</th>
                    <th className="p-1.5 text-right border-r border-slate-300 bg-blue-50/50">Cant</th>
                    <th className="p-1.5 text-right border-r border-slate-300 bg-blue-50/50">Costo Prom</th>
                    <th className="p-1.5 text-right bg-blue-50/50">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredMovements.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-1.5 border-r border-slate-200 font-mono text-[10px]">{m.date}</td>
                      <td className="p-1.5 border-r border-slate-200 font-bold">{m.typeLabel}</td>
                      <td className="p-1.5 border-r border-slate-200 font-mono text-[10px]">{m.docNumber || '-'}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">{m.inQty > 0 ? m.inQty : '-'}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">{m.inQty > 0 ? `$${m.inCost.toFixed(2)}` : '-'}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">{m.inQty > 0 ? `$${m.inTotal.toFixed(2)}` : '-'}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">{m.outQty > 0 ? m.outQty : '-'}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">{m.outQty > 0 ? `$${m.outCost.toFixed(2)}` : '-'}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-rose-700">{m.outQty > 0 ? `$${m.outTotal.toFixed(2)}` : '-'}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-black">{m.balanceQty}</td>
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono">${m.balanceCost.toFixed(2)}</td>
                      <td className="p-1.5 text-right font-mono font-black text-slate-900">${m.balanceTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

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
