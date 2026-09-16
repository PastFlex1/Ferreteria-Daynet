import React, { useState, useEffect } from 'react';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { Header } from './components/Header';
import { LoginView } from './components/Auth/LoginView';
import { BillingTerminal } from './components/POS/BillingTerminal';
import { InventoryManager } from './components/Inventory/InventoryManager';
import { InventoryModuleView } from './components/Inventory/InventoryModuleView';
import { InvoiceHistory } from './components/Invoices/InvoiceHistory';
import { InvoiceViewerModal } from './components/Invoices/InvoiceViewerModal';
import { CustomerManager } from './components/Customers/CustomerManager';
import { CashRegisterView } from './components/CashRegister/CashRegisterView';
import { SettingsManager } from './components/Settings/SettingsManager';
import { SalesModuleView } from './components/Sales/SalesModuleView';
import { PurchasesManager } from './components/Purchases/PurchasesManager';
import { SuppliersManager } from './components/Suppliers/SuppliersManager';
import { FinanceManager } from './components/Finance/FinanceManager';
import { AccountingManager } from './components/Accounting/AccountingManager';
import { AssetsManager } from './components/Assets/AssetsManager';
import { HRManager } from './components/HR/HRManager';
import { ReportsManager } from './components/Reports/ReportsManager';
import { SplashScreen, ModuleSkeleton } from './components/UI/LoadingScreen';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
import { TAB_TO_PERMISSION_MAP, DEFAULT_TAB_PRIORITY } from './types/permissions';

import { 
  AccountingSubTab,
  AssetsSubTab,
  HRSubTab,
  ReportsSubTab,
  SettingsSubTab,
  CashRegisterSession, 
  CartItem,
  Customer, 
  CustomersSubTab,
  DocumentType, 
  FinanceSubTab,
  InventorySubTab,
  Invoice, 
  Product, 
  ProductCategory,
  Promotion,
  PurchasesSubTab,
  SalesSubTab,
  SuppliersSubTab,
  StoreSettings, 
  TabType 
} from './types';
import { Order } from './components/Sales/CreateOrderModal';

import { 
  initialCustomers, 
  initialInvoices, 
  initialProducts, 
  initialStoreSettings,
  CONSUMIDOR_FINAL,
  defaultAccountPlan,
  defaultAssetClassifications,
  defaultAssetAreas,
  defaultAssetLocations,
  defaultPaymentMethods,
  defaultUsersList,
  defaultSellers,
  defaultCategories
} from './data/initialData';
import { generateDocumentNumber } from './utils/formatters';
import { useModal } from './context/ModalContext';
import { Lock, LogOut } from 'lucide-react';


