import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { ProductSearch } from './ProductSearch';
import { Cart } from './Cart';
import { CustomerSelectModal } from './CustomerSelectModal';
import { PaymentModal } from './PaymentModal';
import { 
  CartItem, 
  Customer, 
  DocumentType, 
  Invoice, 
  PaymentMethod, 
  Product, 
  ProductCategory,
  Promotion,
  StoreSettings 
} from '../../types';
import { generateDocumentNumber } from '../../utils/formatters';
import { useModal } from '../../context/ModalContext';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { defaultEmployees, defaultUsersList } from '../../data/initialData';
import { SriEmissionProgressModal } from './SriEmissionProgressModal';

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
  initialCartItems,
  initialCustomer,
}) => {
  const { showToast } = useModal();
  const [employees] = useFirestoreSync<any[]>('ferreteria_hr_employees', defaultEmployees);
  const [usersList] = useFirestoreSync<any[]>('ferreteria_settings_users_list', defaultUsersList);

  const sellerOptions = React.useMemo(() => {
    const names = new Set<string>();
    employees.forEach(e => { if (e.fullName) names.add(e.fullName); });
    usersList.forEach(u => { if (u.name) names.add(u.name); });
    if (names.size === 0) names.add('Juan Pérez');
    return Array.from(names);
  }, [employees, usersList]);

  const [sellerName, setSellerName] = useState<string>(() => sellerOptions[0] || 'Juan Pérez');
  const [cartItems, setCartItems] = useState<CartItem[]>(initialCartItems || []);
  const [documentType, setDocumentType] = useState<DocumentType>(initialDocumentType);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(initialCustomer || customers[0]);

  React.useEffect(() => {
    if (sellerOptions.length > 0 && !sellerOptions.includes(sellerName)) {
      setSellerName(sellerOptions[0]);
    }
  }, [sellerOptions]);

  React.useEffect(() => {
    if (initialDocumentType) {
      setDocumentType(initialDocumentType);
    }
  }, [initialDocumentType]);

  React.useEffect(() => {
    if (initialCartItems && initialCartItems.length > 0) {
      setCartItems(initialCartItems);
    }
  }, [initialCartItems]);

  React.useEffect(() => {
    if (initialCustomer) {
      setSelectedCustomer(initialCustomer);
    }
  }, [initialCustomer]);
  
  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [createdInvoiceForSri, setCreatedInvoiceForSri] = useState<Invoice | null>(null);
  const [isSriEmissionModalOpen, setIsSriEmissionModalOpen] = useState(false);

  // Global F2 shortcut to open checkout
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && cartItems.length > 0 && !isPaymentModalOpen && !isCustomerModalOpen) {
        e.preventDefault();
        setIsPaymentModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length, isPaymentModalOpen, isCustomerModalOpen]);

  // Cart Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discountTotal = cartItems.reduce((sum, item) => {
    const originalSubtotal = item.quantity * item.unitPrice;
    return sum + (originalSubtotal - item.subtotal);
  }, 0);
  
  const taxTotal = cartItems.reduce((sum, item) => sum + item.taxAmount, 0);
  const total = cartItems.reduce((sum, item) => sum + item.total, 0);

  // ─── Promotion Engine ──────────────────────────────────────────────────────
  const getActivePromoForProduct = (product: Product, qty: number): Promotion | null => {
    const today = new Date().toISOString().split('T')[0];
    const active = promotions.filter(p =>
      p.status === 'ACTIVA' &&
      p.startDate <= today &&
      p.endDate >= today &&
      p.appliedCategory.trim().toLowerCase() === product.category.trim().toLowerCase() &&
      qty >= p.minQuantity
    );
    if (active.length === 0) return null;
    // Pick the highest discount
    return active.reduce((best, p) => p.discountPercent > best.discountPercent ? p : best);
  };

  // Helper for Price Scales
  const getPriceForQuantity = (product: Product, qty: number) => {
    if (!product.priceScales || product.priceScales.length === 0) return product.price;
    
    // Sort scales by minQty descending to evaluate highest quantity thresholds first
    const sortedScales = [...product.priceScales].sort((a, b) => b.minQty - a.minQty);
    
    for (const scale of sortedScales) {
      if (qty >= scale.minQty && (!scale.maxQty || qty <= scale.maxQty)) {
        return scale.price;
      }
    }
    return product.price;
  };

  // Cart Handlers
  const handleAddToCart = (product: Product, qty: number = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      
      let newQty = qty;
      if (existing) {
        newQty = existing.quantity + qty;
      }

      const taxRate = (typeof product.taxRate === 'number' ? product.taxRate : settings.defaultTaxRate) / 100;
      const baseUnitPrice = getPriceForQuantity(product, newQty);

      // ── Promo detection ──────────────────────────────────────────────────
      const promo = getActivePromoForProduct(product, newQty);
      // Use promo discount if found and higher than manual discount
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
          // Notify user that a promo was applied (outside setState, deferred)
          setTimeout(() => showToast(`🏷️ Promo aplicada: ${promo.name} (${promo.discountPercent}% OFF)`, 'success'), 0);
        }
        return [...prev, updatedItem];
      }
    });
  };

  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;

        const taxRate = (typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate) / 100;
        
        const baseUnitPrice = getPriceForQuantity(item.product, newQty);
        const itemSubtotal = newQty * baseUnitPrice; // unitPrice is base price
        const itemDiscountAmount = itemSubtotal * (item.discountPercent / 100);
        const baseAfterDiscount = itemSubtotal - itemDiscountAmount;
        const itemTaxAmount = baseAfterDiscount * taxRate;
        const itemTotal = baseAfterDiscount + itemTaxAmount;

        return {
          ...item,
          quantity: newQty,
          unitPrice: baseUnitPrice,
          subtotal: itemSubtotal,
          taxAmount: itemTaxAmount,
          total: itemTotal,
        };
      })
    );
  };

  const handleUpdateDiscount = (productId: string, discountPercent: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;

        const taxRate = (typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate) / 100;
        const safeDiscount = Math.max(0, Math.min(100, discountPercent));
        
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

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Complete Sale & Issue Document
  const handleCompleteSale = (
    paymentMethod: PaymentMethod,
    amountTendered?: number,
    changeGiven?: number,
    notes?: string
  ) => {
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

    // Build Invoice Object
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
      subtotal,
      discountTotal,
      taxTotal,
      total,
      paymentMethod,
      paymentStatus: documentType === 'COTIZACION' ? 'PENDIENTE' : 'PAGADA',
      amountTendered,
      changeGiven,
      notes,
      sellerName: sellerName || 'Juan Pérez',
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

    // Increment document number in store settings and state
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

    // Trigger Confetti Celebration
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err) {
      // ignore
    }

    // Call Parent Callback
    onInvoiceCreated(newInvoice, updatedProducts, updatedSettings);

    // Reset Cart & Close Payment Modal
    setIsPaymentModalOpen(false);
    setCartItems([]);

    if (documentType === 'FACTURA') {
      // Abre el modal de transmisión paso a paso con el SRI automáticamente
      setCreatedInvoiceForSri(newInvoice);
      setIsSriEmissionModalOpen(true);
      showToast('Factura registrada. Iniciando transmisión electrónica con el SRI...', 'info');
    } else {
      // Boleta o Cotización: abrir visor de impresión directo
      onOpenInvoiceViewer(newInvoice);
      showToast(
        documentType === 'COTIZACION'
          ? 'Cotización guardada correctamente.'
          : 'Boleta / Nota de Venta procesada correctamente.',
        'success'
      );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[calc(100vh-6.5rem)] lg:h-[calc(100vh-6.5rem)]">
      {/* Left: Product Search & Catalog (7 columns on desktop) */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full overflow-hidden">
        <ProductSearch
          products={products}
          categories={categories}
          onAddToCart={handleAddToCart}
          currencySymbol={settings.currencySymbol}
          defaultTaxRate={settings.defaultTaxRate}
        />
      </div>

      {/* Right: Cart & Billing Summary Sidebar (5 columns on desktop) */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full">
        <Cart
          cartItems={cartItems}
          documentType={documentType}
          setDocumentType={setDocumentType}
          customer={selectedCustomer}
          onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
          onUpdateQuantity={handleUpdateQuantity}
          onUpdateDiscount={handleUpdateDiscount}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onProceedToCheckout={() => setIsPaymentModalOpen(true)}
          subtotal={subtotal}
          discountTotal={discountTotal}
          taxTotal={taxTotal}
          total={total}
          settings={settings}
          sellerName={sellerName}
          setSellerName={setSellerName}
          sellerOptions={sellerOptions}
        />
      </div>

      {/* Customer Selector Modal */}
      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customers={customers}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={setSelectedCustomer}
        onCreateCustomer={onCreateCustomer}
      />

      {/* Payment Processing Checkout Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        documentType={documentType}
        customer={selectedCustomer}
        cartItems={cartItems}
        subtotal={subtotal}
        discountTotal={discountTotal}
        taxTotal={taxTotal}
        total={total}
        settings={settings}
        onCompleteSale={handleCompleteSale}
      />

      {/* Live 3-Step SRI Electronic Emission Modal */}
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
