import React, { useState, useMemo, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  FileText, 
  RotateCcw, 
  Send, 
  User, 
  Search, 
  Plus, 
  Trash2, 
  CreditCard, 
  Calculator, 
  Package, 
  Info, 
  Check, 
  X, 
  LayoutGrid, 
  ChevronDown, 
  Sparkles, 
  DollarSign, 
  Sliders, 
  Receipt,
  UserCheck,
  Tag,
  AlertCircle,
  ArrowLeftRight,
  Lock,
  Unlock,
  PackageCheck
} from 'lucide-react';
import { 
  CartItem, 
  Customer, 
  DocumentType, 
  Invoice, 
  PaymentMethod, 
  PaymentMethodItem,
  Product, 
  ProductCategory, 
  Promotion, 
  StoreSettings 
} from '../../types';
import { formatCurrency, generateDocumentNumber } from '../../utils/formatters';
import { useModal } from '../../context/ModalContext';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { defaultEmployees, defaultUsersList, defaultPaymentMethods } from '../../data/initialData';
import { Order } from '../Sales/CreateOrderModal';
import { calculateSriTotals } from '../../utils/sriCalculations';
import { CustomerSelectModal } from './CustomerSelectModal';
import { PaymentModal } from './PaymentModal';
import { SriEmissionProgressModal } from './SriEmissionProgressModal';
import { ProductSearch } from './ProductSearch';

interface BillingTerminalProps {
  products: Product[];
  customers: Customer[];
  settings: StoreSettings;
  categories?: ProductCategory[];
  promotions?: Promotion[];
  onInvoiceCreated: (invoice: Invoice, updatedProducts: Product[], updatedSettings: StoreSettings) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onCreateCustomer: (customer: Customer) => void;
  onOpenInvoiceViewer: (invoice: Invoice) => void;
  establishment: string;
  emissionPoint: string;
  secInvoice: string;
  setSecInvoice: (val: string) => void;
  secBoleta?: string;
  setSecBoleta?: (val: string) => void;
  secQuote?: string;
  setSecQuote?: (val: string) => void;
  initialDocumentType?: DocumentType;
  initialCartItems?: CartItem[];
  initialCustomer?: Customer | null;
  invoicingOrder?: Order | null;
  onCancelInvoicingOrder?: () => void;
  paymentMethods?: PaymentMethodItem[];
  isCashRegisterOpen?: boolean;
  onOpenCashRegister?: (initialCash: number) => void;
}

