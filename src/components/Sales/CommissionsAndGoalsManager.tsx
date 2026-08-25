import React, { useState, useMemo } from 'react';
import { 
  Target, 
  TrendingUp, 
  Award, 
  DollarSign, 
  Users, 
  Calendar, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  FileSpreadsheet, 
  Download, 
  Plus, 
  Search, 
  Sparkles, 
  Filter, 
  ChevronRight, 
  Briefcase, 
  Percent, 
  Layers, 
  Clock,
  X,
  FileText,
  Send
} from 'lucide-react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { useModal } from '../../context/ModalContext';
import { Invoice, StoreSettings } from '../../types';
import { formatCurrency, formatFullDate } from '../../utils/formatters';
import { exportToModernExcel } from '../../utils/excelExport';
import { defaultEmployees, defaultUsersList } from '../../data/initialData';
import { Select } from '../Shared/Select';

export interface SellerGoalRecord {
  employeeId: string;
  monthlyTarget: number;
  commissionRatePercent: number;
  bonusOverachievement: number;
  notes?: string;
}

const defaultGoals: SellerGoalRecord[] = [];

interface CommissionsAndGoalsManagerProps {
  invoices: Invoice[];
  settings: StoreSettings;
  onNavigateToTab?: (tab: string) => void;
}

