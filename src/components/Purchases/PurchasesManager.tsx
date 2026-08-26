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
  Sparkles,
  Edit3,
  ClipboardList,
  Check,
  CheckCircle,
  TrendingDown,
  Boxes,
  FileText,
  ShoppingCart,
  Loader2
} from 'lucide-react';
import { Product, PurchasesSubTab, StoreSettings, TaxRateItem, PreOrder, PreOrderItem } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { Select } from '../Shared/Select';
import { defaultTaxRates } from '../../data/initialData';
import { validateEcuadorianDocument } from '../../utils/ecuadorianValidator';
import { useCedulaSearch } from '../../hooks/useCedulaSearch';

interface PurchasesManagerProps {
  subTab: PurchasesSubTab;
  products: Product[];
  settings: StoreSettings;
  onSaveProduct: (product: Product) => void;
  onStockAdjust: (productId: string, adjustmentQty: number) => void;
  onSelectSubTab?: (tab: PurchasesSubTab) => void;
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
  onSelectSubTab,
}) => {
  const { showAlert, showConfirm, showToast } = useModal();
  // Sync with the same collection used in SuppliersManager
  const [suppliers, setSuppliers] = useFirestoreSync<any[]>('ferreteria_suppliers_details', []);

  // Registered Purchase Invoices History
  const [purchasesHistory, setPurchasesHistory] = useFirestoreSync<PurchaseInvoice[]>('ferreteria_purchases', []);

  // Sync with the same batches used in Inventory
  const [batches, setBatches] = useFirestoreSync<any[]>('ferreteria_product_batches', []);

  // Purchase Orders
  const [purchaseOrders, setPurchaseOrders] = useFirestoreSync<PurchaseOrder[]>('ferreteria_purchase_orders', []);

  // Pre-Orders / Requisitions State
  const [preOrders, setPreOrders] = useFirestoreSync<PreOrder[]>('ferreteria_pre_orders', []);
  const [preOrdersActiveView, setPreOrdersActiveView] = useState<'SUGERIDOS' | 'HISTORIAL'>('SUGERIDOS');
  const [isPreOrderModalOpen, setIsPreOrderModalOpen] = useState(false);
  const [selectedPreOrderView, setSelectedPreOrderView] = useState<PreOrder | null>(null);

  // Pre-Order Form State
  const [preOrderSupplierId, setPreOrderSupplierId] = useState('');
  const [preOrderPriority, setPreOrderPriority] = useState<'ALTA' | 'MEDIA' | 'BAJA'>('ALTA');
  const [preOrderExpectedDate, setPreOrderExpectedDate] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [preOrderNotes, setPreOrderNotes] = useState('');
  const [preOrderItems, setPreOrderItems] = useState<PreOrderItem[]>([]);
  const [preOrderAddProductId, setPreOrderAddProductId] = useState('');
  const [preOrderAddQty, setPreOrderAddQty] = useState('');
  const [preOrderSearchFilter, setPreOrderSearchFilter] = useState('');

  // -------------------------------------------------------------------------
  // FORM STATES FOR REGISTRAR COMPRA (COMPRAS)
  // -------------------------------------------------------------------------
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [purchaseDateInput, setPurchaseDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [paymentCondition, setPaymentCondition] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [creditDaysInput, setCreditDaysInput] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [newOrderSupplierId, setNewOrderSupplierId] = useState('');
  const [newOrderExpectedDate, setNewOrderExpectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newOrderItems, setNewOrderItems] = useState<PurchaseItem[]>([]);
  const [newOrderProductId, setNewOrderProductId] = useState('');
  const [newOrderQty, setNewOrderQty] = useState('');

  // Purchase Order View & Edit State
  const [selectedOrderView, setSelectedOrderView] = useState<PurchaseOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [editOrderSupplierId, setEditOrderSupplierId] = useState('');
  const [editOrderExpectedDate, setEditOrderExpectedDate] = useState('');
  const [editOrderStatus, setEditOrderStatus] = useState<PurchaseOrder['status']>('BORRADOR');
  const [editOrderNotes, setEditOrderNotes] = useState('');
  const [editOrderItems, setEditOrderItems] = useState<PurchaseItem[]>([]);
  const [editOrderProductId, setEditOrderProductId] = useState('');
  const [editOrderQty, setEditOrderQty] = useState('');

  const handleAddOrderProduct = () => {
    const p = products.find(prod => prod.id === newOrderProductId) || products[0];
    if(!p) return;
    const qty = parseFloat(newOrderQty) || 1;
    const sub = p.costPrice * qty;
    const tax = sub * ((typeof p.taxRate === 'number' ? p.taxRate : 15) / 100);
    const newItem: PurchaseItem = {
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      quantity: qty,
      costPrice: p.costPrice,
      taxPercent: typeof p.taxRate === 'number' ? p.taxRate : 15,
      subtotal: sub,
      total: sub + tax
    };
    setNewOrderItems([...newOrderItems, newItem]);
    setNewOrderProductId('');
    setNewOrderQty('');
  };

  const handleCreatePurchaseOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if(newOrderItems.length === 0) return;
    const supplier = suppliers.find(s => s.id === newOrderSupplierId) || suppliers[0] || {
      id: `sup-${Date.now()}`,
      name: 'Proveedor General',
      taxId: '9999999999001',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      paymentDays: 30
    };
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
    showToast(`Orden de Compra #${newOrder.orderNumber} creada exitosamente.`, 'success');
  };

  // Open View Modal
  const handleOpenViewOrder = (oc: PurchaseOrder) => {
    setSelectedOrderView(oc);
  };

  // Open Edit Modal
  const handleOpenEditOrder = (oc: PurchaseOrder) => {
    setEditingOrder(oc);
    setEditOrderSupplierId(oc.supplier.id || suppliers[0]?.id || '');
    setEditOrderExpectedDate(oc.expectedDelivery || new Date().toISOString().split('T')[0]);
    setEditOrderStatus(oc.status || 'BORRADOR');
    setEditOrderNotes(oc.notes || '');
    setEditOrderItems(oc.items.map(item => ({ ...item })));
    setEditOrderProductId('');
    setEditOrderQty('');
  };

  // Add Item to Edit Order
  const handleAddEditOrderItem = () => {
    const p = products.find(prod => prod.id === editOrderProductId) || products[0];
    if (!p) return;
    const qty = parseFloat(editOrderQty) || 1;
    const sub = p.costPrice * qty;
    const tax = sub * ((typeof p.taxRate === 'number' ? p.taxRate : 15) / 100);
    const newItem: PurchaseItem = {
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      quantity: qty,
      costPrice: p.costPrice,
      taxPercent: typeof p.taxRate === 'number' ? p.taxRate : 15,
      subtotal: sub,
      total: sub + tax
    };
    setEditOrderItems(prev => [...prev, newItem]);
    setEditOrderProductId('');
    setEditOrderQty('');
  };

  // Save Edit Order
  const handleSaveEditOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    if (editOrderItems.length === 0) {
      showAlert('La orden de compra debe contener al menos un producto.', 'Orden Vacía', 'warning');
      return;
    }

    const supplier = suppliers.find(s => s.id === editOrderSupplierId) || editingOrder.supplier;
    const totalAmount = editOrderItems.reduce((acc, item) => acc + item.total, 0);

    const updatedOrder: PurchaseOrder = {
      ...editingOrder,
      supplier,
      expectedDelivery: editOrderExpectedDate,
      status: editOrderStatus,
      notes: editOrderNotes,
      items: editOrderItems,
      totalAmount,
    };

    setPurchaseOrders(prev => prev.map(o => o.id === editingOrder.id ? updatedOrder : o));
    if (selectedOrderView && selectedOrderView.id === editingOrder.id) {
      setSelectedOrderView(updatedOrder);
    }
    setEditingOrder(null);
    showToast(`Orden de Compra #${updatedOrder.orderNumber} actualizada exitosamente.`, 'success');
  };

  // Convert Order to Purchase Invoice
  const handleConvertOrderToPurchase = (oc: PurchaseOrder) => {
    setSelectedSupplierId(oc.supplier.id);
    setPurchaseItems(oc.items.map(item => ({ ...item })));
    setInvoiceNumberInput(`FAC-${oc.orderNumber.replace(/[^0-9]/g, '') || Date.now().toString().slice(-6)}`);
    
    // Update order status to RECIBIDA
    const updated = purchaseOrders.map(o => o.id === oc.id ? { ...o, status: 'RECIBIDA' as const } : o);
    setPurchaseOrders(updated);
    if (selectedOrderView && selectedOrderView.id === oc.id) {
      setSelectedOrderView({ ...selectedOrderView, status: 'RECIBIDA' });
    }

    if (onSelectSubTab) {
      onSelectSubTab('COMPRAS');
    }

    showToast(`¡Orden #${oc.orderNumber} cargada en Registrar Compra! Verifique los datos y guarde la factura.`, 'success');
  };

  // Delete Order
  const handleDeletePurchaseOrder = (oc: PurchaseOrder) => {
    showConfirm(
      `¿Está seguro de eliminar la Orden de Compra #${oc.orderNumber}? Esta acción no se puede deshacer.`,
      () => {
        setPurchaseOrders(prev => prev.filter(o => o.id !== oc.id));
        if (selectedOrderView && selectedOrderView.id === oc.id) {
          setSelectedOrderView(null);
        }
        showToast(`Orden de Compra #${oc.orderNumber} eliminada.`, 'info');
      },
      'Eliminar Orden de Compra',
      'Sí, Eliminar'
    );
  };

  // Print Order
  const handlePrintOrder = (oc: PurchaseOrder) => {
    setSelectedOrderView(oc);
    setTimeout(() => {
      window.print();
    }, 300);
  };


  // Item selector for purchase form
  const [taxRates] = useFirestoreSync<TaxRateItem[]>('ferreteria_settings_tax_rates', defaultTaxRates);
  const activeTaxRates = taxRates.filter(t => t.active !== false);
  const [currentProductId, setCurrentProductId] = useState<string>(products[0]?.id || '');
  const [currentQty, setCurrentQty] = useState<string>('10');
  const [currentCost, setCurrentCost] = useState<string>(products[0]?.costPrice?.toString() || '10');
  const [currentTaxRate, setCurrentTaxRate] = useState<string>(settings.defaultTaxRate ? settings.defaultTaxRate.toString() : '15');
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

  const { isSearchingCedula, fetchCedulaData } = useCedulaSearch();
  const lastSearchedQuickSupRef = React.useRef<string>('');

  const handleSearchQuickSupplierDoc = (docToSearch?: string) => {
    const doc = (docToSearch || newSupplier.taxId || '').trim();
    if (!doc) return;
    fetchCedulaData(doc, (data) => {
      setNewSupplier((prev) => ({
        ...prev,
        name: data.name || prev.name,
        address: data.address || prev.address,
        phone: data.phone || prev.phone,
        email: data.email || prev.email,
      }));
    });
  };

  useEffect(() => {
    if (!isSupplierModalOpen) {
      lastSearchedQuickSupRef.current = '';
      return;
    }
    const cleanDoc = (newSupplier.taxId || '').trim();
    if ((cleanDoc.length === 10 || cleanDoc.length === 13) && cleanDoc !== lastSearchedQuickSupRef.current) {
      const res = validateEcuadorianDocument('AUTO', cleanDoc);
      if (res.isValid) {
        lastSearchedQuickSupRef.current = cleanDoc;
        handleSearchQuickSupplierDoc(cleanDoc);
      }
    }
    if (cleanDoc === '') {
      lastSearchedQuickSupRef.current = '';
    }
  }, [newSupplier.taxId, isSupplierModalOpen]);

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
    setInvoiceNumberInput('');
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

  // -------------------------------------------------------------------------
  // PRE-ORDERS / REQUISITIONS HANDLERS
  // -------------------------------------------------------------------------
  const handleOpenCreatePreOrderFromLowStock = (selectedProds?: Product[]) => {
    const prods = selectedProds || products.filter(p => p.stock <= p.minStock + 5);
    if (prods.length === 0) {
      showAlert('No hay productos en estado de stock bajo o crítico en este momento.', 'Inventario Óptimo', 'info');
      return;
    }

    const items: PreOrderItem[] = prods.map(p => {
      const qty = Math.max(10, p.minStock * 2 - p.stock);
      const sub = qty * (p.costPrice || 0);
      const itemTaxRate = typeof p.taxRate === 'number' ? p.taxRate : 15;
      const tax = sub * (itemTaxRate / 100);
      return {
        productId: p.id,
        sku: p.sku,
        productName: p.name,
        currentStock: p.stock,
        minStock: p.minStock,
        quantity: qty > 0 ? qty : 10,
        costPrice: p.costPrice || 0,
        taxPercent: itemTaxRate,
        subtotal: sub,
        total: sub + tax,
      };
    });

    setPreOrderSupplierId(suppliers[0]?.id || '');
    setPreOrderPriority('ALTA');
    setPreOrderExpectedDate(new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]);
    setPreOrderNotes('Pre-orden generada por sugerido de stock crítico');
    setPreOrderItems(items);
    setIsPreOrderModalOpen(true);
  };

  const handleOpenCreateManualPreOrder = () => {
    setPreOrderSupplierId(suppliers[0]?.id || '');
    setPreOrderPriority('MEDIA');
    setPreOrderExpectedDate(new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]);
    setPreOrderNotes('');
    setPreOrderItems([]);
    setIsPreOrderModalOpen(true);
  };

  const handleOpenCreatePreOrderForSingleProduct = (product: Product) => {
    const qty = Math.max(10, product.minStock * 2 - product.stock);
    const sub = qty * (product.costPrice || 0);
    const itemTaxRate = typeof product.taxRate === 'number' ? product.taxRate : 15;
    const tax = sub * (itemTaxRate / 100);
    const singleItem: PreOrderItem = {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      currentStock: product.stock,
      minStock: product.minStock,
      quantity: qty > 0 ? qty : 10,
      costPrice: product.costPrice || 0,
      taxPercent: itemTaxRate,
      subtotal: sub,
      total: sub + tax,
    };

    setPreOrderSupplierId(suppliers[0]?.id || '');
    setPreOrderPriority(product.stock <= product.minStock ? 'ALTA' : 'MEDIA');
    setPreOrderExpectedDate(new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]);
    setPreOrderNotes(`Requisición individual para producto: ${product.name}`);
    setPreOrderItems([singleItem]);
    setIsPreOrderModalOpen(true);
  };

  const handleAddProductToPreOrderForm = () => {
    if (!preOrderAddProductId) return;
    const prod = products.find(p => p.id === preOrderAddProductId);
    if (!prod) return;

    const qty = parseFloat(preOrderAddQty) || 1;
    const existingIdx = preOrderItems.findIndex(i => i.productId === prod.id);

    if (existingIdx >= 0) {
      const updated = [...preOrderItems];
      const newQty = updated[existingIdx].quantity + qty;
      const sub = newQty * updated[existingIdx].costPrice;
      const tax = sub * (updated[existingIdx].taxPercent / 100);
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: newQty,
        subtotal: sub,
        total: sub + tax,
      };
      setPreOrderItems(updated);
    } else {
      const sub = qty * (prod.costPrice || 0);
      const itemTaxRate = typeof prod.taxRate === 'number' ? prod.taxRate : 15;
      const tax = sub * (itemTaxRate / 100);
      setPreOrderItems([
        ...preOrderItems,
        {
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          currentStock: prod.stock,
          minStock: prod.minStock,
          quantity: qty,
          costPrice: prod.costPrice || 0,
          taxPercent: itemTaxRate,
          subtotal: sub,
          total: sub + tax,
        }
      ]);
    }
    setPreOrderAddProductId('');
    setPreOrderAddQty('10');
  };

  const handleUpdatePreOrderItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    const updated = [...preOrderItems];
    const sub = newQty * updated[index].costPrice;
    const tax = sub * (updated[index].taxPercent / 100);
    updated[index] = {
      ...updated[index],
      quantity: newQty,
      subtotal: sub,
      total: sub + tax,
    };
    setPreOrderItems(updated);
  };

  const handleUpdatePreOrderItemCost = (index: number, newCost: number) => {
    if (newCost < 0) return;
    const updated = [...preOrderItems];
    const sub = updated[index].quantity * newCost;
    const tax = sub * (updated[index].taxPercent / 100);
    updated[index] = {
      ...updated[index],
      costPrice: newCost,
      subtotal: sub,
      total: sub + tax,
    };
    setPreOrderItems(updated);
  };

  const handleRemovePreOrderItem = (index: number) => {
    setPreOrderItems(preOrderItems.filter((_, idx) => idx !== index));
  };

  const handleSavePreOrder = (convertToOC = false) => {
    if (preOrderItems.length === 0) {
      showAlert('Debe agregar al menos un producto a la pre-orden.', 'Pre-Orden Vacía', 'warning');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === preOrderSupplierId) || suppliers[0];
    const totalCost = preOrderItems.reduce((acc, i) => acc + i.total, 0);
    const totalCount = preOrderItems.reduce((acc, i) => acc + i.quantity, 0);

    const newPreOrder: PreOrder = {
      id: `pre-${Date.now()}`,
      preOrderNumber: `PRE-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierId: supplierObj?.id,
      supplierName: supplierObj?.name || 'Proveedor General',
      createdAt: new Date().toISOString().split('T')[0],
      expectedDate: preOrderExpectedDate,
      priority: preOrderPriority,
      status: convertToOC ? 'CONVERTIDA_A_ORDEN' : 'PENDIENTE',
      items: preOrderItems,
      totalEstimatedCost: totalCost,
      totalItemsCount: totalCount,
      notes: preOrderNotes,
    };

    setPreOrders([newPreOrder, ...preOrders]);

    if (convertToOC) {
      const ocItems: PurchaseItem[] = preOrderItems.map(i => ({
        productId: i.productId,
        sku: i.sku,
        productName: i.productName,
        quantity: i.quantity,
        costPrice: i.costPrice,
        taxPercent: i.taxPercent,
        subtotal: i.subtotal,
        total: i.total,
      }));

      const newOrder: PurchaseOrder = {
        id: `oc-${Date.now()}`,
        orderNumber: `OC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        supplier: supplierObj || { id: 'sup-gen', name: 'Proveedor General', taxId: '', contactPerson: '', phone: '', email: '', address: '', paymentDays: 30 },
        createdAt: new Date().toISOString().split('T')[0],
        expectedDelivery: preOrderExpectedDate,
        items: ocItems,
        totalAmount: totalCost,
        status: 'ENVIADA',
        notes: `Generado desde Pre-Orden #${newPreOrder.preOrderNumber}. ${preOrderNotes}`,
      };

      setPurchaseOrders([newOrder, ...purchaseOrders]);
      showToast(`¡Pre-Orden #${newPreOrder.preOrderNumber} creada y convertida a Orden de Compra #${newOrder.orderNumber}!`, 'success');
    } else {
      showToast(`Pre-Orden #${newPreOrder.preOrderNumber} guardada exitosamente con ${preOrderItems.length} productos`, 'success');
    }

    setIsPreOrderModalOpen(false);
  };

  const handleConvertExistingPreOrderToOC = (preOrder: PreOrder) => {
    const supplierObj = suppliers.find(s => s.id === preOrder.supplierId) || suppliers[0];
    const ocItems: PurchaseItem[] = preOrder.items.map(i => ({
      productId: i.productId,
      sku: i.sku,
      productName: i.productName,
      quantity: i.quantity,
      costPrice: i.costPrice,
      taxPercent: i.taxPercent,
      subtotal: i.subtotal,
      total: i.total,
    }));

    const newOrder: PurchaseOrder = {
      id: `oc-${Date.now()}`,
      orderNumber: `OC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      supplier: supplierObj || { id: 'sup-gen', name: preOrder.supplierName || 'Proveedor General', taxId: '', contactPerson: '', phone: '', email: '', address: '', paymentDays: 30 },
      createdAt: new Date().toISOString().split('T')[0],
      expectedDelivery: preOrder.expectedDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      items: ocItems,
      totalAmount: preOrder.totalEstimatedCost,
      status: 'ENVIADA',
      notes: `Convertido desde Pre-Orden #${preOrder.preOrderNumber}. ${preOrder.notes || ''}`,
    };

    setPurchaseOrders([newOrder, ...purchaseOrders]);
    const updatedPreOrders = preOrders.map(p => p.id === preOrder.id ? { ...p, status: 'CONVERTIDA_A_ORDEN' as const } : p);
    setPreOrders(updatedPreOrders);
    if (selectedPreOrderView && selectedPreOrderView.id === preOrder.id) {
      setSelectedPreOrderView({ ...selectedPreOrderView, status: 'CONVERTIDA_A_ORDEN' });
    }
    showToast(`Pre-Orden #${preOrder.preOrderNumber} convertida a Orden de Compra #${newOrder.orderNumber}`, 'success');
  };

  const handleDeletePreOrder = (preOrderId: string) => {
    showConfirm(
      '¿Está seguro de eliminar esta pre-orden de requisición?',
      () => {
        setPreOrders(preOrders.filter(p => p.id !== preOrderId));
        if (selectedPreOrderView && selectedPreOrderView.id === preOrderId) {
          setSelectedPreOrderView(null);
        }
        showToast('Pre-Orden eliminada', 'info');
      },
      'Eliminar Pre-Orden'
    );
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
                  placeholder="Ej: 001-001-00004589"
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
                    {activeTaxRates.map(t => (
                      <option key={t.id} value={t.rate.toString()}>
                        {t.name} ({t.rate}%)
                      </option>
                    ))}
                    {!activeTaxRates.some(t => t.rate.toString() === currentTaxRate) && (
                      <option value={currentTaxRate}>IVA {currentTaxRate}%</option>
                    )}
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
                  <CustomDatePicker value={currentExpiry} onChange={setCurrentExpiry} align="right" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono" />
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
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        oc.status === 'RECIBIDA' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        oc.status === 'APROBADA' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                        oc.status === 'ENVIADA' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                        oc.status === 'CANCELADA' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                        'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {oc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* 1. Ver */}
                        <button
                          type="button"
                          onClick={() => handleOpenViewOrder(oc)}
                          title="Ver Detalle de Orden"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-slate-600" />
                        </button>

                        {/* 2. Imprimir */}
                        <button
                          type="button"
                          onClick={() => handlePrintOrder(oc)}
                          title="Imprimir Orden de Compra"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4 text-slate-600" />
                        </button>

                        {/* 3. Editar */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditOrder(oc)}
                          title="Editar Orden de Compra"
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs transition cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4 text-amber-600" />
                        </button>

                        {/* 4. Convertir a Compra */}
                        <button
                          type="button"
                          onClick={() => handleConvertOrderToPurchase(oc)}
                          title="Convertir a Factura de Compra"
                          className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg text-[11px] transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Convertir a Compra</span>
                        </button>

                        {/* 5. Eliminar */}
                        <button
                          type="button"
                          onClick={() => handleDeletePurchaseOrder(oc)}
                          title="Eliminar Orden"
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 4: PRE-ORDENES (REQUISICIÓN BAJO STOCK & HISTORIAL)
         --------------------------------------------------------------------- */}
      {subTab === 'PRE_ORDENES' && (
        <div className="space-y-6">
          {/* Top KPI Stats */}
          {(() => {
            const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
            const warningStockCount = products.filter((p) => p.stock > p.minStock && p.stock <= p.minStock + 5).length;
            const pendingPreOrders = preOrders.filter((p) => p.status === 'PENDIENTE').length;
            const totalEstimatedCost = products
              .filter((p) => p.stock <= p.minStock + 5)
              .reduce((acc, p) => acc + Math.max(10, p.minStock * 2 - p.stock) * p.costPrice, 0);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Stock Crítico (Agotados)</span>
                    <h3 className="text-2xl font-black text-rose-600 mt-1">{lowStockCount}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Requieren pedido urgente</p>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Por Agotarse (Nivel Bajo)</span>
                    <h3 className="text-2xl font-black text-amber-600 mt-1">{warningStockCount}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Próximos a stock mínimo</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Pre-Órdenes Pendientes</span>
                    <h3 className="text-2xl font-black text-purple-600 mt-1">{pendingPreOrders}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">{preOrders.length} registradas en total</p>
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-200 text-purple-600 rounded-2xl">
                    <FileCheck2 className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Costo Estimado Sugerido</span>
                    <h3 className="text-2xl font-black text-emerald-600 font-mono mt-1">
                      {formatCurrency(totalEstimatedCost, settings.currencySymbol)}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Para recuperar stock ideal</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Main Card */}
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-amber-500" />
                  <span>Gestión de Pre-Órdenes & Requisiciones</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Planifique y cotice compras de reposición antes de emitir órdenes de compra definitivas a proveedores.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenCreateManualPreOrder}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ NUEVA PRE-ORDEN MANUAL</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenCreatePreOrderFromLowStock()}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs rounded-xl shadow-md shadow-orange-500/20 transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>GENERAR DESDE BAJO STOCK</span>
                </button>
              </div>
            </div>

            {/* Sub-view Switcher (Sugeridos vs Historial) */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setPreOrdersActiveView('SUGERIDOS')}
                className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  preOrdersActiveView === 'SUGERIDOS'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <Boxes className="w-4 h-4" />
                <span>Sugeridos por Bajo Stock ({products.filter((p) => p.stock <= p.minStock + 5).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setPreOrdersActiveView('HISTORIAL')}
                className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  preOrdersActiveView === 'HISTORIAL'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Pre-Órdenes Guardadas ({preOrders.length})</span>
              </button>
            </div>

            {/* VISTA 1: SUGERIDOS POR BAJO STOCK */}
            {preOrdersActiveView === 'SUGERIDOS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Artículos con existencia menor o igual al umbral mínimo de seguridad.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const criticalOnly = products.filter((p) => p.stock <= p.minStock);
                      handleOpenCreatePreOrderFromLowStock(criticalOnly);
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Pedir Solo Stock Crítico ({products.filter((p) => p.stock <= p.minStock).length})</span>
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
                        <th className="py-3 px-4 text-center">Nivel Alerta</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium">
                      {products.filter((p) => p.stock <= p.minStock + 5).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-70" />
                            <p className="font-bold text-slate-700 text-sm">¡Inventario en Niveles Óptimos!</p>
                            <p className="text-xs text-slate-400 mt-1">No hay productos que requieran reposición urgente.</p>
                          </td>
                        </tr>
                      ) : (
                        products
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
                                <td className="py-3 px-4 text-center font-mono font-black text-rose-600 text-sm">
                                  {p.stock} u.
                                </td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                                  {p.minStock} u.
                                </td>
                                <td className="py-3 px-4 text-center font-mono font-black text-emerald-600 text-sm">
                                  +{suggestQty} u.
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                  {formatCurrency(suggestQty * p.costPrice, settings.currencySymbol)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                      isCritical
                                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                                        : 'bg-amber-50 border-amber-200 text-amber-700'
                                    }`}
                                  >
                                    {isCritical ? 'STOCK CRÍTICO' : 'POR AGOTARSE'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCreatePreOrderForSingleProduct(p)}
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                                  >
                                    + Crear Pre-Orden
                                  </button>
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

            {/* VISTA 2: HISTORIAL DE PRE-ORDENES */}
            {preOrdersActiveView === 'HISTORIAL' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por N° o proveedor..."
                      value={preOrderSearchFilter}
                      onChange={(e) => setPreOrderSearchFilter(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <span className="text-xs text-slate-500">
                    Mostrando {preOrders.length} pre-órdenes registradas
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">N° Pre-Orden / Fecha</th>
                        <th className="py-3 px-4">Proveedor Asignado</th>
                        <th className="py-3 px-4 text-center">Prioridad</th>
                        <th className="py-3 px-4 text-center">Artículos</th>
                        <th className="py-3 px-4 text-right">Costo Estimado</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium">
                      {preOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-400" />
                            <p className="font-bold text-slate-700 text-sm">No hay pre-órdenes registradas</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Haga clic en "+ NUEVA PRE-ORDEN MANUAL" o "GENERAR DESDE BAJO STOCK" para crear una.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        preOrders
                          .filter((po) => {
                            if (!preOrderSearchFilter) return true;
                            const query = preOrderSearchFilter.toLowerCase();
                            return (
                              po.preOrderNumber.toLowerCase().includes(query) ||
                              (po.supplierName && po.supplierName.toLowerCase().includes(query)) ||
                              (po.notes && po.notes.toLowerCase().includes(query))
                            );
                          })
                          .map((po) => {
                            const isConverted = po.status === 'CONVERTIDA_A_ORDEN';
                            return (
                              <tr key={po.id} className="hover:bg-slate-50 transition">
                                <td className="py-3 px-4">
                                  <span className="font-mono font-black text-orange-600 text-xs block">
                                    {po.preOrderNumber}
                                  </span>
                                  <span className="text-[11px] text-slate-400">{po.createdAt}</span>
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-800">
                                  {po.supplierName || 'Proveedor General'}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                      po.priority === 'ALTA'
                                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                                        : po.priority === 'MEDIA'
                                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                                        : 'bg-blue-50 border-blue-200 text-blue-700'
                                    }`}
                                  >
                                    {po.priority || 'MEDIA'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                                  {po.items.length} prod. ({po.totalItemsCount || po.items.reduce((a, b) => a + b.quantity, 0)} u.)
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                                  {formatCurrency(po.totalEstimatedCost, settings.currencySymbol)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                      isConverted
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        : 'bg-purple-50 border-purple-200 text-purple-700'
                                    }`}
                                  >
                                    {isConverted ? 'CONVERTIDA A OC' : po.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPreOrderView(po)}
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                      title="Ver Detalle de Pre-Orden"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>

                                    {!isConverted && (
                                      <button
                                        type="button"
                                        onClick={() => handleConvertExistingPreOrderToOC(po)}
                                        className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-[11px] font-black transition shadow-sm cursor-pointer"
                                        title="Convertir a Orden de Compra formal"
                                      >
                                        Convertir a OC
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleDeletePreOrder(po.id)}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                      title="Eliminar Pre-Orden"
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
            )}
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
                <label className="block font-black text-slate-800 mb-1">RUC / Cédula Proveedor (SRI) *</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="ej: 1792048591001"
                    value={newSupplier.taxId}
                    onChange={(e) => setNewSupplier({ ...newSupplier, taxId: e.target.value.trim() })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchQuickSupplierDoc();
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => handleSearchQuickSupplierDoc()}
                    disabled={isSearchingCedula || !newSupplier.taxId}
                    className="p-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                    title="Consultar en SRI / Registro Civil"
                  >
                    {isSearchingCedula ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {newSupplier.taxId && (() => {
                  const res = validateEcuadorianDocument('AUTO', newSupplier.taxId);
                  return (
                    <div className={`mt-1.5 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${
                      res.isValid 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {res.isValid ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{res.type} Válido</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{res.message}</span>
                        </>
                      )}
                    </div>
                  );
                })()}
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

      {/* =====================================================================
          MODAL 1: CREAR / CONFIGURAR PRE-ORDEN (REQUISICIÓN)
          ===================================================================== */}
      {isPreOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl p-6 sm:p-8 shadow-2xl my-auto space-y-6 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl border border-amber-500/20">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>Nueva Pre-Orden & Requisición de Compras</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                      BORRADOR / COTIZACIÓN
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Ajuste cantidades sugeridas, costos estimados y asigne proveedor antes de formalizar el pedido.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreOrderModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* General Information Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Proveedor Sugerido / Asignado</span>
                </label>
                <Select
                  value={preOrderSupplierId}
                  onChange={(e) => setPreOrderSupplierId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="">-- Proveedor General / Por Definir --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.taxId || 'Sin RUC'})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nivel de Prioridad</span>
                </label>
                <Select
                  value={preOrderPriority}
                  onChange={(e) => setPreOrderPriority(e.target.value as any)}
                  className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold ${
                    preOrderPriority === 'ALTA'
                      ? 'text-rose-600'
                      : preOrderPriority === 'MEDIA'
                      ? 'text-amber-600'
                      : 'text-blue-600'
                  }`}
                >
                  <option value="ALTA">🔴 Alta (Urgente / Agotado)</option>
                  <option value="MEDIA">🟡 Media (Stock Mínimo)</option>
                  <option value="BAJA">🔵 Baja (Reposición Regular)</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Fecha Esperada de Llegada</span>
                </label>
                <CustomDatePicker
                  value={preOrderExpectedDate}
                  onChange={setPreOrderExpectedDate}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">Notas / Justificación del Pedido</label>
                <input
                  type="text"
                  placeholder="Ej: Reposición de materiales por alta demanda en proyectos de construcción..."
                  value={preOrderNotes}
                  onChange={(e) => setPreOrderNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Agregar más productos al modal */}
            <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-orange-400" />
                  <span>Agregar Producto Adicional al Pedido</span>
                </h4>
                <span className="text-[10px] text-slate-400">Total en catálogo: {products.length} productos</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-8">
                  <Select
                    value={preOrderAddProductId}
                    onChange={(e) => setPreOrderAddProductId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-medium"
                  >
                    <option value="">-- Seleccionar producto del catálogo --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name} (Stock: {p.stock} u. | Costo: ${p.costPrice.toFixed(2)})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Cant."
                    value={preOrderAddQty}
                    onChange={(e) => setPreOrderAddQty(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-center font-mono font-bold rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddProductToPreOrderForm}
                    disabled={!preOrderAddProductId}
                    className="w-full h-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla de Productos de la Pre-Orden */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Lista de Artículos a Solicitar ({preOrderItems.length} productos)</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Puede editar las cantidades y costos estimados directamente en la tabla
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 font-black uppercase text-[10px] text-slate-600 tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Producto / SKU</th>
                      <th className="py-2.5 px-3 text-center">Stock Actual</th>
                      <th className="py-2.5 px-3 text-center w-28">Cant. Pedir</th>
                      <th className="py-2.5 px-3 text-right w-28">Costo Estimado</th>
                      <th className="py-2.5 px-3 text-center">IVA</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {preOrderItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No hay artículos en esta pre-orden. Agregue productos arriba para comenzar.
                        </td>
                      </tr>
                    ) : (
                      preOrderItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2 px-3">
                            <span className="font-mono text-orange-600 text-[10px] block">{item.sku}</span>
                            <span className="font-bold text-slate-900">{item.productName}</span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                            {item.currentStock} u. <span className="text-[10px] text-slate-400">(mín {item.minStock})</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleUpdatePreOrderItemQty(idx, item.quantity - 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-black text-slate-700 text-xs transition cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdatePreOrderItemQty(idx, parseFloat(e.target.value) || 1)}
                                className="w-14 text-center font-mono font-black text-slate-900 text-xs border border-slate-200 rounded py-0.5 bg-slate-50"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdatePreOrderItemQty(idx, item.quantity + 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-black text-slate-700 text-xs transition cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <span className="text-slate-400 font-mono">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.costPrice}
                                onChange={(e) => handleUpdatePreOrderItemCost(idx, parseFloat(e.target.value) || 0)}
                                className="w-16 text-right font-mono font-bold text-emerald-700 text-xs border border-slate-200 rounded py-0.5 bg-slate-50 px-1"
                              />
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-500">
                            {item.taxPercent}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                            {formatCurrency(item.total, settings.currencySymbol)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePreOrderItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Quitar de la pre-orden"
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
            </div>

            {/* Financial Summary & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 bg-slate-50/70 p-4 rounded-2xl">
              <div className="flex items-center space-x-6 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Artículos / Unidades</span>
                  <span className="font-black text-slate-800 text-sm">
                    {preOrderItems.length} prod. / {preOrderItems.reduce((a, b) => a + b.quantity, 0)} u.
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Subtotal Base</span>
                  <span className="font-bold text-slate-700 text-sm">
                    {formatCurrency(
                      preOrderItems.reduce((a, b) => a + b.subtotal, 0),
                      settings.currencySymbol
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Estimado (con IVA)</span>
                  <span className="font-black text-emerald-600 text-base font-mono">
                    {formatCurrency(
                      preOrderItems.reduce((a, b) => a + b.total, 0),
                      settings.currencySymbol
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsPreOrderModalOpen(false)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => handleSavePreOrder(false)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>Guardar Pre-Orden</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSavePreOrder(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition shadow-lg shadow-purple-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Crear y Emitir Orden de Compra (OC)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: DETALLE / VISUALIZACIÓN DE PRE-ORDEN
          ===================================================================== */}
      {selectedPreOrderView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-6 sm:p-8 shadow-2xl my-auto space-y-6 animate-scaleUp">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-purple-500/10 text-purple-600 rounded-2xl border border-purple-500/20">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>Pre-Orden #{selectedPreOrderView.preOrderNumber}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        selectedPreOrderView.status === 'CONVERTIDA_A_ORDEN'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-purple-50 border-purple-200 text-purple-700'
                      }`}
                    >
                      {selectedPreOrderView.status === 'CONVERTIDA_A_ORDEN'
                        ? 'CONVERTIDA A ORDEN DE COMPRA'
                        : selectedPreOrderView.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Registrada el {selectedPreOrderView.createdAt} • Prioridad {selectedPreOrderView.priority || 'MEDIA'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPreOrderView(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Proveedor Asignado</span>
                <span className="font-bold text-slate-800 text-sm">
                  {selectedPreOrderView.supplierName || 'Proveedor General'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha Requerida</span>
                <span className="font-bold text-slate-800 text-sm">
                  {selectedPreOrderView.expectedDate || 'Inmediata'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Monto Total Estimado</span>
                <span className="font-black text-emerald-600 text-base font-mono">
                  {formatCurrency(selectedPreOrderView.totalEstimatedCost, settings.currencySymbol)}
                </span>
              </div>
              {selectedPreOrderView.notes && (
                <div className="sm:col-span-3 pt-2 border-t border-slate-200/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Notas</span>
                  <p className="text-slate-700 text-xs mt-0.5">{selectedPreOrderView.notes}</p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Producto / SKU</th>
                    <th className="py-2.5 px-3 text-center">Cant. Solicitada</th>
                    <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                    <th className="py-2.5 px-3 text-center">IVA</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                  {selectedPreOrderView.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-orange-600 text-[10px] block">{item.sku}</span>
                        <span className="font-bold text-slate-900">{item.productName}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-slate-800">
                        {item.quantity} u.
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600">
                        {formatCurrency(item.costPrice, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">
                        {item.taxPercent}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(item.subtotal, settings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                        {formatCurrency(item.total, settings.currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Imprimir / Exportar Requisición</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedPreOrderView(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cerrar
                </button>

                {selectedPreOrderView.status !== 'CONVERTIDA_A_ORDEN' && (
                  <button
                    type="button"
                    onClick={() => handleConvertExistingPreOrderToOC(selectedPreOrderView)}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition shadow-lg shadow-purple-600/20 flex items-center gap-2 cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Convertir a Orden de Compra (OC)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL: VIEW & PRINT PURCHASE ORDER (ORDEN DE COMPRA)
         --------------------------------------------------------------------- */}
      {selectedOrderView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl p-6 sm:p-8 space-y-6 shadow-2xl my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-purple-50 border border-purple-200 text-purple-600 rounded-2xl">
                  <ListOrdered className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                    <span>Orden de Compra #{selectedOrderView.orderNumber}</span>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                        selectedOrderView.status === 'RECIBIDA'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : selectedOrderView.status === 'APROBADA'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : selectedOrderView.status === 'ENVIADA'
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : selectedOrderView.status === 'CANCELADA'
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}
                    >
                      {selectedOrderView.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Emitida el {selectedOrderView.createdAt} • Entrega esperada: {selectedOrderView.expectedDelivery || 'Inmediata'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditOrder(selectedOrderView)}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderView(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Body */}
            <div id="printable-order-voucher" className="space-y-6 text-xs text-slate-800">
              {/* Header Info: Store & Supplier Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Store Header */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider block">Datos del Comprador (Empresa)</span>
                  <h4 className="text-sm font-black text-slate-900">{settings.storeName || 'FERRETERÍA INDUSTRIAL'}</h4>
                  <p className="text-slate-600">RUC: <strong className="text-slate-900 font-mono">{settings.taxId || '1790012345001'}</strong></p>
                  <p className="text-slate-600">Dirección: {settings.address || 'Matriz Principal'}</p>
                  <p className="text-slate-600">Tel: {settings.phone || '0990000000'} • Email: {settings.email || 'compras@ferreteria.com'}</p>
                </div>

                {/* Supplier Header */}
                <div className="p-4 bg-purple-50/50 border border-purple-200/80 rounded-2xl space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider block">Datos del Proveedor (Emisor)</span>
                  <h4 className="text-sm font-black text-slate-900">{selectedOrderView.supplier.name}</h4>
                  <p className="text-slate-600">RUC / CI: <strong className="text-slate-900 font-mono">{selectedOrderView.supplier.taxId}</strong></p>
                  {selectedOrderView.supplier.contactPerson && (
                    <p className="text-slate-600">Contacto: {selectedOrderView.supplier.contactPerson}</p>
                  )}
                  <p className="text-slate-600">Teléfono: {selectedOrderView.supplier.phone || 'S/N'} • Email: {selectedOrderView.supplier.email || 'S/N'}</p>
                  <p className="text-slate-600">Dirección: {selectedOrderView.supplier.address || 'S/N'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-950 text-white font-black uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Descripción de Producto</th>
                      <th className="py-2.5 px-3 text-center">Cant.</th>
                      <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                      <th className="py-2.5 px-3 text-center">IVA</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {selectedOrderView.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-purple-600 font-bold">{item.sku}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{item.productName}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600">{formatCurrency(item.costPrice, settings.currencySymbol)}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">{item.taxPercent}%</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatCurrency(item.subtotal, settings.currencySymbol)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">{formatCurrency(item.total, settings.currencySymbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Observaciones / Condiciones</span>
                  <p className="text-xs text-slate-700">{selectedOrderView.notes || 'Sin observaciones registradas.'}</p>
                  <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                    Condición de Pago: <strong>{selectedOrderView.supplier.paymentDays ? `${selectedOrderView.supplier.paymentDays} días de crédito` : 'Contado'}</strong>
                  </p>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal Neto:</span>
                    <span>{formatCurrency(selectedOrderView.items.reduce((acc, i) => acc + i.subtotal, 0), settings.currencySymbol)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>IVA Estimado:</span>
                    <span>{formatCurrency(selectedOrderView.items.reduce((acc, i) => acc + (i.total - i.subtotal), 0), settings.currencySymbol)}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-emerald-400 pt-2 border-t border-slate-800">
                    <span>Total Estimado:</span>
                    <span>{formatCurrency(selectedOrderView.totalAmount, settings.currencySymbol)}</span>
                  </div>
                </div>
              </div>

              {/* Signature Blocks for Printing */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Firma Autorizada</p>
                  <p className="text-slate-500 text-[11px]">Departamento de Compras / Gerencia</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Recibido Conforme</p>
                  <p className="text-slate-500 text-[11px]">Proveedor / Representante Comercial</p>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4 text-purple-300" />
                <span>Imprimir / Guardar PDF</span>
              </button>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedOrderView(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cerrar
                </button>

                {selectedOrderView.status !== 'RECIBIDA' && (
                  <button
                    type="button"
                    onClick={() => handleConvertOrderToPurchase(selectedOrderView)}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition shadow-lg shadow-purple-600/20 flex items-center gap-2 cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Convertir a Factura de Compra</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODAL: EDIT PURCHASE ORDER (ORDEN DE COMPRA)
         --------------------------------------------------------------------- */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-6 sm:p-8 space-y-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl">
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">
                    Editar Orden de Compra #{editingOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modifique proveedores, fechas de entrega, ítems y estado de la orden
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-black text-slate-800 mb-1">Proveedor *</label>
                  <Select
                    value={editOrderSupplierId}
                    onChange={(e: any) => setEditOrderSupplierId(e.target.value)}
                    className="w-full bg-slate-50 border-slate-200 font-bold"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.taxId})</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block font-black text-slate-800 mb-1">Fecha Entrega Esperada</label>
                  <CustomDatePicker
                    value={editOrderExpectedDate}
                    onChange={setEditOrderExpectedDate}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-800 mb-1">Estado de la Orden *</label>
                  <Select
                    value={editOrderStatus}
                    onChange={(e: any) => setEditOrderStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border-slate-200 font-bold"
                  >
                    <option value="BORRADOR">BORRADOR</option>
                    <option value="ENVIADA">ENVIADA</option>
                    <option value="APROBADA">APROBADA</option>
                    <option value="RECIBIDA">RECIBIDA</option>
                    <option value="CANCELADA">CANCELADA</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-800 mb-1">Notas / Observaciones</label>
                <input
                  type="text"
                  placeholder="Ej: Entregar en bodega norte en horario matutino..."
                  value={editOrderNotes}
                  onChange={(e) => setEditOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Add items to order */}
              <div className="p-4 bg-purple-50/50 border border-purple-200/80 rounded-2xl space-y-3">
                <h4 className="font-black text-purple-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-purple-600" />
                  <span>Agregar / Modificar Artículos a la Orden</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <Select
                      value={editOrderProductId}
                      onChange={(e: any) => setEditOrderProductId(e.target.value)}
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
                      value={editOrderQty}
                      onChange={(e) => setEditOrderQty(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleAddEditOrderItem}
                      className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Table with inline quantity/cost edits */}
              {editOrderItems.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-white font-bold text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-center w-24">Cant.</th>
                        <th className="py-2.5 px-3 text-right w-28">Costo Unit.</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3 text-center w-12">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium">
                      {editOrderItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <span className="font-mono text-purple-600 text-[10px] block">{item.sku}</span>
                            <span className="font-bold text-slate-800">{item.productName}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = parseFloat(e.target.value) || 1;
                                const sub = item.costPrice * newQty;
                                const tax = sub * (item.taxPercent / 100);
                                setEditOrderItems(items => items.map((it, i) => i === idx ? {
                                  ...it,
                                  quantity: newQty,
                                  subtotal: sub,
                                  total: sub + tax
                                } : it));
                              }}
                              className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={item.costPrice}
                              onChange={(e) => {
                                const newCost = parseFloat(e.target.value) || 0;
                                const sub = newCost * item.quantity;
                                const tax = sub * (item.taxPercent / 100);
                                setEditOrderItems(items => items.map((it, i) => i === idx ? {
                                  ...it,
                                  costPrice: newCost,
                                  subtotal: sub,
                                  total: sub + tax
                                } : it));
                              }}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono text-emerald-600 font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.total, settings.currencySymbol)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setEditOrderItems(editOrderItems.filter((_, i) => i !== idx))}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
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

              {/* Total Summary */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono">
                <span className="font-bold text-slate-700 text-xs">Total Estimado de la Orden:</span>
                <span className="text-base font-black text-emerald-600">
                  {formatCurrency(editOrderItems.reduce((acc, item) => acc + item.total, 0), settings.currencySymbol)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editOrderItems.length === 0}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  Guardar Cambios de la Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