const AuthorizedTabContent: React.FC<{
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  children: React.ReactNode;
}> = ({ activeTab, setActiveTab, children }) => {
  const { can, isSuperAdmin, userPermissions } = usePermissions();

  const isTabPermitted = (tab: string): boolean => {
    if (isSuperAdmin) return true;
    const perm = TAB_TO_PERMISSION_MAP[tab];
    if (!perm) return true;
    if (typeof userPermissions[perm] === 'boolean') {
      return userPermissions[perm];
    }
    return can(perm);
  };

  const isCurrentAllowed = isTabPermitted(activeTab);

  useEffect(() => {
    if (isSuperAdmin) return;
    if (!isCurrentAllowed) {
      // Si el trabajador no tiene permiso para este tab, buscar el primer tab permitido
      const candidateTabs = [
        ...DEFAULT_TAB_PRIORITY,
        'CATEGORIAS', 'PROMOCIONES', 'UNIDADES_MEDIDAS', 'AJUSTE_STOCK',
        'PROVEEDORES', 'ORDENES_COMPRA', 'BANCOS', 'CAJA_CHICA',
        'CONTABILIDAD_RESUMEN', 'ASIENTOS', 'ACTIVOS_LISTA',
        'EMPLEADOS', 'REP_VENTAS', 'CFG_EMPRESA'
      ];
      const firstAllowed = candidateTabs.find(tab => isTabPermitted(tab));
      if (firstAllowed && firstAllowed !== activeTab) {
        setActiveTab(firstAllowed as TabType);
      }
    }
  }, [activeTab, isSuperAdmin, isCurrentAllowed, userPermissions, setActiveTab]);

  if (!isSuperAdmin && !isCurrentAllowed) {
    return (
      <div className="py-24 px-6 text-center max-w-lg mx-auto space-y-4 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8 stroke-[2.5]" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Acceso Restringido</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Tu cuenta de usuario no tiene permisos habilitados para acceder a la sección <strong className="text-slate-700 font-bold">{activeTab}</strong>.
            Comunícate con el Administrador para solicitar acceso si lo requieres.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {

  const { showAlert, showToast } = useModal();
  const [activeTab, setActiveTabState] = useState<TabType>('CAJA');
  const [posDocumentType, setPosDocumentType] = useState<DocumentType>('FACTURA');
  const [blockerInitialCash, setBlockerInitialCash] = useState('500');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ferreteria_sidebar_collapsed');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const setSidebarCollapsed = (value: boolean | ((prev: boolean) => boolean)) => {
    setSidebarCollapsedState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      try {
        localStorage.setItem('ferreteria_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };
  const [posInitialCart, setPosInitialCart] = useState<CartItem[]>([]);
  const [posInitialCustomer, setPosInitialCustomer] = useState<Customer | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const setActiveTab = (newTab: TabType) => {
    if (newTab === activeTab) return;
    setIsTabLoading(true);
    setActiveTabState(newTab);
    setTimeout(() => {
      setIsTabLoading(false);
    }, 220);
  };

  const handleNavigateToTab = (tab: TabType | string, initialDocType?: DocumentType) => {
    if (initialDocType) {
      setPosDocumentType(initialDocType);
    }
    setActiveTab(tab as TabType);
  };
  
  // App Data State (stored in React state with localStorage persistence backup)
  const [settings, setSettings] = useFirestoreSync<StoreSettings>('ferreteria_settings', initialStoreSettings);
  const [establishment] = useFirestoreSync<string>('ferreteria_settings_establishment', '001');
  const [emissionPoint] = useFirestoreSync<string>('ferreteria_settings_emission_point', '001');
  const [secInvoice, setSecInvoice] = useFirestoreSync<string>('ferreteria_settings_sec_invoice', '000000001');
  const [secBoleta, setSecBoleta] = useFirestoreSync<string>('ferreteria_settings_sec_boleta', '000001');
  const [secQuote, setSecQuote] = useFirestoreSync<string>('ferreteria_settings_sec_quote', '000001');
  const [usersList, setUsersList] = useFirestoreSync<any[]>('ferreteria_settings_users_list', defaultUsersList);

  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = sessionStorage.getItem('ferreteria_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    sessionStorage.setItem('ferreteria_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('ferreteria_current_user');
  };

  const handleConfirmLogout = () => {
    setIsLogoutConfirmOpen(false);
    handleLogout();
  };

  // Migration logic to ensure existing Firestore users have username & password
  useEffect(() => {
    if (usersList && usersList.length > 0) {
      const needsMigration = usersList.some(u => !u.username || !u.password);
      if (needsMigration) {
        const migrated = usersList.map(u => {
          const defaultUser = defaultUsersList.find(d => d.id === u.id || d.email === u.email);
          return {
            ...u,
            username: u.username || defaultUser?.username || '1724567890',
            password: u.password || defaultUser?.password || '1234'
          };
        });
        setUsersList(migrated);
      }
    }
  }, [usersList, setUsersList]);

  // Synchronize browser tab title with configured store settings and preserve the orange wrench SVG favicon
  useEffect(() => {
    if (settings?.storeName) {
      document.title = `${settings.storeName} | Facturación & ERP Ferretero`;
    }

    const wrenchSvgFavicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f97316' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'/%3E%3C/svg%3E";
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = wrenchSvgFavicon;
  }, [settings?.storeName]);

  const [units, setUnits] = useFirestoreSync<any[]>('ferreteria_units', []);
  const [categories, setCategories] = useFirestoreSync<ProductCategory[]>('ferreteria_categories', []);
  const [promotions] = useFirestoreSync<Promotion[]>('ferreteria_promotions', []);
  const [paymentMethods, setPaymentMethods] = useFirestoreSync<any[]>('ferreteria_settings_payment_methods', defaultPaymentMethods);
  const [products, setProducts] = useFirestoreSync<Product[]>('ferreteria_products', initialProducts);
  const [customers, setCustomers] = useFirestoreSync<Customer[]>('ferreteria_customers', initialCustomers);
  const dbCustomers = customers.filter(c => c.id !== 'cust-general');
  const allCustomers = [CONSUMIDOR_FINAL, ...dbCustomers];
  const [invoices, setInvoices] = useFirestoreSync<Invoice[]>('ferreteria_invoices', initialInvoices);
  const [orders, setOrders] = useFirestoreSync<Order[]>('ferreteria_orders', []);
  const [posInvoicingOrder, setPosInvoicingOrder] = useState<Order | null>(null);
  const [cashSession, setCashSession] = useFirestoreSync<CashRegisterSession>('ferreteria_cash_session', {
    id: 'cash-0',
    openedAt: new Date().toISOString(),
    initialCash: 0,
    expectedCash: 0,
    status: 'CERRADA',
    totalSalesCash: 0,
    totalSalesTransfer: 0,
    totalSalesCard: 0,
    totalSalesCredit: 0,
    totalInvoicesCount: 0,
  });
  const [cashSessionsHistory, setCashSessionsHistory] = useFirestoreSync<any[]>('ferreteria_cash_sessions_history', []);

  // Active Invoice Viewer Modal State
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);
  const [preselectedInvoiceForCreditNote, setPreselectedInvoiceForCreditNote] = useState<Invoice | null>(null);

  const handleOpenCreditNoteForInvoice = (inv: Invoice) => {
    setPreselectedInvoiceForCreditNote(inv);
    setActiveTabState('NOTA_CREDITO');
  };

  // Sync state to LocalStorage












  // Low Stock Count
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  // Handlers
  const handleInvoiceCreated = (
    newInvoice: Invoice,
    updatedProducts: Product[],
    updatedSettings: StoreSettings
  ) => {
    setInvoices((prev) => [newInvoice, ...prev]);
    setProducts(updatedProducts);
    setSettings(updatedSettings);

    // Si la venta corresponde a un pedido, cambiar automáticamente su estado de PENDIENTE a FACTURADO
    const targetOrderId = newInvoice.orderId || posInvoicingOrder?.id;
    if (targetOrderId && newInvoice.documentType !== 'COTIZACION') {
      setOrders((prevOrders) =>
        prevOrders.map((ord) =>
          ord.id === targetOrderId
            ? {
                ...ord,
                status: 'FACTURADO',
                invoiceId: newInvoice.id,
                invoiceNumber: newInvoice.fullNumber,
              }
            : ord
        )
      );
      setPosInvoicingOrder(null);
      showToast(`Pedido ${targetOrderId} facturado con éxito con ${newInvoice.fullNumber}`, 'success');
    }

    // If customer paid on credit, update customer debt balance
    if (newInvoice.paymentMethod === 'CREDITO_CLIENTE') {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === newInvoice.customer.id
            ? { ...c, currentBalance: c.currentBalance + newInvoice.total }
            : c
        )
      );
    }
  };

  const handleUpdateInvoice = (updatedInvoice: Invoice) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updatedInvoice.id ? updatedInvoice : inv))
    );
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
    showToast('Comprobante eliminado del historial.', 'info');
  };

  const handleOpenInvoiceViewer = (invoice: Invoice) => {
    setSelectedInvoiceForView(invoice);
    setIsViewerModalOpen(true);
  };

  const handleConvertQuoteToInvoice = (quoteInvoice: Invoice) => {
    setIsViewerModalOpen(false);

    const customerMatch = allCustomers.find(
      (c) =>
        (quoteInvoice.customer?.docNumber && c.docNumber.trim() === quoteInvoice.customer.docNumber.trim()) ||
        c.id === quoteInvoice.customer?.id ||
        (quoteInvoice.customer?.name && c.name.trim().toLowerCase() === quoteInvoice.customer.name.trim().toLowerCase())
    );

    const targetCustomer: Customer = customerMatch || quoteInvoice.customer || CONSUMIDOR_FINAL;

    const newCartItems: CartItem[] = (quoteInvoice.items || []).map((item) => {
      const prod: Product = products.find((p) => p.id === item.productId) || {
        id: item.productId,
        sku: item.sku || 'COT-ITEM',
        barcode: '',
        name: item.productName,
        category: 'Materiales de Construcción',
        price: item.unitPrice,
        costPrice: item.unitPrice * 0.7,
        stock: 999,
        minStock: 1,
        unit: item.unit || 'UND',
        taxRate: item.taxRate ?? settings.defaultTaxRate,
        allowFractional: false,
      };

      const itemTaxRate = (typeof item.taxRate === 'number' ? item.taxRate : (typeof prod.taxRate === 'number' ? prod.taxRate : settings.defaultTaxRate)) / 100;
      const itemSubtotal = typeof item.subtotal === 'number' ? item.subtotal : (item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100));
      const itemTax = typeof item.taxAmount === 'number' ? item.taxAmount : (itemSubtotal * itemTaxRate);
      const itemTotal = typeof item.total === 'number' ? item.total : (itemSubtotal + itemTax);

      return {
        product: prod,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent || 0,
        subtotal: itemSubtotal,
        taxAmount: itemTax,
        total: itemTotal,
      };
    });

    setPosInitialCart(newCartItems);
    setPosInitialCustomer(targetCustomer);
    setPosDocumentType('FACTURA');
    setActiveTabState('CAJA');
    setIsTabLoading(true);
    setTimeout(() => {
      setIsTabLoading(false);
    }, 150);
    showToast('Cotización cargada en el Punto de Venta para facturar', 'info');
  };

  const handleInvoiceOrder = (order: Order) => {
    setPosInvoicingOrder(order);

    const customerMatch = allCustomers.find(
      (c) =>
        (order.customerRuc && c.docNumber.trim() === order.customerRuc.trim()) ||
        c.name.trim().toLowerCase() === order.customerName.trim().toLowerCase()
    );

    const targetCustomer: Customer = customerMatch || {
      id: `cust-${Date.now()}`,
      docType: order.customerRuc && order.customerRuc.length === 13 ? 'RUC' : 'C.I.',
      docNumber: order.customerRuc || '9999999999',
      name: order.customerName,
      creditLimit: 0,
      currentBalance: 0,
    };

    const newCartItems: CartItem[] = (order.items || []).map((item) => {
      const prod: Product = products.find((p) => p.id === item.productId) || {
        id: item.productId,
        sku: 'PED-ITEM',
        barcode: '',
        name: item.productName,
        category: 'Materiales de Construcción',
        price: item.unitPrice,
        costPrice: item.unitPrice * 0.7,
        stock: 999,
        minStock: 1,
        unit: 'UND' as const,
        taxRate: item.taxRate ?? 15,
        allowFractional: false,
      };

      const itemTaxRate = (typeof prod.taxRate === 'number' ? prod.taxRate : settings.defaultTaxRate) / 100;
      const itemSubtotal = item.qty * item.unitPrice;
      const itemTax = itemSubtotal * itemTaxRate;

      return {
        product: prod,
        quantity: item.qty,
        unitPrice: item.unitPrice,
        discountPercent: 0,
        subtotal: itemSubtotal,
        taxAmount: itemTax,
        total: itemSubtotal + itemTax,
      };
    });

    setPosInitialCart(newCartItems);
    setPosInitialCustomer(targetCustomer);
    setPosDocumentType('FACTURA');
    setActiveTabState('CAJA');
    setIsTabLoading(true);
    setTimeout(() => {
      setIsTabLoading(false);
    }, 150);
    showToast(`Pedido ${order.id} cargado en el Punto de Venta para facturar`, 'info');
  };

  const handleCreateCustomer = (newCustomer: Customer) => {
    setCustomers((prev) => {
      const existsIndex = prev.findIndex((c) => c.id === newCustomer.id);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = newCustomer;
        return updated;
      }
      return [newCustomer, ...prev];
    });
  };

  const handleBulkImportCustomers = (newCustomers: Customer[]) => {
    setCustomers((prev) => [...newCustomers, ...prev]);
  };

  const handleUpdateCustomerBalance = (customerId: string, amountPaid: number) => {
    if (customerId === 'cust-general') return;
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? { ...c, currentBalance: Math.max(0, c.currentBalance - amountPaid) }
          : c
      )
    );
  };

  const handleSaveProduct = (productToSave: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === productToSave.id);
      if (exists) {
        return prev.map((p) => (p.id === productToSave.id ? productToSave : p));
      } else {
        return [productToSave, ...prev];
      }
    });
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleStockAdjust = (productId: string, adjustmentQty: number) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, stock: Math.max(0, p.stock + adjustmentQty) } : p
      )
    );
  };

  const handleBulkImportProducts = (newProducts: Product[]) => {
    setProducts((prev) => [...newProducts, ...prev]);
  };

  const handleOpenCashRegister = (initialCash: number) => {
    const nowIso = new Date().toISOString();
    setCashSession({
      id: `session-${Date.now()}`,
      openedAt: nowIso,
      closedAt: undefined,
      initialCash,
      expectedCash: initialCash,
      status: 'ABIERTA',
      totalSalesCash: 0,
      totalSalesCard: 0,
      totalSalesTransfer: 0,
      totalSalesCredit: 0,
      totalInvoicesCount: 0,
    });
  };

  const handleCloseCashRegister = (actualCashCount: number) => {
    const openTime = cashSession.openedAt ? new Date(cashSession.openedAt).getTime() : Date.now();
    const sessionInvoices = invoices.filter((i) => {
      if (i.documentType === 'COTIZACION') return false;
      const invTime = new Date((i as any).date || i.createdAt || Date.now()).getTime();
      return invTime >= openTime;
    });

    const salesCash = sessionInvoices
      .filter((i) => i.paymentMethod === 'EFECTIVO' && i.paymentStatus === 'PAGADA')
      .reduce((sum, i) => sum + i.total, 0);

    const salesCard = sessionInvoices
      .filter((i) => (i.paymentMethod === 'TARJETA_DEBITO' || i.paymentMethod === 'TARJETA_CREDITO') && i.paymentStatus === 'PAGADA')
      .reduce((sum, i) => sum + i.total, 0);

    const salesTransfer = sessionInvoices
      .filter((i) => i.paymentMethod === 'TRANSFERENCIA' && i.paymentStatus === 'PAGADA')
      .reduce((sum, i) => sum + i.total, 0);

    const salesCredit = sessionInvoices
      .filter((i) => i.paymentMethod === 'CREDITO_CLIENTE')
      .reduce((sum, i) => sum + i.total, 0);

    const expected = cashSession.initialCash + salesCash;
    const difference = actualCashCount - expected;

    const closedSession = {
      ...cashSession,
      closedAt: new Date().toISOString(),
      actualCash: actualCashCount,
      expectedCash: expected,
      totalSalesCash: salesCash,
      totalSalesCard: salesCard,
      totalSalesTransfer: salesTransfer,
      totalSalesCredit: salesCredit,
      totalInvoicesCount: sessionInvoices.length,
      difference,
      status: 'CERRADA' as const,
    };

    setCashSession(closedSession);
    setCashSessionsHistory((prev) => [closedSession, ...(prev || [])]);
  };

  const handleClearAllData = async () => {
    try {
      const resetMap: Record<string, any> = {
        ferreteria_settings: initialStoreSettings,
        ferreteria_units: [
          { id: 'u-1', code: 'UND', name: 'Unidad', symbol: 'und', baseRatio: 1, category: 'CANTIDAD', fractional: false }
        ],
        ferreteria_products: initialProducts,
        ferreteria_customers: initialCustomers,
        ferreteria_invoices: initialInvoices,
        ferreteria_cash_session: {
          id: 'cash-0',
          openedAt: new Date().toISOString(),
          initialCash: 0,
          expectedCash: 0,
          status: 'CERRADA',
          totalSalesCash: 0,
          totalSalesTransfer: 0,
          totalSalesCard: 0,
          totalSalesCredit: 0,
          totalInvoicesCount: 0,
        },
        ferreteria_suppliers: [],
        ferreteria_purchases: [],
        ferreteria_purchase_orders: [],
        ferreteria_product_batches: [],
        ferreteria_suppliers_details: [],
        ferreteria_payables: [],
        ferreteria_supplier_payments: [],
        ferreteria_bank_accounts: [],
        ferreteria_bank_transactions: [],
        ferreteria_bank_deposits: [],
        ferreteria_petty_expenses: [],
        ferreteria_finance_assets: [],
        ferreteria_budget_categories: [],
        ferreteria_issued_checks: [],
        ferreteria_postdated_checks: [],
        ferreteria_card_reconciliations: [],
        ferreteria_journal_entries: [],
        ferreteria_account_plan: defaultAccountPlan,
        ferreteria_fiscal_periods: [],
        ferreteria_assets: [],
        ferreteria_asset_maintenances: [],
        ferreteria_asset_transfers: [],
        ferreteria_asset_classifications: defaultAssetClassifications,
        ferreteria_asset_areas: defaultAssetAreas,
        ferreteria_asset_locations: defaultAssetLocations,
        ferreteria_asset_history_logs: [],
        ferreteria_hr_departments: [],
        ferreteria_hr_positions: [],
        ferreteria_hr_employees: [],
        ferreteria_hr_payroll_roles: [],
        ferreteria_hr_incomes: [],
        ferreteria_hr_discounts: [],
        ferreteria_hr_vacations: [],
        ferreteria_hr_liquidations: [],
        ferreteria_hr_decimos: [],
        ferreteria_hr_novelties: [],
        ferreteria_orders: [],
        ferreteria_guias: [],
        ferreteria_credit_notes: [],
        ferreteria_retenciones: [],
        ferreteria_recetas: [],
        ferreteria_promotions: [],
        ferreteria_seller_goals: [],
        ferreteria_stock_adjustments: [],
        ferreteria_warranties: [],
        ferreteria_transfers: [],
        ferreteria_sellers: defaultSellers,
        ferreteria_settings_sri_mode: 'PRUEBAS',
        ferreteria_settings_establishment: '001',
        ferreteria_settings_emission_point: '001',
        ferreteria_settings_sec_invoice: '000000001',
        ferreteria_settings_sec_credit_note: '000000001',
        ferreteria_settings_sec_retention: '000000001',
        ferreteria_settings_users_list: defaultUsersList,
        ferreteria_settings_payment_methods: defaultPaymentMethods,
        ferreteria_settings_print_format: 'TICKET_80MM',
        ferreteria_settings_include_qr: true,
        ferreteria_settings_print_logo: true,
        ferreteria_settings_allow_negative_stock: false,
        ferreteria_settings_block_no_stock_sales: true,
        ferreteria_settings_min_stock_alert: true,
        ferreteria_settings_auto_session_timeout: '30',
      };

      for (const [key, val] of Object.entries(resetMap)) {
        try {
          localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        } catch {}
      }

      await fetch('/api/mongo/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: resetMap })
      });
    } catch (e) {
      console.error("Error clearing database: ", e);
    }

    localStorage.clear();
    window.location.reload();
  };

  if (isInitialLoading) {
    return (
      <SplashScreen 
        storeName={settings.storeName} 
        onComplete={() => setIsInitialLoading(false)} 
      />
    );
  }

  if (!currentUser) {
    return (
      <LoginView
        users={usersList}
        onLogin={handleLogin}
        storeName={settings.storeName}
        logoUrl={settings.logoUrl}
      />
    );
  }

  return (
    <PermissionsProvider currentUser={currentUser} usersList={usersList}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
        {/* Left Sidebar + Top Topbar (both fixed/sticky, rendered by Header) */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          settings={settings}
          lowStockCount={lowStockCount}
          isCashRegisterOpen={cashSession.status === 'ABIERTA'}
          cartItemCount={0}
          currentUser={currentUser}
          onLogout={() => setIsLogoutConfirmOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
        />

        {/* Main Container Content — offset by topbar (56px) and sidebar (dynamic) */}
        <main className={`pt-14 min-h-screen transition-all duration-200 ${sidebarCollapsed ? 'pl-14' : 'pl-56'}`}>
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
          {isTabLoading ? (
            <ModuleSkeleton />
          ) : (
            <AuthorizedTabContent activeTab={activeTab} setActiveTab={setActiveTab}>
          {(activeTab === 'CAJA') && (
            <BillingTerminal
              products={products}

            customers={allCustomers}
            settings={settings}
            categories={categories}
            promotions={promotions}
            onInvoiceCreated={handleInvoiceCreated}
            onUpdateInvoice={handleUpdateInvoice}
            onCreateCustomer={handleCreateCustomer}
            onOpenInvoiceViewer={handleOpenInvoiceViewer}
            establishment={establishment}
            emissionPoint={emissionPoint}
            secInvoice={secInvoice}
            setSecInvoice={setSecInvoice}
            secBoleta={secBoleta}
            setSecBoleta={setSecBoleta}
            secQuote={secQuote}
            setSecQuote={setSecQuote}
            initialDocumentType={posDocumentType}
            initialCartItems={posInitialCart}
            initialCustomer={posInitialCustomer}
            invoicingOrder={posInvoicingOrder}
            onCancelInvoicingOrder={() => setPosInvoicingOrder(null)}
            paymentMethods={paymentMethods}
            isCashRegisterOpen={cashSession.status === 'ABIERTA'}
            onOpenCashRegister={handleOpenCashRegister}
          />
        )}

        {(activeTab === 'FACTURAS' || activeTab === 'COTIZACIONES' || activeTab === 'HISTORIAL_FACTURAS' || activeTab === 'HISTORIAL_COTIZACIONES') && (
          <InvoiceHistory
            invoices={invoices}
            settings={settings}
            onOpenViewer={handleOpenInvoiceViewer}
            onConvertQuoteToInvoice={handleConvertQuoteToInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            initialDocType={activeTab === 'COTIZACIONES' || activeTab === 'HISTORIAL_COTIZACIONES' ? 'COTIZACION' : activeTab === 'FACTURAS' || activeTab === 'HISTORIAL_FACTURAS' ? 'FACTURA' : 'TODOS'}
            onNavigateToTab={handleNavigateToTab}
          />
        )}

        {[
          'PEDIDOS',
          'GUIA_REMISION',
          'DEVOLUCIONES',
          'NOTA_CREDITO',
          'COMPROBANTES_ELECTRONICOS',
          'RETENCION',
          'RECETAS_MEDICAS',
          'COMISIONES_METAS',
        ].includes(activeTab) && (
          <SalesModuleView
            subTab={activeTab as SalesSubTab}
            invoices={invoices}
            customers={allCustomers}
            products={products}
            settings={settings}
            onNavigateToTab={(tab) => {
              if (tab !== 'NOTA_CREDITO') {
                setPreselectedInvoiceForCreditNote(null);
              }
              setActiveTab(tab);
            }}
            onOpenViewer={handleOpenInvoiceViewer}
            onInvoiceOrder={handleInvoiceOrder}
            onUpdateInvoice={handleUpdateInvoice}
            onStockAdjust={handleStockAdjust}
            preselectedInvoice={preselectedInvoiceForCreditNote}
          />
        )}

        {[
          'INVENTORY',
          'INVENTARIO',
          'CATEGORIAS',
          'PROMOCIONES',
          'UNIDADES_MEDIDAS',
          'LOTES_VENCIMIENTOS',
          'CAMBIO_PRECIO_MASIVO',
          'AJUSTE_STOCK',
          'TRANSFERENCIAS',
          'ETIQUETAS',
          'KARDEX',
          'TOMA_FISICA'
        ].includes(activeTab) && (
          <InventoryModuleView
            subTab={(activeTab === 'INVENTORY' ? 'INVENTARIO' : activeTab) as InventorySubTab}
            products={products}
            settings={settings}
            units={units}
            onUpdateUnits={setUnits}
            categories={categories}
            onUpdateCategories={setCategories}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onStockAdjust={handleStockAdjust}
            onBulkImportProducts={handleBulkImportProducts}
          />
        )}

        {['CLIENTES', 'CUENTAS_POR_COBRAR'].includes(activeTab) && (
          <CustomerManager
            subTab={activeTab as CustomersSubTab}
            customers={dbCustomers}
            settings={settings}
            onCreateCustomer={handleCreateCustomer}
            onUpdateCustomerBalance={handleUpdateCustomerBalance}
            onBulkImportCustomers={handleBulkImportCustomers}
            isCashRegisterOpen={cashSession.status === 'ABIERTA'}
          />
        )}

        {['COMPRAS', 'HISTORIAL_COMPRAS', 'ORDENES_COMPRA', 'PRE_ORDENES'].includes(activeTab) && (
          <PurchasesManager
            subTab={activeTab as PurchasesSubTab}
            products={products}
            settings={settings}
            onSaveProduct={handleSaveProduct}
            onStockAdjust={handleStockAdjust}
            onSelectSubTab={(tab) => setActiveTab(tab)}
          />
        )}

        {['PROVEEDORES', 'CUENTAS_POR_PAGAR'].includes(activeTab) && (
          <SuppliersManager
            subTab={activeTab as SuppliersSubTab}
            settings={settings}
          />
        )}

        {['BANCOS', 'DEPOSITOS', 'CAJA_CHICA', 'ACTIVOS_FIJOS', 'PRESUPUESTO'].includes(activeTab) && (
          <FinanceManager
            subTab={activeTab as FinanceSubTab}
            settings={settings}
          />
        )}

        {[
          'CONTABILIDAD_RESUMEN',
          'CHEQUES_GIRADOS',
          'CONCILIACION_TARJETAS',
          'CONCILIACION_BANCARIA',
          'COMPROBANTE_INGRESO',
          'COMPROBANTE_EGRESO',
          'ASIENTOS',
          'MAYORES',
          'BALANCE_COMPROBACION',
          'ESTADO_SITUACION_FINANCIERA',
          'ESTADO_RESULTADO',
          'ATS',
          'PLAN_CUENTAS',
          'PARAMETRIZACION',
          'PERIODOS_FISCALES',
          'FORMULARIOS_DIMM',
          'CHEQUES_POSFECHADOS'
        ].includes(activeTab) && (
          <AccountingManager
            subTab={activeTab as AccountingSubTab}
            settings={settings}
          />
        )}

        {[
          'ACTIVOS_LISTA',
          'DEPRECIACIONES',
          'MANTENIMIENTOS',
          'TRANSFERENCIAS_ACTIVOS',
          'HISTORICOS_ACTIVOS',
          'AREAS_ACTIVOS',
          'CLASIFICACIONES_ACTIVOS',
          'UBICACIONES_ACTIVOS'
        ].includes(activeTab) && (
          <AssetsManager
            subTab={activeTab as AssetsSubTab}
            settings={settings}
          />
        )}

        {[
          'ROLES_PAGO',
          'OTROS_INGRESOS',
          'DESCUENTOS',
          'VACACIONES',
          'LIQUIDACIONES',
          'DECIMOS',
          'DEPARTAMENTOS_RRHH',
          'CARGOS_RRHH',
          'EMPLEADOS',
          'NOVEDADES_RRHH'
        ].includes(activeTab) && (
          <HRManager
            subTab={activeTab as HRSubTab}
            settings={settings}
          />
        )}

        {[
          'REP_VENTAS',
          'REP_PRODUCTOS',
          'REP_INVENTARIO',
          'REP_CAJA',
          'REP_COMPRAS',
          'REP_COMISIONES',
          'REP_ATS',
          'REP_FORMULARIO_104',
          'REP_FORMULARIO_103',
          'REP_RENTABILIDAD',
          'REP_STOCK_MUERTO',
          'REP_NOMINA',
          'REP_DEVOLUCIONES',
          'REP_ROTACION',
          'REP_FLUJO_CAJA'
        ].includes(activeTab) && (
          <ReportsManager
            subTab={activeTab as ReportsSubTab}
            settings={settings}
          />
        )}




        {activeTab === 'CASH_REGISTER' && (
          <CashRegisterView
            session={cashSession}
            invoices={invoices}
            settings={settings}
            onOpenRegister={handleOpenCashRegister}
            onCloseRegister={handleCloseCashRegister}
          />
        )}

        {([
          'SETTINGS',
          'CFG_EMPRESA',
          'CFG_FIRMA_ELECTRONICA',
          'CFG_PUNTO_EMISION',
          'CFG_IMPUESTOS',
          'CFG_CAJA',
          'CFG_FORMAS_PAGO',
          'CFG_USUARIOS',
          'CFG_FORMATO_IMPRESION',
          'CFG_ADMINISTRACION',
          'CFG_BACKUP'
        ].includes(activeTab)) && (
          <SettingsManager 
            subTab={activeTab as SettingsSubTab | 'SETTINGS'} 
            settings={settings} 
            onSaveSettings={setSettings} 
            onClearAllData={handleClearAllData}
            usersList={usersList}
            setUsersList={setUsersList}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
          />
        )}
            </AuthorizedTabContent>
        )}

        </div>
      </main>

      {/* Printable Invoice Viewer Modal */}
      <InvoiceViewerModal
        isOpen={isViewerModalOpen}
        onClose={() => setIsViewerModalOpen(false)}
        invoice={selectedInvoiceForView}
        settings={settings}
        onConvertQuoteToInvoice={handleConvertQuoteToInvoice}
        onUpdateInvoice={handleUpdateInvoice}
        onStockAdjust={handleStockAdjust}
        onOpenCreditNote={handleOpenCreditNoteForInvoice}
      />

      {/* Logout Confirmation Modal */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl ring-1 ring-slate-900/10 p-6 space-y-5 animate-scaleUp text-center">
            <div className="mx-auto w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center text-rose-600 shadow-2xs">
              <LogOut className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-950">
                ¿Seguro que deseas cerrar sesión?
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Estás a punto de salir de la cuenta de{' '}
                <strong className="text-slate-800">{currentUser?.name || currentUser?.username || 'Usuario'}</strong>.
                Asegúrate de haber guardado tus cambios o cerrado tu turno de caja.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Sí, Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PermissionsProvider>
  );
}