export const CommissionsAndGoalsManager: React.FC<CommissionsAndGoalsManagerProps> = ({
  invoices,
  settings,
  onNavigateToTab,
}) => {
  const { showAlert, showToast, showConfirm } = useModal();

  // ── Sync with Real Employees, Users and Goals ──────────────────────────────
  const [employees] = useFirestoreSync<any[]>('ferreteria_hr_employees', defaultEmployees);
  const [usersList] = useFirestoreSync<any[]>('ferreteria_settings_users_list', defaultUsersList);
  const [goals, setGoals] = useFirestoreSync<SellerGoalRecord[]>('ferreteria_seller_goals', []);
  const [incomes, setIncomes] = useFirestoreSync<any[]>('ferreteria_hr_incomes', []);

  // Filter Period
  const [selectedPeriod, setSelectedPeriod] = useState<'ESTE_MES' | 'MES_ANTERIOR' | 'TODOS'>('ESTE_MES');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [editingGoal, setEditingGoal] = useState<SellerGoalRecord | null>(null);
  const [editingEmployeeName, setEditingEmployeeName] = useState<string>('');
  const [viewingEmployeeSales, setViewingEmployeeSales] = useState<{ id: string; name: string } | null>(null);

  // Form State for Editing Goal
  const [targetInput, setTargetInput] = useState('5000');
  const [rateInput, setRateInput] = useState('2');
  const [bonusInput, setBonusInput] = useState('50');

  // ── Combine real employees and users without duplicates ───────────────────
  const allStaff = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string; position: string; department: string; status: string }>();

    employees.forEach(emp => {
      map.set(emp.fullName.toLowerCase().trim(), {
        id: emp.id,
        name: emp.fullName,
        code: emp.code || 'EMP',
        position: emp.positionName || 'Asesor Comercial',
        department: emp.departmentName || 'Ventas',
        status: emp.status || 'ACTIVO',
      });
    });

    usersList.forEach(usr => {
      const key = usr.name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          id: usr.id,
          name: usr.name,
          code: usr.role || 'USR',
          position: usr.role || 'Ventas',
          department: 'Operaciones',
          status: usr.status === 'Activo' ? 'ACTIVO' : 'ACTIVO',
        });
      }
    });

    return Array.from(map.values());
  }, [employees, usersList]);

  // ── Date range filter helper ───────────────────────────────────────────────
  const currentMonthDate = new Date();
  const currentMonth = currentMonthDate.getMonth();
  const currentYear = currentMonthDate.getFullYear();

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.paymentStatus === 'ANULADA') return false;
      const invDate = new Date(inv.createdAt);
      if (selectedPeriod === 'ESTE_MES') {
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
      }
      if (selectedPeriod === 'MES_ANTERIOR') {
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return invDate.getMonth() === prevMonth && invDate.getFullYear() === prevYear;
      }
      return true;
    });
  }, [invoices, selectedPeriod, currentMonth, currentYear]);

  // ── Compute Performance per Real Employee ──────────────────────────────────
  const staffPerformance = useMemo(() => {
    return allStaff.map(staff => {
      // Find configured goals or fallback
      const goal = goals.find(g => g.employeeId === staff.id) || {
        employeeId: staff.id,
        monthlyTarget: 5000,
        commissionRatePercent: 2.0,
        bonusOverachievement: 50,
      };

      // Match invoices by sellerName
      const staffInvoices = filteredInvoices.filter(inv => {
        if (!inv.sellerName) return false;
        const sName = inv.sellerName.toLowerCase().trim();
        const empName = staff.name.toLowerCase().trim();
        return sName.includes(empName) || empName.includes(sName);
      });

      const totalSold = staffInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const salesCount = staffInvoices.length;
      const avgTicket = salesCount > 0 ? totalSold / salesCount : 0;
      const progressPercent = goal.monthlyTarget > 0 ? Math.round((totalSold / goal.monthlyTarget) * 100) : 0;
      
      const isGoalMet = totalSold >= goal.monthlyTarget && goal.monthlyTarget > 0;
      const baseCommission = totalSold * (goal.commissionRatePercent / 100);
      const bonus = isGoalMet ? (goal.bonusOverachievement || 0) : 0;
      const totalCommission = baseCommission + bonus;

      return {
        staff,
        goal,
        invoices: staffInvoices,
        totalSold,
        salesCount,
        avgTicket,
        progressPercent,
        isGoalMet,
        baseCommission,
        bonus,
        totalCommission,
      };
    });
  }, [allStaff, goals, filteredInvoices]);

  // Search filter
  const displayedStaff = useMemo(() => {
    return staffPerformance.filter(p => 
      p.staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.staff.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.staff.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staffPerformance, searchTerm]);

  // Summary Metrics
  const totalPeriodSales = staffPerformance.reduce((sum, p) => sum + p.totalSold, 0);
  const totalPeriodCommissions = staffPerformance.reduce((sum, p) => sum + p.totalCommission, 0);
  const avgGoalProgress = staffPerformance.length > 0
    ? Math.round(staffPerformance.reduce((sum, p) => sum + p.progressPercent, 0) / staffPerformance.length)
    : 0;
  
  const topSeller = useMemo(() => {
    if (staffPerformance.length === 0) return null;
    const sorted = [...staffPerformance].sort((a, b) => b.totalSold - a.totalSold);
    return sorted[0]?.totalSold > 0 ? sorted[0] : null;
  }, [staffPerformance]);

  // ── Open Edit Goal Modal ───────────────────────────────────────────────────
  const handleOpenEditGoal = (staffItem: typeof staffPerformance[0]) => {
    setEditingGoal(staffItem.goal);
    setEditingEmployeeName(staffItem.staff.name);
    setTargetInput(staffItem.goal.monthlyTarget.toString());
    setRateInput(staffItem.goal.commissionRatePercent.toString());
    setBonusInput((staffItem.goal.bonusOverachievement || 0).toString());
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;

    const newTarget = parseFloat(targetInput) || 0;
    const newRate = parseFloat(rateInput) || 0;
    const newBonus = parseFloat(bonusInput) || 0;

    setGoals(prev => {
      const existsIndex = prev.findIndex(g => g.employeeId === editingGoal.employeeId);
      const updatedRecord: SellerGoalRecord = {
        employeeId: editingGoal.employeeId,
        monthlyTarget: newTarget,
        commissionRatePercent: newRate,
        bonusOverachievement: newBonus,
      };

      if (existsIndex >= 0) {
        const copy = [...prev];
        copy[existsIndex] = updatedRecord;
        return copy;
      }
      return [...prev, updatedRecord];
    });

    setEditingGoal(null);
    showToast(`Metas y comisión actualizadas para ${editingEmployeeName}.`, 'success');
  };

  // ── Send Commission to Payroll / RRHH ─────────────────────────────────────
  const handleSendToPayroll = (perf: typeof staffPerformance[0]) => {
    if (perf.totalCommission <= 0) {
      showAlert('Este empleado no tiene comisiones acumuladas en el período seleccionado.', 'Sin Comisiones', 'warning');
      return;
    }

    showConfirm(
      `¿Desea registrar automáticamente el bono de comisión por ${formatCurrency(perf.totalCommission, settings.currencySymbol)} a favor de ${perf.staff.name} en el módulo de Recursos Humanos (Rol de Pagos)?`,
      () => {
        const newIncome = {
          id: `inc-comm-${Date.now()}`,
          employeeId: perf.staff.id,
          employeeName: perf.staff.name,
          concept: 'COMISION_VENTAS',
          date: new Date().toISOString().split('T')[0],
          amount: perf.totalCommission,
          description: `Comisión por Ventas ${selectedPeriod === 'ESTE_MES' ? 'Mes Actual' : selectedPeriod} (Total Vendido: ${formatCurrency(perf.totalSold, settings.currencySymbol)} - Avance: ${perf.progressPercent}%)`,
        };

        setIncomes(prev => [newIncome, ...prev]);
        showAlert(
          `¡Comisión de ${formatCurrency(perf.totalCommission, settings.currencySymbol)} enviada y registrada con éxito en el Rol de Pagos de ${perf.staff.name}!`,
          'Registrado en RRHH',
          'success'
        );
      },
      'Transferir Comisión a Nómina',
      'Sí, Transferir',
      'Cancelar'
    );
  };

  // ── Export Excel Report ───────────────────────────────────────────────────
  const handleExportExcel = () => {
    const columns = [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Empleado / Vendedor', key: 'name', width: 25 },
      { header: 'Cargo', key: 'position', width: 22 },
      { header: 'Departamento', key: 'department', width: 20 },
      { header: 'Comprobantes', key: 'salesCount', width: 14 },
      { header: 'Total Vendido ($)', key: 'totalSold', width: 18 },
      { header: 'Meta Mensual ($)', key: 'target', width: 18 },
      { header: '% Cumplimiento', key: 'progress', width: 16 },
      { header: '% Comisión', key: 'rate', width: 14 },
      { header: 'Comisión Base ($)', key: 'baseComm', width: 18 },
      { header: 'Bono Meta ($)', key: 'bonus', width: 16 },
      { header: 'Total Comisión ($)', key: 'totalComm', width: 18 },
      { header: 'Estado', key: 'status', width: 15 },
    ];

    const dataToExport = staffPerformance.map(p => ({
      code: p.staff.code,
      name: p.staff.name,
      position: p.staff.position,
      department: p.staff.department,
      salesCount: p.salesCount,
      totalSold: p.totalSold,
      target: p.goal.monthlyTarget,
      progress: `${p.progressPercent}%`,
      rate: `${p.goal.commissionRatePercent}%`,
      baseComm: p.baseCommission,
      bonus: p.bonus,
      totalComm: p.totalCommission,
      status: p.isGoalMet ? 'CUMPLIDA' : `${p.progressPercent}%`,
    }));

    exportToModernExcel({
      filename: `Reporte_Comisiones_Metas_${selectedPeriod}_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Comisiones y Metas',
      title: 'REPORTE DE COMISIONES Y METAS DE EMPLEADOS',
      columns,
      data: dataToExport,
    });
    showToast('Reporte de comisiones y metas descargado en Excel.', 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-slate-950 text-orange-400 rounded-2xl border border-slate-800 shadow-md">
            <Target className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-950">Comisiones y Metas de Empleados</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-50 text-orange-700 border border-orange-200">
                Enlace Real con RRHH & Ventas
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Rendimiento individual por cada empleado registrado, cálculo automático de comisiones y conexión con roles de pago.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period Selector Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1">
            <button
              onClick={() => setSelectedPeriod('ESTE_MES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedPeriod === 'ESTE_MES'
                  ? 'bg-white text-slate-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setSelectedPeriod('MES_ANTERIOR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedPeriod === 'MES_ANTERIOR'
                  ? 'bg-white text-slate-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mes Anterior
            </button>
            <button
              onClick={() => setSelectedPeriod('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedPeriod === 'TODOS'
                  ? 'bg-white text-slate-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Histórico
            </button>
          </div>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Ventas del Período</span>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-950 font-mono">
            {formatCurrency(totalPeriodSales, settings.currencySymbol)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Facturas procesadas por el equipo
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Comisiones a Liquidar</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {formatCurrency(totalPeriodCommissions, settings.currencySymbol)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Incentivos y bonos por metas
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Cumplimiento Global</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono">
            {avgGoalProgress}%
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Promedio de avance del personal
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Vendedor Líder</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-black text-slate-900 truncate">
            {topSeller ? topSeller.staff.name : 'Sin ventas aún'}
          </div>
          <div className="text-[11px] text-amber-700 font-bold font-mono">
            {topSeller ? `${formatCurrency(topSeller.totalSold, settings.currencySymbol)} (${topSeller.progressPercent}%)` : '---'}
          </div>
        </div>
      </div>

      {/* Main Staff Performance Grid */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por empleado, cargo o departamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <span className="text-xs text-slate-500 font-bold">
            {displayedStaff.length} Empleados Monitoreados
          </span>
        </div>

        {displayedStaff.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-black text-slate-800 uppercase">
              No se encontraron empleados registrados
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
              Los empleados creados en el módulo de Recursos Humanos o en Usuarios del Sistema aparecerán automáticamente aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {displayedStaff.map((item) => {
              const pct = item.progressPercent;
              const isMet = item.isGoalMet;

              return (
                <div
                  key={item.staff.id}
                  className="bg-white border border-slate-200/90 hover:border-orange-300 rounded-2xl p-5 shadow-xs space-y-4 transition group"
                >
                  {/* Top Bar: Employee Info & Goal Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                        {item.staff.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-black text-slate-900 truncate">{item.staff.name}</h3>
                          <span className="text-[10px] font-mono text-slate-400 font-bold shrink-0">
                            ({item.staff.code})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium truncate">
                          {item.staff.position} • <span className="text-slate-400">{item.staff.department}</span>
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shrink-0 border ${
                        isMet
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : pct >= 50
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isMet ? '🎉 Meta Cumplida' : `${pct}% Alcanzado`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Avance de Meta Mensual:</span>
                      <span className="font-mono text-slate-900">{pct}% ({formatCurrency(item.totalSold, settings.currencySymbol)} / {formatCurrency(item.goal.monthlyTarget, settings.currencySymbol)})</span>
                    </div>
                    <div className="w-full h-3.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isMet
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : pct >= 50
                            ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                            : 'bg-gradient-to-r from-rose-500 to-orange-400'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Ventas</span>
                      <span className="font-mono font-black text-slate-900 text-xs mt-0.5 block">
                        {item.salesCount} facturas
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Ticket Prom.</span>
                      <span className="font-mono font-black text-slate-900 text-xs mt-0.5 block">
                        {formatCurrency(item.avgTicket, settings.currencySymbol)}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">% Comisión</span>
                      <span className="font-mono font-black text-slate-900 text-xs mt-0.5 block">
                        {item.goal.commissionRatePercent}%
                      </span>
                    </div>

                    <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 font-bold block uppercase">Comisión Total</span>
                      <span className="font-mono font-black text-emerald-700 text-xs mt-0.5 block">
                        {formatCurrency(item.totalCommission, settings.currencySymbol)}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditGoal(item)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1 transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Ajustar Metas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewingEmployeeSales({ id: item.staff.id, name: item.staff.name })}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1 transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ver Facturas ({item.salesCount})</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendToPayroll(item)}
                      disabled={item.totalCommission <= 0}
                      className={`px-3 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                        item.totalCommission > 0
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar a Nómina RRHH</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Edit Goal & Commission */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
                  <Target className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Configurar Metas y Comisión</h3>
                  <p className="text-xs text-slate-400 font-medium">{editingEmployeeName}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingGoal(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Meta Mensual de Ventas ($):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Porcentaje de Comisión (% sobre ventas):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    placeholder="0.0"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Bono Extra por Superar la Meta ($):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={bonusInput}
                    onChange={(e) => setBonusInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Se sumará a la liquidación únicamente si el empleado alcanza o supera el 100% de su meta mensual.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Invoices for Selected Employee */}
      {viewingEmployeeSales && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
                  <FileText className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Facturas Emitidas</h3>
                  <p className="text-xs text-slate-400 font-medium">Vendedor: {viewingEmployeeSales.name}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingEmployeeSales(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {(() => {
                const empInvoices = filteredInvoices.filter(inv => {
                  if (!inv.sellerName) return false;
                  const sName = inv.sellerName.toLowerCase().trim();
                  const empName = viewingEmployeeSales.name.toLowerCase().trim();
                  return sName.includes(empName) || empName.includes(sName);
                });

                if (empInvoices.length === 0) {
                  return (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs font-medium">
                      No hay comprobantes emitidos por {viewingEmployeeSales.name} en el período seleccionado.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-white uppercase font-black text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3.5">N° Comprobante</th>
                          <th className="py-2.5 px-3.5">Fecha</th>
                          <th className="py-2.5 px-3.5">Cliente</th>
                          <th className="py-2.5 px-3.5">Pago</th>
                          <th className="py-2.5 px-3.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {empInvoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3.5 font-mono font-bold text-slate-950">{inv.fullNumber}</td>
                            <td className="py-2.5 px-3.5 text-slate-500">{formatFullDate(inv.createdAt)}</td>
                            <td className="py-2.5 px-3.5 font-bold text-slate-800">{inv.customer.name}</td>
                            <td className="py-2.5 px-3.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                {inv.paymentMethod}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono font-black text-orange-600">
                              {formatCurrency(inv.total, settings.currencySymbol)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingEmployeeSales(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
