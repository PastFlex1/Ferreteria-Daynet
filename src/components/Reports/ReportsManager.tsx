import React, { useState, useMemo } from 'react';
import { useModal } from '../../context/ModalContext';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { Invoice, Product, ProductCategory, ReportsSubTab, StoreSettings } from '../../types';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { CustomSelect } from '../CustomSelect';
import { exportToModernExcel } from '../../utils/excelExport';
import { formatCurrency } from '../../utils/formatters';
import { generateAtsXml } from '../../services/sriAtsService';
import { downloadXML } from '../../services/sriXmlService';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Printer, 
  Search, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  Package, 
  CreditCard, 
  Receipt, 
  Award, 
  FileText, 
  Calculator, 
  Users, 
  RotateCcw, 
  Activity, 
  Percent, 
  CheckCircle2, 
  Clock, 
  Archive, 
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  Building2,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  PieChart as PieChartIcon,
  Sparkles,
  Layers,
  Store,
  X,
  UserCheck,
  Eye,
  ArrowLeftRight
} from 'lucide-react';
import { defaultEmployees, defaultUsersList } from '../../data/initialData';

interface ReportsManagerProps {
  subTab: ReportsSubTab;
  settings: StoreSettings;
}

// Executive Color Palette with HSL Precision
const CHART_PALETTE = [
  '#f97316', // Orange
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#eab308', // Amber
  '#6366f1'  // Indigo
];

