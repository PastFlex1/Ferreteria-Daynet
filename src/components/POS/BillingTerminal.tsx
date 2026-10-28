import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  PackageCheck,
  Layers,
  Building2
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
  StoreSettings,
  PriceScale
} from '../../types';
import { formatCurrency, generateDocumentNumber, getEcuadorianDateTime } from '../../utils/formatters';
import { useModal } from '../../context/ModalContext';
import { usePermissions } from '../../context/PermissionsContext';
import { usePostgresSync } from '../../hooks/usePostgresSync';
import { defaultEmployees, defaultUsersList, defaultPaymentMethods } from '../../data/initialData';
import { Order } from '../Sales/CreateOrderModal';
import { calculateSriTotals, calculateCartItemFinancials, calculateCartItemFinancialsFromPvp } from '../../utils/sriCalculations';
import { CustomerSelectModal } from './CustomerSelectModal';
import { PaymentModal } from './PaymentModal';
import { SriEmissionProgressModal } from './SriEmissionProgressModal';
import { ProductSearch } from './ProductSearch';
import { getApiUrl } from '../../lib/apiConfig';

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
  onSelectEmissionPoint?: (val: string) => void;
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
  onClearInitialData?: () => void;
  paymentMethods?: PaymentMethodItem[];
  isCashRegisterOpen?: boolean;
  onOpenCashRegister?: (initialCash: number) => void;
  onSaveProduct?: (product: Product) => void;
}

interface DecimalInputProps {
  value: number;
  onChange: (val: number) => void;
  onBlurFallback?: number;
  className?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
}

