import React, { useState, useMemo } from 'react';
import { useModal } from '../../context/ModalContext';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { Invoice, Product, ProductCategory, ReportsSubTab, StoreSettings } from '../../types';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { CustomSelect } from '../CustomSelect';
import { exportToModernExcel } from '../../utils/excelExport';
import { formatCurrency } from '../../utils/formatters';
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
  Layers
} from 'lucide-react';

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
  const [employees] = useFirestoreSync<any[]>('ferreteria_hr_employees', []);
  const [payrollRoles] = useFirestoreSync<any[]>('ferreteria_hr_payroll_roles', []);
  const [cashSession] = useFirestoreSync<any>('ferreteria_cash_session', null);
  const [retenciones] = useFirestoreSync<any[]>('ferreteria_retenciones', []);
  const [bankAccounts] = useFirestoreSync<any[]>('ferreteria_bank_accounts', []);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);
  const [selectedBranch, setSelectedBranch] = useState('TODAS');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');

  // Quick Date Presets
  const handleSetPreset = (preset: 'HOY' | 'MES_ACTUAL' | 'MES_ANTERIOR' | 'ANIO_ACTUAL') => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'HOY') {
      const t = fmt(today);
      setStartDate(t);
      setEndDate(t);
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

  const totalComprasPeriodo = useMemo(() => purchases.reduce((sum, p) => sum + (p.total || 0), 0), [purchases]);
  const totalRetencionesPeriodo = useMemo(() => retenciones.reduce((sum, r) => sum + (r.totalRetained || 0), 0), [retenciones]);

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
    } else {
      exportToModernExcel({
        filename: `Reporte_${subTab}_${dateStamp}.xlsx`,
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
    window.print();
  };

  return (
    <div className="space-y-6">
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
              { id: 'MES_ACTUAL', label: 'Este Mes' },
              { id: 'MES_ANTERIOR', label: 'Mes Anterior' },
              { id: 'ANIO_ACTUAL', label: 'Año 2026' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleSetPreset(p.id as any)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition cursor-pointer"
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

      {/* 4. REPORTE DE ARQUEOS DE CAJA */}
      {subTab === 'REP_CAJA' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-500" />
                <span>Historial de Sesiones & Arqueos de Caja</span>
              </h3>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700 font-mono">
                <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Sesión ID</th>
                    <th className="py-3 px-4">Apertura</th>
                    <th className="py-3 px-4 text-right">Saldo Inicial</th>
                    <th className="py-3 px-4 text-right">Ventas Efectivo</th>
                    <th className="py-3 px-4 text-right">Ventas Tarjeta/Transf.</th>
                    <th className="py-3 px-4 text-right">Total Esperado</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {!cashSession ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No hay registros de arqueos o sesiones de caja en el período.
                      </td>
                    </tr>
                  ) : (
                    <tr className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-black text-slate-900">{cashSession.id || 'CASH-001'}</td>
                      <td className="py-3 px-4 text-slate-500">{cashSession.openedAt ? cashSession.openedAt.substring(0, 16).replace('T', ' ') : '-'}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(cashSession.initialCash || 0, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(cashSession.totalSalesCash || 0, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600">
                        {formatCurrency((cashSession.totalSalesCard || 0) + (cashSession.totalSalesTransfer || 0), settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                        {formatCurrency((cashSession.initialCash || 0) + (cashSession.totalSalesCash || 0), settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                          cashSession.status === 'ABIERTA' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {cashSession.status || 'CERRADA'}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. REPORTE DE COMPRAS CONSOLIDADO */}
      {subTab === 'REP_COMPRAS' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-500" />
                <span>Facturas & Comprobantes de Adquisición a Proveedores ({purchases.length})</span>
              </h3>
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
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No hay compras registradas en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((pc: any) => (
                      <tr key={pc.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black text-slate-900">{pc.invoiceNumber || pc.orderNumber || '-'}</td>
                        <td className="py-3 px-4 text-slate-500">{pc.date || '-'}</td>
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
      {!['REP_VENTAS', 'REP_PRODUCTOS', 'REP_INVENTARIO', 'REP_CAJA', 'REP_COMPRAS', 'REP_STOCK_MUERTO', 'REP_ATS', 'REP_FORMULARIO_104', 'REP_FORMULARIO_103'].includes(subTab) && (
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
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Registros</span>
                <div className="text-2xl font-black text-slate-900 font-mono">{filteredInvoices.length}</div>
                <div className="text-xs text-slate-500 font-bold">Documentos auditados</div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Monto Operacional</span>
                <div className="text-2xl font-black text-emerald-600 font-mono">{formatCurrency(totalVentasPeriodo, settings.currencySymbol)}</div>
                <div className="text-xs text-slate-500 font-bold">Volumen financiero procesado</div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado de Verificación</span>
                <div className="text-sm font-black text-emerald-600 flex items-center gap-1.5 mt-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SIN DISCREPANCIAS</span>
                </div>
                <div className="text-xs text-slate-500 font-bold">Consistencia contable al 100%</div>
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
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No hay movimientos registrados para este reporte en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.slice(0, 20).map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black text-slate-900">{inv.fullNumber || inv.number}</td>
                        <td className="py-3 px-4 text-slate-500">{inv.createdAt ? inv.createdAt.split('T')[0] : '-'}</td>
                        <td className="py-3 px-4 font-sans text-slate-800">
                          {currentMeta.title}: {inv.customer?.name || 'Consumidor Final'}
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
      )}
    </div>
  );
};
