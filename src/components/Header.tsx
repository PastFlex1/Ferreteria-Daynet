import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Package, 
  FileText, 
  Users, 
  DollarSign, 
  Settings, 
  Wrench, 
  Store,
  AlertTriangle,
  Clock,
  ChevronDown,
  Receipt,
  PackageCheck,
  Truck,
  ClipboardList,
  Calculator,
  FileSpreadsheet,
  RotateCcw,
  FileX,
  CreditCard,
  Send,
  Percent,
  Stethoscope,
  Target,
  TrendingUp,
  UploadCloud,
  BadgeDollarSign,
  Tag,
  Scale,
  Calendar,
  Sliders,
  ArrowLeftRight,
  Barcode,
  ClipboardCheck,
  RefreshCw,
  Boxes,
  ShoppingBag,
  ListOrdered,
  FileCheck2,
  Building2,
  Landmark,
  PiggyBank,
  Coins,
  Briefcase,
  PieChart,
  BookOpen,
  FolderTree,
  TrendingDown,
  ArrowRightLeft,
  History,
  Building,
  FolderGit2,
  MapPin,
  Sun,
  Award,
  AlertCircle,
  BarChart3,
  Archive,
  Activity,
  Database,
  Printer,
  Layers,
  Key,
  LogOut,
  X,
  ChevronRight
} from 'lucide-react';
import { CustomersSubTab, InventorySubTab, PurchasesSubTab, SalesSubTab, SuppliersSubTab, FinanceSubTab, AccountingSubTab, AssetsSubTab, HRSubTab, ReportsSubTab, SettingsSubTab, StoreSettings, TabType } from '../types';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  settings: StoreSettings;
  lowStockCount: number;
  isCashRegisterOpen: boolean;
  cartItemCount: number;
  currentUser?: any;
  onLogout?: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