const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  onChange,
  onBlurFallback,
  className,
  min = 0,
  max,
  placeholder,
  allowEmpty = false,
  disabled = false,
}) => {
  const [localText, setLocalText] = useState<string>(() => {
    if (value === 0 && allowEmpty) return '';
    return String(value);
  });
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (value === 0 && allowEmpty) {
        setLocalText('');
      } else {
        setLocalText(String(value));
      }
    }
  }, [value, isFocused, allowEmpty]);

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={localText}
      disabled={disabled}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onChange={(e) => {
        let raw = e.target.value.replace(',', '.');

        if (!/^[0-9]*\.?[0-9]*$/.test(raw)) {
          return;
        }

        setLocalText(raw);

        if (raw === '' || raw === '.') {
          if (allowEmpty) {
            onChange(0);
          }
          return;
        }

        const num = parseFloat(raw);
        if (!isNaN(num)) {
          if (max !== undefined && num > max) return;
          onChange(num);
        }
      }}
      onBlur={() => {
        setIsFocused(false);
        const clean = localText.replace(',', '.').trim();
        const num = parseFloat(clean);
        if (isNaN(num) || (onBlurFallback !== undefined && onBlurFallback > 0 && num <= 0)) {
          const fallback = onBlurFallback !== undefined ? onBlurFallback : (allowEmpty ? 0 : 1);
          setLocalText(fallback === 0 && allowEmpty ? '' : String(fallback));
          onChange(fallback);
        } else {
          setLocalText(String(num));
          onChange(num);
        }
      }}
      className={className}
    />
  );
};

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
  onSelectEmissionPoint,
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
  onClearInitialData,
  paymentMethods,
  isCashRegisterOpen = true,
  onOpenCashRegister,
  onSaveProduct,
}) => {
  const { showToast, showAlert } = useModal();
  const { can } = usePermissions();
  const [employees] = usePostgresSync<any[]>('ferreteria_hr_employees', defaultEmployees);
  const [usersList] = usePostgresSync<any[]>('ferreteria_settings_users_list', defaultUsersList);
  const [syncedPaymentMethods] = usePostgresSync<any[]>('ferreteria_settings_payment_methods', defaultPaymentMethods);

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

  // Sellers (Sincronizado en tiempo real con RRHH y Usuarios del Sistema)
  const sellerOptions = useMemo(() => {
    const names = new Set<string>();
    (employees || []).forEach((e: any) => {
      const n = e.fullName || e.name;
      if (n) names.add(n);
    });
    (usersList || []).forEach((u: any) => {
      const n = u.name || u.fullName;
      if (n) names.add(n);
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
  const [selectedPosProductIds, setSelectedPosProductIds] = useState<string[]>([]);

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

  // Quick custom item / direct product form
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('10.00');
  const [customCostPrice, setCustomCostPrice] = useState('7.00');
  const [customQty, setCustomQty] = useState('1');
  const [customStock, setCustomStock] = useState('0');
  const [customCategory, setCustomCategory] = useState(categories && categories.length > 0 ? categories[0].name : 'Herramientas Manuales');
  const [customUnit, setCustomUnit] = useState('UND');
  const [customTaxRate, setCustomTaxRate] = useState<number>(settings.defaultTaxRate || 15);

  const [isDocTypeDropdownOpen, setIsDocTypeDropdownOpen] = useState(false);
  const [isEmissionPointDropdownOpen, setIsEmissionPointDropdownOpen] = useState(false);
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState(false);
  const [openTaxDropdownId, setOpenTaxDropdownId] = useState<string | null>(null);
  const [taxDropdownPos, setTaxDropdownPos] = useState<{ top: number; left: number; openUpwards: boolean } | null>(null);

  const customerSearchRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const docTypeDropdownRef = useRef<HTMLDivElement>(null);
  const emissionPointDropdownRef = useRef<HTMLDivElement>(null);
  const sellerDropdownRef = useRef<HTMLDivElement>(null);

  const handleToggleTaxDropdown = (productId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!can('pos.edit_tax')) return;
    if (openTaxDropdownId === productId) {
      setOpenTaxDropdownId(null);
      setTaxDropdownPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownWidth = 140;
    const dropdownHeight = 145;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpwards = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    let left = rect.left + rect.width / 2 - dropdownWidth / 2;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = window.innerWidth - dropdownWidth - 12;
    }
    if (left < 12) left = 12;

    const top = openUpwards ? Math.max(10, rect.top - dropdownHeight - 6) : rect.bottom + 6;

    setTaxDropdownPos({ top, left, openUpwards });
    setOpenTaxDropdownId(productId);
  };

  // Reposicionar el dropdown flotante de tarifa en caso de scroll o redimensión
  useEffect(() => {
    if (!openTaxDropdownId) return;
    const handleReposition = () => {
      const triggerBtn = document.querySelector(`[data-tax-btn="${openTaxDropdownId}"]`) as HTMLElement;
      if (!triggerBtn) {
        setOpenTaxDropdownId(null);
        setTaxDropdownPos(null);
        return;
      }
      const rect = triggerBtn.getBoundingClientRect();
      const dropdownWidth = 140;
      const dropdownHeight = 145;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpwards = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      let left = rect.left + rect.width / 2 - dropdownWidth / 2;
      if (left + dropdownWidth > window.innerWidth - 12) {
        left = window.innerWidth - dropdownWidth - 12;
      }
      if (left < 12) left = 12;

      const top = openUpwards ? Math.max(10, rect.top - dropdownHeight - 6) : rect.bottom + 6;
      setTaxDropdownPos({ top, left, openUpwards });
    };

    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [openTaxDropdownId]);

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
      if (emissionPointDropdownRef.current && !emissionPointDropdownRef.current.contains(e.target as Node)) {
        setIsEmissionPointDropdownOpen(false);
      }
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(e.target as Node)) {
        setIsSellerDropdownOpen(false);
      }
      if (!(e.target as HTMLElement).closest('[data-tax-dropdown]')) {
        setOpenTaxDropdownId(null);
        setTaxDropdownPos(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sincronizar automáticamente el secuencial del servidor para el punto de emisión y establecimiento seleccionados
  useEffect(() => {
    const syncSequentialForPoint = async () => {
      if (documentType !== 'FACTURA' || !setSecInvoice) return;
      try {
        const estab = (establishment || '001').padStart(3, '0').slice(-3);
        const pto = (emissionPoint || '001').padStart(3, '0').slice(-3);
        const res = await fetch(getApiUrl('/api/invoices/emission-points'));
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            const point = json.data.find((p: any) => p.establishment === estab && p.emissionPoint === pto);
            if (point && point.nextSequential !== undefined && point.nextSequential >= 1) {
              setSecInvoice(String(point.nextSequential).padStart(9, '0'));
            }
          }
        }
      } catch (err) {
        console.warn('Error sincronizando secuencial para punto de emisión:', err);
      }
    };
    syncSequentialForPoint();
  }, [establishment, emissionPoint, documentType]);

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
  const getActivePromoForProduct = (product: Product, qty: number = 1): Promotion | null => {
    if (!promotions || promotions.length === 0) return null;

    // Obtener fecha local YYYY-MM-DD para evitar desfases de zona horaria con UTC
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayLocal = `${year}-${month}-${day}`;

    const applicablePromos: Promotion[] = [];

    promotions.forEach((p) => {
      // Estado activo (insensible a mayúsculas/minúsculas)
      if (p.status && p.status.trim().toUpperCase() !== 'ACTIVA') return;

      // Fechas de vigencia
      const start = p.startDate ? p.startDate.split('T')[0].trim() : '';
      const end = p.endDate ? p.endDate.split('T')[0].trim() : '';
      if (start && start > todayLocal) return;
      if (end && end < todayLocal) return;

      // Cantidad mínima requerida
      if (qty < (p.minQuantity || 1)) return;

      // 1. Si la promoción tiene lista detallada de productos (items)
      if (p.items && p.items.length > 0) {
        const itemMatch = p.items.find((it) => {
          const matchId = it.productId && product.id && String(it.productId).trim() === String(product.id).trim();
          const matchBarcode = it.barcode && product.barcode && String(it.barcode).trim() === String(product.barcode).trim();
          const matchSku = it.sku && product.sku && String(it.sku).trim().toLowerCase() === String(product.sku).trim().toLowerCase();
          const matchName = it.productName && product.name && String(it.productName).trim().toUpperCase() === String(product.name).trim().toUpperCase();
          return matchId || matchBarcode || matchSku || matchName;
        });

        if (itemMatch) {
          const itemDiscount = typeof itemMatch.discountPercent === 'number' ? itemMatch.discountPercent : p.discountPercent;
          applicablePromos.push({
            ...p,
            discountPercent: itemDiscount,
            name: p.name || `${itemDiscount}% OFF`,
          });
        }
        // Si la campaña tenía lista de productos y este producto no está en ella, no continúa a general
        return;
      }

      // 2. Coincidencia por producto específico
      if (p.productId) {
        if (String(p.productId).trim() === String(product.id).trim()) {
          applicablePromos.push(p);
        }
        return;
      }

      // 3. Coincidencia por categoría
      if (p.appliedCategory && p.appliedCategory !== 'TODOS') {
        if (product.category && p.appliedCategory.trim().toLowerCase() === product.category.trim().toLowerCase()) {
          applicablePromos.push(p);
        }
        return;
      }

      // 4. Promoción general (para todos los productos)
      applicablePromos.push(p);
    });

    if (applicablePromos.length === 0) return null;
    return applicablePromos.reduce((best, p) => (p.discountPercent > best.discountPercent ? p : best));
  };

  // Helper for Price Scales
  const getActiveScaleForQuantity = (product: Product, qty: number): PriceScale | null => {
    if (!product.priceScales || product.priceScales.length === 0) return null;
    const sortedScales = [...product.priceScales]
      .map((s) => ({
        ...s,
        minQty: Number(s.minQty) || 0,
        maxQty: s.maxQty !== undefined && s.maxQty !== null && !isNaN(Number(s.maxQty)) ? Number(s.maxQty) : undefined,
        price: Number(s.price) || 0,
      }))
      .filter((s) => s.minQty > 0 && s.price > 0)
      .sort((a, b) => b.minQty - a.minQty);

    for (const scale of sortedScales) {
      if (qty >= scale.minQty && (scale.maxQty === undefined || qty <= scale.maxQty)) {
        return scale;
      }
    }
    return null;
  };

  const getPvpForQuantity = (product: Product, qty: number): number => {
    const taxRateNum = typeof product.taxRate === 'number' ? product.taxRate : settings.defaultTaxRate;
    const scale = getActiveScaleForQuantity(product, qty);
    if (scale) {
      if (scale.priceWithTax !== undefined && scale.priceWithTax !== null && !isNaN(Number(scale.priceWithTax)) && Number(scale.priceWithTax) > 0) {
        return Number(scale.priceWithTax);
      }
      return Math.round(Number(scale.price) * (1 + taxRateNum / 100) * 100) / 100;
    }
    if (product.priceWithTax !== undefined && product.priceWithTax !== null && !isNaN(Number(product.priceWithTax)) && Number(product.priceWithTax) > 0) {
      return Number(product.priceWithTax);
    }
    return Math.round(Number(product.price || 0) * (1 + taxRateNum / 100) * 100) / 100;
  };

  const getPriceForQuantity = getPvpForQuantity;

  // Cart operations
  const handleAddToCart = (product: Product, qty: number = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      let newQty = qty;
      if (existing) {
        newQty = existing.quantity + qty;
      }

      const taxRateNum = typeof product.taxRate === 'number' ? product.taxRate : settings.defaultTaxRate;
      const unitPricePvp = getPvpForQuantity(product, newQty);
      const activeScale = getActiveScaleForQuantity(product, newQty);
      const appliedScale = activeScale ? activeScale.name : undefined;

      const promo = getActivePromoForProduct(product, newQty);
      const manualDiscount = existing ? existing.discountPercent : 0;
      const discountPct = promo ? Math.max(promo.discountPercent, manualDiscount) : manualDiscount;
      const appliedPromo = promo ? `${promo.code} · ${promo.discountPercent}% OFF` : (existing?.appliedPromo ?? undefined);

      const financials = calculateCartItemFinancialsFromPvp(newQty, unitPricePvp, taxRateNum, discountPct);

      const updatedItem: CartItem = {
        product,
        quantity: newQty,
        unitPrice: unitPricePvp,
        discountPercent: discountPct,
        subtotal: financials.subtotal,
        taxAmount: financials.taxAmount,
        total: financials.total,
        appliedPromo,
        appliedScale,
      };

      if (existing) {
        if (activeScale && existing.appliedScale !== activeScale.name) {
          setTimeout(() => showToast(`✨ Escala aplicada: "${activeScale.name}" (${formatCurrency(unitPricePvp, settings.currencySymbol)} c/u)`, 'info'), 0);
        }
        if (promo && !existing.appliedPromo) {
          setTimeout(() => showToast(`🏷️ Promo aplicada: ${promo.name} (${promo.discountPercent}% OFF)`, 'success'), 0);
        }
        return prev.map((item) => (item.product.id === product.id ? updatedItem : item));
      } else {
        if (activeScale) {
          setTimeout(() => showToast(`✨ Escala aplicada: "${activeScale.name}" (${formatCurrency(unitPricePvp, settings.currencySymbol)} c/u)`, 'info'), 0);
        }
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
        const taxRateNum = typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate;
        const activeScale = getActiveScaleForQuantity(item.product, newQty);
        const appliedScale = activeScale ? activeScale.name : undefined;

        let unitPricePvp = item.unitPrice;
        if (activeScale) {
          unitPricePvp = getPvpForQuantity(item.product, newQty);
        } else if (item.appliedScale) {
          unitPricePvp = getPvpForQuantity(item.product, newQty);
        }

        if (activeScale && item.appliedScale !== activeScale.name) {
          setTimeout(() => showToast(`✨ Escala aplicada: "${activeScale.name}" (${formatCurrency(unitPricePvp, settings.currencySymbol)} c/u)`, 'info'), 0);
        } else if (!activeScale && item.appliedScale) {
          setTimeout(() => showToast(`ℹ️ Cantidad menor al rango de escala. Aplicando precio regular.`, 'info'), 0);
        }

        const promo = getActivePromoForProduct(item.product, newQty);
        let discountPct = item.discountPercent;
        let appliedPromo = item.appliedPromo;
        if (promo) {
          discountPct = Math.max(promo.discountPercent, item.discountPercent);
          appliedPromo = `${promo.code} · ${promo.discountPercent}% OFF`;
        } else if (item.appliedPromo) {
          discountPct = 0;
          appliedPromo = undefined;
        }

        const financials = calculateCartItemFinancialsFromPvp(newQty, unitPricePvp, taxRateNum, discountPct);

        return {
          ...item,
          quantity: newQty,
          unitPrice: unitPricePvp,
          discountPercent: discountPct,
          subtotal: financials.subtotal,
          taxAmount: financials.taxAmount,
          total: financials.total,
          appliedPromo,
          appliedScale,
        };
      })
    );
  };

  const handleUpdateUnitPrice = (productId: string, newUnitPrice: number) => {
    const safePrice = Math.max(0, Math.round(newUnitPrice * 10000) / 10000);
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const taxRateNum = typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate;
        const financials = calculateCartItemFinancialsFromPvp(item.quantity, safePrice, taxRateNum, item.discountPercent);

        return {
          ...item,
          unitPrice: safePrice,
          subtotal: financials.subtotal,
          taxAmount: financials.taxAmount,
          total: financials.total,
        };
      })
    );
  };

  const handleUpdateTaxRate = (productId: string, newTaxRate: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const updatedProduct = {
          ...item.product,
          taxRate: newTaxRate,
        };
        const financials = calculateCartItemFinancialsFromPvp(item.quantity, item.unitPrice, newTaxRate, item.discountPercent);

        return {
          ...item,
          product: updatedProduct,
          subtotal: financials.subtotal,
          taxAmount: financials.taxAmount,
          total: financials.total,
        };
      })
    );
  };

  const handleUpdateDiscount = (productId: string, discountPercent: number) => {
    const safeDiscount = Math.max(0, Math.min(100, discountPercent));
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const taxRateNum = typeof item.product.taxRate === 'number' ? item.product.taxRate : settings.defaultTaxRate;
        const financials = calculateCartItemFinancialsFromPvp(item.quantity, item.unitPrice, taxRateNum, safeDiscount);

        return {
          ...item,
          discountPercent: safeDiscount,
          subtotal: financials.subtotal,
          taxAmount: financials.taxAmount,
          total: financials.total,
        };
      })
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => {
      const filtered = prev.filter((item) => item.product.id !== productId);
      if (filtered.length === 0) {
        onCancelInvoicingOrder?.();
        onClearInitialData?.();
      }
      return filtered;
    });
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
    setOpenTaxDropdownId(null);
    setTaxDropdownPos(null);
    setCustomName('');
    setCustomPrice('10.00');
    setCustomCostPrice('7.00');
    setCustomQty('1');
    setCustomStock('0');
    setCustomTaxRate(settings.defaultTaxRate || 15);

    // Desvincular pedido y limpiar cotización o pedido precargado en App.tsx
    onCancelInvoicingOrder?.();
    onClearInitialData?.();

    showToast('Terminal restablecido. Se han limpiado todos los datos.', 'success');
  };

  // Add product directly from POS and reflect it into real inventory
  const handleAddCustomItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const price = parseFloat(customPrice) || 0;
    const cost = parseFloat(customCostPrice) || Math.round(price * 0.7 * 100) / 100;
    const qty = parseFloat(customQty) || 1;
    const initialStock = parseFloat(customStock) || 0;
    const tax = customTaxRate;
    const timestamp = Date.now();
    const sku = `DIR-${timestamp.toString().slice(-4)}`;

    const newProduct: Product = {
      id: `prod-direct-${timestamp}`,
      sku: sku,
      name: customName.trim(),
      description: customName.trim(),
      category: customCategory || 'Herramientas Manuales',
      price: price,
      costPrice: cost,
      stock: initialStock, // Stock real ingresado por el cajero/usuario, sin 999 por defecto
      minStock: 1,
      unit: customUnit || 'UND',
      taxRate: tax,
      barcode: '',
      allowFractional: false,
      isCustom: false,
    };

    // 1. Guardar y reflejar en inventario
    if (onSaveProduct) {
      onSaveProduct(newProduct);
    }
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('ferreteria_auth_token') : null;
      fetch(getApiUrl('/api/products'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(newProduct)
      }).catch(() => {});
    } catch {}

    // 2. Agregar a la venta actual
    handleAddToCart(newProduct, qty);

    setCustomName('');
    setCustomPrice('10.00');
    setCustomCostPrice('7.00');
    setCustomQty('1');
    setCustomStock('0');
    setIsQuickCustomItemOpen(false);
    showToast(`Producto "${newProduct.name}" registrado en inventario (Stock inicial: ${initialStock} ${newProduct.unit}) y añadido a la venta.`, 'success');
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
    if (!productSearch.trim()) return products.slice(0, 50);
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [products, productSearch]);

  const handleToggleSelectPosProduct = (productId: string) => {
    setSelectedPosProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectAllPosProducts = (visibleProducts: Product[]) => {
    if (visibleProducts.length === 0) return;
    const visibleIds = visibleProducts.map((p) => p.id);
    const allSelected = visibleIds.every((id) => selectedPosProductIds.includes(id));
    if (allSelected) {
      setSelectedPosProductIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedPosProductIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleAddSelectedPosProducts = () => {
    if (selectedPosProductIds.length === 0) return;
    const productsToAdd = products.filter((p) => selectedPosProductIds.includes(p.id));
    productsToAdd.forEach((p) => {
      handleAddToCart(p, 1);
    });
    setSelectedPosProductIds([]);
    setProductSearch('');
    setIsProductDropdownOpen(false);
    showToast(`¡${productsToAdd.length} producto(s) agregado(s) a la lista!`, 'success');
  };

  // Direct Invoicing / Transmitting
  const handleDirectEmission = (overrideOptions?: {
    paymentMethod?: PaymentMethod;
    tendered?: number;
    change?: number;
    paymentReference?: string;
    notes?: string;
  }) => {
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

    executeInvoiceEmission(overrideOptions);
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

  const executeInvoiceEmission = (overrideOptions?: {
    paymentMethod?: PaymentMethod;
    tendered?: number;
    change?: number;
    paymentReference?: string;
    notes?: string;
  }) => {
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

    const pm = overrideOptions?.paymentMethod || selectedPaymentMethod;
    const tendered = overrideOptions?.tendered !== undefined
      ? overrideOptions.tendered
      : (parseFloat(cashAmountTendered) || sriBreakdown.valorAPagar);
    const rawChange = overrideOptions?.change !== undefined
      ? overrideOptions.change
      : Math.max(0, tendered - sriBreakdown.valorAPagar);
    const change = Math.round(rawChange * 100) / 100;

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      documentType,
      series: docInfo.series,
      number: docInfo.number,
      fullNumber: docInfo.fullNumber,
      createdAt: getEcuadorianDateTime().isoLocal,
      customer: selectedCustomer,
      items: cartItems.map((item) => ({
        productId: item.product.id,
        sku: item.product.sku,
        productName: item.product.name,
        unit: item.product.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.product.costPrice,
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
      paymentMethod: pm,
      paymentStatus: documentType === 'COTIZACION' ? 'PENDIENTE' : 'PAGADA',
      amountTendered: pm === 'EFECTIVO' ? tendered : sriBreakdown.valorAPagar,
      changeGiven: pm === 'EFECTIVO' ? change : 0,
      paymentReference: overrideOptions?.paymentReference || paymentReference || undefined,
      sellerName: sellerName || 'Juan Pérez',
      orderId: invoicingOrder?.id,
      notes: overrideOptions?.notes || (invoicingOrder
        ? `Pedido N° ${invoicingOrder.id}${invoicingOrder.notes ? ' - ' + invoicingOrder.notes : ''}`
        : undefined),
    };

    // Deduct stock for active sales (support negative stock)
    const updatedProducts = [...products];
    if (documentType !== 'COTIZACION') {
      cartItems.forEach((item) => {
        const idx = updatedProducts.findIndex((p) => p.id === item.product.id);
        if (idx >= 0) {
          const currentStock = updatedProducts[idx].stock;
          updatedProducts[idx] = {
            ...updatedProducts[idx],
            stock: Math.round((currentStock - item.quantity) * 10000) / 10000,
          };
        } else {
          // Si el producto fue creado directo en caja y aún no se reflejó por re-render en props
          updatedProducts.unshift({
            ...item.product,
            stock: Math.round((item.product.stock - item.quantity) * 10000) / 10000,
          });
        }
      });
    }

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

    // Reset Form y REGRESAR INMEDIATAMENTE A CONSUMIDOR FINAL TRAS FACTURAR
    setCartItems([]);
    setCashAmountTendered('');
    setPaymentReference('');
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
    setSelectedCustomer(defaultCustomer);
    setCustomerSearch('');
    setIsCustomerDropdownOpen(false);
    onClearInitialData?.();
    onCancelInvoicingOrder?.();

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
                  onClick={() => {
                    onCancelInvoicingOrder();
                    onClearInitialData?.();
                  }}
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

              {/* Selector de Punto de Emisión (4 Puntos según Términos de Referencia) con diseño institucional */}
              <div className="relative" ref={emissionPointDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsEmissionPointDropdownOpen(!isEmissionPointDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-200/90 bg-amber-50/80 hover:bg-amber-100/70 transition cursor-pointer shadow-2xs font-bold text-xs text-amber-950"
                  title="Punto de Emisión asignado a esta terminal (TDR: 4 Puntos de Emisión)"
                >
                  <div className="p-1 rounded-lg bg-amber-500/20 text-amber-700">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 leading-none">Punto Emisión</span>
                    <span className="font-black text-xs text-amber-950 leading-tight">
                      {emissionPoint === '001' ? 'Caja 1 (001)' :
                       emissionPoint === '002' ? 'Caja 2 (002)' :
                       emissionPoint === '003' ? 'Caja 3 (003)' :
                       emissionPoint === '004' ? 'Caja 4 (004)' :
                       `Punto ${emissionPoint} (${emissionPoint})`}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-amber-600 transition-transform duration-200 ${isEmissionPointDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isEmissionPointDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 p-1.5 space-y-1 animate-fadeIn ring-1 ring-slate-900/10">
                    <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Puntos de Emisión SRI
                    </div>

                    {(() => {
                      const defaultPoints = [
                        { code: '001', name: 'Caja 1', label: 'Caja 1 (001)', desc: 'Caja Principal / Mostrador' },
                        { code: '002', name: 'Caja 2', label: 'Caja 2 (002)', desc: 'Atención al Cliente' },
                        { code: '003', name: 'Caja 3', label: 'Caja 3 (003)', desc: 'Patio / Bodega' },
                        { code: '004', name: 'Caja 4', label: 'Caja 4 (004)', desc: 'Express / Mayorista' }
                      ];
                      const allPoints = defaultPoints.some(p => p.code === emissionPoint)
                        ? defaultPoints
                        : [...defaultPoints, { code: emissionPoint, name: `Punto ${emissionPoint}`, label: `Punto ${emissionPoint} (${emissionPoint})`, desc: 'Punto configurado en ajustes' }];

                      return allPoints.map((pt) => {
                        const isSelected = emissionPoint === pt.code;
                        return (
                          <button
                            key={pt.code}
                            type="button"
                            onClick={() => {
                              if (onSelectEmissionPoint) onSelectEmissionPoint(pt.code);
                              setIsEmissionPointDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black shadow-md shadow-orange-500/20'
                                : 'hover:bg-amber-50/80 text-slate-800 font-bold hover:text-amber-950'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100/70 text-amber-700'}`}>
                                <Building2 className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div className="text-xs">{pt.name} <span className="font-mono text-[10px] opacity-80">({pt.code})</span></div>
                                <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'} font-normal`}>{pt.desc}</div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                          </button>
                        );
                      });
                    })()}
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
                onClick={() => handleDirectEmission()}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && productSearch) {
                      const exactMatch = products.find(
                        (p) =>
                          p.sku.toLowerCase() === productSearch.toLowerCase() ||
                          (p.barcode && p.barcode.toLowerCase() === productSearch.toLowerCase())
                      );
                      if (exactMatch) {
                        handleAddToCart(exactMatch, 1);
                        setProductSearch('');
                        setIsProductDropdownOpen(false);
                      } else if (filteredProducts.length === 1) {
                        handleAddToCart(filteredProducts[0], 1);
                        setProductSearch('');
                        setIsProductDropdownOpen(false);
                      }
                    }
                  }}
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
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 max-h-80 overflow-y-auto custom-scrollbar p-1.5 animate-fadeIn">
                    <div className="px-2.5 py-1.5 text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap sticky top-0 bg-white z-10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>Productos Disponibles ({filteredProducts.length})</span>
                        {promotions.filter((p) => p.status === 'ACTIVA').length > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-black text-[9px]">
                            🔥 {promotions.filter((p) => p.status === 'ACTIVA').length} Promoción(es) activa(s)
                          </span>
                        )}
                      </div>
                      {filteredProducts.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAllPosProducts(filteredProducts);
                            }}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-600 hover:text-orange-800 cursor-pointer normal-case"
                          >
                            <input
                              type="checkbox"
                              readOnly
                              checked={
                                filteredProducts.length > 0 &&
                                filteredProducts.every((p) => selectedPosProductIds.includes(p.id))
                              }
                              className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 pointer-events-none accent-orange-600"
                            />
                            <span>
                              {filteredProducts.every((p) => selectedPosProductIds.includes(p.id))
                                ? 'Deseleccionar todos'
                                : 'Seleccionar todos'}
                            </span>
                          </button>
                          {selectedPosProductIds.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPosProductIds([]);
                                }}
                                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 px-1.5 py-0.5 rounded cursor-pointer normal-case"
                              >
                                Limpiar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddSelectedPosProducts();
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1 normal-case"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Agregar seleccionados ({selectedPosProductIds.length})
                              </button>
                            </>
                          )}
                        </div>
                      )}
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
                      filteredProducts.map((p) => {
                        const taxRate = typeof p.taxRate === 'number' ? p.taxRate : (settings.defaultTaxRate ?? 15);
                        const priceWithTax = p.price * (1 + taxRate / 100);
                        const promo = getActivePromoForProduct(p, 1);
                        const discountPct = promo ? promo.discountPercent : 0;
                        const discountedPriceWithTax = promo ? priceWithTax * (1 - discountPct / 100) : priceWithTax;
                        const savings = promo ? priceWithTax - discountedPriceWithTax : 0;
                        const isChecked = selectedPosProductIds.includes(p.id);
                        const inCartItem = cartItems.find((item) => item.product.id === p.id);

                        return (
                          <div
                            key={p.id}
                            onClick={() => handleToggleSelectPosProduct(p.id)}
                            className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer border-b border-slate-50 last:border-none ${
                              isChecked
                                ? 'bg-orange-50/80 hover:bg-orange-100/60 border-l-4 border-l-orange-500'
                                : promo
                                  ? 'bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-transparent hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                                  : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelectPosProduct(p.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer shrink-0 accent-orange-600"
                              />
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                  <span>{p.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">[{p.sku}]</span>
                                  {inCartItem && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      ✓ En lista ({inCartItem.quantity})
                                    </span>
                                  )}
                                  {promo && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-xs animate-pulse">
                                      🔥 PROMO: {promo.discountPercent}% OFF · {promo.name || promo.code}
                                    </span>
                                  )}
                                  {p.priceScales && p.priceScales.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                                      <Layers className="w-3 h-3 text-indigo-500" />
                                      {p.priceScales.length} {p.priceScales.length === 1 ? 'Escala' : 'Escalas'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-2 flex-wrap">
                                  <span>Cat: {p.category}</span>
                                  <span>•</span>
                                  <span className={p.stock <= p.minStock ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                                    Stock: {p.stock} {p.unit}
                                  </span>
                                  <span>•</span>
                                  <span className="font-bold text-orange-600">IVA: {taxRate}%</span>
                                  {promo && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        Ahorras: {formatCurrency(savings, settings.currencySymbol)}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {p.priceScales && p.priceScales.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-50/90 px-1.5 py-0.5 rounded border border-indigo-200/80">
                                      Escalas x volumen:
                                    </span>
                                    {p.priceScales.map((scale, sIdx) => {
                                      const sPriceWithTax = Number(scale.price) * (1 + taxRate / 100);
                                      return (
                                        <span key={sIdx} className="text-[9px] font-mono font-bold bg-white text-indigo-950 px-1.5 py-0.5 rounded border border-indigo-200 shadow-2xs">
                                          {scale.name || `E${sIdx+1}`} ({scale.minQty}+ {p.unit}): <strong className="text-indigo-700">{formatCurrency(sPriceWithTax, settings.currencySymbol)}</strong>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right pl-3 shrink-0">
                              {promo ? (
                                <div>
                                  <div className="text-[11px] text-slate-400 line-through font-mono">
                                    {formatCurrency(priceWithTax, settings.currencySymbol)}
                                  </div>
                                  <div className="text-sm font-black font-mono text-emerald-600">
                                    {formatCurrency(discountedPriceWithTax, settings.currencySymbol)}
                                  </div>
                                  <div className="text-[9px] text-rose-600 font-bold font-mono">
                                    -{promo.discountPercent}% en caja
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-sm font-black font-mono text-slate-900">
                                    {formatCurrency(priceWithTax, settings.currencySymbol)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Sin IVA: {formatCurrency(p.price, settings.currencySymbol)}
                                  </div>
                                  {p.priceScales && p.priceScales.length > 0 && (
                                    <div className="text-[9px] text-indigo-600 font-extrabold font-mono">
                                      Desde {formatCurrency(Math.min(...p.priceScales.map(s => Number(s.price))) * (1 + taxRate / 100), settings.currencySymbol)} x mayor
                                    </div>
                                  )}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCart(p, 1);
                                  setProductSearch('');
                                  setIsProductDropdownOpen(false);
                                }}
                                className="inline-block text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline font-bold mt-0.5 cursor-pointer"
                              >
                                + Agregar
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {selectedPosProductIds.length > 0 && (
                      <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-3 py-2 flex items-center justify-between gap-2 z-10">
                        <span className="text-xs font-bold text-slate-700">
                          {selectedPosProductIds.length} producto(s) marcado(s)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddSelectedPosProducts();
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Agregar seleccionados a la lista ({selectedPosProductIds.length})
                        </button>
                      </div>
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

                {can('pos.create_custom_item') && (
                  <button
                    type="button"
                    onClick={() => setIsQuickCustomItemOpen(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                    title="Agregar un ítem o servicio personalizado"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo</span>
                  </button>
                )}

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
                    <th className="py-2.5 px-2 text-right w-24" title="Precio unitario final de venta con IVA incluido (PVP)">PRECIO UNIT.</th>
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
                    cartItems.map((item) => {
                      const hasScales = item.product.priceScales && item.product.priceScales.length > 0;
                      const activeScale = hasScales ? getActiveScaleForQuantity(item.product, item.quantity) : null;
                      const nextScale = hasScales
                        ? [...item.product.priceScales!]
                            .map((s) => ({ ...s, minQty: Number(s.minQty), price: Number(s.price) }))
                            .filter((s) => s.minQty > item.quantity)
                            .sort((a, b) => a.minQty - b.minQty)[0]
                        : null;

                      return (
                        <tr key={item.product.id} className="hover:bg-slate-50/80 transition">
                          {/* Descripción */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 leading-tight">{item.product.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>SKU: {item.product.sku}</span>
                              {item.product.stock !== undefined && (
                                <span className="text-slate-500">Stock: {item.product.stock} {item.product.unit}</span>
                              )}
                              {item.appliedPromo && (
                                <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded font-black text-[10px] shadow-2xs">
                                  🔥 {item.appliedPromo}
                                </span>
                              )}
                              {activeScale && (
                                <span className="inline-flex items-center gap-1 text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-black text-[10px] shadow-2xs" title={`Escala activa: ${activeScale.name}. Precio unitario base: $${activeScale.price.toFixed(2)} (normal: $${item.product.price.toFixed(2)})`}>
                                  <Layers className="w-3 h-3 text-indigo-600" />
                                  ✨ Escala: {activeScale.name} ({activeScale.minQty}+ {item.product.unit})
                                </span>
                              )}
                              {item.discountPercent > 0 && (() => {
                                const discConIva = Math.round(((item.quantity * item.unitPrice) - item.total) * 100) / 100;
                                const discSinIva = item.subtotal * (item.discountPercent / 100);
                                return (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold text-[10px]" title={`Descuento base SRI: -$${discSinIva.toFixed(2)} | Ahorro al cliente: -$${discConIva.toFixed(2)}`}>
                                    Ahorro: -${discConIva.toFixed(2)} con IVA
                                  </span>
                                );
                              })()}
                            </div>

                            {/* Escalas disponibles con botón de acción rápida para fijar cantidad */}
                            {hasScales && (
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-slate-500 font-extrabold text-[9px] uppercase tracking-wider">
                                  <Layers className="w-2.5 h-2.5 text-indigo-500" />
                                  Escalas ({item.product.priceScales!.length}):
                                </span>
                                {item.product.priceScales!.map((scale, sIdx) => {
                                  const isThisActive = activeScale?.id === scale.id || (activeScale && activeScale.name === scale.name);
                                  const scaleMin = Number(scale.minQty);
                                  const scaleP = Number(scale.price);
                                  const itemTaxRate = typeof item.product.taxRate === 'number' ? item.product.taxRate : (settings.defaultTaxRate ?? 15);
                                  const scalePWithTax = scaleP * (1 + itemTaxRate / 100);
                                  return (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      onClick={() => handleUpdateQuantity(item.product.id, scaleMin)}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition cursor-pointer ${
                                        isThisActive
                                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                          : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 border-indigo-200/90'
                                      }`}
                                      title={`Fijar cantidad a ${scaleMin} para aplicar ${scale.name || `Escala ${sIdx + 1}`}: $${scaleP.toFixed(2)} sin IVA ($${scalePWithTax.toFixed(2)} con IVA)`}
                                    >
                                      {isThisActive ? '✓ ' : ''}{scale.name || `Escala ${sIdx + 1}`} ({scaleMin}+): ${scaleP.toFixed(2)}{itemTaxRate > 0 ? ` ($${scalePWithTax.toFixed(2)} c/IVA)` : ''}
                                    </button>
                                  );
                                })}
                                {!activeScale && nextScale && (
                                  <span className="text-[9px] text-amber-700 font-semibold ml-1">
                                    (Faltan {Math.max(0, +(nextScale.minQty - item.quantity).toFixed(2))} {item.product.unit} para activar {nextScale.name})
                                  </span>
                                )}
                              </div>
                            )}
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
                              <DecimalInput
                                value={item.quantity}
                                onChange={(newQty) => handleUpdateQuantity(item.product.id, newQty)}
                                onBlurFallback={1}
                                min={0.0001}
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
                            <DecimalInput
                              value={item.unitPrice}
                              onChange={(newPrice) => handleUpdateUnitPrice(item.product.id, newPrice)}
                              onBlurFallback={0}
                              min={0}
                              disabled={!can('pos.edit_price')}
                              className={`w-20 text-right font-bold font-mono border rounded px-1.5 py-0.5 text-xs focus:outline-none ${
                                can('pos.edit_price')
                                  ? 'border-slate-200 text-slate-900 focus:ring-1 focus:ring-orange-500'
                                  : 'border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed opacity-80'
                              }`}
                            />
                            {activeScale ? (
                              <span className="text-[9px] font-bold text-indigo-600 block text-right font-mono" title={`Precio de escala "${activeScale.name}" aplicado automáticamente`}>
                                ⚡ {activeScale.name}
                              </span>
                            ) : hasScales ? (
                              <span className="text-[9px] text-slate-400 block text-right font-mono" title="Este producto cuenta con escalas de precio">
                                {item.product.priceScales!.length} escalas disp.
                              </span>
                            ) : null}
                          </td>

                        {/* Tarifa IVA (Trigger para Popover Flotante en Portal) */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="relative inline-block text-left" data-tax-dropdown>
                            <button
                              type="button"
                              data-tax-dropdown
                              data-tax-btn={item.product.id}
                              onClick={(e) => handleToggleTaxDropdown(item.product.id, e)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all shadow-2xs select-none ${
                                can('pos.edit_tax') ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                              } ${
                                (item.product.taxRate ?? settings.defaultTaxRate) === 15
                                  ? 'bg-amber-50 text-amber-800 border-amber-200/90 hover:bg-amber-100'
                                  : (item.product.taxRate ?? settings.defaultTaxRate) === 5
                                  ? 'bg-blue-50 text-blue-800 border-blue-200/90 hover:bg-blue-100'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200/90 hover:bg-emerald-100'
                              } ${openTaxDropdownId === item.product.id ? 'ring-2 ring-orange-500 border-orange-500 bg-white' : ''}`}
                              title={can('pos.edit_tax') ? 'Modificar tarifa' : 'Modificación de IVA bloqueada'}
                            >
                              <span>{item.product.taxRate ?? settings.defaultTaxRate}% IVA</span>
                              {can('pos.edit_tax') && (
                                <ChevronDown
                                  className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${
                                    openTaxDropdownId === item.product.id ? 'rotate-180 text-orange-600' : ''
                                  }`}
                                />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Descuento */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex flex-col items-center">
                            <DecimalInput
                              value={item.discountPercent || 0}
                              onChange={(newDisc) => handleUpdateDiscount(item.product.id, newDisc)}
                              allowEmpty={true}
                              min={0}
                              max={100}
                              placeholder="0"
                              disabled={!can('pos.apply_discount')}
                              className={`w-14 text-center font-bold font-mono border rounded px-1 py-0.5 text-xs focus:outline-none ${
                                !can('pos.apply_discount') 
                                  ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-80' 
                                  : item.discountPercent > 0
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-black ring-1 ring-emerald-200'
                                    : 'border-slate-200 text-slate-800 focus:ring-1 focus:ring-orange-500'
                              }`}
                            />
                            {item.discountPercent > 0 && (
                              <div className="mt-0.5 text-center">
                                <span className="text-[9px] font-black text-emerald-700 block whitespace-nowrap">
                                  {item.appliedPromo ? '🏷️ Promo' : '% desc.'}
                                </span>
                                {(() => {
                                  const discConIva = Math.round(((item.quantity * item.unitPrice) - item.total) * 100) / 100;
                                  const discSinIva = item.subtotal * (item.discountPercent / 100);
                                  return (
                                    <span className="text-[9px] font-bold text-emerald-600 font-mono block whitespace-nowrap" title={`Descuento Sin IVA: -$${discSinIva.toFixed(2)} | Ahorro Con IVA: -$${discConIva.toFixed(2)}`}>
                                      -${discConIva.toFixed(2)}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Valor Total */}
                        <td className="py-2.5 px-3 text-right">
                          {item.discountPercent > 0 && (() => {
                            const originalTotalConIva = item.quantity * item.unitPrice;
                            return (
                              <span className="block text-[10px] font-mono text-slate-400 line-through">
                                {formatCurrency(originalTotalConIva, settings.currencySymbol)}
                              </span>
                            );
                          })()}
                          <span className="font-black font-mono text-slate-900 text-sm block">
                            {formatCurrency(item.total, settings.currencySymbol)}
                          </span>
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Dropdown Flotante en Portal para Tarifa SRI (Posicionado con fixed y z-index máximo para quedar siempre encima de todo) */}
            {openTaxDropdownId && taxDropdownPos && can('pos.edit_tax') && (() => {
              const currentItem = cartItems.find((i) => i.product.id === openTaxDropdownId);
              if (!currentItem) return null;
              const currentTaxRate = currentItem.product.taxRate ?? settings.defaultTaxRate;

              return createPortal(
                <div
                  data-tax-dropdown
                  style={{
                    position: 'fixed',
                    top: taxDropdownPos.top,
                    left: taxDropdownPos.left,
                    width: 140,
                    zIndex: 99999999,
                  }}
                  className="bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-fadeIn ring-1 ring-slate-900/10 select-none"
                >
                  <div className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400 text-center border-b border-slate-100 pb-1">
                    Tarifa SRI
                  </div>
                  {[15, 5, 0].map((rate) => {
                    const isSelected = currentTaxRate === rate;
                    return (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          handleUpdateTaxRate(currentItem.product.id, rate);
                          setOpenTaxDropdownId(null);
                          setTaxDropdownPos(null);
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
                </div>,
                document.body
              );
            })()}
          </div>

          {/* Resumen de ítems actualmente dentro de la lista (justo arriba de Formas de pago) */}
          <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl px-3.5 py-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                <Package className="w-3.5 h-3.5 text-orange-600" />
                <span>Ítems en la lista ({cartItems.length})</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                Total unidades:{' '}
                <strong className="font-mono text-slate-800">
                  {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
                </strong>
              </span>
            </div>
            {cartItems.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">
                Ningún ítem agregado a la lista todavía.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {cartItems.map((item) => (
                  <div
                    key={item.product.id}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-[11px] shadow-2xs"
                  >
                    <span className="font-bold text-slate-800 truncate max-w-[200px]">
                      {item.product.name}
                    </span>
                    <span className="font-mono font-black text-orange-600 bg-orange-50 border border-orange-200/80 px-1.5 py-0.2 rounded-md text-[10px]">
                      x{item.quantity} {item.product.unit || 'UND'}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                    const change = Math.round((tendered - total) * 100) / 100;
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

            {sriBreakdown.totalDescuento > 0 ? (
              <div className="p-2.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-1 my-1">
                <div className="flex justify-between items-center text-slate-700 font-bold">
                  <span className="flex items-center gap-1 text-rose-700">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Total descuento (Base SRI):</span>
                  </span>
                  <span className="font-mono font-black text-rose-600">
                    -{formatCurrency(sriBreakdown.totalDescuento, settings.currencySymbol)}
                  </span>
                </div>
                {sriBreakdown.totalDescuentoConIva && sriBreakdown.totalDescuentoConIva > 0 && (
                  <div className="flex justify-between items-center text-[11px] text-emerald-700 font-black pt-1 border-t border-rose-200/60">
                    <span>🎉 Ahorro real del cliente (Con IVA):</span>
                    <span className="font-mono font-black text-emerald-600">
                      -{formatCurrency(sriBreakdown.totalDescuentoConIva, settings.currencySymbol)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Total descuento:</span>
                <span className="font-mono font-bold text-slate-400">
                  {formatCurrency(0, settings.currencySymbol)}
                </span>
              </div>
            )}

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

            {/* Item counter */}
            <div className="pt-2 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5 border-t border-slate-100">
              <Package className="w-4 h-4 text-slate-400" />
              <span>{totalItemCount} {totalItemCount === 1 ? 'producto' : 'productos'}</span>
            </div>

            {/* Big Action Button */}
            <button
              type="button"
              onClick={() => handleDirectEmission()}
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
                promotions={promotions}
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

      {/* ── MODAL: REGISTRAR PRODUCTO DIRECTO EN CAJA E INVENTARIO ──────────── */}
      {isQuickCustomItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <span>Registrar Producto Directo en Caja</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Se guardará formalmente en el inventario con su stock real y se agregará a la venta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickCustomItemOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomItemSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre / Descripción del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Disco de corte fino 4 1/2 Dewalt"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"
                  >
                    {categories && categories.length > 0 ? (
                      categories.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Herramientas Manuales">Herramientas Manuales</option>
                        <option value="Materiales de Construcción">Materiales de Construcción</option>
                        <option value="Pinturas y Acabados">Pinturas y Acabados</option>
                        <option value="Fijaciones y Tornillería">Fijaciones y Tornillería</option>
                        <option value="General">General</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unidad de Medida</label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"
                  >
                    <option value="UND">UND (Unidades)</option>
                    <option value="PZA">PZA (Piezas)</option>
                    <option value="KG">KG (Kilogramos)</option>
                    <option value="MTR">MTR (Metros)</option>
                    <option value="LTR">LTR (Litros)</option>
                    <option value="GLN">GLN (Galones)</option>
                    <option value="CJA">CJA (Cajas)</option>
                    <option value="PAQ">PAQ (Paquetes)</option>
                    <option value="JGO">JGO (Juegos)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">P. Venta ($) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="10.00"
                    value={customPrice}
                    onChange={(e) => {
                      const clean = e.target.value.replace(',', '.');
                      if (/^[0-9]*\.?[0-9]*$/.test(clean)) {
                        setCustomPrice(clean);
                        const p = parseFloat(clean);
                        if (!isNaN(p)) {
                          setCustomCostPrice((Math.round(p * 0.7 * 100) / 100).toString());
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Costo ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="7.00"
                    value={customCostPrice}
                    onChange={(e) => {
                      const clean = e.target.value.replace(',', '.');
                      if (/^[0-9]*\.?[0-9]*$/.test(clean)) {
                        setCustomCostPrice(clean);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1" title="Stock actual disponible en existencias reales">
                    Stock Inicial
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="0"
                    value={customStock}
                    onChange={(e) => {
                      const clean = e.target.value.replace(',', '.');
                      if (/^-?[0-9]*\.?[0-9]*$/.test(clean)) {
                        setCustomStock(clean);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-emerald-700 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">A Facturar</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="1"
                    value={customQty}
                    onChange={(e) => {
                      const clean = e.target.value.replace(',', '.');
                      if (/^[0-9]*\.?[0-9]*$/.test(clean)) {
                        setCustomQty(clean);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tarifa IVA</label>
                <div className="grid grid-cols-3 gap-1.5">
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
                      {rate}% {rate === 15 ? '(General)' : rate === 5 ? '(Construcción)' : '(0% Sin IVA)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  El producto se registrará en inventario con <strong>{customStock || '0'} {customUnit}</strong> y quedará registrado formalmente en el sistema.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickCustomItemOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Guardar en Inventario y Facturar</span>
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
                    type="text"
                    inputMode="decimal"
                    required
                    value={openCashAmount}
                    onChange={(e) => {
                      const clean = e.target.value.replace(',', '.');
                      if (/^[0-9]*\.?[0-9]*$/.test(clean)) {
                        setOpenCashAmount(clean);
                      }
                    }}
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
          if (tendered !== undefined) setCashAmountTendered(tendered.toString());
          if (ref) setPaymentReference(ref);
          setIsPaymentModalOpen(false);
          handleDirectEmission({
            paymentMethod: pm,
            tendered,
            change,
            paymentReference: ref,
            notes,
          });
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
        establishment={establishment}
        emissionPoint={emissionPoint}
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