export const BillingTerminal: React.FC<BillingTerminalProps> = ({
  products,
  customers,
  settings,
  categories,
  promotions = [],
  onInvoiceCreated,
  onUpdateInvoice,
  onCreateCustomer,
  onOpenInvoiceViewer,
  establishment,
  emissionPoint,
  secInvoice,
  setSecInvoice,
  secBoleta = '000001',
  setSecBoleta,
  secQuote = '000001',
  setSecQuote,
  initialDocumentType = 'FACTURA',
  initialCartItems = [],
  initialCustomer = null,
  invoicingOrder = null,
  onCancelInvoicingOrder,
  paymentMethods,
  isCashRegisterOpen = true,
  onOpenCashRegister,
}) => {
  const { showToast, showAlert } = useModal();
  const [employees] = useFirestoreSync<any[]>('ferreteria_hr_employees', defaultEmployees);
  const [usersList] = useFirestoreSync<any[]>('ferreteria_settings_users_list', defaultUsersList);
  const [syncedPaymentMethods] = useFirestoreSync<any[]>('ferreteria_settings_payment_methods', defaultPaymentMethods);

  // Dynamic payment methods list connected in real-time to Settings
  const activePaymentMethodsList = useMemo(() => {
    const rawList = (paymentMethods && paymentMethods.length > 0) 
      ? paymentMethods 
      : (syncedPaymentMethods && syncedPaymentMethods.length > 0) 
      ? syncedPaymentMethods 
      : defaultPaymentMethods;

    const activeList = rawList.filter((pm: any) => pm.active !== false);

    if (activeList.length === 0) {
      return [{ key: 'EFECTIVO' as PaymentMethod, label: 'Efectivo', isDefault: true, code: '01' }];
    }

    return activeList.map((pm: any) => {
      let key: PaymentMethod = (pm.methodKey || pm.id) as PaymentMethod;
      let label = pm.shortName || pm.name;

      if (pm.code === '01' || pm.name?.toUpperCase().includes('EFECTIVO') || key === 'EFECTIVO') {
        key = 'EFECTIVO';
        label = pm.shortName || 'Efectivo';
      } else if (pm.code === '16' || pm.name?.toUpperCase().includes('DEBITO') || key === 'TARJETA_DEBITO') {
        key = 'TARJETA_DEBITO';
        label = pm.shortName || 'Tarjeta Débito';
      } else if (pm.code === '19' || (pm.name?.toUpperCase().includes('CREDITO') && !pm.name?.toUpperCase().includes('CLIENTE')) || key === 'TARJETA_CREDITO') {
        key = 'TARJETA_CREDITO';
        label = pm.shortName || 'Tarjeta Crédito';
      } else if (pm.code === '20' || pm.name?.toUpperCase().includes('TRANSFERENCIA') || key === 'TRANSFERENCIA') {
        key = 'TRANSFERENCIA';
        label = pm.shortName || 'Transferencia';
      } else if (pm.code === '15' || pm.name?.toUpperCase().includes('COMPENSACION') || key === 'COMPENSACION') {
        key = 'COMPENSACION';
        label = pm.shortName || 'Compensación';
      } else if (pm.code === '21' || pm.name?.toUpperCase().includes('ENDOSO') || key === 'ENDOSO') {
        key = 'ENDOSO';
        label = pm.shortName || 'Endoso';
      } else if (pm.code === 'CRED' || pm.name?.toUpperCase().includes('CLIENTE') || key === 'CREDITO_CLIENTE') {
        key = 'CREDITO_CLIENTE';
        label = pm.shortName || 'Crédito';
      }

      return {
        key,
        label,
        isDefault: !!pm.default,
        code: pm.code || '01',
      };
    });
  }, [paymentMethods, syncedPaymentMethods]);

  // Sellers
  const sellerOptions = useMemo(() => {
    const names = new Set<string>();
    (employees || []).forEach((e: any) => {
      if (e.name) names.add(e.name);
    });
    (usersList || []).forEach((u: any) => {
      if (u.name) names.add(u.name);
    });
    if (names.size === 0) names.add('Juan Pérez');
    return Array.from(names);
  }, [employees, usersList]);

  const [sellerName, setSellerName] = useState<string>(() => sellerOptions[0] || 'Juan Pérez');
  const [cartItems, setCartItems] = useState<CartItem[]>(initialCartItems || []);
  const [documentType, setDocumentType] = useState<DocumentType>(initialDocumentType);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(initialCustomer || customers[0] || {
    id: 'cf-default',
    name: 'CONSUMIDOR FINAL',
    docType: 'C.I.',
    docNumber: '9999999999999',
    email: 'consumidorfinal@sri.gob.ec',
    phone: '9999999999',
    address: 'ECUADOR',
    creditLimit: 0,
    currentBalance: 0,
  });

  // Searches
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Payment Selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(() => {
    const defaultPm = defaultPaymentMethods.find((pm: any) => pm.default);
    return (defaultPm?.methodKey as PaymentMethod) || 'EFECTIVO';
  });
  const [cashAmountTendered, setCashAmountTendered] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [propinaEnabled, setPropinaEnabled] = useState<boolean>(false);

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isQuickCustomItemOpen, setIsQuickCustomItemOpen] = useState(false);
  const [createdInvoiceForSri, setCreatedInvoiceForSri] = useState<Invoice | null>(null);
  const [isSriEmissionModalOpen, setIsSriEmissionModalOpen] = useState(false);
  const [isOpenCashModalOpen, setIsOpenCashModalOpen] = useState(false);
  const [openCashAmount, setOpenCashAmount] = useState('0.00');
  const pendingEmissionActionRef = useRef<boolean>(false);

  // Quick custom item form
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('10.00');
  const [customQty, setCustomQty] = useState('1');
  const [customTaxRate, setCustomTaxRate] = useState<number>(settings.defaultTaxRate || 15);

  const [isDocTypeDropdownOpen, setIsDocTypeDropdownOpen] = useState(false);
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState(false);
  const [openTaxDropdownId, setOpenTaxDropdownId] = useState<string | null>(null);

  const customerSearchRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const docTypeDropdownRef = useRef<HTMLDivElement>(null);
  const sellerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sellerOptions.length > 0 && !sellerOptions.includes(sellerName)) {
      setSellerName(sellerOptions[0]);
    }
  }, [sellerOptions]);

  useEffect(() => {
    if (initialDocumentType) setDocumentType(initialDocumentType);
  }, [initialDocumentType]);

  useEffect(() => {
    if (initialCartItems && initialCartItems.length > 0) setCartItems(initialCartItems);
  }, [initialCartItems]);

  useEffect(() => {
    if (initialCustomer) setSelectedCustomer(initialCustomer);
  }, [initialCustomer]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setIsProductDropdownOpen(false);
      }
      if (docTypeDropdownRef.current && !docTypeDropdownRef.current.contains(e.target as Node)) {
        setIsDocTypeDropdownOpen(false);
      }
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(e.target as Node)) {
        setIsSellerDropdownOpen(false);
      }
      if (!(e.target as HTMLElement).closest('[data-tax-dropdown]')) {
        setOpenTaxDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Formatted Sequential Number (001-001-000000001)
  const formattedSequentialNumber = useMemo(() => {
    return generateDocumentNumber(
      documentType,
      settings,
      establishment,
      emissionPoint,
      secInvoice,
      secBoleta,
      secQuote
    ).fullNumber;
  }, [establishment, emissionPoint, secInvoice, secBoleta, secQuote, documentType, settings]);

  // Totals calculations
  const sriBreakdown = useMemo(() => {
    return calculateSriTotals(cartItems, settings.defaultTaxRate || 15, propinaEnabled);
  }, [cartItems, settings.defaultTaxRate, propinaEnabled]);

  const totalItemCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  // Promotion calculation helper
  const getActivePromoForProduct = (product: Product, qty: number): Promotion | null => {
    const today = new Date().toISOString().split('T')[0];
    const active = promotions.filter(p => {
      if (p.status !== 'ACTIVA') return false;
      if (p.startDate && p.startDate > today) return false;
      if (p.endDate && p.endDate < today) return false;
      if (qty < (p.minQuantity || 1)) return false;

      // Match product ID if specified
      if (p.productId) {
        return p.productId === product.id;
      }

      // Match category if specified (and not 'TODOS')
      if (p.appliedCategory && p.appliedCategory !== 'TODOS') {
        return p.appliedCategory.trim().toLowerCase() === product.category.trim().toLowerCase();
      }

      return true; // Applies to all products
    });

    if (active.length === 0) return null;
    return active.reduce((best, p) => p.discountPercent > best.discountPercent ? p : best);
  };

  // Helper for Price Scales
  const getPriceForQuantity = (product: Product, qty: number) => {
    if (!product.priceScales || product.priceScales.length === 0) return product.price;
    const sortedScales = [...product.priceScales].sort((a, b) => b.minQty - a.minQty);
    for (const scale of sortedScales) {
      if (qty >= scale.minQty && (!scale.maxQty || qty <= scale.maxQty)) {
        return scale.price;
      }
    }
    return product.price;
  };

  // Cart operations
  const handleAddToCart = (product: Product, qty: number = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      let newQty = qty;
      if (existing) {
        newQty = existing.quantity + qty;
      }

      const taxRate = (typeof product.taxRate === 'number' ? product.taxRate : settings.defaultTaxRate) / 100;
      const baseUnitPrice = getPriceForQuantity(product, newQty);

      const promo = getActivePromoForProduct(product, newQty);
      const manualDiscount = existing ? existing.discountPercent : 0;
      const discountPct = promo ? Math.max(promo.discountPercent, manualDiscount) : manualDiscount;
      const appliedPromo = promo ? `${promo.code} · ${promo.discountPercent}% OFF` : (existing?.appliedPromo ?? undefined);

      const itemSubtotal = newQty * baseUnitPrice;
      const itemDiscountAmount = itemSubtotal * (discountPct / 100);
      const baseAfterDiscount = itemSubtotal - itemDiscountAmount;
      const itemTaxAmount = baseAfterDiscount * taxRate;
      const itemTotal = baseAfterDiscount + itemTaxAmount;

      const updatedItem: CartItem = {
        product,
        quantity: newQty,
        unitPrice: baseUnitPrice,
        discountPercent: discountPct,
        subtotal: itemSubtotal,
        taxAmount: itemTaxAmount,
        total: itemTotal,
        appliedPromo,
      };

      if (existing) {
        return prev.map((item) => (item.product.id === product.id ? updatedItem : item));
      } else {
        if (promo) {
          setTimeout(() => showToast(`🏷️ Promo aplicada: ${promo.name} (${promo.discountPercent}% OFF)`, 'success'), 0);
        }
        return [...prev, updatedItem];
      }
    });
  };

  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (isNaN(newQty) || newQty < 0) return;

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const taxRate = (typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate) / 100;
        const baseUnitPrice = getPriceForQuantity(item.product, newQty);

        const promo = getActivePromoForProduct(item.product, newQty);
        const discountPct = promo ? Math.max(promo.discountPercent, item.discountPercent) : item.discountPercent;
        const appliedPromo = promo ? `${promo.code} · ${promo.discountPercent}% OFF` : item.appliedPromo;

        const itemSubtotal = newQty * baseUnitPrice;
        const itemDiscountAmount = itemSubtotal * (discountPct / 100);
        const baseAfterDiscount = itemSubtotal - itemDiscountAmount;
        const itemTaxAmount = baseAfterDiscount * taxRate;
        const itemTotal = baseAfterDiscount + itemTaxAmount;

        return {
          ...item,
          quantity: newQty,
          unitPrice: baseUnitPrice,
          discountPercent: discountPct,
          subtotal: itemSubtotal,
          taxAmount: itemTaxAmount,
          total: itemTotal,
          appliedPromo,
        };
      })
    );
  };

  const handleUpdateUnitPrice = (productId: string, newUnitPrice: number) => {
    const safePrice = Math.max(0, Math.round(newUnitPrice * 100) / 100);
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const taxRate = (typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate) / 100;
        const itemSubtotal = Math.round(item.quantity * safePrice * 100) / 100;
        const itemDiscountAmount = Math.round((itemSubtotal * (item.discountPercent / 100)) * 100) / 100;
        const baseAfterDiscount = Math.round((itemSubtotal - itemDiscountAmount) * 100) / 100;
        const itemTaxAmount = Math.round((baseAfterDiscount * taxRate) * 100) / 100;
        const itemTotal = Math.round((baseAfterDiscount + itemTaxAmount) * 100) / 100;

        return {
          ...item,
          unitPrice: safePrice,
          subtotal: itemSubtotal,
          taxAmount: itemTaxAmount,
          total: itemTotal,
        };
      })
    );
  };

  const handleUpdateTaxRate = (productId: string, newTaxRate: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const taxRate = newTaxRate / 100;
        const itemSubtotal = item.quantity * item.unitPrice;
        const itemDiscountAmount = itemSubtotal * (item.discountPercent / 100);
        const baseAfterDiscount = itemSubtotal - itemDiscountAmount;
        const itemTaxAmount = baseAfterDiscount * taxRate;
        const itemTotal = baseAfterDiscount + itemTaxAmount;

        return {
          ...item,
          product: {
            ...item.product,
            taxRate: newTaxRate,
          },
          taxAmount: itemTaxAmount,
          total: itemTotal,
        };
      })
    );
  };

  const handleUpdateDiscount = (productId: string, discountPercent: number) => {
    const safeDiscount = Math.max(0, Math.min(100, discountPercent));
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const taxRate = (typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate) / 100;
        const itemSubtotal = item.quantity * item.unitPrice;
        const itemDiscountAmount = itemSubtotal * (safeDiscount / 100);
        const baseAfterDiscount = itemSubtotal - itemDiscountAmount;
        const itemTaxAmount = baseAfterDiscount * taxRate;
        const itemTotal = baseAfterDiscount + itemTaxAmount;

        return {
          ...item,
          discountPercent: safeDiscount,
          subtotal: itemSubtotal,
          taxAmount: itemTaxAmount,
          total: itemTotal,
        };
      })
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearAll = () => {
    const defaultCustomer: Customer = customers.find(
      (c) => c.docNumber === '9999999999999' || c.name.toUpperCase().includes('CONSUMIDOR FINAL')
    ) || customers[0] || {
      id: 'cf-default',
      name: 'CONSUMIDOR FINAL',
      docType: 'C.I.',
      docNumber: '9999999999999',
      email: 'consumidorfinal@sri.gob.ec',
      phone: '9999999999',
      address: 'ECUADOR',
      creditLimit: 0,
      currentBalance: 0,
    };

    setCartItems([]);
    setSelectedCustomer(defaultCustomer);
    setCustomerSearch('');
    setProductSearch('');
    setCashAmountTendered('');
    const defaultPm = activePaymentMethodsList.find((pm) => pm.isDefault);
    setSelectedPaymentMethod(defaultPm ? defaultPm.key : 'EFECTIVO');
    setPropinaEnabled(false);
    setDocumentType('FACTURA');
    setIsCustomerDropdownOpen(false);
    setIsProductDropdownOpen(false);
    setIsDocTypeDropdownOpen(false);
    setIsSellerDropdownOpen(false);
    setCustomName('');
    setCustomPrice('10.00');
    setCustomQty('1');
    setCustomTaxRate(settings.defaultTaxRate || 15);

    showToast('Terminal restablecido. Se han limpiado todos los datos.', 'success');
  };

  // Add custom manual line item
  const handleAddCustomItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const price = parseFloat(customPrice) || 0;
    const qty = parseFloat(customQty) || 1;
    const tax = customTaxRate;

    const customProduct: Product = {
      id: `custom-item-${Date.now()}`,
      sku: `MISC-${Date.now().toString().slice(-4)}`,
      name: customName.trim(),
      description: 'Ítem personalizado',
      category: 'Herramientas Manuales',
      price: price,
      costPrice: price * 0.7,
      stock: 999,
      minStock: 1,
      unit: 'UND',
      taxRate: tax,
      barcode: '',
      allowFractional: false,
      isCustom: true,
    };

    handleAddToCart(customProduct, qty);
    setCustomName('');
    setCustomPrice('10.00');
    setCustomQty('1');
    setIsQuickCustomItemOpen(false);
    showToast(`Ítem "${customName}" agregado a la orden.`, 'success');
  };

  // Fast customer filtering
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 8);
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.docNumber.includes(q) ||
        (c.phone && c.phone.includes(q))
    ).slice(0, 8);
  }, [customers, customerSearch]);

  // Fast product filtering
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [products, productSearch]);

  // Direct Invoicing / Transmitting
  const handleDirectEmission = () => {
    if (cartItems.length === 0) {
      showAlert('Agregue al menos un producto a la orden antes de emitir el comprobante.', 'Orden Vacía', 'warning');
      return;
    }

    if (!selectedCustomer) {
      showAlert('Seleccione un cliente para emitir el comprobante.', 'Cliente Requerido', 'warning');
      return;
    }

    // If cash register is closed and attempting a sale (Factura or Nota de Venta)
    if (!isCashRegisterOpen && documentType !== 'COTIZACION') {
      pendingEmissionActionRef.current = true;
      setIsOpenCashModalOpen(true);
      return;
    }

    executeInvoiceEmission();
  };

  const handleConfirmOpenCash = (e: React.FormEvent) => {
    e.preventDefault();
    const initialAmt = parseFloat(openCashAmount) || 0;
    if (onOpenCashRegister) {
      onOpenCashRegister(initialAmt);
    }
    setIsOpenCashModalOpen(false);

    if (pendingEmissionActionRef.current) {
      pendingEmissionActionRef.current = false;
      setTimeout(() => {
        executeInvoiceEmission();
      }, 80);
    }
  };

  const executeInvoiceEmission = () => {
    if (cartItems.length === 0 || !selectedCustomer) return;

    // Generate Document Number
    const docInfo = generateDocumentNumber(
      documentType,
      settings,
      establishment,
      emissionPoint,
      secInvoice,
      secBoleta,
      secQuote
    );

    const tendered = parseFloat(cashAmountTendered) || sriBreakdown.valorAPagar;
    const change = Math.max(0, tendered - sriBreakdown.valorAPagar);

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      documentType,
      series: docInfo.series,
      number: docInfo.number,
      fullNumber: docInfo.fullNumber,
      createdAt: new Date().toISOString(),
      customer: selectedCustomer,
      items: cartItems.map((item) => ({
        productId: item.product.id,
        sku: item.product.sku,
        productName: item.product.name,
        unit: item.product.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        subtotal: item.subtotal,
        taxRate: typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate,
        taxAmount: item.taxAmount,
        total: item.total,
      })),
      subtotal: sriBreakdown.subtotalSinImpuestos,
      discountTotal: sriBreakdown.totalDescuento,
      taxTotal: sriBreakdown.iva15 + sriBreakdown.iva5 + sriBreakdown.ivaEspecial,
      total: sriBreakdown.valorAPagar,
      paymentMethod: selectedPaymentMethod,
      paymentStatus: documentType === 'COTIZACION' ? 'PENDIENTE' : 'PAGADA',
      amountTendered: selectedPaymentMethod === 'EFECTIVO' ? tendered : sriBreakdown.valorAPagar,
      changeGiven: selectedPaymentMethod === 'EFECTIVO' ? change : 0,
      paymentReference: paymentReference || undefined,
      sellerName: sellerName || 'Juan Pérez',
      orderId: invoicingOrder?.id,
      notes: invoicingOrder
        ? `Pedido N° ${invoicingOrder.id}${invoicingOrder.notes ? ' - ' + invoicingOrder.notes : ''}`
        : undefined,
    };

    // Deduct stock for active sales (not quote)
    const updatedProducts = products.map((prod) => {
      if (documentType === 'COTIZACION') return prod;
      const soldItem = cartItems.find((item) => item.product.id === prod.id);
      if (soldItem) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - soldItem.quantity),
        };
      }
      return prod;
    });

    // Increment document number
    const updatedSettings = { ...settings };
    if (documentType === 'FACTURA') {
      const nextNum = (parseInt(secInvoice || '1', 10) + 1).toString().padStart(9, '0');
      setSecInvoice(nextNum);
      updatedSettings.nextInvoiceNumber = parseInt(nextNum, 10);
    } else if (documentType === 'BOLETA') {
      const nextNum = (parseInt(secBoleta || '1', 10) + 1).toString().padStart(6, '0');
      if (setSecBoleta) setSecBoleta(nextNum);
      updatedSettings.nextTicketNumber = parseInt(nextNum, 10);
    } else if (documentType === 'COTIZACION') {
      const nextNum = (parseInt(secQuote || '1', 10) + 1).toString().padStart(6, '0');
      if (setSecQuote) setSecQuote(nextNum);
      updatedSettings.nextQuoteNumber = parseInt(nextNum, 10);
    }

    // Confetti
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (err) {}

    // Callback
    onInvoiceCreated(newInvoice, updatedProducts, updatedSettings);

    // Reset Form
    setCartItems([]);
    setCashAmountTendered('');
    setPaymentReference('');

    if (documentType === 'FACTURA') {
      setCreatedInvoiceForSri(newInvoice);
      setIsSriEmissionModalOpen(true);
      showToast('Factura registrada. Iniciando transmisión electrónica al SRI...', 'info');
    } else {
      onOpenInvoiceViewer(newInvoice);
      showToast(
        documentType === 'COTIZACION'
          ? 'Cotización registrada correctamente.'
          : 'Nota de Venta procesada correctamente.',
        'success'
      );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[1920px] mx-auto pb-10">
      
      {/* ── PANEL IZQUIERDO: ÁREA DE FACTURACIÓN Y DETALLE (Col-span 8) ──────── */}
      <div className="lg:col-span-8 space-y-4">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
          
          {/* Banner de Pedido Vinculado */}
          {invoicingOrder && (
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <PackageCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs uppercase tracking-wide">Facturando Pedido:</span>
                    <span className="font-mono font-black text-sm bg-black/20 px-2 py-0.5 rounded-md">
                      {invoicingOrder.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/95">
                    Cliente: <strong>{invoicingOrder.customerName}</strong> {invoicingOrder.customerRuc ? `(${invoicingOrder.customerRuc})` : ''}
                  </p>
                </div>
              </div>
              {onCancelInvoicingOrder && (
                <button
                  type="button"
                  onClick={onCancelInvoicingOrder}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow-xs"
                  title="Desvincular pedido de esta venta"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Desvincular Pedido</span>
                </button>
              )}
            </div>
          )}

          {/* 1. TOP HEADER: Tipo de Documento, Secuencial y Botones de Acción */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Document Type Selector (Custom Modern Dropdown) */}
              <div className="relative" ref={docTypeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDocTypeDropdownOpen(!isDocTypeDropdownOpen)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100/90 border rounded-2xl transition-all cursor-pointer select-none ${
                    isDocTypeDropdownOpen 
                      ? 'ring-2 ring-orange-500 border-orange-500 bg-white shadow-sm' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-1 rounded-lg ${
                    documentType === 'FACTURA' 
                      ? 'bg-orange-500/10 text-orange-600' 
                      : documentType === 'BOLETA' 
                      ? 'bg-emerald-500/10 text-emerald-600' 
                      : 'bg-blue-500/10 text-blue-600'
                  }`}>
                    {documentType === 'FACTURA' && <FileText className="w-4 h-4" />}
                    {documentType === 'BOLETA' && <Receipt className="w-4 h-4" />}
                    {documentType === 'COTIZACION' && <Tag className="w-4 h-4" />}
                  </div>

                  <span className="font-black text-sm text-slate-900">
                    {documentType === 'FACTURA' ? 'Factura' : documentType === 'BOLETA' ? 'Nota de Venta' : 'Cotización'}
                  </span>

                  <ChevronDown className={`w-3.5 h-3.5 text-orange-500 transition-transform duration-200 ${isDocTypeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDocTypeDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-60 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 p-1.5 space-y-1 animate-fadeIn ring-1 ring-slate-900/10">
                    <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Tipo de Comprobante
                    </div>

                    {/* Factura */}
                    <button
                      type="button"
                      onClick={() => {
                        setDocumentType('FACTURA');
                        setIsDocTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                        documentType === 'FACTURA'
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black shadow-md shadow-orange-500/20'
                          : 'hover:bg-orange-50/80 text-slate-800 font-bold hover:text-orange-950'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${documentType === 'FACTURA' ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-600'}`}>
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs">Factura</div>
                          <div className={`text-[10px] ${documentType === 'FACTURA' ? 'text-white/80' : 'text-slate-400'} font-normal`}>Comprobante SRI</div>
                        </div>
                      </div>
                      {documentType === 'FACTURA' && <Check className="w-4 h-4 text-white" />}
                    </button>

                    {/* Nota de Venta */}
                    <button
                      type="button"
                      onClick={() => {
                        setDocumentType('BOLETA');
                        setIsDocTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                        documentType === 'BOLETA'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black shadow-md shadow-emerald-600/20'
                          : 'hover:bg-emerald-50/80 text-slate-800 font-bold hover:text-emerald-950'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${documentType === 'BOLETA' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                          <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs">Nota de Venta</div>
                          <div className={`text-[10px] ${documentType === 'BOLETA' ? 'text-white/80' : 'text-slate-400'} font-normal`}>Venta directa / ticket</div>
                        </div>
                      </div>
                      {documentType === 'BOLETA' && <Check className="w-4 h-4 text-white" />}
                    </button>

                    {/* Cotización */}
                    <button
                      type="button"
                      onClick={() => {
                        setDocumentType('COTIZACION');
                        setIsDocTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                        documentType === 'COTIZACION'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black shadow-md shadow-blue-600/20'
                          : 'hover:bg-blue-50/80 text-slate-800 font-bold hover:text-blue-950'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${documentType === 'COTIZACION' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                          <Tag className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs">Cotización</div>
                          <div className={`text-[10px] ${documentType === 'COTIZACION' ? 'text-white/80' : 'text-slate-400'} font-normal`}>Proforma informativa</div>
                        </div>
                      </div>
                      {documentType === 'COTIZACION' && <Check className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Sequential Number Badge (001-001-000-000-001) */}
              <div className="px-4 py-1.5 bg-indigo-50/90 border border-indigo-200/90 rounded-xl text-indigo-700 font-mono font-black text-sm tracking-wider shadow-2xs">
                {formattedSequentialNumber}
              </div>
            </div>

            {/* Action Buttons: Caja Status, Limpiar & Emitir */}
            <div className="flex items-center gap-2 flex-wrap">
              {!isCashRegisterOpen && (
                <button
                  type="button"
                  onClick={() => {
                    pendingEmissionActionRef.current = false;
                    setIsOpenCashModalOpen(true);
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-rose-200 shadow-2xs"
                  title="La caja está cerrada. Haga clic para abrir turno."
                >
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>Caja Cerrada</span>
                  <span className="text-[10px] font-black text-rose-600 underline ml-0.5">Abrir</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>

              <button
                type="button"
                onClick={handleDirectEmission}
                disabled={cartItems.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-2 shadow-md shadow-emerald-600/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Emitir</span>
              </button>
            </div>
          </div>

          {/* 2. SECTION: DATOS DEL CLIENTE */}
          <div className="space-y-2" ref={customerSearchRef}>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <div className="flex items-center gap-1.5 font-black text-slate-800">
                <User className="w-4 h-4 text-slate-600" />
                <span>Datos del Cliente</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400" /> Escriba para buscar
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    placeholder="Buscar cliente por nombre o RUC..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-2xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none transition"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition cursor-pointer flex items-center gap-1 border border-slate-200 shrink-0"
                  title="Directorio completo de clientes"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Cliente</span>
                </button>
              </div>

              {/* Autocomplete Dropdown Menu */}
              {isCustomerDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 max-h-60 overflow-y-auto custom-scrollbar p-1.5 animate-fadeIn">
                  <div className="px-2.5 py-1.5 text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-100 flex justify-between items-center">
                    <span>Resultados coincidentes ({filteredCustomers.length})</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cf = customers.find(c => c.docNumber === '9999999999999') || customers[0];
                        if (cf) setSelectedCustomer(cf);
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="text-orange-600 hover:underline font-bold"
                    >
                      Seleccionar Consumidor Final
                    </button>
                  </div>

                  {filteredCustomers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 space-y-2">
                      <p>No se encontraron clientes para "<strong>{customerSearch}</strong>".</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomerDropdownOpen(false);
                          setIsCustomerModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Crear Nuevo Cliente
                      </button>
                    </div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setIsCustomerDropdownOpen(false);
                          setCustomerSearch('');
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                          selectedCustomer.id === c.id
                            ? 'bg-orange-50 text-orange-950 font-bold'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <span className="text-[10px] font-normal text-slate-400 font-mono">({c.docType}: {c.docNumber})</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {c.email || 'Sin correo'} • {c.phone || 'Sin teléfono'} • {c.address || 'Ecuador'}
                          </div>
                          {c.creditLimit > 0 && (() => {
                            const debt = c.currentBalance || 0;
                            const available = Math.max(0, c.creditLimit - debt);
                            return (
                              <div className="text-[10px] text-slate-600 font-medium mt-1 flex flex-wrap items-center gap-1.5">
                                <span>Límite: <strong className="text-slate-800">${c.creditLimit.toFixed(2)}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span className="text-rose-600">Deuda: <strong className="text-rose-700">${debt.toFixed(2)}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-700 font-bold">Cupo: ${available.toFixed(2)}</span>
                              </div>
                            );
                          })()}
                        </div>
                        {selectedCustomer.id === c.id && (
                          <Check className="w-4 h-4 text-orange-600 shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Customer Info Badge */}
            {selectedCustomer && (
              <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-900 text-white rounded-xl font-black">
                    <UserCheck className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <div className="font-black text-slate-950 flex items-center gap-2">
                      <span>{selectedCustomer.name}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-200 text-slate-700">
                        {selectedCustomer.docType} {selectedCustomer.docNumber}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {selectedCustomer.email || 'Sin email registrado'} • Tel: {selectedCustomer.phone || 'N/A'} • {selectedCustomer.address || 'Ecuador'}
                    </div>
                    {selectedCustomer.creditLimit > 0 && (() => {
                      const debt = selectedCustomer.currentBalance || 0;
                      const available = Math.max(0, selectedCustomer.creditLimit - debt);
                      return (
                        <div className="text-[11px] pt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="text-slate-600 font-medium">
                            Límite de crédito: <strong className="font-bold text-slate-900">${selectedCustomer.creditLimit.toFixed(2)}</strong>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-rose-600 font-medium">
                            Deuda actual: <strong className="font-bold text-rose-700">${debt.toFixed(2)}</strong>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 font-medium">
                            Cupo disponible: <strong className="font-black text-emerald-800">${available.toFixed(2)}</strong>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                  >
                    Cambiar Cliente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. SECTION: DETALLE (BUSCADOR DE PRODUCTOS Y TABLA DE ITEMS) */}
          <div className="space-y-3" ref={productSearchRef}>
            {/* Header with Search and New Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 shrink-0">
                <Package className="w-4 h-4 text-slate-600" />
                <span>Detalle</span>
              </div>

              {/* Fast Predictive Product Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setIsProductDropdownOpen(true);
                  }}
                  onFocus={() => setIsProductDropdownOpen(true)}
                  placeholder="Buscar producto por nombre, SKU o código de barras..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/90 rounded-2xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none transition"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Product Search Dropdown */}
                {isProductDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 max-h-72 overflow-y-auto custom-scrollbar p-1.5 animate-fadeIn">
                    <div className="px-2.5 py-1 text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-100">
                      Productos Disponibles ({filteredProducts.length})
                    </div>

                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 space-y-2">
                        <p>No se encontraron productos para "<strong>{productSearch}</strong>".</p>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomName(productSearch);
                            setIsProductDropdownOpen(false);
                            setIsQuickCustomItemOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                        >
                          + Agregar como Ítem Manual
                        </button>
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            handleAddToCart(p, 1);
                            setProductSearch('');
                            setIsProductDropdownOpen(false);
                          }}
                          className="w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between hover:bg-slate-50 transition cursor-pointer border-b border-slate-50 last:border-none"
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">[{p.sku}]</span>
                              {(() => {
                                const promo = getActivePromoForProduct(p, 1);
                                return promo ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                                    🏷️ {promo.discountPercent}% OFF
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>Cat: {p.category}</span>
                              <span>•</span>
                              <span className={p.stock <= p.minStock ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                                Stock: {p.stock} {p.unit}
                              </span>
                              <span>•</span>
                              <span className="font-bold text-orange-600">IVA: {p.taxRate ?? settings.defaultTaxRate}%</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black font-mono text-slate-900">
                              {formatCurrency(p.price, settings.currencySymbol)}
                            </span>
                            <span className="block text-[10px] text-emerald-600 font-bold">
                              + Agregar
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons: + Nuevo & + Catálogo */}
              <div className="flex items-center gap-1.5 shrink-0">
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 border border-rose-200"
                    title="Vaciar detalle y restablecer terminal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsQuickCustomItemOpen(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                  title="Agregar un ítem o servicio personalizado"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 border border-slate-200"
                  title="Abrir catálogo visual con imágenes y categorías"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Catálogo</span>
                </button>
              </div>
            </div>

            {/* Products Table matching user image structure */}
            <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">DESCRIPCIÓN</th>
                    <th className="py-2.5 px-2 text-center w-24">CANT.</th>
                    <th className="py-2.5 px-2 text-right w-24">PRECIO UNIT.</th>
                    <th className="py-2.5 px-2 text-center w-24">TARIFA</th>
                    <th className="py-2.5 px-2 text-center w-16">DESC.</th>
                    <th className="py-2.5 px-3 text-right w-28">VALOR TOTAL</th>
                    <th className="py-2.5 px-2 text-center w-8">✕</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cartItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        <Package className="w-8 h-8 mx-auto stroke-[1.5] text-slate-300 mb-1" />
                        <p className="font-medium text-xs">No hay productos agregados en el detalle.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Use el buscador superior o el botón "+ Catálogo" para añadir artículos.</p>
                      </td>
                    </tr>
                  ) : (
                    cartItems.map((item) => (
                      <tr key={item.product.id} className="hover:bg-slate-50/80 transition">
                        {/* Descripción */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 leading-tight">{item.product.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>SKU: {item.product.sku}</span>
                            {item.product.stock !== undefined && (
                              <span className="text-slate-500">Stock: {item.product.stock} {item.product.unit}</span>
                            )}
                            {item.appliedPromo && (
                              <span className="text-emerald-700 bg-emerald-50 px-1 rounded font-bold">{item.appliedPromo}</span>
                            )}
                          </div>
                        </td>

                        {/* Cantidad */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const nextQty = item.quantity <= 1 ? Math.max(0.1, +(item.quantity - 0.25).toFixed(2)) : +(item.quantity - 1).toFixed(2);
                                handleUpdateQuantity(item.product.id, nextQty);
                              }}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer text-xs"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0.0001"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  handleUpdateQuantity(item.product.id, 0);
                                } else {
                                  const num = parseFloat(val);
                                  if (!isNaN(num)) {
                                    handleUpdateQuantity(item.product.id, num);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const num = parseFloat(e.target.value);
                                if (isNaN(num) || num <= 0) {
                                  handleUpdateQuantity(item.product.id, 1);
                                }
                              }}
                              className="w-14 text-center font-black font-mono border border-slate-200 rounded py-0.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nextQty = item.quantity < 1 ? +(item.quantity + 0.25).toFixed(2) : +(item.quantity + 1).toFixed(2);
                                handleUpdateQuantity(item.product.id, nextQty);
                              }}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer text-xs"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Precio Unitario */}
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateUnitPrice(item.product.id, val === '' ? 0 : parseFloat(val) || 0);
                            }}
                            className="w-20 text-right font-bold font-mono border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-900 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                          />
                        </td>

                        {/* Tarifa IVA (Custom Popover Dropdown) */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="relative inline-block text-left" data-tax-dropdown>
                            <button
                              type="button"
                              onClick={() => setOpenTaxDropdownId(openTaxDropdownId === item.product.id ? null : item.product.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer shadow-2xs select-none ${
                                (item.product.taxRate ?? settings.defaultTaxRate) === 15
                                  ? 'bg-amber-50 text-amber-800 border-amber-200/90 hover:bg-amber-100'
                                  : (item.product.taxRate ?? settings.defaultTaxRate) === 5
                                  ? 'bg-blue-50 text-blue-800 border-blue-200/90 hover:bg-blue-100'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200/90 hover:bg-emerald-100'
                              } ${openTaxDropdownId === item.product.id ? 'ring-2 ring-orange-500 border-orange-500 bg-white' : ''}`}
                            >
                              <span>{item.product.taxRate ?? settings.defaultTaxRate}% IVA</span>
                              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${openTaxDropdownId === item.product.id ? 'rotate-180 text-orange-600' : ''}`} />
                            </button>

                            {openTaxDropdownId === item.product.id && (
                              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-32 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 p-1.5 space-y-1 animate-fadeIn ring-1 ring-slate-900/10">
                                <div className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400 text-center">
                                  Tarifa SRI
                                </div>
                                {[15, 5, 0].map((rate) => {
                                  const isSelected = (item.product.taxRate ?? settings.defaultTaxRate) === rate;
                                  return (
                                    <button
                                      key={rate}
                                      type="button"
                                      onClick={() => {
                                        handleUpdateTaxRate(item.product.id, rate);
                                        setOpenTaxDropdownId(null);
                                      }}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-2xs'
                                          : 'hover:bg-orange-50/80 text-slate-700 hover:text-orange-950'
                                      }`}
                                    >
                                      <span>{rate}% IVA</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Descuento */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            value={item.discountPercent || 0}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateDiscount(item.product.id, val === '' ? 0 : parseFloat(val) || 0);
                            }}
                            className="w-12 text-center font-bold font-mono border border-slate-200 rounded px-1 py-0.5 text-xs text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                          />
                        </td>

                        {/* Valor Total */}
                        <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900 text-sm">
                          {formatCurrency(item.total, settings.currencySymbol)}
                        </td>

                        {/* Eliminar */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.product.id)}
                            className="text-slate-300 hover:text-rose-600 transition p-1 cursor-pointer"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. SECTION: FORMAS DE PAGO */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                <CreditCard className="w-4 h-4 text-slate-600" />
                <span>Formas de pago</span>
              </div>

              {/* Vendedor Selector (Custom Modern Dropdown) */}
              <div className="relative text-xs" ref={sellerDropdownRef}>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Vendedor:</span>
                  <button
                    type="button"
                    onClick={() => setIsSellerDropdownOpen(!isSellerDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer transition shadow-2xs select-none"
                  >
                    <span>{sellerName}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSellerDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {isSellerDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5 animate-fadeIn ring-1 ring-slate-900/10">
                    <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Asignar Vendedor
                    </div>
                    {sellerOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setSellerName(opt);
                          setIsSellerDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                          sellerName === opt
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold shadow-2xs'
                            : 'hover:bg-orange-50/80 text-slate-700 font-medium hover:text-orange-950'
                        }`}
                      >
                        <span className="truncate">{opt}</span>
                        {sellerName === opt && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Checkbox / Pill Selectors */}
            <div className="flex flex-wrap items-center gap-2">
              {activePaymentMethodsList.map((pm) => (
                <button
                  key={pm.key}
                  type="button"
                  onClick={() => setSelectedPaymentMethod(pm.key)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    selectedPaymentMethod === pm.key
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    selectedPaymentMethod === pm.key ? 'border-white bg-white text-slate-900' : 'border-slate-300'
                  }`}>
                    {selectedPaymentMethod === pm.key && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span>{pm.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(true)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition border border-slate-200 flex items-center gap-1 cursor-pointer"
                title="Cobro avanzado con múltiples métodos o crédito"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>

            {/* Contextual Payment Fields */}
            {selectedPaymentMethod === 'EFECTIVO' && (
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800 flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      Monto Recibido ($):
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder={sriBreakdown.valorAPagar > 0 ? sriBreakdown.valorAPagar.toFixed(2) : "0.00"}
                        value={cashAmountTendered}
                        onChange={(e) => setCashAmountTendered(e.target.value)}
                        className="w-32 pl-3 pr-6 py-1.5 bg-white border border-slate-200 text-slate-900 font-mono font-black text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none shadow-2xs"
                      />
                      {cashAmountTendered && (
                        <button
                          type="button"
                          onClick={() => setCashAmountTendered('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCashAmountTendered(sriBreakdown.valorAPagar.toFixed(2))}
                    className="text-[11px] font-black text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-xl cursor-pointer transition"
                  >
                    Monto Exacto (${sriBreakdown.valorAPagar.toFixed(2)})
                  </button>
                </div>

                {/* Billetes rápidos USD */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billetes:</span>
                  {[1, 5, 10, 20, 50, 100].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setCashAmountTendered(bill.toString())}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-mono font-black text-slate-700 transition cursor-pointer shadow-2xs"
                    >
                      ${bill}
                    </button>
                  ))}
                </div>

                {/* Live Change / Vuelto Banner */}
                {(() => {
                  const tendered = parseFloat(cashAmountTendered) || 0;
                  const total = sriBreakdown.valorAPagar;
                  if (tendered >= total && total > 0) {
                    const change = tendered - total;
                    return (
                      <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-xl flex items-center justify-between animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-emerald-600 text-white rounded-lg font-black">
                            <Check className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                              Cambio / Vuelto a Entregar
                            </div>
                            <div className="text-xs text-emerald-600 font-medium">
                              Entregar al cliente
                            </div>
                          </div>
                        </div>
                        <div className="text-2xl font-black font-mono text-emerald-700">
                          {formatCurrency(change, settings.currencySymbol)}
                        </div>
                      </div>
                    );
                  } else if (tendered > 0 && tendered < total) {
                    const remaining = total - tendered;
                    return (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
                        <span className="text-amber-800 font-bold">Falta por cobrar:</span>
                        <span className="font-mono font-black text-amber-700 text-sm">
                          {formatCurrency(remaining, settings.currencySymbol)}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {(selectedPaymentMethod === 'TARJETA_DEBITO' || selectedPaymentMethod === 'TARJETA_CREDITO' || selectedPaymentMethod === 'TRANSFERENCIA') && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3 text-xs">
                <span className="font-bold text-slate-700">N° Comprobante / Referencia:</span>
                <input
                  type="text"
                  placeholder="Ej: LOTE-89421 / REF-0091"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="flex-1 max-w-xs px-3 py-1 bg-white border border-slate-200 text-slate-900 font-mono font-bold rounded-xl text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── PANEL DERECHO: TOTALES SRI Y RESUMEN (Col-span 4) ───────────────── */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 sticky top-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-950 flex items-center gap-2 tracking-wide uppercase">
              <Calculator className="w-4 h-4 text-slate-800" />
              <span>TOTALES</span>
            </h3>
            <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
              SRI ECUADOR
            </span>
          </div>

          {/* SRI Totals Itemized List */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal sin impuestos:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.subtotalSinImpuestos, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal 15%:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.subtotal15, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal 5%:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.subtotal5, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal tarifa especial:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.subtotalEspecial, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal 0%:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.subtotal0, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal no objeto de IVA:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.subtotalNoObjeto, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal exento de IVA:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.subtotalExento, settings.currencySymbol)}
              </span>
            </div>

            <div className="border-t border-slate-100 my-2" />

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Total descuento:</span>
              <span className="font-mono font-bold text-rose-600">
                {formatCurrency(sriBreakdown.totalDescuento, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Valor ICE:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.valorIce, settings.currencySymbol)}
              </span>
            </div>

            <div className="border-t border-slate-100 my-2" />

            <div className="flex justify-between items-center text-slate-700 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span>IVA 15%:</span>
              </div>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.iva15, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-700 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <span>IVA 5%:</span>
              </div>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.iva5, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-700 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                <span>IVA tarifa especial:</span>
              </div>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.ivaEspecial, settings.currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-700 font-medium">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={propinaEnabled}
                  onChange={(e) => setPropinaEnabled(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <span>Propina 10%:</span>
              </label>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(sriBreakdown.propina10Amount, settings.currencySymbol)}
              </span>
            </div>

            <div className="border-t-2 border-slate-900 my-3" />

            {/* Valor a pagar */}
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-base font-black text-slate-950">Valor a pagar:</span>
              <span className="text-3xl font-black font-mono text-indigo-700">
                {formatCurrency(sriBreakdown.valorAPagar, settings.currencySymbol)}
              </span>
            </div>

            {/* ── COBRO RÁPIDO EN EFECTIVO Y CAMBIO / VUELTO (SIDEBAR) ── */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Paga con / Recibido:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCashAmountTendered(sriBreakdown.valorAPagar.toFixed(2))}
                  className="text-[10px] font-black text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-lg cursor-pointer transition"
                >
                  Exacto (${sriBreakdown.valorAPagar.toFixed(2)})
                </button>
              </div>

              {/* Input for Cash Received */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400 text-sm">
                  $
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder={sriBreakdown.valorAPagar > 0 ? sriBreakdown.valorAPagar.toFixed(2) : "0.00"}
                  value={cashAmountTendered}
                  onChange={(e) => setCashAmountTendered(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-950 font-mono font-black text-lg rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none transition shadow-2xs"
                />
                {cashAmountTendered && (
                  <button
                    type="button"
                    onClick={() => setCashAmountTendered('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Bill Buttons USD */}
              <div className="grid grid-cols-6 gap-1">
                {[1, 5, 10, 20, 50, 100].map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => setCashAmountTendered(bill.toString())}
                    className={`py-1.5 px-0.5 rounded-xl text-xs font-mono font-black border transition cursor-pointer text-center ${
                      parseFloat(cashAmountTendered) === bill
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                    }`}
                  >
                    ${bill}
                  </button>
                ))}
              </div>

              {/* Live Change / Vuelto Card */}
              {(() => {
                const tendered = parseFloat(cashAmountTendered) || 0;
                const total = sriBreakdown.valorAPagar;
                if (tendered >= total && total > 0) {
                  const change = tendered - total;
                  return (
                    <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-center justify-between animate-fadeIn">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                          Cambio / Vuelto
                        </div>
                        <div className="text-[11px] text-emerald-600 font-medium">
                          Entregar al cliente
                        </div>
                      </div>
                      <div className="text-2xl font-black font-mono text-emerald-700">
                        {formatCurrency(change, settings.currencySymbol)}
                      </div>
                    </div>
                  );
                } else if (tendered > 0 && tendered < total) {
                  const remaining = total - tendered;
                  return (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between animate-fadeIn text-xs">
                      <span className="text-amber-800 font-bold">Falta por cobrar:</span>
                      <span className="font-mono font-black text-amber-700">
                        {formatCurrency(remaining, settings.currencySymbol)}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Item counter */}
            <div className="pt-2 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5 border-t border-slate-100">
              <Package className="w-4 h-4 text-slate-400" />
              <span>{totalItemCount} {totalItemCount === 1 ? 'producto' : 'productos'}</span>
            </div>

            {/* Big Action Button */}
            <button
              type="button"
              onClick={handleDirectEmission}
              disabled={cartItems.length === 0}
              className="w-full mt-3 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {documentType === 'COTIZACION'
                  ? 'Guardar Cotización'
                  : `Emitir ${documentType === 'FACTURA' ? 'Factura SRI' : 'Nota de Venta'}`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: CATÁLOGO VISUAL DE PRODUCTOS ─────────────────────────────── */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">Catálogo General de Productos</h3>
                  <p className="text-xs text-slate-500">Seleccione los artículos que desea agregar al detalle.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
              <ProductSearch
                products={products}
                categories={categories}
                onAddToCart={(p, q) => {
                  handleAddToCart(p, q || 1);
                  showToast(`"${p.name}" agregado al detalle.`, 'success');
                }}
                currencySymbol={settings.currencySymbol}
                defaultTaxRate={settings.defaultTaxRate}
              />
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50 rounded-b-3xl">
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                Listo / Volver a Facturación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: AGREGAR ÍTEM MANUAL RÁPIDO ───────────────────────────────── */}
      {isQuickCustomItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Agregar Ítem o Servicio Personalizado</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickCustomItemOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomItemSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción del Ítem / Servicio *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Mano de obra instalación eléctrica"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Precio Unit. ($)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tarifa IVA</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[15, 5, 0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setCustomTaxRate(rate)}
                        className={`py-2 px-1 text-xs font-black rounded-xl border transition cursor-pointer text-center ${
                          customTaxRate === rate
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickCustomItemOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md cursor-pointer"
                >
                  Agregar a Detalle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: APERTURA DE CAJA REQUERIDA PARA FACTURAR ── */}
      {isOpenCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 border border-amber-200 rounded-2xl">
                  <Lock className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">Apertura de Caja Requerida</h3>
                  <p className="text-xs text-slate-500">Se requiere abrir turno para facturar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpenCashModalOpen(false);
                  pendingEmissionActionRef.current = false;
                }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmOpenCash} className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>La caja se encuentra actualmente cerrada.</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Para emitir el comprobante y registrar los cobros en el arqueo diario, ingrese el dinero en efectivo con el que inicia su turno.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  Dinero Inicial en Caja ($):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400 text-base">
                    $
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={openCashAmount}
                    onChange={(e) => setOpenCashAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-base text-slate-950 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Botones de sugerencias rápidas */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                {['0.00', '10.00', '20.00', '50.00', '100.00'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpenCashAmount(amt)}
                    className={`py-1.5 px-1 rounded-xl text-xs font-mono font-bold border transition cursor-pointer text-center ${
                      openCashAmount === amt
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    ${parseFloat(amt).toFixed(0)}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpenCashModalOpen(false);
                    pendingEmissionActionRef.current = false;
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Abrir Caja y Continuar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODALES COMPLEMENTARIOS ─────────────────────────────────────────── */}
      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customers={customers}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={(c) => {
          setSelectedCustomer(c);
          setIsCustomerModalOpen(false);
          showToast(`Cliente "${c.name}" seleccionado.`, 'info');
        }}
        onCreateCustomer={onCreateCustomer}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        documentType={documentType}
        customer={selectedCustomer}
        cartItems={cartItems}
        subtotal={sriBreakdown.subtotalSinImpuestos}
        discountTotal={sriBreakdown.totalDescuento}
        taxTotal={sriBreakdown.iva15 + sriBreakdown.iva5 + sriBreakdown.ivaEspecial}
        total={sriBreakdown.valorAPagar}
        settings={settings}
        paymentMethods={paymentMethods}
        onCompleteSale={(pm, tendered, change, notes, ref) => {
          setSelectedPaymentMethod(pm);
          if (tendered) setCashAmountTendered(tendered.toString());
          if (ref) setPaymentReference(ref);
          setIsPaymentModalOpen(false);
          handleDirectEmission();
        }}
      />

      <SriEmissionProgressModal
        isOpen={isSriEmissionModalOpen}
        onClose={() => {
          setIsSriEmissionModalOpen(false);
          if (createdInvoiceForSri) {
            onOpenInvoiceViewer(createdInvoiceForSri);
          }
        }}
        invoice={createdInvoiceForSri}
        settings={settings}
        onInvoiceUpdated={(updated) => {
          setCreatedInvoiceForSri(updated);
          if (onUpdateInvoice) {
            onUpdateInvoice(updated);
          }
        }}
      />
    </div>
  );
};