type ModuleId = 'VENTAS' | 'CLIENTES' | 'INVENTARIO' | 'COMPRAS' | 'PROVEEDORES' | 'FINANZAS' | 'CONTABILIDAD' | 'ACTIVOS' | 'RRHH' | 'REPORTES' | 'CONFIGURACION';

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  lowStockCount,
  isCashRegisterOpen,
  cartItemCount,
  currentUser,
  onLogout,
  onCollapsedChange,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ─── Sub-tab definitions ─────────────────────────────────────────────────────
  const salesSubTabs: { id: SalesSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'CAJA',                    label: 'Caja',                    icon: <ShoppingCart className="w-3.5 h-3.5" /> },
    { id: 'FACTURAS',                label: 'Facturas',                icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'PEDIDOS',                 label: 'Pedidos',                 icon: <PackageCheck className="w-3.5 h-3.5" /> },
    { id: 'GUIA_REMISION',           label: 'Guía de Remisión',        icon: <Truck className="w-3.5 h-3.5" /> },
    { id: 'COTIZACIONES',            label: 'Cotizaciones',            icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: 'DEVOLUCIONES',            label: 'Devueltas (SRI)',         icon: <RotateCcw className="w-3.5 h-3.5" /> },
    { id: 'NOTA_CREDITO',            label: 'Nota de Crédito',         icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'COMPROBANTES_ELECTRONICOS', label: 'Comp. Electrónicos',   icon: <Send className="w-3.5 h-3.5" /> },
    { id: 'RETENCION',               label: 'Retención',               icon: <Percent className="w-3.5 h-3.5" /> },
    { id: 'RECETAS_MEDICAS',         label: 'Recetas Médicas',         icon: <Stethoscope className="w-3.5 h-3.5" /> },
    { id: 'COMISIONES_METAS',        label: 'Comisiones / Metas',      icon: <Target className="w-3.5 h-3.5" /> },
  ];

  const customerSubTabs: { id: CustomersSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'CLIENTES',           label: 'Clientes',           icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'CUENTAS_POR_COBRAR', label: 'Cuentas por Cobrar', icon: <BadgeDollarSign className="w-3.5 h-3.5" /> },
  ];

  const inventorySubTabs: { id: InventorySubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'INVENTARIO',          label: 'Inventario',           icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'CATEGORIAS',          label: 'Categorías',           icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'PROMOCIONES',         label: 'Promociones',          icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'UNIDADES_MEDIDAS',    label: 'Unidades de Medidas',  icon: <Scale className="w-3.5 h-3.5" /> },
    { id: 'LOTES_VENCIMIENTOS',  label: 'Lotes / Vencimientos', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'CAMBIO_PRECIO_MASIVO', label: 'Cambio Precio Masivo', icon: <RefreshCw className="w-3.5 h-3.5" /> },
    { id: 'AJUSTE_STOCK',        label: 'Ajuste de Stock',      icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'TRANSFERENCIAS',      label: 'Transferencias',       icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
    { id: 'ETIQUETAS',           label: 'Etiquetas',            icon: <Barcode className="w-3.5 h-3.5" /> },
    { id: 'KARDEX',              label: 'Kardex',               icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: 'TOMA_FISICA',         label: 'Toma Física',          icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
  ];

  const purchasesSubTabs: { id: PurchasesSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'COMPRAS',       label: 'Compras',          icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: 'ORDENES_COMPRA', label: 'Órdenes de Compra', icon: <ListOrdered className="w-3.5 h-3.5" /> },
    { id: 'PRE_ORDENES',   label: 'Pre-Órdenes',      icon: <FileCheck2 className="w-3.5 h-3.5" /> },
  ];

  const suppliersSubTabs: { id: SuppliersSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'PROVEEDORES',      label: 'Proveedores',      icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'CUENTAS_POR_PAGAR', label: 'Cuentas por Pagar', icon: <CreditCard className="w-3.5 h-3.5" /> },
  ];

  const financeSubTabs: { id: FinanceSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'BANCOS',      label: 'Bancos',       icon: <Landmark className="w-3.5 h-3.5" /> },
    { id: 'DEPOSITOS',   label: 'Depósitos',    icon: <PiggyBank className="w-3.5 h-3.5" /> },
    { id: 'CAJA_CHICA',  label: 'Caja Chica',   icon: <Coins className="w-3.5 h-3.5" /> },
    { id: 'ACTIVOS_FIJOS', label: 'Activos Fijos', icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'PRESUPUESTO', label: 'Presupuesto',  icon: <PieChart className="w-3.5 h-3.5" /> },
  ];

  const accountingSubTabs: { id: AccountingSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'CONTABILIDAD_RESUMEN',        label: 'Contabilidad',               icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'CHEQUES_GIRADOS',             label: 'Cheques Girados',            icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'CONCILIACION_TARJETAS',       label: 'Concil. Tarjetas',           icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'CONCILIACION_BANCARIA',       label: 'Concil. Bancaria',           icon: <Landmark className="w-3.5 h-3.5" /> },
    { id: 'COMPROBANTE_INGRESO',         label: 'Comp. Ingreso',              icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'COMPROBANTE_EGRESO',          label: 'Comp. Egreso',               icon: <FileX className="w-3.5 h-3.5" /> },
    { id: 'ASIENTOS',                    label: 'Asientos',                   icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: 'MAYORES',                     label: 'Mayores',                    icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
    { id: 'BALANCE_COMPROBACION',        label: 'Balance Comprobación',       icon: <Scale className="w-3.5 h-3.5" /> },
    { id: 'ESTADO_SITUACION_FINANCIERA', label: 'Est. Situación Financiera',  icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'ESTADO_RESULTADO',            label: 'Estado de Resultado',        icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'ATS',                         label: 'ATS',                        icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
    { id: 'PLAN_CUENTAS',                label: 'Plan de Cuentas',            icon: <FolderTree className="w-3.5 h-3.5" /> },
    { id: 'PARAMETRIZACION',             label: 'Parametrización',            icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'PERIODOS_FISCALES',           label: 'Períodos Fiscales',          icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'FORMULARIOS_DIMM',            label: 'Formularios DIMM',           icon: <FileCheck2 className="w-3.5 h-3.5" /> },
    { id: 'CHEQUES_POSFECHADOS',         label: 'Cheques Posfechados',        icon: <Clock className="w-3.5 h-3.5" /> },
  ];

  const assetsSubTabs: { id: AssetsSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ACTIVOS_LISTA',          label: 'Activos',         icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'DEPRECIACIONES',         label: 'Depreciaciones',  icon: <TrendingDown className="w-3.5 h-3.5" /> },
    { id: 'MANTENIMIENTOS',         label: 'Mantenimientos',  icon: <Wrench className="w-3.5 h-3.5" /> },
    { id: 'TRANSFERENCIAS_ACTIVOS', label: 'Transferencias',  icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
    { id: 'HISTORICOS_ACTIVOS',     label: 'Históricos',      icon: <History className="w-3.5 h-3.5" /> },
    { id: 'AREAS_ACTIVOS',          label: 'Áreas',           icon: <Building className="w-3.5 h-3.5" /> },
    { id: 'CLASIFICACIONES_ACTIVOS', label: 'Clasificaciones', icon: <FolderGit2 className="w-3.5 h-3.5" /> },
    { id: 'UBICACIONES_ACTIVOS',    label: 'Ubicaciones',     icon: <MapPin className="w-3.5 h-3.5" /> },
  ];

  const hrSubTabs: { id: HRSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ROLES_PAGO',       label: 'Roles de Pago',    icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'OTROS_INGRESOS',   label: 'Otros Ingresos',   icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'DESCUENTOS',       label: 'Descuentos',       icon: <Percent className="w-3.5 h-3.5" /> },
    { id: 'VACACIONES',       label: 'Vacaciones',       icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'LIQUIDACIONES',    label: 'Liquidaciones',    icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
    { id: 'DECIMOS',          label: 'Décimos',          icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'DEPARTAMENTOS_RRHH', label: 'Departamentos',  icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'CARGOS_RRHH',      label: 'Cargos',           icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'EMPLEADOS',        label: 'Empleados',        icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'NOVEDADES_RRHH',   label: 'Novedades',        icon: <AlertCircle className="w-3.5 h-3.5" /> },
  ];

  const reportsSubTabs: { id: ReportsSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'REP_VENTAS',         label: 'Ventas',            icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'REP_PRODUCTOS',      label: 'Productos',         icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: 'REP_INVENTARIO',     label: 'Inventario',        icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'REP_CAJA',           label: 'Caja',              icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'REP_COMPRAS',        label: 'Compras',           icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'REP_COMISIONES',     label: 'Comisiones',        icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'REP_ATS',            label: 'ATS',               icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'REP_FORMULARIO_104', label: 'Formulario 104',    icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: 'REP_FORMULARIO_103', label: 'Formulario 103',    icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
    { id: 'REP_RENTABILIDAD',   label: 'Rentabilidad',      icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'REP_STOCK_MUERTO',   label: 'Stock Muerto',      icon: <Archive className="w-3.5 h-3.5" /> },
    { id: 'REP_NOMINA',         label: 'Nómina',            icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'REP_DEVOLUCIONES',   label: 'Devueltas (SRI)',   icon: <RotateCcw className="w-3.5 h-3.5" /> },
    { id: 'REP_ROTACION',       label: 'Rotación',          icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'REP_FLUJO_CAJA',     label: 'Flujo de Caja',     icon: <DollarSign className="w-3.5 h-3.5" /> },
  ];

  const settingsSubTabs: { id: SettingsSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'CFG_EMPRESA',           label: 'Empresa',             icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'CFG_FIRMA_ELECTRONICA', label: 'Firma Electrónica',   icon: <Key className="w-3.5 h-3.5" /> },
    { id: 'CFG_PUNTO_EMISION',     label: 'Punto de Emisión',    icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'CFG_IMPUESTOS',         label: 'Impuestos',           icon: <Percent className="w-3.5 h-3.5" /> },
    { id: 'CFG_CAJA',              label: 'Caja',                icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'CFG_FORMAS_PAGO',       label: 'Formas de Pago',      icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'CFG_USUARIOS',          label: 'Usuarios',            icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'CFG_FORMATO_IMPRESION', label: 'Formato Impresión',   icon: <Printer className="w-3.5 h-3.5" /> },
    { id: 'CFG_ADMINISTRACION',    label: 'Administración',      icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'CFG_BACKUP',            label: 'Backup',              icon: <Database className="w-3.5 h-3.5" /> },
  ];

  // ─── Module map ──────────────────────────────────────────────────────────────
  const modules: {
    id: ModuleId;
    label: string;
    icon: React.ReactNode;
    items: { id: string; label: string; icon: React.ReactNode }[];
    accentClass: string;
    badge?: number;
  }[] = [
    { id: 'VENTAS',       label: 'Ventas',       icon: <TrendingUp className="w-4 h-4" />,  items: salesSubTabs,      accentClass: 'text-orange-400', badge: cartItemCount || undefined },
    { id: 'CLIENTES',     label: 'Clientes',     icon: <Users className="w-4 h-4" />,        items: customerSubTabs,   accentClass: 'text-orange-400' },
    { id: 'INVENTARIO',   label: 'Inventario',   icon: <Package className="w-4 h-4" />,      items: inventorySubTabs,  accentClass: 'text-orange-400', badge: lowStockCount || undefined },
    { id: 'COMPRAS',      label: 'Compras',      icon: <ShoppingBag className="w-4 h-4" />, items: purchasesSubTabs,  accentClass: 'text-orange-400' },
    { id: 'PROVEEDORES',  label: 'Proveedores',  icon: <Building2 className="w-4 h-4" />,   items: suppliersSubTabs,  accentClass: 'text-orange-400' },
    { id: 'FINANZAS',     label: 'Finanzas',     icon: <Landmark className="w-4 h-4" />,     items: financeSubTabs,    accentClass: 'text-emerald-400' },
    { id: 'CONTABILIDAD', label: 'Contabilidad', icon: <BookOpen className="w-4 h-4" />,     items: accountingSubTabs, accentClass: 'text-indigo-400' },
    { id: 'ACTIVOS',      label: 'Activos',      icon: <Briefcase className="w-4 h-4" />,    items: assetsSubTabs,     accentClass: 'text-amber-400' },
    { id: 'RRHH',         label: 'RRHH',         icon: <Users className="w-4 h-4" />,        items: hrSubTabs,         accentClass: 'text-cyan-400' },
    { id: 'REPORTES',     label: 'Reportes',     icon: <BarChart3 className="w-4 h-4" />,    items: reportsSubTabs,    accentClass: 'text-emerald-400' },
    { id: 'CONFIGURACION', label: 'Configuración', icon: <Settings className="w-4 h-4" />,  items: settingsSubTabs,   accentClass: 'text-slate-400' },
  ];

  // Determine which module is active based on current tab
  const activeModule = modules.find(m => m.items.some(i => i.id === activeTab));

  // Open the active module by default; allow manual toggling
  const [openModule, setOpenModule] = useState<ModuleId | null>(
    (activeModule?.id ?? null) as ModuleId | null
  );

  // Keep open module in sync when navigating programmatically
  useEffect(() => {
    if (activeModule && openModule !== activeModule.id) {
      setOpenModule(activeModule.id as ModuleId);
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNavClick = (tab: TabType) => {
    setActiveTab(tab);
  };

  const toggleModule = (id: ModuleId) => {
    setOpenModule(prev => (prev === id ? null : id));
  };

  return (
    <>
      {/* ── Top Topbar ───────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950 border-b border-slate-800/80 shadow-xl h-14 flex items-center px-4 gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          {settings.logoUrl ? (
            <div className="p-1 bg-white rounded-xl shadow-md border border-slate-700 flex items-center justify-center shrink-0">
              <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            </div>
          ) : (
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl blur-xs opacity-75 group-hover:opacity-100 transition duration-200" />
              <div className="relative p-2 bg-slate-900 text-orange-400 rounded-xl font-black flex items-center justify-center border border-orange-500/30">
                <Wrench className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
          )}
          <div>
            <h1 className="text-base font-black tracking-tight text-white">
              {settings.storeName.toUpperCase().includes('DAYNET') ? (
                <span>FERRETERÍA <span className="text-orange-500">DAYNET</span></span>
              ) : (
                <span>{settings.storeName}</span>
              )}
            </h1>
            <p className="text-[10px] text-slate-500 font-mono leading-none mt-0.5">{settings.taxId}</p>
          </div>
          <span className="hidden sm:flex text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 items-center gap-1">
            <Store className="w-2.5 h-2.5" />
            ERP Ferretero
          </span>
        </div>

        <div className="flex-1" />

        {/* Right-side status pills */}
        <div className="flex items-center gap-2 shrink-0">
          {lowStockCount > 0 && (
            <button
              onClick={() => setActiveTab('INVENTARIO' as TabType)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">{lowStockCount} Bajo Stock</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('CASH_REGISTER')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              isCashRegisterOpen
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isCashRegisterOpen ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isCashRegisterOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </span>
            <span>{isCashRegisterOpen ? 'Caja Abierta' : 'Caja Cerrada'}</span>
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span>{currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          {currentUser && (
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[11px] font-black text-white leading-tight">{currentUser.name}</span>
                <span className="text-[9px] font-black text-orange-400 uppercase tracking-wider">{currentUser.role}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center justify-center p-2 bg-slate-900 border border-slate-800 hover:bg-rose-500/10 hover:border-rose-500/30 rounded-xl text-slate-400 transition cursor-pointer group"
                title="Cerrar Sesión"
              >
                <LogOut className="w-3.5 h-3.5 group-hover:text-rose-400 transition-colors" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Left Sidebar (accordion) ─────────────────────────────────────────── */}
      <aside
        className={`fixed top-14 left-0 bottom-0 z-30 bg-slate-950 border-r border-slate-800/80 flex flex-col shadow-2xl transition-all duration-200 ${
          sidebarCollapsed ? 'w-14' : 'w-52'
        }`}
      >
        {/* Collapse toggle */}
        <div className="flex items-center justify-end px-2 py-2 border-b border-slate-800/60 shrink-0">
          <button
            onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              onCollapsedChange?.(next);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {sidebarCollapsed
              ? <ChevronRight className="w-4 h-4" />
              : <X className="w-4 h-4" />}
          </button>
        </div>

        {/* Accordion nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-2">
          {modules.map((mod) => {
            const isModuleActive = mod.items.some(i => i.id === activeTab);
            const isOpen = openModule === mod.id;

            return (
              <div key={mod.id}>
                {/* Module header button */}
                <button
                  onClick={() => {
                    if (!sidebarCollapsed) toggleModule(mod.id);
                    else {
                      // when collapsed, just open the first subtab
                      setSidebarCollapsed(false);
                      setOpenModule(mod.id);
                    }
                  }}
                  title={sidebarCollapsed ? mod.label : undefined}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150 cursor-pointer
                    ${isModuleActive
                      ? 'bg-orange-500/15 text-white border-l-2 border-orange-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border-l-2 border-transparent'
                    }`}
                >
                  <span className={`shrink-0 ${isModuleActive ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {mod.icon}
                  </span>

                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left text-[11px] font-black uppercase tracking-wider truncate">
                        {mod.label}
                      </span>
                      {mod.badge !== undefined && mod.badge > 0 && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                          {mod.badge}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${
                          isModuleActive ? 'text-orange-400' : 'text-slate-600'
                        }`}
                      />
                    </>
                  )}
                </button>

                {/* Submenu items (accordion) */}
                {isOpen && !sidebarCollapsed && (
                  <div className="bg-slate-900/40 border-l-2 border-orange-500/20 ml-2 mr-1 mb-1 rounded-r-xl overflow-hidden">
                    {mod.items.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id as TabType)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-100 cursor-pointer
                            ${isActive
                              ? 'bg-orange-500/20 text-orange-300 font-black'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                          <span className={`shrink-0 ${isActive ? 'text-orange-400' : 'text-slate-600'}`}>
                            {item.icon}
                          </span>
                          <span className="text-[11px] font-bold truncate">{item.label}</span>
                          {isActive && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Arqueo de Caja — direct link, same style as module buttons */}
          <button
            onClick={() => handleNavClick('CASH_REGISTER')}
            title={sidebarCollapsed ? 'Arqueo de Caja' : undefined}
            className={`group w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150 cursor-pointer border-l-2
              ${activeTab === 'CASH_REGISTER'
                ? 'bg-orange-500/15 text-white border-orange-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border-transparent'
              }`}
          >
            <DollarSign className={`shrink-0 w-4 h-4 ${activeTab === 'CASH_REGISTER' ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left text-[11px] font-black uppercase tracking-wider">Arqueo de Caja</span>
              </>
            )}
          </button>
        </nav>

        {/* Bottom store address & branding/support info */}
        {!sidebarCollapsed ? (
          <div className="px-3 py-2.5 border-t border-slate-800/80 bg-slate-950/40 shrink-0 space-y-1">
            {settings.address && (
              <p className="text-[9px] text-slate-500 truncate font-medium">{settings.address}</p>
            )}
            <div className="pt-1 border-t border-slate-800/50 flex items-center justify-between text-[9px]">
              <span className="font-semibold text-slate-400">Palma Nexus Solutions</span>
              <a 
                href="tel:0998212307" 
                className="font-mono text-orange-400 font-bold hover:text-orange-300 transition"
                title="Llamar / Contactar Soporte"
              >
                099 821 2307
              </a>
            </div>
          </div>
        ) : (
          <div className="p-2 border-t border-slate-800/60 text-center shrink-0" title="Palma Nexus Solutions: 099 821 2307">
            <span className="text-[8px] font-bold text-slate-500 font-mono">PNS</span>
          </div>
        )}
      </aside>
    </>
  );
};