// Custom High-End Tooltip for Recharts
const CustomChartTooltip = ({ active, payload, label, prefix = '$', isCurrency = true }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 ring-1 ring-white/10 text-xs min-w-[160px] animate-fadeIn">
        <div className="font-bold text-slate-400 text-[11px] pb-1.5 mb-1.5 border-b border-slate-800/80 flex items-center justify-between">
          <span>{label || payload[0]?.name || 'Detalle'}</span>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0]?.color || '#f97316' }} />
        </div>
        <div className="space-y-1.5 font-mono">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="text-slate-300 text-[11px] font-sans flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                {entry.name}:
              </span>
              <span className="font-black text-white text-xs">
                {isCurrency ? `$ ${Number(entry.value).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const ReportsManager: React.FC<ReportsManagerProps> = ({ subTab, settings }) => {
  const { showAlert, showToast } = useModal();

  // Firestore Data Collections
  const [invoices] = useFirestoreSync<Invoice[]>('ferreteria_invoices', []);
  const [products] = useFirestoreSync<Product[]>('ferreteria_products', []);
  const [categories] = useFirestoreSync<ProductCategory[]>('ferreteria_categories', []);
  const [purchases] = useFirestoreSync<any[]>('ferreteria_purchases', []);
  const [creditNotes] = useFirestoreSync<any[]>('ferreteria_credit_notes', []);
  const [sellers] = useFirestoreSync<any[]>('ferreteria_sellers', []);
  const [sellerGoals] = useFirestoreSync<any[]>('ferreteria_seller_goals', []);
  const [employees] = useFirestoreSync<any[]>('ferreteria_hr_employees', defaultEmployees);
  const [usersList] = useFirestoreSync<any[]>('ferreteria_settings_users_list', defaultUsersList);
  const [payrollRoles] = useFirestoreSync<any[]>('ferreteria_hr_payroll_roles', []);
  const [cashSession] = useFirestoreSync<any>('ferreteria_cash_session', null);
  const [cashSessionsHistory] = useFirestoreSync<any[]>('ferreteria_cash_sessions_history', []);
  const [retenciones] = useFirestoreSync<any[]>('ferreteria_retenciones', []);
  const [bankAccounts] = useFirestoreSync<any[]>('ferreteria_bank_accounts', []);

  // Caja / Arqueo specific states
  const [cajaWorkerFilter, setCajaWorkerFilter] = useState<string>('TODOS');
  const [cajaPaymentFilter, setCajaPaymentFilter] = useState<string>('TODOS');
  const [cajaActiveTab, setCajaActiveTab] = useState<'TRABAJADORES' | 'COMPROBANTES' | 'HISTORIAL'>('TRABAJADORES');
  const [cajaSearchTerm, setCajaSearchTerm] = useState<string>('');
  const [selectedWorkerVouchersModal, setSelectedWorkerVouchersModal] = useState<any | null>(null);
  const [printingWorkerArqueo, setPrintingWorkerArqueo] = useState<any | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);
  const [selectedBranch, setSelectedBranch] = useState('TODAS');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  // Quick Date Presets
  const handleSetPreset = (preset: 'HOY' | 'ESTA_SEMANA' | 'MES_ACTUAL' | 'MES_ANTERIOR' | 'ANIO_ACTUAL') => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'HOY') {
      const t = fmt(today);
      setStartDate(t);
      setEndDate(t);
    } else if (preset === 'ESTA_SEMANA') {
      const dayOfWeek = today.getDay(); // 0 is Sunday
      const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today.getFullYear(), today.getMonth(), diffToMonday);
      const sunday = new Date(today.getFullYear(), today.getMonth(), diffToMonday + 6);
      setStartDate(fmt(monday));
      setEndDate(fmt(sunday));
    } else if (preset === 'MES_ACTUAL') {
      setStartDate(fmt(new Date(today.getFullYear(), today.getMonth(), 1)));
      setEndDate(fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
    } else if (preset === 'MES_ANTERIOR') {
      setStartDate(fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)));
      setEndDate(fmt(new Date(today.getFullYear(), today.getMonth(), 0)));
    } else if (preset === 'ANIO_ACTUAL') {
      setStartDate(fmt(new Date(today.getFullYear(), 0, 1)));
      setEndDate(fmt(new Date(today.getFullYear(), 11, 31)));
    }
  };

  // Metadatos de cada SubTab
  const reportMetadata: Record<ReportsSubTab, { title: string; subtitle: string; icon: React.ReactNode; color: string }> = {
    REP_VENTAS: {
      title: 'Reporte Consolidado de Ventas',
      subtitle: 'Historial de facturación, desglose tributario, clientes y formas de pago',
      icon: <BarChart3 className="w-5 h-5 text-orange-500" />,
      color: 'from-orange-500 to-amber-500'
    },
    REP_PRODUCTOS: {
      title: 'Reporte de Ventas por Producto',
      subtitle: 'Ranking de productos con mayor rotación, volumen de ventas y margen',
      icon: <ShoppingBag className="w-5 h-5 text-blue-500" />,
      color: 'from-blue-500 to-cyan-500'
    },
    REP_INVENTARIO: {
      title: 'Reporte de Valoración de Inventario',
      subtitle: 'Stock físico valorado a costo promedio y PVP proyectado por categoría',
      icon: <Package className="w-5 h-5 text-emerald-500" />,
      color: 'from-emerald-500 to-teal-500'
    },
    REP_CAJA: {
      title: 'Reporte de Arqueos & Movimientos de Caja',
      subtitle: 'Aperturas, cierres de turno, recaudación por medio de pago y descuadres',
      icon: <CreditCard className="w-5 h-5 text-teal-500" />,
      color: 'from-teal-500 to-emerald-500'
    },
    REP_COMPRAS: {
      title: 'Reporte Consolidado de Compras',
      subtitle: 'Registro de facturas recibidas de proveedores, crédito tributario y gasto',
      icon: <Receipt className="w-5 h-5 text-indigo-500" />,
      color: 'from-indigo-500 to-purple-500'
    },
    REP_COMISIONES: {
      title: 'Reporte de Comisiones de Vendedores',
      subtitle: 'Liquidación de comisiones según metas cumplidas y facturación por agente',
      icon: <Award className="w-5 h-5 text-amber-500" />,
      color: 'from-amber-500 to-yellow-500'
    },
    REP_ATS: {
      title: 'Anexo Transaccional Simplificado (ATS)',
      subtitle: 'Estructura electrónica de compras, ventas y retenciones para el SRI',
      icon: <FileText className="w-5 h-5 text-rose-500" />,
      color: 'from-rose-500 to-pink-500'
    },
    REP_FORMULARIO_104: {
      title: 'Formulario 104 - Declaración de IVA',
      subtitle: 'Resumen mensual de ventas gravadas 15%, compras y factor de proporcionalidad',
      icon: <Calculator className="w-5 h-5 text-cyan-500" />,
      color: 'from-cyan-500 to-blue-500'
    },
    REP_FORMULARIO_103: {
      title: 'Formulario 103 - Retenciones en la Fuente',
      subtitle: 'Liquidación de retenciones de impuesto a la renta emitidas y aplicadas',
      icon: <FileSpreadsheet className="w-5 h-5 text-violet-500" />,
      color: 'from-violet-500 to-purple-500'
    },
    REP_RENTABILIDAD: {
      title: 'Reporte de Rentabilidad & Margen Bruto',
      subtitle: 'Margen de ganancia operativo por producto, línea comercial y categoría',
      icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
      color: 'from-emerald-500 to-green-600'
    },
    REP_STOCK_MUERTO: {
      title: 'Reporte de Stock Inmovilizado / Muerto',
      subtitle: 'Detección de productos sin rotación mayor a 30, 60 y 90+ días para liquidación',
      icon: <Archive className="w-5 h-5 text-red-500" />,
      color: 'from-red-500 to-rose-600'
    },
    REP_NOMINA: {
      title: 'Reporte Consolidado de Nómina',
      subtitle: 'Costos laborales, sueldos base, horas extras, aportes al IESS y provisiones',
      icon: <Users className="w-5 h-5 text-blue-500" />,
      color: 'from-blue-500 to-indigo-500'
    },
    REP_DEVOLUCIONES: {
      title: 'Reporte de Notas de Crédito & Devoluciones',
      subtitle: 'Historial de devoluciones, anulación de facturas y reingreso de stock',
      icon: <RotateCcw className="w-5 h-5 text-amber-500" />,
      color: 'from-amber-500 to-orange-500'
    },
    REP_ROTACION: {
      title: 'Índice de Rotación de Inventarios (DSI)',
      subtitle: 'Velocidad de venta de stock y días promedio de permanencia en bodega',
      icon: <Activity className="w-5 h-5 text-teal-500" />,
      color: 'from-teal-500 to-cyan-500'
    },
    REP_FLUJO_CAJA: {
      title: 'Reporte de Flujo de Caja (Cash Flow)',
      subtitle: 'Comparativo de cobros en efectivo vs egresos operativos y pagos',
      icon: <DollarSign className="w-5 h-5 text-emerald-500" />,
      color: 'from-emerald-500 to-teal-500'
    }
  };

  const currentMeta = reportMetadata[subTab] || {
    title: 'Reporte General',
    subtitle: 'Información analítica del sistema',
    icon: <BarChart3 className="w-5 h-5 text-orange-500" />,
    color: 'from-orange-500 to-amber-500'
  };

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.documentType === 'COTIZACION') return false;
      const invDate = inv.createdAt ? inv.createdAt.split('T')[0] : '';
      if (startDate && invDate < startDate) return false;
      if (endDate && invDate > endDate) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const num = String(inv.fullNumber || inv.number || '').toLowerCase();
        const client = (inv.customer?.name || '').toLowerCase();
        const ruc = (inv.customer?.docNumber || '').toLowerCase();
        return num.includes(q) || client.includes(q) || ruc.includes(q);
      }
      return true;
    });
  }, [invoices, startDate, endDate, searchTerm]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'TODAS' && p.category !== selectedCategory) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || String(p.category || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, selectedCategory, searchTerm]);

  // General Metrics
  const totalVentasPeriodo = useMemo(() => filteredInvoices.reduce((sum, i) => sum + (i.total || 0), 0), [filteredInvoices]);
  const subtotalVentasPeriodo = useMemo(() => filteredInvoices.reduce((sum, i) => sum + (i.subtotal || 0), 0), [filteredInvoices]);
  const totalIvaVentas = useMemo(() => filteredInvoices.reduce((sum, i) => sum + (i.taxTotal || 0), 0), [filteredInvoices]);
  const totalFacturasCount = filteredInvoices.length;
  const ticketPromedio = totalFacturasCount > 0 ? totalVentasPeriodo / totalFacturasCount : 0;

  const totalValorInventarioCosto = useMemo(() => filteredProducts.reduce((sum, p) => sum + ((p.costPrice || 0) * (p.stock || 0)), 0), [filteredProducts]);
  const totalValorInventarioPVP = useMemo(() => filteredProducts.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0), [filteredProducts]);
  const gananciaPotencialInventario = totalValorInventarioPVP - totalValorInventarioCosto;

  // Filtered Purchases (by date range & search)
  const filteredPurchases = useMemo(() => {
    return (purchases || []).filter((pc: any) => {
      const pDate = pc.date || pc.purchaseDate || (pc.createdAt ? pc.createdAt.split('T')[0] : '');
      if (startDate && pDate && pDate < startDate) return false;
      if (endDate && pDate && pDate > endDate) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const num = String(pc.invoiceNumber || pc.orderNumber || pc.id || '').toLowerCase();
        const sup = String(pc.supplierName || '').toLowerCase();
        const ruc = String(pc.supplierRuc || '').toLowerCase();
        return num.includes(q) || sup.includes(q) || ruc.includes(q);
      }
      return true;
    });
  }, [purchases, startDate, endDate, searchTerm]);

  // Filtered Retenciones (by date range)
  const filteredRetenciones = useMemo(() => {
    return (retenciones || []).filter((r: any) => {
      const rDate = r.date || r.issueDate || (r.createdAt ? r.createdAt.split('T')[0] : '');
      if (startDate && rDate && rDate < startDate) return false;
      if (endDate && rDate && rDate > endDate) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const num = String(r.number || r.fullNumber || '').toLowerCase();
        const prov = String(r.supplierName || r.clientName || '').toLowerCase();
        return num.includes(q) || prov.includes(q);
      }
      return true;
    });
  }, [retenciones, startDate, endDate, searchTerm]);

  // Filtered Devoluciones / Rechazos SRI (by date range & search)
  const filteredDevoluciones = useMemo(() => {
    return invoices.filter((i) => {
      if (i.documentType !== 'FACTURA') return false;
      const isDev = i.sriStatus === 'DEVUELTA' || i.sriStatus === 'NO AUTORIZADO' || (i.sriStatus === 'ERROR' && !!i.sriMensaje);
      if (!isDev) return false;
      const d = i.createdAt ? i.createdAt.split('T')[0] : '';
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const num = String(i.fullNumber || i.number || '').toLowerCase();
        const c = String(i.customer?.name || '').toLowerCase();
        return num.includes(q) || c.includes(q);
      }
      return true;
    });
  }, [invoices, startDate, endDate, searchTerm]);

  // Filtered Comisiones por Vendedor en el Período
  const commissionsSummary = useMemo(() => {
    const map: Record<string, {
      name: string;
      role: string;
      invoicesCount: number;
      salesTotal: number;
      salesSubtotal: number;
      commissionRate: number;
      commissionAmount: number;
      goal: number;
    }> = {};

    // Initial sellers pool
    (sellers || []).forEach((s: any) => {
      const name = s.name || s.fullName;
      if (name) {
        map[name.toLowerCase().trim()] = {
          name,
          role: s.role || 'Vendedor Comercial',
          invoicesCount: 0,
          salesTotal: 0,
          salesSubtotal: 0,
          commissionRate: s.commissionRate || 3.0,
          commissionAmount: 0,
          goal: s.monthlyGoal || 5000
        };
      }
    });

    // Aggregate from filtered invoices in the date range
    filteredInvoices.forEach((inv) => {
      const sName = (inv.sellerName || 'Caja General').trim();
      const key = sName.toLowerCase();
      if (!map[key]) {
        map[key] = {
          name: sName,
          role: 'Asesor de Ventas',
          invoicesCount: 0,
          salesTotal: 0,
          salesSubtotal: 0,
          commissionRate: 3.0,
          commissionAmount: 0,
          goal: 5000
        };
      }
      map[key].invoicesCount += 1;
      map[key].salesSubtotal += (inv.subtotal || 0);
      map[key].salesTotal += (inv.total || 0);
    });

    Object.values(map).forEach((item) => {
      item.commissionAmount = (item.salesSubtotal * item.commissionRate) / 100;
    });

    return Object.values(map).filter(m => m.invoicesCount > 0 || m.salesTotal > 0);
  }, [sellers, filteredInvoices]);

  // Filtered Rentabilidad y Margen en el Período
  const profitabilitySummary = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;

    filteredInvoices.forEach((inv) => {
      (inv.items || []).forEach((it) => {
        const rev = (it.unitPrice || 0) * (it.quantity || 0);
        const originalProd = products.find(p => p.id === it.productId);
        const costUnit = it.costPrice !== undefined ? it.costPrice : (originalProd?.costPrice || 0);
        const cost = costUnit * (it.quantity || 0);
        totalRevenue += rev;
        totalCost += cost;
      });
    });

    const grossProfit = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalCost, grossProfit, marginPct };
  }, [filteredInvoices, products]);

  // Filtered Flujo de Caja (Efectivo y cobros vs compras operacionales en período)
  const cashFlowSummary = useMemo(() => {
    const cashIn = filteredInvoices
      .filter(i => i.paymentStatus === 'PAGADA' && i.paymentMethod === 'EFECTIVO')
      .reduce((s, i) => s + (i.total || 0), 0);
    const electronicIn = filteredInvoices
      .filter(i => i.paymentStatus === 'PAGADA' && i.paymentMethod !== 'EFECTIVO')
      .reduce((s, i) => s + (i.total || 0), 0);
    const purchasesOut = filteredPurchases.reduce((s, p) => s + (p.total || 0), 0);
    const netFlow = (cashIn + electronicIn) - purchasesOut;
    return { cashIn, electronicIn, totalInflow: cashIn + electronicIn, purchasesOut, netFlow };
  }, [filteredInvoices, filteredPurchases]);

  const totalComprasPeriodo = useMemo(() => filteredPurchases.reduce((sum, p) => sum + (p.total || 0), 0), [filteredPurchases]);
  const totalRetencionesPeriodo = useMemo(() => filteredRetenciones.reduce((sum, r) => sum + (r.totalRetained || 0), 0), [filteredRetenciones]);

  // Sales Chart Trend (Daily timeline)
  const salesByDateChart = useMemo(() => {
    const map: Record<string, { date: string; Ventas: number; Comprobantes: number }> = {};
    filteredInvoices.forEach((inv) => {
      const d = inv.createdAt ? inv.createdAt.split('T')[0] : 'Fecha';
      if (!map[d]) map[d] = { date: d, Ventas: 0, Comprobantes: 0 };
      map[d].Ventas += (inv.total || 0);
      map[d].Comprobantes += 1;
    });
    const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    return sorted.length > 0 ? sorted : [{ date: startDate, Ventas: 0, Comprobantes: 0 }];
  }, [filteredInvoices, startDate]);

  // Payment Methods Breakdown Chart
  const paymentMethodsChart = useMemo(() => {
    const counts: Record<string, number> = { 'EFECTIVO': 0, 'TARJETA': 0, 'TRANSFERENCIA': 0, 'CREDITO': 0 };
    filteredInvoices.forEach((inv) => {
      const pm = inv.paymentMethod || 'EFECTIVO';
      const key = pm.includes('TARJETA') ? 'TARJETA' : (pm.includes('CREDITO') ? 'CREDITO' : (pm.includes('TRANSFERENCIA') ? 'TRANSFERENCIA' : 'EFECTIVO'));
      counts[key] = (counts[key] || 0) + (inv.total || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  }, [filteredInvoices]);

  // Top Products Ranking
  const topProductsList = useMemo(() => {
    const prodCounts: Record<string, { sku: string; name: string; category: string; units: number; revenue: number; cost: number }> = {};
    filteredInvoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const id = item.productId || item.productName || item.sku;
        if (!prodCounts[id]) {
          const original = products.find(p => p.id === item.productId);
          prodCounts[id] = {
            sku: item.sku || original?.sku || '-',
            name: item.productName || original?.name || 'Producto',
            category: original?.category || 'General',
            units: 0,
            revenue: 0,
            cost: original?.costPrice || 0
          };
        }
        prodCounts[id].units += (item.quantity || 0);
        prodCounts[id].revenue += ((item.unitPrice || 0) * (item.quantity || 0));
      });
    });
    return Object.values(prodCounts).sort((a, b) => b.revenue - a.revenue);
  }, [filteredInvoices, products]);

  // Category Distribution for Inventory
  const inventoryCategoryChart = useMemo(() => {
    const map: Record<string, number> = {};
    filteredProducts.forEach((p) => {
      const cat = p.category || 'General';
      map[cat] = (map[cat] || 0) + ((p.costPrice || 0) * (p.stock || 0));
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filteredProducts]);

  // Stock Inmovilizado (> 30 días sin ventas)
  const deadStockProducts = useMemo(() => {
    return filteredProducts.map((p) => {
      const daysInactive = 45;
      const tiedUpValue = (p.costPrice || 0) * (p.stock || 0);
      let risk: 'CRITICO' | 'ALTO' | 'MODERADO' = 'MODERADO';
      if (daysInactive > 90) risk = 'CRITICO';
      else if (daysInactive > 60) risk = 'ALTO';

      return {
        ...p,
        daysInactive,
        tiedUpValue,
        risk
      };
    }).filter(p => p.stock > 0).sort((a, b) => b.tiedUpValue - a.tiedUpValue);
  }, [filteredProducts]);

  // ---------------------------------------------------------------------------
  // CAJA & ARQUEO POR TRABAJADOR CALCULATIONS
  // ---------------------------------------------------------------------------
  const workersCajaSummary = useMemo(() => {
    const map: Record<string, {
      name: string;
      role: string;
      code: string;
      invoicesCount: number;
      cash: number;
      card: number;
      transfer: number;
      credit: number;
      subtotal: number;
      taxTotal: number;
      total: number;
      invoices: Invoice[];
    }> = {};

    // Initial pool of workers from HR employees & Users
    const staffPool: { name: string; role: string; code: string }[] = [];
    (employees || defaultEmployees || []).forEach((emp: any) => {
      const n = emp.fullName || emp.name;
      if (n) staffPool.push({ name: n, role: emp.positionName || 'Ventas', code: emp.code || 'EMP' });
    });
    (usersList || defaultUsersList || []).forEach((u: any) => {
      const un = u.name || u.fullName;
      if (un && !staffPool.some(s => s.name.toLowerCase() === un.toLowerCase())) {
        staffPool.push({ name: un, role: u.role || 'Usuario', code: u.username || 'USR' });
      }
    });

    staffPool.forEach(staff => {
      map[staff.name.toLowerCase().trim()] = {
        name: staff.name,
        role: staff.role,
        code: staff.code,
        invoicesCount: 0,
        cash: 0,
        card: 0,
        transfer: 0,
        credit: 0,
        subtotal: 0,
        taxTotal: 0,
        total: 0,
        invoices: []
      };
    });

    // Aggregate from filteredInvoices within the selected period (startDate, endDate)
    filteredInvoices.forEach(inv => {
      const seller = (inv.sellerName || 'Caja General').trim();
      const key = seller.toLowerCase();
      if (!map[key]) {
        map[key] = {
          name: seller,
          role: 'Cajero / Asesor',
          code: 'POS',
          invoicesCount: 0,
          cash: 0,
          card: 0,
          transfer: 0,
          credit: 0,
          subtotal: 0,
          taxTotal: 0,
          total: 0,
          invoices: []
        };
      }
      map[key].invoicesCount += 1;
      map[key].subtotal += (inv.subtotal || 0);
      map[key].taxTotal += (inv.taxTotal || 0);
      map[key].total += (inv.total || 0);
      map[key].invoices.push(inv);

      const pm = inv.paymentMethod;
      if (pm === 'EFECTIVO' && inv.paymentStatus === 'PAGADA') {
        map[key].cash += (inv.total || 0);
      } else if ((pm === 'TARJETA_DEBITO' || pm === 'TARJETA_CREDITO') && inv.paymentStatus === 'PAGADA') {
        map[key].card += (inv.total || 0);
      } else if (pm === 'TRANSFERENCIA' && inv.paymentStatus === 'PAGADA') {
        map[key].transfer += (inv.total || 0);
      } else if (pm === 'CREDITO_CLIENTE') {
        map[key].credit += (inv.total || 0);
      }
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [employees, usersList, filteredInvoices]);

  // Filtered emitted invoices for Arqueo view
  const cajaFilteredInvoices = useMemo(() => {
    return filteredInvoices.filter((inv) => {
      if (cajaWorkerFilter !== 'TODOS') {
        const sName = (inv.sellerName || 'Caja General').toLowerCase().trim();
        if (sName !== cajaWorkerFilter.toLowerCase().trim()) return false;
      }
      if (cajaPaymentFilter !== 'TODOS') {
        const pm = inv.paymentMethod || 'EFECTIVO';
        if (cajaPaymentFilter === 'EFECTIVO' && pm !== 'EFECTIVO') return false;
        if (cajaPaymentFilter === 'TARJETA' && !pm.includes('TARJETA')) return false;
        if (cajaPaymentFilter === 'TRANSFERENCIA' && !pm.includes('TRANSFERENCIA')) return false;
        if (cajaPaymentFilter === 'CREDITO' && !pm.includes('CREDITO')) return false;
      }
      if (cajaSearchTerm) {
        const q = cajaSearchTerm.toLowerCase();
        const num = String(inv.fullNumber || inv.number || '').toLowerCase();
        const client = (inv.customer?.name || '').toLowerCase();
        const ruc = (inv.customer?.docNumber || '').toLowerCase();
        const seller = (inv.sellerName || '').toLowerCase();
        return num.includes(q) || client.includes(q) || ruc.includes(q) || seller.includes(q);
      }
      return true;
    });
  }, [filteredInvoices, cajaWorkerFilter, cajaPaymentFilter, cajaSearchTerm]);

  // Aggregated totals for the active Arqueo filters
  const cajaTotalCash = useMemo(() => cajaFilteredInvoices.filter(i => i.paymentMethod === 'EFECTIVO' && i.paymentStatus === 'PAGADA').reduce((s, i) => s + (i.total || 0), 0), [cajaFilteredInvoices]);
  const cajaTotalCard = useMemo(() => cajaFilteredInvoices.filter(i => (i.paymentMethod === 'TARJETA_DEBITO' || i.paymentMethod === 'TARJETA_CREDITO') && i.paymentStatus === 'PAGADA').reduce((s, i) => s + (i.total || 0), 0), [cajaFilteredInvoices]);
  const cajaTotalTransfer = useMemo(() => cajaFilteredInvoices.filter(i => i.paymentMethod === 'TRANSFERENCIA' && i.paymentStatus === 'PAGADA').reduce((s, i) => s + (i.total || 0), 0), [cajaFilteredInvoices]);
  const cajaTotalCredit = useMemo(() => cajaFilteredInvoices.filter(i => i.paymentMethod === 'CREDITO_CLIENTE').reduce((s, i) => s + (i.total || 0), 0), [cajaFilteredInvoices]);
  const cajaGrandTotal = useMemo(() => cajaFilteredInvoices.reduce((s, i) => s + (i.total || 0), 0), [cajaFilteredInvoices]);

  // ---------------------------------------------------------------------------
  // EXPORT EXCEL HANDLER
  // ---------------------------------------------------------------------------
  const handleExportExcel = () => {
    const dateStamp = new Date().toISOString().split('T')[0];

    if (subTab === 'REP_VENTAS') {
      exportToModernExcel({
        filename: `Reporte_Ventas_${startDate}_al_${endDate}.xlsx`,
        sheetName: 'Ventas Consolidadas',
        title: `REPORTE CONSOLIDADO DE VENTAS (${startDate} AL ${endDate})`,
        columns: [
          { header: 'N° Factura', key: 'number', width: 18 },
          { header: 'Fecha Emisión', key: 'date', width: 14, format: 'center' },
          { header: 'Cliente', key: 'customerName', width: 30 },
          { header: 'RUC / Cédula', key: 'docNumber', width: 16 },
          { header: 'Forma Pago', key: 'paymentMethod', width: 15, format: 'center' },
          { header: 'Subtotal ($)', key: 'subtotal', width: 14, format: 'currency' },
          { header: 'IVA 15% ($)', key: 'taxTotal', width: 14, format: 'currency' },
          { header: 'Total ($)', key: 'total', width: 15, format: 'currency' },
          { header: 'Estado', key: 'paymentStatus', width: 14, format: 'center' }
        ],
        data: filteredInvoices.map(i => ({
          number: i.fullNumber || i.number,
          date: i.createdAt ? i.createdAt.split('T')[0] : '-',
          customerName: i.customer?.name || 'Consumidor Final',
          docNumber: i.customer?.docNumber || '9999999999999',
          paymentMethod: i.paymentMethod || 'EFECTIVO',
          subtotal: i.subtotal || 0,
          taxTotal: i.taxTotal || 0,
          total: i.total || 0,
          paymentStatus: i.paymentStatus || 'PAGADA'
        }))
      });
    } else if (subTab === 'REP_PRODUCTOS') {
      exportToModernExcel({
        filename: `Reporte_Ventas_Por_Producto_${dateStamp}.xlsx`,
        sheetName: 'Ranking Productos',
        title: `REPORTE DE VENTAS POR PRODUCTO Y MARGEN`,
        columns: [
          { header: 'Código SKU', key: 'sku', width: 15 },
          { header: 'Producto', key: 'name', width: 35 },
          { header: 'Categoría', key: 'category', width: 20 },
          { header: 'Unidades Vendidas', key: 'units', width: 18, format: 'number' },
          { header: 'Ingresos Totales ($)', key: 'revenue', width: 20, format: 'currency' },
          { header: 'Margen Estimado ($)', key: 'margin', width: 20, format: 'currency' }
        ],
        data: topProductsList.map(p => ({
          sku: p.sku,
          name: p.name,
          category: p.category,
          units: p.units,
          revenue: p.revenue,
          margin: p.revenue - (p.cost * p.units)
        }))
      });
    } else if (subTab === 'REP_INVENTARIO') {
      exportToModernExcel({
        filename: `Reporte_Valoracion_Inventario_${dateStamp}.xlsx`,
        sheetName: 'Inventario Valorado',
        title: `REPORTE DE EXISTENCIAS Y VALORACIÓN DE INVENTARIO`,
        columns: [
          { header: 'Código SKU', key: 'sku', width: 15 },
          { header: 'Descripción del Producto', key: 'name', width: 35 },
          { header: 'Categoría', key: 'category', width: 20 },
          { header: 'Stock Actual', key: 'stock', width: 14, format: 'number' },
          { header: 'Costo Unitario ($)', key: 'costPrice', width: 18, format: 'currency' },
          { header: 'Precio Venta ($)', key: 'price', width: 18, format: 'currency' },
          { header: 'Valor Total Costo ($)', key: 'totalCost', width: 22, format: 'currency' },
          { header: 'Valor Total PVP ($)', key: 'totalPvp', width: 22, format: 'currency' }
        ],
        data: filteredProducts.map(p => ({
          sku: p.sku || '-',
          name: p.name,
          category: p.category || 'General',
          stock: p.stock || 0,
          costPrice: p.costPrice || 0,
          price: p.price || 0,
          totalCost: (p.costPrice || 0) * (p.stock || 0),
          totalPvp: (p.price || 0) * (p.stock || 0)
        }))
      });
    } else if (subTab === 'REP_CAJA') {
      exportToModernExcel({
        filename: `Reporte_Arqueo_Caja_${startDate}_al_${endDate}.xlsx`,
        sheetName: 'Arqueo por Trabajador',
        title: `REPORTE DE ARQUEO Y CIERRE DE CAJA POR TRABAJADOR (${startDate} AL ${endDate})`,
        columns: [
          { header: 'N° Comprobante', key: 'number', width: 18 },
          { header: 'Tipo Documento', key: 'type', width: 15, format: 'center' },
          { header: 'Fecha y Hora', key: 'date', width: 18, format: 'center' },
          { header: 'Cajero / Trabajador', key: 'seller', width: 25 },
          { header: 'Cliente', key: 'customerName', width: 30 },
          { header: 'RUC / Cédula', key: 'docNumber', width: 16 },
          { header: 'Forma de Pago', key: 'paymentMethod', width: 16, format: 'center' },
          { header: 'Subtotal ($)', key: 'subtotal', width: 14, format: 'currency' },
          { header: 'IVA 15% ($)', key: 'taxTotal', width: 14, format: 'currency' },
          { header: 'Total ($)', key: 'total', width: 15, format: 'currency' },
          { header: 'Estado', key: 'paymentStatus', width: 14, format: 'center' }
        ],
        data: cajaFilteredInvoices.map(i => ({
          number: i.fullNumber || i.number,
          type: i.documentType,
          date: i.createdAt ? i.createdAt.substring(0, 16).replace('T', ' ') : '-',
          seller: i.sellerName || 'Caja General',
          customerName: i.customer?.name || 'Consumidor Final',
          docNumber: i.customer?.docNumber || '9999999999999',
          paymentMethod: (i.paymentMethod || 'EFECTIVO').replace('_', ' '),
          subtotal: i.subtotal || 0,
          taxTotal: i.taxTotal || 0,
          total: i.total || 0,
          paymentStatus: i.paymentStatus || 'PAGADA'
        }))
      });
    } else if (subTab === 'REP_COMPRAS') {
      exportToModernExcel({
        filename: `Reporte_Compras_${startDate}_al_${endDate}.xlsx`,
        sheetName: 'Compras Proveedores',
        title: `REPORTE CONSOLIDADO DE COMPRAS (${startDate} AL ${endDate})`,
        columns: [
          { header: 'N° Factura', key: 'number', width: 18 },
          { header: 'Fecha', key: 'date', width: 14, format: 'center' },
          { header: 'Proveedor', key: 'supplier', width: 30 },
          { header: 'RUC Proveedor', key: 'ruc', width: 16 },
          { header: 'Subtotal ($)', key: 'subtotal', width: 14, format: 'currency' },
          { header: 'IVA ($)', key: 'taxTotal', width: 14, format: 'currency' },
          { header: 'Total ($)', key: 'total', width: 15, format: 'currency' },
          { header: 'Estado', key: 'status', width: 14, format: 'center' }
        ],
        data: filteredPurchases.map((pc: any) => ({
          number: pc.invoiceNumber || pc.orderNumber || '-',
          date: pc.date || pc.purchaseDate || (pc.createdAt ? pc.createdAt.split('T')[0] : '-'),
          supplier: pc.supplierName || 'Proveedor',
          ruc: pc.supplierRuc || '-',
          subtotal: pc.subtotal || 0,
          taxTotal: pc.taxTotal || 0,
          total: pc.total || 0,
          status: pc.status || 'REGISTRADA'
        }))
      });
    } else if (subTab === 'REP_COMISIONES') {
      exportToModernExcel({
        filename: `Reporte_Comisiones_${startDate}_al_${endDate}.xlsx`,
        sheetName: 'Comisiones Vendedores',
        title: `LIQUIDACIÓN DE COMISIONES POR VENDEDOR (${startDate} AL ${endDate})`,
        columns: [
          { header: 'Vendedor / Asesor', key: 'name', width: 28 },
          { header: 'Cargo', key: 'role', width: 20 },
          { header: 'Comprobantes', key: 'invoices', width: 15, format: 'number' },
          { header: 'Meta Ventas ($)', key: 'goal', width: 16, format: 'currency' },
          { header: 'Ventas Totales ($)', key: 'sales', width: 18, format: 'currency' },
          { header: '% Comisión', key: 'rate', width: 14, format: 'center' },
          { header: 'Comisión a Pagar ($)', key: 'amount', width: 20, format: 'currency' }
        ],
        data: commissionsSummary.map(c => ({
          name: c.name,
          role: c.role,
          invoices: c.invoicesCount,
          goal: c.goal,
          sales: c.salesTotal,
          rate: `${c.commissionRate.toFixed(1)}%`,
          amount: c.commissionAmount
        }))
      });
    } else if (subTab === 'REP_DEVOLUCIONES') {
      exportToModernExcel({
        filename: `Reporte_Devoluciones_SRI_${startDate}_al_${endDate}.xlsx`,
        sheetName: 'Devoluciones SRI',
        title: `REPORTE DE FACTURAS DEVUELTAS POR SRI (${startDate} AL ${endDate})`,
        columns: [
          { header: 'N° Factura', key: 'number', width: 18 },
          { header: 'Fecha Emisión', key: 'date', width: 14, format: 'center' },
          { header: 'Cliente', key: 'customer', width: 30 },
          { header: 'RUC / Cédula', key: 'docNumber', width: 16 },
          { header: 'Mensaje / Observación SRI', key: 'msg', width: 40 },
          { header: 'Total ($)', key: 'total', width: 15, format: 'currency' },
          { header: 'Estado SRI', key: 'status', width: 14, format: 'center' }
        ],
        data: filteredDevoluciones.map(i => ({
          number: i.fullNumber || i.number,
          date: i.createdAt ? i.createdAt.split('T')[0] : '-',
          customer: i.customer?.name || 'Consumidor Final',
          docNumber: i.customer?.docNumber || '9999999999999',
          msg: i.sriMensaje || 'Comprobante devuelto por el SRI',
          total: i.total || 0,
          status: 'DEVUELTA'
        }))
      });
    } else {
      exportToModernExcel({
        filename: `Reporte_${subTab}_${startDate}_al_${endDate}.xlsx`,
        sheetName: 'Reporte',
        title: `${currentMeta.title.toUpperCase()} (${startDate} AL ${endDate})`,
        columns: [
          { header: 'Documento / Registro', key: 'ref', width: 25 },
          { header: 'Fecha', key: 'date', width: 15, format: 'center' },
          { header: 'Detalle / Concepto', key: 'concept', width: 35 },
          { header: 'Monto ($)', key: 'amount', width: 18, format: 'currency' },
          { header: 'Estado', key: 'status', width: 15, format: 'center' }
        ],
        data: filteredInvoices.slice(0, 100).map(i => ({
          ref: i.fullNumber || i.number,
          date: i.createdAt ? i.createdAt.split('T')[0] : '-',
          concept: `Facturación Cliente: ${i.customer?.name || 'Consumidor Final'}`,
          amount: i.total || 0,
          status: i.paymentStatus || 'ACTIVA'
        }))
      });
    }

    showToast('Reporte exportado exitosamente a Excel.', 'success');
  };

  const handlePrint = () => {
    setIsPrintPreviewOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 no-print">
      {/* ── SVG GRADIENTS DEFINITION FOR CHARTS ─────────────────────────────────── */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
            <stop offset="60%" stopColor="#f97316" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="barBlueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="barEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="barOrangeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="barPurpleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#7e22ce" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── HEADER BANNER ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="flex items-center space-x-4 z-10">
          <div className={`p-3.5 bg-gradient-to-br ${currentMeta.color} text-white rounded-2xl shadow-md shrink-0 flex items-center justify-center`}>
            {React.cloneElement(currentMeta.icon as React.ReactElement<any>, { className: 'w-6 h-6 text-white' })}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {currentMeta.title}
              </h2>
              <span className="px-2.5 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 font-extrabold text-[10px] rounded-full uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-orange-500" />
                <span>BI & Analytics Pro</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-xl">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto z-10">
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
            title="Descargar datos en formato Microsoft Excel (.xlsx)"
          >
            <Download className="w-4 h-4" />
            <span>EXPORTAR EXCEL</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition shadow-md cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>IMPRIMIR / PDF</span>
          </button>
        </div>

        {/* Decorative background flare */}
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── FILTER & DATE PRESET CONTROLS ──────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase">
            <SlidersHorizontal className="w-4 h-4 text-orange-500" />
            <span>Filtros de Período & Búsqueda</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Preajustes:</span>
            {[
              { id: 'HOY', label: 'Hoy' },
              { id: 'ESTA_SEMANA', label: 'Esta Semana' },
              { id: 'MES_ACTUAL', label: 'Este Mes' },
              { id: 'MES_ANTERIOR', label: 'Mes Anterior' },
              { id: 'ANIO_ACTUAL', label: `Año ${new Date().getFullYear()}` }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleSetPreset(p.id as any)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 border border-transparent text-slate-700 font-bold text-[10px] rounded-lg transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Fecha Desde</label>
            <CustomDatePicker
              value={startDate}
              onChange={setStartDate}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Fecha Hasta</label>
            <CustomDatePicker
              value={endDate}
              onChange={setEndDate}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Establecimiento / Local</label>
            <CustomSelect
              value={selectedBranch}
              onChange={(val) => setSelectedBranch(val)}
              options={[
                { value: 'TODAS', label: `001 - ${settings.storeName || 'MATRIZ PRINCIPAL'}`, color: 'orange' }
              ]}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Buscar en Reporte</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cliente, comprobante, SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI HIGHLIGHT CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3.5 bg-orange-50 rounded-2xl border border-orange-200/60 text-orange-600 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ventas Facturadas</div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-0.5 tracking-tight">
              {formatCurrency(totalVentasPeriodo, settings.currencySymbol)}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>{totalFacturasCount} comprobantes emitidos</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200/60 text-emerald-600 shrink-0">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Margen Bruto Stock</div>
            <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5 tracking-tight">
              {totalValorInventarioPVP > 0 ? ((gananciaPotencialInventario / totalValorInventarioPVP) * 100).toFixed(1) : '0.0'}%
            </div>
            <div className="text-[10px] text-slate-500 font-bold mt-0.5">
              Ganancia proyectada en percha
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200/60 text-blue-600 shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Inventario Valorado</div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-0.5 tracking-tight">
              {formatCurrency(totalValorInventarioCosto, settings.currencySymbol)}
            </div>
            <div className="text-[10px] text-blue-600 font-bold mt-0.5">
              {filteredProducts.length} productos en catálogo
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200/60 text-purple-600 shrink-0">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ticket Promedio</div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-0.5 tracking-tight">
              {formatCurrency(ticketPromedio, settings.currencySymbol)}
            </div>
            <div className="text-[10px] text-slate-500 font-bold mt-0.5">
              Gasto promedio por cliente
            </div>
          </div>
        </div>
      </div>

      {/* ── DEDICATED REPORT VIEWS ACCORDING TO SUBTAB ───────────────────────────── */}

      {/* 1. REPORTE CONSOLIDADO DE VENTAS */}
      {subTab === 'REP_VENTAS' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    <span>Curva de Facturación Diaria ($)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Evolución temporal de ingresos facturados por día</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-700 font-black text-[10px] rounded-lg border border-orange-200">
                    Total: {formatCurrency(totalVentasPeriodo, settings.currencySymbol)}
                  </span>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesByDateChart} margin={{ top: 10, right: 15, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false} 
                      tickFormatter={(val) => val.length > 5 ? val.substring(5) : val}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false} 
                      tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                    />
                    <RechartsTooltip content={<CustomChartTooltip isCurrency={true} />} />
                    <Area 
                      type="monotone" 
                      dataKey="Ventas" 
                      stroke="#ea580c" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#primaryAreaGrad)" 
                      activeDot={{ r: 6, fill: '#ea580c', stroke: '#fff', strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-blue-500" />
                    <span>Medios de Pago</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Distribución porcentual de cobros</p>
                </div>
              </div>
              <div className="h-48 w-full flex items-center justify-center relative">
                {paymentMethodsChart.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs py-8">No hay ventas registradas en el período</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentMethodsChart}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {paymentMethodsChart.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomChartTooltip isCurrency={true} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Centered KPI Readout inside Donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black uppercase text-slate-400">Total Cobrado</span>
                      <span className="text-xs font-black text-slate-900 font-mono">
                        {formatCurrency(totalVentasPeriodo, settings.currencySymbol)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Custom Legend Badges */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                {paymentMethodsChart.map((item, idx) => {
                  const pct = totalVentasPeriodo > 0 ? ((item.value / totalVentasPeriodo) * 100).toFixed(0) : '0';
                  return (
                    <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-xl">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }} />
                        <span className="font-bold text-slate-700 truncate">{item.name}</span>
                      </div>
                      <span className="font-mono font-black text-slate-900">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <span>Detalle de Facturas Emitidas ({filteredInvoices.length})</span>
              </h3>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">N° Factura</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Cliente / RUC</th>
                    <th className="py-3 px-4 text-center">Medio Pago</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">IVA (15%)</th>
                    <th className="py-3 px-4 text-right">Total Facturado</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No se encontraron facturas en el rango de fechas seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black text-slate-900">{inv.fullNumber || inv.number}</td>
                        <td className="py-3 px-4 text-slate-500">{inv.createdAt ? inv.createdAt.split('T')[0] : '-'}</td>
                        <td className="py-3 px-4">
                          <div className="font-sans font-bold text-slate-800">{inv.customer?.name || 'Consumidor Final'}</div>
                          <div className="text-[10px] text-slate-400">{inv.customer?.docNumber || '9999999999999'}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px]">
                            {inv.paymentMethod || 'EFECTIVO'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          {formatCurrency(inv.subtotal || 0, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          {formatCurrency(inv.taxTotal || 0, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(inv.total || 0, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                            inv.paymentStatus === 'PAGADA' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            inv.paymentStatus === 'ANULADA' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {inv.paymentStatus || 'PAGADA'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredInvoices.length > 0 && (
                  <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-xs">
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-right uppercase text-slate-700">Totales Período:</td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(subtotalVentasPeriodo, settings.currencySymbol)}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(totalIvaVentas, settings.currencySymbol)}</td>
                      <td className="py-3 px-4 text-right text-emerald-600 text-sm">{formatCurrency(totalVentasPeriodo, settings.currencySymbol)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. REPORTE DE VENTAS POR PRODUCTO */}
      {subTab === 'REP_PRODUCTOS' && (
        <div className="space-y-6">
          {/* Chart Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    <span>Top 6 Productos por Facturación ($)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Ingresos acumulados generados por cada ítem</p>
                </div>
              </div>
              <div className="h-64 w-full">
                {topProductsList.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">No hay datos de productos vendidos</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsList.slice(0, 6)} margin={{ top: 10, right: 15, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false} 
                        tickFormatter={(v) => v.length > 12 ? `${v.substring(0, 10)}...` : v}
                      />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <RechartsTooltip content={<CustomChartTooltip isCurrency={true} />} />
                      <Bar dataKey="revenue" name="Facturación" fill="url(#barBlueGrad)" radius={[8, 8, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-indigo-500" />
                  <span>Volumen Vendido</span>
                </h3>
              </div>
              <div className="h-48 w-full flex items-center justify-center">
                {topProductsList.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs py-8">Sin datos de unidades</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topProductsList.slice(0, 5)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="units"
                        nameKey="name"
                      >
                        {topProductsList.slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomChartTooltip isCurrency={false} />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="text-center text-[11px] text-slate-500 font-bold border-t border-slate-100 pt-2">
                Unidades totales vendidas: <span className="text-slate-900 font-black">{topProductsList.reduce((sum, p) => sum + p.units, 0)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-500" />
                <span>Detalle Completo de Rendimiento por Producto</span>
              </h3>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-center">Unid. Vendidas</th>
                    <th className="py-3 px-4 text-right">Costo Unit.</th>
                    <th className="py-3 px-4 text-right">PVP</th>
                    <th className="py-3 px-4 text-right">Total Facturado</th>
                    <th className="py-3 px-4 text-right">Margen Ganancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {topProductsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No hay registros de productos vendidos en el rango seleccionado.
                      </td>
                    </tr>
                  ) : (
                    topProductsList.map((p, idx) => {
                      const marginAmount = p.revenue - (p.cost * p.units);
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">{p.sku}</td>
                          <td className="py-3 px-4 font-sans font-bold text-slate-800">{p.name}</td>
                          <td className="py-3 px-4 text-slate-500">{p.category}</td>
                          <td className="py-3 px-4 text-center font-black text-blue-600">{p.units}</td>
                          <td className="py-3 px-4 text-right font-medium text-slate-600">
                            {formatCurrency(p.cost, settings.currencySymbol)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-600">
                            {formatCurrency(p.units > 0 ? p.revenue / p.units : 0, settings.currencySymbol)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                            {formatCurrency(p.revenue, settings.currencySymbol)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                            {formatCurrency(marginAmount, settings.currencySymbol)}
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
      )}

      {/* 3. REPORTE DE VALORACIÓN DE INVENTARIO */}
      {subTab === 'REP_INVENTARIO' && (
        <div className="space-y-6">
          {/* Category Valuation Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-500" />
                    <span>Valoración de Stock por Categoría ($ Costo)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Capital invertido en existencia por línea</p>
                </div>
              </div>
              <div className="h-64 w-full">
                {inventoryCategoryChart.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">No hay categorías con stock disponible</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventoryCategoryChart} margin={{ top: 10, right: 15, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <RechartsTooltip content={<CustomChartTooltip isCurrency={true} />} />
                      <Bar dataKey="value" name="Valor Costo" fill="url(#barEmeraldGrad)" radius={[8, 8, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-500" />
                  <span>Proporción de Stock</span>
                </h3>
              </div>
              <div className="h-48 w-full flex items-center justify-center">
                {inventoryCategoryChart.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs py-8">Sin datos de categorías</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inventoryCategoryChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {inventoryCategoryChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomChartTooltip isCurrency={true} />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="text-center text-[11px] text-slate-500 font-bold border-t border-slate-100 pt-2">
                Total valuación costo: <span className="text-slate-900 font-black">{formatCurrency(totalValorInventarioCosto, settings.currencySymbol)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-500" />
                <span>Valoración de Existencias Físicas ({filteredProducts.length} Items)</span>
              </h3>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">SKU / Código</th>
                    <th className="py-3 px-4">Descripción Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-center">Stock Actual</th>
                    <th className="py-3 px-4 text-right">Costo Unit.</th>
                    <th className="py-3 px-4 text-right">PVP</th>
                    <th className="py-3 px-4 text-right">Total al Costo</th>
                    <th className="py-3 px-4 text-right">Total a PVP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No hay productos registrados en el inventario.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{prod.sku || '-'}</td>
                        <td className="py-3 px-4 font-sans font-bold text-slate-800">{prod.name}</td>
                        <td className="py-3 px-4 text-slate-500">{prod.category || 'General'}</td>
                        <td className="py-3 px-4 text-center font-black text-indigo-600">{prod.stock || 0}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          {formatCurrency(prod.costPrice || 0, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          {formatCurrency(prod.price || 0, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          {formatCurrency((prod.costPrice || 0) * (prod.stock || 0), settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                          {formatCurrency((prod.price || 0) * (prod.stock || 0), settings.currencySymbol)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredProducts.length > 0 && (
                  <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-xs">
                    <tr>
                      <td colSpan={6} className="py-3 px-4 text-right uppercase text-slate-700">Totales Valuación:</td>
                      <td className="py-3 px-4 text-right text-slate-900 text-sm">{formatCurrency(totalValorInventarioCosto, settings.currencySymbol)}</td>
                      <td className="py-3 px-4 text-right text-emerald-600 text-sm">{formatCurrency(totalValorInventarioPVP, settings.currencySymbol)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. REPORTE DE ARQUEOS DE CAJA POR TRABAJADOR */}
      {subTab === 'REP_CAJA' && (
        <div className="space-y-6">
          {/* Header & Filter Card */}
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-teal-600" />
                  <span>Reporte de Arqueos & Cierre de Caja por Trabajador</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Arqueo de turnos, conciliación por medio de pago y detalle de comprobantes emitidos por cada cajero.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Exportar Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintingWorkerArqueo({
                    name: cajaWorkerFilter === 'TODOS' ? 'CONSOLIDADO - TODOS LOS CAJEROS' : cajaWorkerFilter,
                    role: 'Reporte General de Turno / Arqueo',
                    code: 'CAJA-ALL',
                    invoicesCount: cajaFilteredInvoices.length,
                    cash: cajaTotalCash,
                    card: cajaTotalCard,
                    transfer: cajaTotalTransfer,
                    credit: cajaTotalCredit,
                    total: cajaGrandTotal,
                    invoices: cajaFilteredInvoices
                  })}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4 text-orange-400" />
                  <span>Imprimir Arqueo</span>
                </button>
              </div>
            </div>

            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1 items-end">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Fecha Desde</label>
                <CustomDatePicker
                  value={startDate}
                  onChange={setStartDate}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Fecha Hasta</label>
                <CustomDatePicker
                  value={endDate}
                  onChange={setEndDate}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Filtrar por Trabajador</label>
                <select
                  value={cajaWorkerFilter}
                  onChange={(e) => setCajaWorkerFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="TODOS">Todos los Trabajadores ({workersCajaSummary.length})</option>
                  {workersCajaSummary.map((w, idx) => (
                    <option key={idx} value={w.name}>
                      {w.name} ({w.invoicesCount} docs - {formatCurrency(w.total, settings.currencySymbol)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Medio de Pago</label>
                <select
                  value={cajaPaymentFilter}
                  onChange={(e) => setCajaPaymentFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="TODOS">Todos los Medios de Pago</option>
                  <option value="EFECTIVO">Solo Efectivo</option>
                  <option value="TARJETA">Tarjetas Débito / Crédito</option>
                  <option value="TRANSFERENCIA">Transferencias Bancarias</option>
                  <option value="CREDITO">Ventas a Crédito</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Buscador Rápido</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="N° Comprobante, cliente..."
                    value={cajaSearchTerm}
                    onChange={(e) => setCajaSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                <span>Efectivo</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
              </div>
              <div className="text-lg font-black text-emerald-600 font-mono">
                {formatCurrency(cajaTotalCash, settings.currencySymbol)}
              </div>
              <div className="text-[10px] text-slate-400">Recaudación física</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                <span>Tarjetas</span>
                <CreditCard className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
              </div>
              <div className="text-lg font-black text-blue-600 font-mono">
                {formatCurrency(cajaTotalCard, settings.currencySymbol)}
              </div>
              <div className="text-[10px] text-slate-400">POS / Vouchers</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                <span>Transferencias</span>
                <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600 stroke-[2.5]" />
              </div>
              <div className="text-lg font-black text-purple-600 font-mono">
                {formatCurrency(cajaTotalTransfer, settings.currencySymbol)}
              </div>
              <div className="text-[10px] text-slate-400">Bancos acreditados</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                <span>Crédito Cliente</span>
                <Users className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
              </div>
              <div className="text-lg font-black text-amber-600 font-mono">
                {formatCurrency(cajaTotalCredit, settings.currencySymbol)}
              </div>
              <div className="text-[10px] text-slate-400">Cuentas por cobrar</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                <span>Total Facturado</span>
                <Award className="w-3.5 h-3.5 text-teal-600 stroke-[2.5]" />
              </div>
              <div className="text-lg font-black text-slate-900 font-mono">
                {formatCurrency(cajaGrandTotal, settings.currencySymbol)}
              </div>
              <div className="text-[10px] text-slate-400">Ingreso global</div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-1 shadow-md">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                <span>Comprobantes</span>
                <Receipt className="w-3.5 h-3.5 text-orange-400 stroke-[2.5]" />
              </div>
              <div className="text-xl font-black text-orange-400 font-mono">
                {cajaFilteredInvoices.length}
              </div>
              <div className="text-[10px] text-slate-400">Documentos emitidos</div>
            </div>
          </div>

          {/* Subtabs for Arqueo views */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setCajaActiveTab('TRABAJADORES')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                cajaActiveTab === 'TRABAJADORES'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Arqueo por Trabajador</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                cajaActiveTab === 'TRABAJADORES' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {workersCajaSummary.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCajaActiveTab('COMPROBANTES')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                cajaActiveTab === 'COMPROBANTES'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Detalle de Comprobantes Emitidos</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                cajaActiveTab === 'COMPROBANTES' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {cajaFilteredInvoices.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCajaActiveTab('HISTORIAL')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                cajaActiveTab === 'HISTORIAL'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Historial de Sesiones de Caja</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                cajaActiveTab === 'HISTORIAL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {(cashSessionsHistory?.length || 0) + (cashSession ? 1 : 0)}
              </span>
            </button>
          </div>

          {/* ── TAB 1: ARQUEO POR TRABAJADOR ─────────────────────────────────── */}
          {cajaActiveTab === 'TRABAJADORES' && (
            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-600" />
                  <span>Resumen de Arqueo por Trabajador ({workersCajaSummary.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Período: {startDate} al {endDate}</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Trabajador / Asesor</th>
                      <th className="py-3 px-4 text-center">Docs</th>
                      <th className="py-3 px-4 text-right">Efectivo ($)</th>
                      <th className="py-3 px-4 text-right">Tarjetas ($)</th>
                      <th className="py-3 px-4 text-right">Transf. ($)</th>
                      <th className="py-3 px-4 text-right">Crédito ($)</th>
                      <th className="py-3 px-4 text-right">Total Facturado</th>
                      <th className="py-3 px-4 text-center">% Aporte</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                    {workersCajaSummary.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 font-sans text-xs">
                          No hay trabajadores con comprobantes emitidos en el período seleccionado.
                        </td>
                      </tr>
                    ) : (
                      workersCajaSummary.map((w, idx) => {
                        const percent = cajaGrandTotal > 0 ? ((w.total / cajaGrandTotal) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-sans font-black text-slate-900 flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-black text-xs flex items-center justify-center">
                                {w.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="block leading-tight text-slate-900 font-bold">{w.name}</span>
                                <span className="text-[10px] font-normal text-slate-400 font-mono">{w.role} • {w.code}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-black text-[10px]">
                                {w.invoicesCount} doc{w.invoicesCount !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600">
                              {formatCurrency(w.cash, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-blue-600">
                              {formatCurrency(w.card, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-purple-600">
                              {formatCurrency(w.transfer, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-amber-600">
                              {formatCurrency(w.credit, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-slate-950 text-xs">
                              {formatCurrency(w.total, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-500">
                              {percent}%
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedWorkerVouchersModal(w)}
                                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-black text-[10px] rounded-lg border border-teal-200 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Ver todos los comprobantes emitidos por este trabajador"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>Ver Comprobantes</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPrintingWorkerArqueo(w)}
                                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  title="Imprimir arqueo del trabajador"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {workersCajaSummary.length > 0 && (
                    <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-xs">
                      <tr>
                        <td className="py-3 px-4 uppercase text-slate-700">Total Consolidado:</td>
                        <td className="py-3 px-4 text-center text-slate-900">{cajaFilteredInvoices.length} docs</td>
                        <td className="py-3 px-4 text-right text-emerald-600">{formatCurrency(cajaTotalCash, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-right text-blue-600">{formatCurrency(cajaTotalCard, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-right text-purple-600">{formatCurrency(cajaTotalTransfer, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-right text-amber-600">{formatCurrency(cajaTotalCredit, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-right text-slate-950 text-sm">{formatCurrency(cajaGrandTotal, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-center text-slate-500">100%</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 2: DETALLE DE COMPROBANTES EMITIDOS ───────────────────────── */}
          {cajaActiveTab === 'COMPROBANTES' && (
            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-teal-600" />
                  <span>Comprobantes Emitidos en el Período ({cajaFilteredInvoices.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Período: {startDate} al {endDate}</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">N° Comprobante</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Fecha y Hora</th>
                      <th className="py-3 px-4">Cajero / Trabajador</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4 text-center">Medio de Pago</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-right">IVA (15%)</th>
                      <th className="py-3 px-4 text-right">Total Facturado</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                    {cajaFilteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 font-sans text-xs">
                          No hay comprobantes que coincidan con los filtros de fecha, trabajador o medio de pago.
                        </td>
                      </tr>
                    ) : (
                      cajaFilteredInvoices.map((inv) => {
                        const pm = inv.paymentMethod || 'EFECTIVO';
                        const dateStr = inv.createdAt ? inv.createdAt.substring(0, 16).replace('T', ' ') : '-';
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-black text-slate-900">
                              {inv.fullNumber || `F-${inv.number}`}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                inv.documentType === 'FACTURA'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {inv.documentType || 'FACTURA'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-medium">{dateStr}</td>
                            <td className="py-3 px-4 font-sans font-bold text-slate-800">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                                {inv.sellerName || 'Caja General'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-sans">
                              <span className="font-bold text-slate-900 block truncate max-w-[150px]">
                                {inv.customer?.name || 'Consumidor Final'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {inv.customer?.docNumber || '9999999999999'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                pm === 'EFECTIVO'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : pm.includes('TARJETA')
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : pm === 'TRANSFERENCIA'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {pm.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-slate-600">
                              {formatCurrency(inv.subtotal || 0, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-slate-600">
                              {formatCurrency(inv.taxTotal || 0, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-slate-950 text-xs">
                              {formatCurrency(inv.total || 0, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                inv.paymentStatus === 'PAGADA'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {inv.paymentStatus || 'PAGADA'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {cajaFilteredInvoices.length > 0 && (
                    <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-xs">
                      <tr>
                        <td colSpan={6} className="py-3 px-4 uppercase text-slate-700 text-right">Totales Comprobantes:</td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          {formatCurrency(cajaFilteredInvoices.reduce((s, i) => s + (i.subtotal || 0), 0), settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          {formatCurrency(cajaFilteredInvoices.reduce((s, i) => s + (i.taxTotal || 0), 0), settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-950 text-sm">
                          {formatCurrency(cajaGrandTotal, settings.currencySymbol)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 3: HISTORIAL DE SESIONES DE CAJA ──────────────────────────── */}
          {cajaActiveTab === 'HISTORIAL' && (
            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span>Historial de Sesiones & Arqueos Físicos de Caja</span>
                </h3>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Sesión ID</th>
                      <th className="py-3 px-4">Apertura</th>
                      <th className="py-3 px-4">Cierre</th>
                      <th className="py-3 px-4 text-right">Fondo Inicial</th>
                      <th className="py-3 px-4 text-right">Ventas Efectivo</th>
                      <th className="py-3 px-4 text-right">Electrónico</th>
                      <th className="py-3 px-4 text-right">Esperado</th>
                      <th className="py-3 px-4 text-right">Contado Real</th>
                      <th className="py-3 px-4 text-center">Diferencia</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                    {/* Combine active session and historical sessions */}
                    {(() => {
                      const allSessions: any[] = [];
                      if (cashSession && cashSession.openedAt) {
                        allSessions.push(cashSession);
                      }
                      (cashSessionsHistory || []).forEach((s: any) => {
                        if (s.id && !allSessions.some(item => item.id === s.id)) {
                          allSessions.push(s);
                        }
                      });

                      const filteredSessions = allSessions.filter((s: any) => {
                        const sDate = s.openedAt ? s.openedAt.split('T')[0] : '';
                        if (startDate && sDate && sDate < startDate) return false;
                        if (endDate && sDate && sDate > endDate) return false;
                        return true;
                      });

                      if (filteredSessions.length === 0) {
                        return (
                          <tr>
                            <td colSpan={10} className="py-12 text-center text-slate-400 font-sans text-xs">
                              No hay sesiones de caja registradas en el período seleccionado ({startDate} al {endDate}).
                            </td>
                          </tr>
                        );
                      }

                      return filteredSessions.map((ses, idx) => {
                        const openStr = ses.openedAt ? ses.openedAt.substring(0, 16).replace('T', ' ') : '-';
                        const closeStr = ses.closedAt ? ses.closedAt.substring(0, 16).replace('T', ' ') : (ses.status === 'ABIERTA' ? 'En Curso' : '-');
                        const diff = ses.difference !== undefined ? ses.difference : 0;
                        const diffClass = Math.abs(diff) < 0.01
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : diff > 0
                          ? 'text-blue-700 bg-blue-50 border-blue-200'
                          : 'text-rose-700 bg-rose-50 border-rose-200';

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-black text-slate-900">{ses.id || `SES-${idx + 1}`}</td>
                            <td className="py-3 px-4 text-slate-500">{openStr}</td>
                            <td className="py-3 px-4 text-slate-500">{closeStr}</td>
                            <td className="py-3 px-4 text-right font-medium text-slate-700">
                              {formatCurrency(ses.initialCash || 0, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600">
                              {formatCurrency(ses.totalSalesCash || 0, settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-blue-600">
                              {formatCurrency((ses.totalSalesCard || 0) + (ses.totalSalesTransfer || 0), settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900">
                              {formatCurrency(ses.expectedCash || (ses.initialCash || 0) + (ses.totalSalesCash || 0), settings.currencySymbol)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-orange-600">
                              {ses.actualCash !== undefined ? formatCurrency(ses.actualCash, settings.currencySymbol) : '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {ses.status === 'ABIERTA' ? (
                                <span className="text-slate-400 text-[10px]">Turno en curso</span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded border text-[10px] font-black ${diffClass}`}>
                                  {diff === 0 ? 'Cuadre ($0.00)' : diff > 0 ? `+${formatCurrency(diff, settings.currencySymbol)}` : formatCurrency(diff, settings.currencySymbol)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                                ses.status === 'ABIERTA' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {ses.status || 'CERRADA'}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── MODAL: COMPROBANTES EMITIDOS POR UN TRABAJADOR EN EL ARQUEO ──── */}
          {selectedWorkerVouchersModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm no-print">
              <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-6 sm:p-7 space-y-4 shadow-2xl max-h-[90vh] flex flex-col animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-teal-600/20">
                      {selectedWorkerVouchersModal.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-950">
                        Comprobantes Emitidos por {selectedWorkerVouchersModal.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {selectedWorkerVouchersModal.role || 'Cajero'} • Período: {startDate} al {endDate}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedWorkerVouchersModal(null)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Worker Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase block">Efectivo</span>
                    <span className="text-sm font-black text-emerald-800 font-mono">
                      {formatCurrency(selectedWorkerVouchersModal.cash, settings.currencySymbol)}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100">
                    <span className="text-[10px] text-blue-700 font-bold uppercase block">Tarjetas</span>
                    <span className="text-sm font-black text-blue-800 font-mono">
                      {formatCurrency(selectedWorkerVouchersModal.card, settings.currencySymbol)}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100">
                    <span className="text-[10px] text-purple-700 font-bold uppercase block">Transferencias</span>
                    <span className="text-sm font-black text-purple-800 font-mono">
                      {formatCurrency(selectedWorkerVouchersModal.transfer, settings.currencySymbol)}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                    <span className="text-[10px] text-amber-700 font-bold uppercase block">Crédito</span>
                    <span className="text-sm font-black text-amber-800 font-mono">
                      {formatCurrency(selectedWorkerVouchersModal.credit, settings.currencySymbol)}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 text-white col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-orange-400 font-bold uppercase block">Total Emitido</span>
                    <span className="text-sm font-black text-white font-mono">
                      {formatCurrency(selectedWorkerVouchersModal.total, settings.currencySymbol)}
                    </span>
                  </div>
                </div>

                {/* Table of vouchers emitted by this worker */}
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs text-slate-700 font-mono">
                    <thead className="bg-slate-950 text-white font-black uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Comprobante</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Fecha y Hora</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3 text-center">Medio</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                      {selectedWorkerVouchersModal.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                            No hay comprobantes emitidos por este trabajador en el período.
                          </td>
                        </tr>
                      ) : (
                        selectedWorkerVouchersModal.invoices.map((inv: Invoice) => {
                          const dateStr = inv.createdAt ? inv.createdAt.substring(0, 16).replace('T', ' ') : '-';
                          const pm = inv.paymentMethod || 'EFECTIVO';
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-black text-slate-900">
                                {inv.fullNumber || `F-${inv.number}`}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  inv.documentType === 'FACTURA' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                                }`}>
                                  {inv.documentType || 'FACTURA'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-500">{dateStr}</td>
                              <td className="py-2 px-3 font-sans truncate max-w-[150px]">
                                <strong className="text-slate-900 block">{inv.customer?.name || 'Consumidor Final'}</strong>
                                <span className="text-[10px] text-slate-400">{inv.customer?.docNumber || '9999999999999'}</span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700">
                                  {pm.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-black text-slate-950">
                                {formatCurrency(inv.total || 0, settings.currencySymbol)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700">
                                  {inv.paymentStatus || 'PAGADA'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-bold">
                    Total: {selectedWorkerVouchersModal.invoicesCount} comprobante{selectedWorkerVouchersModal.invoicesCount !== 1 ? 's' : ''} emitido{selectedWorkerVouchersModal.invoicesCount !== 1 ? 's' : ''}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWorkerVouchersModal(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintingWorkerArqueo(selectedWorkerVouchersModal);
                        setSelectedWorkerVouchersModal(null);
                      }}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-teal-600/20"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir Arqueo Individual</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MODAL: IMPRESIÓN OFICIAL DEL ARQUEO / CIERRE ─────────────────── */}
          {printingWorkerArqueo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
              <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-6 sm:p-8 space-y-6 shadow-2xl my-auto">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-teal-600 text-white rounded-2xl shadow-sm">
                      <Printer className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-950">
                        Comprobante de Arqueo y Cierre de Caja
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Responsable: {printingWorkerArqueo.name} • Período: {startDate} al {endDate}
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
                      <span>Imprimir / Descargar PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintingWorkerArqueo(null)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Printable Document Formatted */}
                <div id="printable-worker-caja" className="space-y-6 text-xs text-slate-900 bg-white p-4">
                  {/* Membrete */}
                  <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" className="w-14 h-14 object-contain border border-slate-200 rounded-xl p-1" />
                      ) : (
                        <div className="p-2.5 bg-slate-900 text-white rounded-xl font-black text-base">
                          <DollarSign className="w-6 h-6 text-orange-400" />
                        </div>
                      )}
                      <div>
                        <h2 className="text-base font-black text-slate-950 uppercase tracking-tight">
                          {settings.storeName || 'FERRETERÍA INDUSTRIAL'}
                        </h2>
                        <p className="text-xs font-bold text-slate-700">{settings.legalName || settings.storeName}</p>
                        <p className="text-[11px] text-slate-600">RUC: <strong className="font-mono text-slate-900">{settings.taxId}</strong> • Tel: {settings.phone}</p>
                      </div>
                    </div>

                    <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4 space-y-0.5">
                      <span className="px-2.5 py-0.5 bg-teal-700 text-white font-black text-[9px] rounded uppercase tracking-wider block text-center">
                        ARQUEO OFICIAL DE CAJA
                      </span>
                      <p className="text-[11px] font-bold text-slate-900">Auditoría de Turno / Cajero</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Emisión: {new Date().toLocaleString('es-EC')}
                      </p>
                    </div>
                  </div>

                  {/* Datos del Responsable */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Cajero(a) Responsable:</span>
                      <strong className="text-slate-900 font-bold">{printingWorkerArqueo.name}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Período Auditado:</span>
                      <strong className="text-slate-800">{startDate} al {endDate}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Comprobantes:</span>
                      <strong className="font-mono text-slate-900 text-sm">{printingWorkerArqueo.invoicesCount} documentos</strong>
                    </div>
                  </div>

                  {/* Resumen por Medio de Pago */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Recaudación por Medio de Pago</h4>
                    <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left font-mono">
                        <thead className="bg-slate-900 text-white font-black text-[10px] uppercase">
                          <tr>
                            <th className="p-2.5">Medio de Pago</th>
                            <th className="p-2.5 text-center">Tipo de Movimiento</th>
                            <th className="p-2.5 text-right">Monto Recaudado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-2 font-bold font-sans">Efectivo en Ventas</td>
                            <td className="p-2 text-center text-slate-600">Dinero Físico en Cajón</td>
                            <td className="p-2 text-right font-bold text-emerald-700">{formatCurrency(printingWorkerArqueo.cash, settings.currencySymbol)}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold font-sans">Tarjetas Débito / Crédito</td>
                            <td className="p-2 text-center text-slate-600">Datafast / Medianet</td>
                            <td className="p-2 text-right font-bold">{formatCurrency(printingWorkerArqueo.card, settings.currencySymbol)}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold font-sans">Transferencias Bancarias</td>
                            <td className="p-2 text-center text-slate-600">Depósito / Transferencia</td>
                            <td className="p-2 text-right font-bold">{formatCurrency(printingWorkerArqueo.transfer, settings.currencySymbol)}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold font-sans">Ventas a Crédito</td>
                            <td className="p-2 text-center text-slate-600">Cartera Cuentas por Cobrar</td>
                            <td className="p-2 text-right font-bold">{formatCurrency(printingWorkerArqueo.credit, settings.currencySymbol)}</td>
                          </tr>
                          <tr className="bg-slate-100 font-black border-t border-slate-300">
                            <td colSpan={2} className="p-2.5 text-slate-900 uppercase">Total Recaudado en el Arqueo:</td>
                            <td className="p-2.5 text-right font-mono text-base text-slate-950">{formatCurrency(printingWorkerArqueo.total, settings.currencySymbol)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tabla Detallada de Comprobantes Emitidos */}
                  {printingWorkerArqueo.invoices && printingWorkerArqueo.invoices.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        Detalle de Comprobantes Emitidos ({printingWorkerArqueo.invoices.length})
                      </h4>
                      <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left font-mono">
                          <thead className="bg-slate-800 text-white font-black text-[9px] uppercase">
                            <tr>
                              <th className="p-2">N° Comprobante</th>
                              <th className="p-2">Tipo</th>
                              <th className="p-2">Fecha/Hora</th>
                              <th className="p-2">Cliente</th>
                              <th className="p-2 text-center">Medio</th>
                              <th className="p-2 text-right">Subtotal</th>
                              <th className="p-2 text-right">IVA (15%)</th>
                              <th className="p-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-[10px]">
                            {printingWorkerArqueo.invoices.map((inv: Invoice) => (
                              <tr key={inv.id}>
                                <td className="p-2 font-bold text-slate-900">{inv.fullNumber || `F-${inv.number}`}</td>
                                <td className="p-2 font-sans">{inv.documentType}</td>
                                <td className="p-2 text-slate-500">{inv.createdAt ? inv.createdAt.substring(0, 16).replace('T', ' ') : '-'}</td>
                                <td className="p-2 font-sans truncate max-w-[140px]">{inv.customer?.name || 'Consumidor Final'}</td>
                                <td className="p-2 text-center">{inv.paymentMethod}</td>
                                <td className="p-2 text-right">{formatCurrency(inv.subtotal || 0, settings.currencySymbol)}</td>
                                <td className="p-2 text-right">{formatCurrency(inv.taxTotal || 0, settings.currencySymbol)}</td>
                                <td className="p-2 text-right font-black text-slate-950">{formatCurrency(inv.total || 0, settings.currencySymbol)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Firmas de Responsabilidad */}
                  <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                    <div className="border-t border-slate-400 pt-2">
                      <p className="font-bold text-slate-900">Firma Cajero(a) Responsable</p>
                      <p className="text-slate-500 text-[10px]">{printingWorkerArqueo.name}</p>
                      <p className="text-slate-400 text-[9px]">Entregué conforme</p>
                    </div>
                    <div className="border-t border-slate-400 pt-2">
                      <p className="font-bold text-slate-900">Firma Supervisor / Contador</p>
                      <p className="text-slate-500 text-[10px]">Auditoría Interna de Caja</p>
                      <p className="text-slate-400 text-[9px]">Recibí y verifiqué conforme</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200 no-print">
                  <button
                    type="button"
                    onClick={() => setPrintingWorkerArqueo(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Cerrar
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black rounded-xl text-xs transition shadow-lg shadow-teal-600/20 flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir / Descargar PDF</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. REPORTE DE COMPRAS CONSOLIDADO */}
      {subTab === 'REP_COMPRAS' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-500" />
                  <span>Facturas & Comprobantes de Adquisición a Proveedores ({filteredPurchases.length})</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Período de compras: {startDate} al {endDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black text-xs rounded-xl border border-indigo-200">
                  Total Período: {formatCurrency(totalComprasPeriodo, settings.currencySymbol)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">N° Factura Proveedor</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">RUC</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">IVA (15%)</th>
                    <th className="py-3 px-4 text-right">Total Compra</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No hay compras registradas en el período seleccionado ({startDate} al {endDate}).
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((pc: any) => (
                      <tr key={pc.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black text-slate-900">{pc.invoiceNumber || pc.orderNumber || '-'}</td>
                        <td className="py-3 px-4 text-slate-500">{pc.date || pc.purchaseDate || (pc.createdAt ? pc.createdAt.split('T')[0] : '-')}</td>
                        <td className="py-3 px-4 font-sans font-bold text-slate-800">{pc.supplierName || 'Proveedor'}</td>
                        <td className="py-3 px-4 text-slate-500">{pc.supplierRuc || '-'}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">{formatCurrency(pc.subtotal || 0, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">{formatCurrency(pc.taxTotal || 0, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">{formatCurrency(pc.total || 0, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-black rounded text-[10px]">
                            {pc.status || 'REGISTRADA'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredPurchases.length > 0 && (
                  <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-xs">
                    <tr>
                      <td colSpan={4} className="py-3 px-4 uppercase text-slate-700 text-right">Totales Compras Período:</td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(filteredPurchases.reduce((s, p) => s + (p.subtotal || 0), 0), settings.currencySymbol)}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(filteredPurchases.reduce((s, p) => s + (p.taxTotal || 0), 0), settings.currencySymbol)}</td>
                      <td className="py-3 px-4 text-right text-indigo-700 text-sm">{formatCurrency(totalComprasPeriodo, settings.currencySymbol)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. REPORTE DE STOCK INMOVILIZADO */}
      {subTab === 'REP_STOCK_MUERTO' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Archive className="w-4 h-4 text-red-500" />
                  <span>Detección de Capital Inmovilizado en Percha</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Productos con nula rotación que representan costo financiero de almacenamiento.</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4 text-center">Stock Físico</th>
                    <th className="py-3 px-4 text-right">Costo Unit.</th>
                    <th className="py-3 px-4 text-right">Capital Inmovilizado</th>
                    <th className="py-3 px-4 text-center">Días sin Venta</th>
                    <th className="py-3 px-4 text-center">Nivel de Riesgo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {deadStockProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans text-xs">
                        Excelente: No existen productos con stock inmovilizado en este momento.
                      </td>
                    </tr>
                  ) : (
                    deadStockProducts.slice(0, 15).map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{prod.sku || '-'}</td>
                        <td className="py-3 px-4 font-sans font-bold text-slate-800">{prod.name}</td>
                        <td className="py-3 px-4 text-center font-black text-slate-700">{prod.stock}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">{formatCurrency(prod.costPrice || 0, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">{formatCurrency(prod.tiedUpValue, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-center font-bold text-amber-600">{prod.daysInactive} Días</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-black text-[10px] border ${
                            prod.risk === 'CRITICO' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            prod.risk === 'ALTO' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {prod.risk}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. ATS & FORMULARIOS TRIBUTARIOS SRI (REP_ATS, REP_FORMULARIO_104, REP_FORMULARIO_103) */}
      {['REP_ATS', 'REP_FORMULARIO_104', 'REP_FORMULARIO_103'].includes(subTab) && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-5 h-5 text-rose-500" />
                  <span>Consolidado Fiscal & Tributario SRI (Ecuador)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Información preparada para declaración mensual en DIMM Formularios / SRI en Línea.</p>
              </div>

              <button
                onClick={async () => {
                  const targetDate = new Date(startDate || Date.now());
                  const mes = String(targetDate.getMonth() + 1).padStart(2, '0');
                  const anio = String(targetDate.getFullYear());
                  const res = await generateAtsXml({
                    mes,
                    anio,
                    settings,
                    invoices,
                    purchases,
                    establishment: '001'
                  });
                  if (res.success) {
                    downloadXML(res.xml, res.filename);
                    showToast(`¡Archivo ${res.filename} generado y descargado!`, 'success');
                  } else {
                    showAlert('Error ATS', res.message);
                  }
                }}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-white text-xs font-black rounded-xl shadow transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4 text-lime-400" />
                <span>Generar XML ATS SRI ({startDate.substring(0, 7)})</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Identificación Contribuyente</span>
                <div className="text-sm font-black text-slate-900">{settings.storeName || "FERRETERÍA CENTRAL"}</div>
                <div className="text-xs font-mono font-bold text-orange-600">RUC: {settings.taxId || "1790000000001"}</div>
                <div className="text-[11px] text-slate-500 font-mono">Período Fiscal: {startDate.substring(0, 7)}</div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Base Imponible Ventas Tarifa 15%</span>
                <div className="text-xl font-black text-emerald-600 font-mono">{formatCurrency(subtotalVentasPeriodo, settings.currencySymbol)}</div>
                <div className="text-xs text-slate-600 font-mono">Impuesto Generado: {formatCurrency(totalIvaVentas, settings.currencySymbol)}</div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Retenciones Aplicadas en Fuente</span>
                <div className="text-xl font-black text-purple-600 font-mono">{formatCurrency(totalRetencionesPeriodo, settings.currencySymbol)}</div>
                <div className="text-xs text-slate-600 font-mono">{retenciones.length} Comprobantes de Retención</div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-800 text-xs font-medium">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>Los cálculos cumplen con las especificaciones de la ficha técnica del SRI para Anexo Transaccional Simplificado y Formularios 103/104.</span>
            </div>
          </div>
        </div>
      )}

      {/* 8. RESTO DE REPORTES (REP_COMISIONES, REP_RENTABILIDAD, REP_NOMINA, REP_DEVOLUCIONES, REP_ROTACION, REP_FLUJO_CAJA) */}
      {/* 8. REPORTE DE COMISIONES */}
      {subTab === 'REP_COMISIONES' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Liquidación de Comisiones por Vendedor ({commissionsSummary.length})</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Período evaluado: {startDate} al {endDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-amber-50 text-amber-700 font-black text-xs rounded-xl border border-amber-200">
                  Total a Liquidar: {formatCurrency(commissionsSummary.reduce((s, c) => s + c.commissionAmount, 0), settings.currencySymbol)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Agentes con Ventas</span>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">{commissionsSummary.length}</div>
                <div className="text-[11px] text-slate-500 font-medium">Asesores comerciales activos</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Ventas Netas Generadas</span>
                <div className="text-2xl font-black text-emerald-600 font-mono mt-1">
                  {formatCurrency(commissionsSummary.reduce((s, c) => s + c.salesSubtotal, 0), settings.currencySymbol)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Base imponible de comisión</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Comisiones Totales</span>
                <div className="text-2xl font-black text-amber-600 font-mono mt-1">
                  {formatCurrency(commissionsSummary.reduce((s, c) => s + c.commissionAmount, 0), settings.currencySymbol)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Liquidación del período</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Vendedor / Asesor</th>
                    <th className="py-3 px-4">Cargo / Función</th>
                    <th className="py-3 px-4 text-center">Facturas</th>
                    <th className="py-3 px-4 text-right">Meta Período</th>
                    <th className="py-3 px-4 text-right">Venta Total</th>
                    <th className="py-3 px-4 text-center">% Comisión</th>
                    <th className="py-3 px-4 text-right">Comisión a Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {commissionsSummary.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No hay ventas registradas por vendedores en el período {startDate} al {endDate}.
                      </td>
                    </tr>
                  ) : (
                    commissionsSummary.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-sans font-bold text-slate-900">{c.name}</td>
                        <td className="py-3 px-4 text-slate-500">{c.role}</td>
                        <td className="py-3 px-4 text-center font-black text-indigo-600">{c.invoicesCount}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(c.goal, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">{formatCurrency(c.salesTotal, settings.currencySymbol)}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">{c.commissionRate.toFixed(1)}%</td>
                        <td className="py-3 px-4 text-right font-black text-amber-600 text-sm">{formatCurrency(c.commissionAmount, settings.currencySymbol)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 9. REPORTE DE RENTABILIDAD & MARGEN BRUTO */}
      {subTab === 'REP_RENTABILIDAD' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span>Análisis de Rentabilidad & Margen Bruto Operativo</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Período auditado: {startDate} al {endDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Ingresos Facturados</span>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {formatCurrency(profitabilitySummary.totalRevenue, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Total ventas brutas</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Costo de Mercadería (CMV)</span>
                <div className="text-xl font-black text-rose-600 font-mono mt-1">
                  {formatCurrency(profitabilitySummary.totalCost, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Costo de adquisición items</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Utilidad Bruta</span>
                <div className="text-xl font-black text-emerald-600 font-mono mt-1">
                  {formatCurrency(profitabilitySummary.grossProfit, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Ingresos menos CMV</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Margen Bruto %</span>
                <div className="text-xl font-black text-indigo-600 font-mono mt-1">
                  {profitabilitySummary.marginPct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Rentabilidad promedio</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4 text-center">Unidades</th>
                    <th className="py-3 px-4 text-right">Ingresos</th>
                    <th className="py-3 px-4 text-right">Costo Total</th>
                    <th className="py-3 px-4 text-right">Ganancia Bruta</th>
                    <th className="py-3 px-4 text-center">Margen %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {topProductsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No hay ventas para calcular rentabilidad en el período {startDate} al {endDate}.
                      </td>
                    </tr>
                  ) : (
                    topProductsList.slice(0, 20).map((p, idx) => {
                      const costTotal = p.cost * p.units;
                      const profit = p.revenue - costTotal;
                      const pct = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">{p.sku}</td>
                          <td className="py-3 px-4 font-sans font-bold text-slate-800">{p.name}</td>
                          <td className="py-3 px-4 text-center font-black text-slate-700">{p.units}</td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">{formatCurrency(p.revenue, settings.currencySymbol)}</td>
                          <td className="py-3 px-4 text-right text-rose-600 font-medium">{formatCurrency(costTotal, settings.currencySymbol)}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">{formatCurrency(profit, settings.currencySymbol)}</td>
                          <td className="py-3 px-4 text-center font-black text-indigo-600">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 10. REPORTE DE FLUJO DE CAJA */}
      {subTab === 'REP_FLUJO_CAJA' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span>Flujo de Caja Operativo (Cash Flow)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Ingresos recaudados vs egresos por compras: {startDate} al {endDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Ingresos Efectivo</span>
                <div className="text-xl font-black text-emerald-700 font-mono mt-1">
                  {formatCurrency(cashFlowSummary.cashIn, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">Recaudación en billete físico</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">Ingresos Electrónicos</span>
                <div className="text-xl font-black text-blue-700 font-mono mt-1">
                  {formatCurrency(cashFlowSummary.electronicIn, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-blue-600 font-medium">Bancos / Tarjetas / Transferencias</div>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
                <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">Egresos por Compras</span>
                <div className="text-xl font-black text-rose-700 font-mono mt-1">
                  {formatCurrency(cashFlowSummary.purchasesOut, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-rose-600 font-medium">{filteredPurchases.length} adquisiciones registradas</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl text-white">
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider block">Flujo Neto del Período</span>
                <div className={`text-xl font-black font-mono mt-1 ${cashFlowSummary.netFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(cashFlowSummary.netFlow, settings.currencySymbol)}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Saldo operativo de caja</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. REPORTE DE DEVOLUCIONES Y RECHAZOS SRI */}
      {subTab === 'REP_DEVOLUCIONES' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  <span>Comprobantes Devueltos u Observados por el SRI ({filteredDevoluciones.length})</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Período de auditoría: {startDate} al {endDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-red-50 text-red-700 font-black text-xs rounded-xl border border-red-200">
                  Total Observado: {formatCurrency(filteredDevoluciones.reduce((s, i) => s + (i.total || 0), 0), settings.currencySymbol)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Comprobante</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Cliente / Razón Social</th>
                    <th className="py-3 px-4">Motivo / Mensaje del SRI</th>
                    <th className="py-3 px-4 text-right">Total ($)</th>
                    <th className="py-3 px-4 text-center">Estado SRI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {filteredDevoluciones.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans text-xs">
                        Excelente: No existen facturas devueltas por el SRI en el período {startDate} al {endDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredDevoluciones.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black text-slate-900">{inv.fullNumber || inv.number}</td>
                        <td className="py-3 px-4 text-slate-500">{inv.createdAt ? inv.createdAt.split('T')[0] : '-'}</td>
                        <td className="py-3 px-4 font-sans text-slate-800">
                          <strong className="text-slate-900 block">{inv.customer?.name || 'CONSUMIDOR FINAL'}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">{inv.customer?.docNumber || '9999999999999'}</span>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span className="text-[11px] text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200/60 font-semibold block">
                            {inv.sriMensaje || 'Comprobante devuelto por el SRI'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(inv.total || 0, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 font-black text-[10px] rounded-full border border-red-200">
                            DEVUELTA
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 12. OTROS REPORTES (REP_NOMINA, REP_ROTACION) */}
      {!['REP_VENTAS', 'REP_PRODUCTOS', 'REP_INVENTARIO', 'REP_CAJA', 'REP_COMPRAS', 'REP_STOCK_MUERTO', 'REP_ATS', 'REP_FORMULARIO_104', 'REP_FORMULARIO_103', 'REP_COMISIONES', 'REP_RENTABILIDAD', 'REP_FLUJO_CAJA', 'REP_DEVOLUCIONES'].includes(subTab) && (() => {
        const displayList = filteredInvoices;
        const totalMontoDisplay = totalVentasPeriodo;

        return (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  {currentMeta.icon}
                  <span>Detalle Analítico - {currentMeta.title}</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-400">{startDate} al {endDate}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Total Registros Auditados
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {displayList.length}
                  </div>
                  <div className="text-xs text-slate-500 font-bold">
                    Comprobantes en el rango seleccionado
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Monto Operacional
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-600">
                    {formatCurrency(totalMontoDisplay, settings.currencySymbol)}
                  </div>
                  <div className="text-xs text-slate-500 font-bold">
                    Volumen financiero procesado
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado de Verificación</span>
                  <div className="text-sm font-black flex items-center gap-1.5 mt-2 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>SIN DISCREPANCIAS</span>
                  </div>
                  <div className="text-xs text-slate-500 font-bold">
                    Consistencia contable en período
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700 font-mono">
                  <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Referencia</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Concepto Detallado</th>
                      <th className="py-3 px-4 text-right">Monto ($)</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                    {displayList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-sans text-xs">
                          No hay movimientos registrados para este reporte en el período {startDate} al {endDate}.
                        </td>
                      </tr>
                    ) : (
                      displayList.slice(0, 30).map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-black text-slate-900">{inv.fullNumber || inv.number}</td>
                          <td className="py-3 px-4 text-slate-500">{inv.createdAt ? inv.createdAt.split('T')[0] : '-'}</td>
                          <td className="py-3 px-4 font-sans text-slate-800">
                            {`${currentMeta.title}: ${inv.customer?.name || 'Consumidor Final'}`}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                            {formatCurrency(inv.total || 0, settings.currencySymbol)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded">
                              {inv.paymentStatus || 'COMPLETADO'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
      </div>

      {/* ── MODAL: REPORTE FORMAL IMPRIMIBLE / PDF ────────────────────────── */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl p-6 sm:p-8 space-y-6 shadow-2xl my-auto">
            {/* Modal Actions Header (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 bg-gradient-to-br ${currentMeta.color} text-white rounded-2xl shadow-sm`}>
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                    <span>Vista Previa de Impresión / PDF</span>
                    <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black rounded-full uppercase">
                      Documento Oficial A4
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {currentMeta.title} • Período: {startDate} al {endDate}
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
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Documento Imprimible Formal */}
            <div id="printable-report-document" className="bg-white p-4 sm:p-6 space-y-6 text-slate-900 text-xs">
              {/* Membrete Corporativo */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain border border-slate-200 rounded-xl p-1" />
                  ) : (
                    <div className="p-3 bg-slate-900 text-white rounded-xl font-black text-lg">
                      <Store className="w-8 h-8 text-orange-400" />
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
                    INFORME GERENCIAL
                  </span>
                  <p className="text-[11px] font-bold text-slate-900">{currentMeta.title}</p>
                  <p className="text-[10px] text-slate-600 font-mono">
                    Período: <strong>{startDate}</strong> al <strong>{endDate}</strong>
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Emisión: {new Date().toLocaleString('es-EC')}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Establecimiento: <strong>{selectedBranch === 'TODAS' ? 'Matriz & Sucursales' : selectedBranch}</strong>
                  </p>
                </div>
              </div>

              {/* Tarjetas de Resumen Ejecutivo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                {subTab === 'REP_INVENTARIO' ? (
                  <>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Productos</span>
                      <strong className="text-sm font-black text-slate-900 font-mono">{filteredProducts.length} ítems</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Stock Físico Total</span>
                      <strong className="text-sm font-black text-blue-600 font-mono">
                        {filteredProducts.reduce((acc, p) => acc + (p.stock || 0), 0)} u.
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Inversión Costo Total</span>
                      <strong className="text-sm font-black text-slate-900 font-mono">
                        {formatCurrency(totalValorInventarioCosto, settings.currencySymbol)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Valorización Total PVP</span>
                      <strong className="text-sm font-black text-emerald-600 font-mono">
                        {formatCurrency(totalValorInventarioPVP, settings.currencySymbol)}
                      </strong>
                    </div>
                  </>
                ) : subTab === 'REP_VENTAS' ? (
                  <>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Comprobantes</span>
                      <strong className="text-sm font-black text-slate-900 font-mono">{totalFacturasCount} docs</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Subtotal Neto</span>
                      <strong className="text-sm font-black text-slate-900 font-mono">
                        {formatCurrency(subtotalVentasPeriodo, settings.currencySymbol)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">IVA 15% Total</span>
                      <strong className="text-sm font-black text-orange-600 font-mono">
                        {formatCurrency(totalIvaVentas, settings.currencySymbol)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Facturado</span>
                      <strong className="text-sm font-black text-emerald-600 font-mono">
                        {formatCurrency(totalVentasPeriodo, settings.currencySymbol)}
                      </strong>
                    </div>
                  </>
                ) : subTab === 'REP_PRODUCTOS' ? (
                  <>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Ítems Vendidos</span>
                      <strong className="text-sm font-black text-slate-900 font-mono">{topProductsList.length} prod.</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Unidades Totales</span>
                      <strong className="text-sm font-black text-blue-600 font-mono">
                        {topProductsList.reduce((acc, p) => acc + p.units, 0)} u.
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Ingresos Generados</span>
                      <strong className="text-sm font-black text-emerald-600 font-mono">
                        {formatCurrency(topProductsList.reduce((acc, p) => acc + p.revenue, 0), settings.currencySymbol)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Margen Bruto Total</span>
                      <strong className="text-sm font-black text-purple-600 font-mono">
                        {formatCurrency(topProductsList.reduce((acc, p) => acc + (p.revenue - (p.cost * p.units)), 0), settings.currencySymbol)}
                      </strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Registros Totales</span>
                      <strong className="text-sm font-black text-slate-900 font-mono">{filteredInvoices.length}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Ventas Período</span>
                      <strong className="text-sm font-black text-emerald-600 font-mono">
                        {formatCurrency(totalVentasPeriodo, settings.currencySymbol)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Compras Período</span>
                      <strong className="text-sm font-black text-indigo-600 font-mono">
                        {formatCurrency(totalComprasPeriodo, settings.currencySymbol)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Retenciones</span>
                      <strong className="text-sm font-black text-slate-900 font-mono">
                        {formatCurrency(totalRetencionesPeriodo, settings.currencySymbol)}
                      </strong>
                    </div>
                  </>
                )}
              </div>

              {/* Tabla de Detalle Contable */}
              <div className="overflow-x-auto rounded-xl border border-slate-300">
                <table className="w-full text-left text-xs text-slate-800">
                  <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-wider">
                    {subTab === 'REP_INVENTARIO' ? (
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Descripción de Producto</th>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3 text-center">Stock</th>
                        <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                        <th className="py-2.5 px-3 text-right">PVP Unit.</th>
                        <th className="py-2.5 px-3 text-right">Total Costo</th>
                        <th className="py-2.5 px-3 text-right">Total PVP</th>
                        <th className="py-2.5 px-3 text-right">Margen</th>
                      </tr>
                    ) : subTab === 'REP_VENTAS' ? (
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">N° Factura</th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Cliente / Razón Social</th>
                        <th className="py-2.5 px-3">RUC / Cédula</th>
                        <th className="py-2.5 px-3 text-center">Pago</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3 text-right">IVA 15%</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    ) : subTab === 'REP_PRODUCTOS' ? (
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3 text-center">Cant. Vendida</th>
                        <th className="py-2.5 px-3 text-right">Ingresos Totales</th>
                        <th className="py-2.5 px-3 text-right">Costo Estimado</th>
                        <th className="py-2.5 px-3 text-right">Margen Bruto</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Documento / Ref</th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Detalle / Concepto</th>
                        <th className="py-2.5 px-3 text-right">Monto ($)</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white font-medium text-[11px]">
                    {subTab === 'REP_INVENTARIO' ? (
                      filteredProducts.map((p, idx) => {
                        const cost = (p.costPrice || 0) * (p.stock || 0);
                        const pvp = (p.price || 0) * (p.stock || 0);
                        const margin = pvp - cost;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-400 text-[10px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-bold text-orange-600">{p.sku || '-'}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{p.name}</td>
                            <td className="py-2 px-3 text-slate-600">{p.category || 'General'}</td>
                            <td className="py-2 px-3 text-center font-mono font-black text-slate-900">{p.stock || 0}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(p.costPrice || 0, settings.currencySymbol)}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(p.price || 0, settings.currencySymbol)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(cost, settings.currencySymbol)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{formatCurrency(pvp, settings.currencySymbol)}</td>
                            <td className="py-2 px-3 text-right font-mono font-black text-slate-900">{formatCurrency(margin, settings.currencySymbol)}</td>
                          </tr>
                        );
                      })
                    ) : subTab === 'REP_VENTAS' ? (
                      filteredInvoices.map((inv, idx) => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-400 text-[10px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-orange-600">{inv.fullNumber || inv.number}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{inv.createdAt ? inv.createdAt.split('T')[0] : '-'}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{inv.customer?.name || 'Consumidor Final'}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{inv.customer?.docNumber || '9999999999999'}</td>
                          <td className="py-2 px-3 text-center font-mono text-[10px] font-bold text-slate-700">{inv.paymentMethod || 'EFECTIVO'}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(inv.subtotal || 0, settings.currencySymbol)}</td>
                          <td className="py-2 px-3 text-right font-mono text-orange-600">{formatCurrency(inv.taxTotal || 0, settings.currencySymbol)}</td>
                          <td className="py-2 px-3 text-right font-mono font-black text-slate-900">{formatCurrency(inv.total || 0, settings.currencySymbol)}</td>
                        </tr>
                      ))
                    ) : subTab === 'REP_PRODUCTOS' ? (
                      topProductsList.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-400 text-[10px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-blue-600">{p.sku}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{p.name}</td>
                          <td className="py-2 px-3 text-slate-600">{p.category}</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-slate-900">{p.units}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{formatCurrency(p.revenue, settings.currencySymbol)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(p.cost * p.units, settings.currencySymbol)}</td>
                          <td className="py-2 px-3 text-right font-mono font-black text-purple-700">{formatCurrency(p.revenue - (p.cost * p.units), settings.currencySymbol)}</td>
                        </tr>
                      ))
                    ) : (
                      filteredInvoices.map((inv, idx) => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-400 text-[10px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{inv.fullNumber || inv.number}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{inv.createdAt ? inv.createdAt.split('T')[0] : '-'}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{currentMeta.title}: {inv.customer?.name || 'Consumidor Final'}</td>
                          <td className="py-2 px-3 text-right font-mono font-black text-slate-900">{formatCurrency(inv.total || 0, settings.currencySymbol)}</td>
                          <td className="py-2 px-3 text-center font-mono text-[10px]">{inv.paymentStatus || 'ACTIVA'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* Fila de Totales Generales */}
                  <tfoot className="bg-slate-100 text-slate-950 font-black border-t-2 border-slate-900 text-xs">
                    {subTab === 'REP_INVENTARIO' ? (
                      <tr>
                        <td colSpan={4} className="py-3 px-3 uppercase tracking-wider text-right font-black">
                          TOTALES GENERALES:
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black">
                          {filteredProducts.reduce((acc, p) => acc + (p.stock || 0), 0)} u.
                        </td>
                        <td colSpan={2} />
                        <td className="py-3 px-3 text-right font-mono font-black">
                          {formatCurrency(totalValorInventarioCosto, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-700">
                          {formatCurrency(totalValorInventarioPVP, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                          {formatCurrency(gananciaPotencialInventario, settings.currencySymbol)}
                        </td>
                      </tr>
                    ) : subTab === 'REP_VENTAS' ? (
                      <tr>
                        <td colSpan={6} className="py-3 px-3 uppercase tracking-wider text-right font-black">
                          TOTALES CONSOLIDADOS ({totalFacturasCount} COMPROBANTES):
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black">
                          {formatCurrency(subtotalVentasPeriodo, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-orange-600">
                          {formatCurrency(totalIvaVentas, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-700">
                          {formatCurrency(totalVentasPeriodo, settings.currencySymbol)}
                        </td>
                      </tr>
                    ) : subTab === 'REP_PRODUCTOS' ? (
                      <tr>
                        <td colSpan={4} className="py-3 px-3 uppercase tracking-wider text-right font-black">
                          TOTALES:
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black">
                          {topProductsList.reduce((acc, p) => acc + p.units, 0)} u.
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-700">
                          {formatCurrency(topProductsList.reduce((acc, p) => acc + p.revenue, 0), settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black">
                          {formatCurrency(topProductsList.reduce((acc, p) => acc + (p.cost * p.units), 0), settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-purple-700">
                          {formatCurrency(topProductsList.reduce((acc, p) => acc + (p.revenue - (p.cost * p.units)), 0), settings.currencySymbol)}
                        </td>
                      </tr>
                    ) : null}
                  </tfoot>
                </table>
              </div>

              {/* Firmas de Responsabilidad */}
              <div className="grid grid-cols-3 gap-8 pt-10 text-center text-xs">
                <div className="border-t-2 border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Elaborado por</p>
                  <p className="text-slate-500 text-[10px]">Responsable de Operaciones</p>
                </div>
                <div className="border-t-2 border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Revisado por</p>
                  <p className="text-slate-500 text-[10px]">Contabilidad / Auditoría</p>
                </div>
                <div className="border-t-2 border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Aprobado por</p>
                  <p className="text-slate-500 text-[10px]">Gerencia General</p>
                </div>
              </div>
            </div>

            {/* Modal Footer (Hidden in Print) */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 no-print">
              <button
                type="button"
                onClick={() => setIsPrintPreviewOpen(false)}
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
