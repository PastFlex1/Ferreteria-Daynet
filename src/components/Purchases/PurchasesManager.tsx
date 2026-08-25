import React, { useState, useEffect } from 'react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { useModal } from '../../context/ModalContext';
import { 
  ShoppingBag, 
  Clock, 
  ListOrdered, 
  FileCheck2, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  Building2, 
  Calendar, 
  DollarSign, 
  FileSpreadsheet, 
  Printer, 
  Send, 
  ArrowRight, 
  RefreshCw,
  X,
  CreditCard,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';
import { Product, PurchasesSubTab, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { Select } from '../Shared/Select';

interface PurchasesManagerProps {
  subTab: PurchasesSubTab;
  products: Product[];
  settings: StoreSettings;
  onSaveProduct: (product: Product) => void;
  onStockAdjust: (productId: string, adjustmentQty: number) => void;
}

export interface Supplier {
  id: string;
  taxId: string; // RUC / NIT / RFC
  name: string; // Razón Social
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  paymentDays: number; // Días de crédito
}

export interface PurchaseItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  costPrice: number;
  taxPercent: number;
  subtotal: number;
  total: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string; // Factura del Proveedor ej: 001-002-00004589
  supplier: Supplier;
  purchaseDate: string;
  dueDate: string;
  items: PurchaseItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentStatus: 'PAGADA' | 'CREDITO_PENDIENTE' | 'ANULADA';
  amountPaid: number;
  notes?: string;
  registeredBy: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string; // ej: OC-2026-0045
  supplier: Supplier;
  createdAt: string;
  expectedDelivery: string;
  items: PurchaseItem[];
  totalAmount: number;
  status: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECIBIDA' | 'CANCELADA';
  notes?: string;
}

export const PurchasesManager: React.FC<PurchasesManagerProps> = ({
  subTab,
  products,
  settings,
  onSaveProduct,
  onStockAdjust,
}) => {
  const { showAlert, showToast } = useModal();
  // Sync with the same collection used in SuppliersManager
  const [suppliers, setSuppliers] = useFirestoreSync<any[]>('ferreteria_suppliers_details', []);

  // Registered Purchase Invoices History
  const [purchasesHistory, setPurchasesHistory] = useFirestoreSync<PurchaseInvoice[]>('ferreteria_purchases', []);

  // Sync with the same batches used in Inventory
  const [batches, setBatches] = useFirestoreSync<any[]>('ferreteria_product_batches', []);

  // Purchase Orders
  const [purchaseOrders, setPurchaseOrders] = useFirestoreSync<PurchaseOrder[]>('ferreteria_purchase_orders', []);







  // -------------------------------------------------------------------------
  // FORM STATES FOR REGISTRAR COMPRA (COMPRAS)
  // -------------------------------------------------------------------------
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('001-001-0000' + Math.floor(1000 + Math.random() * 9000));
  const [purchaseDateInput, setPurchaseDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [paymentCondition, setPaymentCondition] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [creditDaysInput, setCreditDaysInput] = useState('30');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [newOrderSupplierId, setNewOrderSupplierId] = useState('');
  const [newOrderExpectedDate, setNewOrderExpectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newOrderItems, setNewOrderItems] = useState<PurchaseItem[]>([]);
  const [newOrderProductId, setNewOrderProductId] = useState('');
  const [newOrderQty, setNewOrderQty] = useState('10');

  const handleAddOrderProduct = () => {
    const p = products.find(prod => prod.id === newOrderProductId) || products[0];
    if(!p) return;
    const qty = parseFloat(newOrderQty) || 1;
    const sub = p.costPrice * qty;
    const tax = sub * (p.taxRate / 100);
    const newItem: PurchaseItem = {
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      quantity: qty,
      costPrice: p.costPrice,
      taxPercent: p.taxRate,
      subtotal: sub,
      total: sub + tax
    };
    setNewOrderItems([...newOrderItems, newItem]);
    setNewOrderProductId('');
    setNewOrderQty('10');
  };

  const handleCreatePurchaseOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if(newOrderItems.length === 0) return;
    const supplier = suppliers.find(s => s.id === newOrderSupplierId) || suppliers[0];
    const newOrder: PurchaseOrder = {
      id: `oc-${Date.now()}`,
      orderNumber: `OC-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(4, '0')}`,
      supplier,
      createdAt: new Date().toISOString().split('T')[0],
      expectedDelivery: newOrderExpectedDate || new Date().toISOString().split('T')[0],
      items: newOrderItems,
      totalAmount: newOrderItems.reduce((acc, item) => acc + item.total, 0),
      status: 'BORRADOR'
    };
    setPurchaseOrders([newOrder, ...purchaseOrders]);
    setIsNewOrderModalOpen(false);
    setNewOrderItems([]);
  };


  // Item selector for purchase form
  const [currentProductId, setCurrentProductId] = useState<string>(products[0]?.id || '');
  const [currentQty, setCurrentQty] = useState<string>('10');
  const [currentCost, setCurrentCost] = useState<string>(products[0]?.costPrice?.toString() || '10');
  const [currentTaxRate, setCurrentTaxRate] = useState<string>('15');
  const [currentBatch, setCurrentBatch] = useState<string>('');
  const [currentExpiry, setCurrentExpiry] = useState<string>('');

  const [purchaseSuccessMsg, setPurchaseSuccessMsg] = useState<string | null>(null);

  // New Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    taxId: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    paymentDays: 30
  });

  // Invoice Detail Modal View
  const [selectedInvoiceView, setSelectedInvoiceView] = useState<PurchaseInvoice | null>(null);
  const [paymentAbonoAmount, setPaymentAbonoAmount] = useState('');

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------
  const handleAddPurchaseItem = () => {
    const prod = products.find((p) => p.id === currentProductId);
    if (!prod) return;

    const qty = parseFloat(currentQty) || 0;
    const cost = parseFloat(currentCost) || 0;
    const tax = parseFloat(currentTaxRate) || 0;

    if (qty <= 0 || cost < 0) return;

    if (!currentBatch.trim() || !currentExpiry) {
      showAlert('El número de lote y la fecha de caducidad son obligatorios para ingresar la mercadería.', 'Campos Requeridos', 'warning');
      return;
    }

    const sub = qty * cost;
    const taxVal = sub * (tax / 100);
    const tot = sub + taxVal;

    const newItem: PurchaseItem = {
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      quantity: qty,
      costPrice: cost,
      taxPercent: tax,
      subtotal: sub,
      total: tot,
      batchNumber: currentBatch || undefined,
      expiryDate: currentExpiry || undefined
    };

    setPurchaseItems([...purchaseItems, newItem]);
    setCurrentQty('10');
    setCurrentBatch('');
    setCurrentExpiry('');
  };

  const handleRemovePurchaseItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handleProcessPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) return;

    const supplier = suppliers.find((s) => s.id === selectedSupplierId) || suppliers[0];

    const subtotal = purchaseItems.reduce((acc, item) => acc + item.subtotal, 0);
    const taxTotal = purchaseItems.reduce((acc, item) => acc + (item.total - item.subtotal), 0);
    const total = subtotal + taxTotal;

    const days = paymentCondition === 'CREDITO' ? parseInt(creditDaysInput) || 30 : 0;
    const dueDateObj = new Date(purchaseDateInput);
    dueDateObj.setDate(dueDateObj.getDate() + days);

    const newInvoice: PurchaseInvoice = {
      id: `pur-${Date.now()}`,
      invoiceNumber: invoiceNumberInput,
      supplier,
      purchaseDate: purchaseDateInput,
      dueDate: dueDateObj.toISOString().split('T')[0],
      items: purchaseItems,
      subtotal,
      taxTotal,
      total,
      paymentStatus: paymentCondition === 'CONTADO' ? 'PAGADA' : 'CREDITO_PENDIENTE',
      amountPaid: paymentCondition === 'CONTADO' ? total : 0,
      registeredBy: 'Administrador POS'
    };

    // Increase product stocks in catalog & update cost price
    purchaseItems.forEach((item) => {
      onStockAdjust(item.productId, item.quantity);

      const targetProd = products.find((p) => p.id === item.productId);
      if (targetProd) {
        onSaveProduct({
          ...targetProd,
          costPrice: item.costPrice,
          stock: targetProd.stock + item.quantity
        });
      }
    });

    // Process Purchase & Save Batches
    const newBatchesList = [...batches];
    purchaseItems.forEach((item) => {
      if (item.batchNumber && item.expiryDate) {
        const today = new Date();
        const expiry = new Date(item.expiryDate);
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' = 'VIGENTE';
        if (diffDays < 0) {
          status = 'VENCIDO';
        } else if (diffDays <= 30) {
          status = 'POR_VENCER';
        }

        const prod = products.find(p => p.id === item.productId);
        
        newBatchesList.unshift({
          id: `b-${Date.now()}-${item.productId}-${Math.random().toString(36).substring(2, 5)}`,
          productId: item.productId,
          productName: item.productName,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          quantity: item.quantity,
          location: prod?.location || 'Bodega Principal',
          status
        });
      }
    });
    setBatches(newBatchesList);

    setPurchasesHistory([newInvoice, ...purchasesHistory]);
    setPurchaseItems([]);
    setInvoiceNumberInput('001-001-0000' + Math.floor(1000 + Math.random() * 9000));
    setPurchaseSuccessMsg(`¡Factura de Compra #${newInvoice.invoiceNumber} registrada exitosamente! Se actualizó el inventario.`);
  };

  // Process Abono to Supplier Invoice
  const handleRegisterSupplierAbono = () => {
    if (!selectedInvoiceView) return;
    const abono = parseFloat(paymentAbonoAmount) || 0;
    if (abono <= 0) return;

    const newAmountPaid = selectedInvoiceView.amountPaid + abono;
    const isPaidInFull = newAmountPaid >= selectedInvoiceView.total;

    const updated: PurchaseInvoice = {
      ...selectedInvoiceView,
      amountPaid: Math.min(newAmountPaid, selectedInvoiceView.total),
      paymentStatus: isPaidInFull ? 'PAGADA' : 'CREDITO_PENDIENTE'
    };

    setPurchasesHistory(purchasesHistory.map((inv) => (inv.id === updated.id ? updated : inv)));
    setSelectedInvoiceView(updated);
    setPaymentAbonoAmount('');
  };

  // Convert Pre-order / Low Stock Items to Purchase Order
  const handleGeneratePurchaseOrderFromLowStock = (lowStockProducts: Product[]) => {
    if (lowStockProducts.length === 0) return;

    const defaultSupplier = suppliers[0];
    const items: PurchaseItem[] = lowStockProducts.map((prod) => {
      const suggestQty = Math.max(10, prod.minStock * 2 - prod.stock);
      const sub = suggestQty * prod.costPrice;
      const tax = sub * (prod.taxRate / 100);
      return {
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        quantity: suggestQty,
        costPrice: prod.costPrice,
        taxPercent: prod.taxRate,
        subtotal: sub,
        total: sub + tax
      };
    });

    const totalAmount = items.reduce((acc, i) => acc + i.total, 0);

    const newOrder: PurchaseOrder = {
      id: `oc-${Date.now()}`,
      orderNumber: `OC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      supplier: defaultSupplier,
      createdAt: new Date().toISOString().split('T')[0],
      expectedDelivery: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      items,
      totalAmount,
      status: 'ENVIADA',
      notes: 'Generado automáticamente por sugerido de bajo stock'
    };

    setPurchaseOrders([newOrder, ...purchaseOrders]);
    showToast(`Orden de Compra #${newOrder.orderNumber} creada con ${items.length} artículos sugeridos!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------
          SUBTAB 1: COMPRAS (REGISTRO DE FACTURA DE COMPRA)
         --------------------------------------------------------------------- */}
      {subTab === 'COMPRAS' && (
        <>
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-500" />
                <span>Registro de Facturas de Compra & Mercadería</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ingresa compras de proveedores para reabastecer el inventario y actualizar precios de costo.
              </p>
            </div>

            <button
              onClick={() => {
                setNewSupplier({
                  taxId: '',
                  name: '',
                  contactPerson: '',
                  phone: '',
                  email: '',
                  address: '',
                  paymentDays: 30
                });
                setIsSupplierModalOpen(true);
              }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-orange-400" />
              <span>Nuevo Proveedor</span>
            </button>
          </div>

          {purchaseSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {purchaseSuccessMsg}
              </span>
              <button onClick={() => setPurchaseSuccessMsg(null)}>✕</button>
            </div>
          )}

          <form onSubmit={handleProcessPurchase} className="space-y-6">
            {/* Header Form Data */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">Proveedor</label>
                <Select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.taxId})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">N° Factura Proveedor</label>
                <input
                  type="text"
                  required
                  value={invoiceNumberInput}
                  onChange={(e) => setInvoiceNumberInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Fecha Emisión</label>
                <CustomDatePicker value={purchaseDateInput} onChange={setPurchaseDateInput} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold" />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Condición de Pago</label>
                <div className="flex gap-2">
                  <Select
                    value={paymentCondition}
                    onChange={(e) => setPaymentCondition(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="CONTADO">Contado (Pagado)</option>
                    <option value="CREDITO">Crédito Proveedor</option>
                  </Select>
                  {paymentCondition === 'CREDITO' && (
                    <input
                      type="number"
                      placeholder="Días"
                      value={creditDaysInput}
                      onChange={(e) => setCreditDaysInput(e.target.value)}
                      className="w-20 px-2 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-center"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Product Item Entry */}
            <div className="p-4 bg-orange-50/50 border border-orange-200/80 rounded-2xl space-y-3 text-xs">
              <h3 className="font-black text-orange-950 text-xs uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-600" />
                <span>Agregar Artículo a la Factura de Compra</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Producto Catálogo</label>
                  <Select
                    value={currentProductId}
                    onChange={(e) => {
                      setCurrentProductId(e.target.value);
                      const p = products.find((prod) => prod.id === e.target.value);
                      if (p) {
                        setCurrentCost(p.costPrice.toString());
                        setCurrentTaxRate((typeof p.taxRate === 'number' ? p.taxRate : 15).toString());
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (IVA {typeof p.taxRate === 'number' ? p.taxRate : 15}%)
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={currentQty}
                    onChange={(e) => setCurrentQty(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Costo Unit. ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    value={currentCost}
                    onChange={(e) => setCurrentCost(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-center text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tarifa IVA</label>
                  <Select
                    value={currentTaxRate}
                    onChange={(e) => setCurrentTaxRate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-center text-orange-600"
                  >
                    <option value="15">IVA 15%</option>
                    <option value="5">IVA 5% (Construcción)</option>
                    <option value="0">IVA 0%</option>
                    <option value="8">IVA 8%</option>
                  </Select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">N° Lote *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: LOT-901"
                    value={currentBatch}
                    onChange={(e) => setCurrentBatch(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">F. Caducidad *</label>
                  <CustomDatePicker value={currentExpiry} onChange={setCurrentExpiry} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono" />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleAddPurchaseItem}
                    className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">SKU / Producto</th>
                    <th className="py-3 px-4 text-center">Cantidad</th>
                    <th className="py-3 px-4 text-right">Costo Unit.</th>
                    <th className="py-3 px-4 text-center">Tarifa IVA</th>
                    <th className="py-3 px-4 text-center">Lote / Caducidad</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">Total c/IVA</th>
                    <th className="py-3 px-4 text-center">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {purchaseItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                        No has agregado ningún artículo a esta compra.
                      </td>
                    </tr>
                  ) : (
                    purchaseItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black text-slate-900">
                          <span className="font-mono text-orange-600 text-[11px] block">{item.sku}</span>
                          {item.productName}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{item.quantity} u.</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(item.costPrice, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] border ${
                            item.taxPercent === 5 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : item.taxPercent === 0 
                              ? 'bg-slate-100 text-slate-700 border-slate-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {item.taxPercent}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500">
                          <span className="block font-bold text-slate-800">{item.batchNumber}</span>
                          {item.expiryDate}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(item.subtotal, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">
                          {formatCurrency(item.total, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePurchaseItem(idx)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals Summary & Submit */}
            <div className="flex flex-col sm:flex-row items-end justify-between gap-4 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-500 space-y-1">
                <div>Items agregados: <strong className="text-slate-900 font-mono">{purchaseItems.length}</strong></div>
                <div>Registrado por: <strong className="text-slate-900 font-bold">Administrador POS</strong></div>
              </div>

              {/* Dynamic Totals Summary */}
              {(() => {
                const sub15 = purchaseItems.filter(i => i.taxPercent === 15).reduce((acc, i) => acc + i.subtotal, 0);
                const sub5 = purchaseItems.filter(i => i.taxPercent === 5).reduce((acc, i) => acc + i.subtotal, 0);
                const sub0 = purchaseItems.filter(i => i.taxPercent === 0).reduce((acc, i) => acc + i.subtotal, 0);
                const subEsp = purchaseItems.filter(i => ![15, 5, 0].includes(i.taxPercent)).reduce((acc, i) => acc + i.subtotal, 0);
                const totTax = purchaseItems.reduce((acc, i) => acc + (i.total - i.subtotal), 0);
                const totFactura = purchaseItems.reduce((acc, i) => acc + i.total, 0);

                return (
                  <div className="w-full sm:w-80 bg-slate-950 text-white p-4 rounded-2xl space-y-1.5 text-xs font-mono">
                    {sub15 > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal 15%:</span>
                        <span>{formatCurrency(sub15, settings.currencySymbol)}</span>
                      </div>
                    )}
                    {sub5 > 0 && (
                      <div className="flex justify-between text-amber-400 font-bold">
                        <span>Subtotal 5% (Construcción):</span>
                        <span>{formatCurrency(sub5, settings.currencySymbol)}</span>
                      </div>
                    )}
                    {sub0 > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal 0%:</span>
                        <span>{formatCurrency(sub0, settings.currencySymbol)}</span>
                      </div>
                    )}
                    {subEsp > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal Otros:</span>
                        <span>{formatCurrency(subEsp, settings.currencySymbol)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-300 font-bold pt-1 border-t border-slate-800">
                      <span>Total Impuestos (IVA):</span>
                      <span className="text-emerald-400">{formatCurrency(totTax, settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-orange-400 pt-1.5 border-t border-slate-800">
                      <span>Total Factura:</span>
                      <span>{formatCurrency(totFactura, settings.currencySymbol)}</span>
                    </div>

                    <button
                      type="submit"
                      disabled={purchaseItems.length === 0}
                      className="w-full mt-3 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50"
                    >
                      Procesar Compra e Ingresar al Inventario
                    </button>
                  </div>
                );
              })()}
            </div>
          </form>
        </div>

      {/* ---------------------------------------------------------------------
          HISTORIAL DE COMPRAS (Integrado)
         --------------------------------------------------------------------- */}
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span>Historial de Facturas & Registros de Compras</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulta facturas de proveedor registradas, saldos pendientes a crédito y abonos realizados.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Fecha / N° Factura</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4 text-right">Monto Total</th>
                  <th className="py-3 px-4 text-right">Monto Pagado</th>
                  <th className="py-3 px-4 text-center">Estado Pago</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {purchasesHistory.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-black text-slate-900">
                      <span className="font-mono text-blue-600 text-[11px] block">{inv.invoiceNumber}</span>
                      {inv.purchaseDate}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {inv.supplier.name}
                      <span className="block text-[10px] text-slate-400 font-mono">RUC: {inv.supplier.taxId}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                      {formatCurrency(inv.total, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(inv.amountPaid, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          inv.paymentStatus === 'PAGADA'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedInvoiceView(inv)}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] cursor-pointer flex items-center justify-center gap-1 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5 text-orange-400" />
                        <span>Ver Detalle</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Invoice View Modal */}
          {selectedInvoiceView && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-orange-500" />
                    <span>Factura de Compra #{selectedInvoiceView.invoiceNumber}</span>
                  </h3>
                  <button onClick={() => setSelectedInvoiceView(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl">
                  <div>
                    <div className="text-slate-400 font-bold uppercase text-[10px]">Proveedor</div>
                    <div className="font-black text-slate-900 text-sm">{selectedInvoiceView.supplier.name}</div>
                    <div className="text-slate-600 font-mono">RUC: {selectedInvoiceView.supplier.taxId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 font-bold uppercase text-[10px]">Fecha Emisión</div>
                    <div className="font-mono font-bold text-slate-900">{selectedInvoiceView.purchaseDate}</div>
                    <div className="font-mono text-emerald-600 font-black text-sm mt-1">
                      Total: {formatCurrency(selectedInvoiceView.total, settings.currencySymbol)}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-48">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-950 text-white font-black text-[10px] uppercase">
                      <tr>
                        <th className="py-2 px-3">Producto</th>
                        <th className="py-2 px-3 text-center">Cant.</th>
                        <th className="py-2 px-3 text-right">Costo U.</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoiceView.items.map((it, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-bold">{it.productName}</td>
                          <td className="py-2 px-3 text-center font-mono">{it.quantity} u.</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCurrency(it.costPrice, settings.currencySymbol)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(it.total, settings.currencySymbol)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedInvoiceView.paymentStatus === 'CREDITO_PENDIENTE' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                    <div className="font-black text-amber-900">Registrar Abono a Proveedor</div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={selectedInvoiceView.total - selectedInvoiceView.amountPaid}
                        placeholder="0.00"
                        value={paymentAbonoAmount}
                        onChange={(e) => setPaymentAbonoAmount(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-sm"
                      />
                      <button
                        onClick={handleRegisterSupplierAbono}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl cursor-pointer shrink-0"
                      >
                        Pagar Abono
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 3: ORDENES DE COMPRA
         --------------------------------------------------------------------- */}
      {subTab === 'ORDENES_COMPRA' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-purple-500" />
                <span>Órdenes de Compra (OC) a Proveedores</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Genera pedidos formales de reabastecimiento antes de recibir la factura de compra final.
              </p>

            </div>
            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-purple-200" />
              <span>Nueva Orden de Compra</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Orden / Fecha</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4 text-center">Items Solicitados</th>
                  <th className="py-3 px-4 text-right">Monto Estimado</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {purchaseOrders.map((oc) => (
                  <tr key={oc.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-black text-slate-900">
                      <span className="font-mono text-purple-600 text-[11px] block">{oc.orderNumber}</span>
                      {oc.createdAt}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{oc.supplier.name}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{oc.items.length} prod.</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">
                      {formatCurrency(oc.totalAmount, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-blue-50 border-blue-200 text-blue-700">
                        {oc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-[11px] cursor-pointer">
                        Imprimir OC
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 4: PRE-ORDENES (REQUISICIÓN BAJO STOCK)
         --------------------------------------------------------------------- */}
      {subTab === 'PRE_ORDENES' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-amber-500" />
                <span>Pre-Órdenes & Sugeridos de Reabastecimiento</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Detección automática de productos agotados o con nivel crítico de stock para solicitar a proveedores.
              </p>
            </div>

            <button
              onClick={() => {
                const lowStockProds = products.filter((p) => p.stock <= p.minStock);
                handleGeneratePurchaseOrderFromLowStock(lowStockProds);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generar Orden de Compra Sugerida</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">SKU / Producto</th>
                  <th className="py-3 px-4 text-center">Stock Actual</th>
                  <th className="py-3 px-4 text-center">Stock Mínimo</th>
                  <th className="py-3 px-4 text-center">Sugerido a Pedir</th>
                  <th className="py-3 px-4 text-right">Costo Estimado</th>
                  <th className="py-3 px-4 text-center">Estado Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {products
                  .filter((p) => p.stock <= p.minStock + 5)
                  .map((p) => {
                    const suggestQty = Math.max(10, p.minStock * 2 - p.stock);
                    const isCritical = p.stock <= p.minStock;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black text-slate-900">
                          <span className="font-mono text-orange-600 text-[11px] block">{p.sku}</span>
                          {p.name}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-rose-600 text-sm">{p.stock} u.</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">{p.minStock} u.</td>
                        <td className="py-3 px-4 text-center font-mono font-black text-emerald-600 text-sm">+{suggestQty} u.</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(suggestQty * p.costPrice, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                              isCritical ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}
                          >
                            {isCritical ? 'STOCK CRÍTICO' : 'POR AGOTARSE'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      
      {/* New Purchase Order Modal */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl my-auto">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-purple-500" />
              Crear Nueva Orden de Compra
            </h3>
            
            <form onSubmit={handleCreatePurchaseOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Proveedor</label>
                  <Select 
                    value={newOrderSupplierId} 
                    onChange={(e: any) => setNewOrderSupplierId(e.target.value)}
                    className="bg-slate-50 border-slate-200 text-sm font-bold"
                  >
                    <option value="">Seleccione Proveedor...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Entrega Esperada</label>
                  <CustomDatePicker value={newOrderExpectedDate} onChange={setNewOrderExpectedDate} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 mt-4 space-y-4">
                <h4 className="text-xs font-black text-slate-900">Agregar Productos</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <Select
                      value={newOrderProductId}
                      onChange={(e: any) => setNewOrderProductId(e.target.value)}
                      className="bg-white border-slate-200 text-xs font-bold"
                    >
                      <option value="">Seleccionar Producto...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} - {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="1"
                      placeholder="Cantidad"
                      value={newOrderQty}
                      onChange={(e) => setNewOrderQty(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleAddOrderProduct}
                      className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              </div>

              {newOrderItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="py-2 px-3">Producto</th>
                        <th className="py-2 px-3 text-right">Cant.</th>
                        <th className="py-2 px-3 text-right">Costo</th>
                        <th className="py-2 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {newOrderItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-slate-800 font-medium">{item.productName}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{item.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-600">$\{item.costPrice.toFixed(4)}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setNewOrderItems(newOrderItems.filter((_, i) => i !== idx))}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button 
                  type="button" 
                  onClick={() => setIsNewOrderModalOpen(false)} 
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl shadow-md text-sm transition cursor-pointer disabled:opacity-50"
                  disabled={newOrderItems.length === 0}
                >
                  Crear Orden de Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Creation Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-500" />
              <span>Registrar Nuevo Proveedor</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 mb-1">RUC / NIT / RFC</label>
                <input
                  type="text"
                  placeholder="ej: 1792048591001"
                  value={newSupplier.taxId}
                  onChange={(e) => setNewSupplier({ ...newSupplier, taxId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Razón Social / Nombre Comercial</label>
                <input
                  type="text"
                  placeholder="ej: DISTRIBUIDORA FERRETERA DEL PACÍFICO"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+593 99..."
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-800 mb-1">Días Crédito</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="30"
                    value={newSupplier.paymentDays === 0 ? '' : newSupplier.paymentDays}
                    onChange={(e) => setNewSupplier({ ...newSupplier, paymentDays: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button onClick={() => {
                  setIsSupplierModalOpen(false);
                  setNewSupplier({
                    taxId: '',
                    name: '',
                    contactPerson: '',
                    phone: '',
                    email: '',
                    address: '',
                    paymentDays: 30
                  });
                }} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl">Cancelar</button>
                <button
                  onClick={() => {
                    if (newSupplier.taxId && newSupplier.name) {
                      setSuppliers([
                        ...suppliers,
                        {
                          id: `sup-${Date.now()}`,
                          taxId: newSupplier.taxId,
                          name: newSupplier.name,
                          contactPerson: newSupplier.contactPerson || 'Agente de Ventas',
                          phone: newSupplier.phone || '',
                          email: newSupplier.email || '',
                          address: newSupplier.address || '',
                          paymentDays: newSupplier.paymentDays || 30,
                          bankName: 'Banco Pichincha',
                          accountType: 'Corriente',
                          accountNumber: '',
                          status: 'ACTIVO',
                          currentBalance: 0,
                          notes: ''
                        }
                      ]);
                      setIsSupplierModalOpen(false);
                      setNewSupplier({
                        taxId: '',
                        name: '',
                        contactPerson: '',
                        phone: '',
                        email: '',
                        address: '',
                        paymentDays: 30
                      });
                    }
                  }}
                  className="px-5 py-2 bg-orange-500 text-white font-black rounded-xl shadow-md cursor-pointer"
                >
                  Guardar Proveedor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
