import React, { useState, useEffect } from 'react';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
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

export default function App() {
  const { showAlert, showToast } = useModal();
  const [activeTab, setActiveTabState] = useState<TabType>('CAJA');
  const [posDocumentType, setPosDocumentType] = useState<DocumentType>('FACTURA');
  const [blockerInitialCash, setBlockerInitialCash] = useState('500');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // Active Invoice Viewer Modal State
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);

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
    setCashSession({
      id: `session-${Date.now()}`,
      openedAt: new Date().toISOString(),
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

  const handleClearAllData = async () => {
    try {
      const resetJobs = [
        setDoc(doc(db, 'app_state', 'ferreteria_settings'), { data: initialStoreSettings }),
        setDoc(doc(db, 'app_state', 'ferreteria_units'), { data: [
          { id: 'u-1', code: 'UND', name: 'Unidad', symbol: 'und', baseRatio: 1, category: 'CANTIDAD', fractional: false }
        ] }),
        setDoc(doc(db, 'app_state', 'ferreteria_products'), { data: initialProducts }),
        setDoc(doc(db, 'app_state', 'ferreteria_customers'), { data: initialCustomers }),
        setDoc(doc(db, 'app_state', 'ferreteria_invoices'), { data: initialInvoices }),
        setDoc(doc(db, 'app_state', 'ferreteria_cash_session'), { data: {
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
        } }),
        setDoc(doc(db, 'app_state', 'ferreteria_suppliers'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_purchases'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_purchase_orders'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_product_batches'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_suppliers_details'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_payables'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_supplier_payments'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_bank_accounts'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_bank_transactions'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_bank_deposits'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_petty_expenses'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_finance_assets'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_budget_categories'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_issued_checks'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_postdated_checks'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_card_reconciliations'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_journal_entries'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_account_plan'), { data: defaultAccountPlan }),
        setDoc(doc(db, 'app_state', 'ferreteria_fiscal_periods'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_assets'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_asset_maintenances'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_asset_transfers'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_asset_classifications'), { data: defaultAssetClassifications }),
        setDoc(doc(db, 'app_state', 'ferreteria_asset_areas'), { data: defaultAssetAreas }),
        setDoc(doc(db, 'app_state', 'ferreteria_asset_locations'), { data: defaultAssetLocations }),
        setDoc(doc(db, 'app_state', 'ferreteria_asset_history_logs'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_departments'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_positions'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_employees'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_payroll_roles'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_incomes'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_discounts'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_vacations'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_liquidations'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_decimos'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_hr_novelties'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_orders'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_guias'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_credit_notes'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_retenciones'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_recetas'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_promotions'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_seller_goals'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_stock_adjustments'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_warranties'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_transfers'), { data: [] }),
        setDoc(doc(db, 'app_state', 'ferreteria_sellers'), { data: defaultSellers }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_sri_mode'), { data: 'PRUEBAS' }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_establishment'), { data: '001' }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_emission_point'), { data: '001' }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_sec_invoice'), { data: '000000001' }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_sec_credit_note'), { data: '000000001' }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_sec_retention'), { data: '000000001' }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_users_list'), { data: defaultUsersList }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_payment_methods'), { data: defaultPaymentMethods }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_print_format'), { data: 'TICKET_80MM' }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_include_qr'), { data: true }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_print_logo'), { data: true }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_allow_negative_stock'), { data: false }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_block_no_stock_sales'), { data: true }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_min_stock_alert'), { data: true }),
        setDoc(doc(db, 'app_state', 'ferreteria_settings_auto_session_timeout'), { data: '30' }),
      ];

      await Promise.all(resetJobs);
    } catch (e) {
      console.error("Error clearing Firestore database: ", e);
    }

    localStorage.clear();
    window.location.reload();
  };

  const handleCloseCashRegister = (actualCashCount: number) => {
    const expected = cashSession.initialCash + cashSession.totalSalesCash;
    const difference = actualCashCount - expected;

    setCashSession((prev) => ({
      ...prev,
      closedAt: new Date().toISOString(),
      actualCash: actualCashCount,
      difference,
      status: 'CERRADA',
    }));
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
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main Container Content — offset by topbar (56px) and sidebar (dynamic) */}
      <main className={`pt-14 min-h-screen transition-all duration-200 ${sidebarCollapsed ? 'pl-14' : 'pl-52'}`}>
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
        {isTabLoading ? (
          <ModuleSkeleton />
        ) : (
          <>
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
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onOpenViewer={handleOpenInvoiceViewer}
            onInvoiceOrder={handleInvoiceOrder}
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
          />
        )}
          </>
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
  );
}
