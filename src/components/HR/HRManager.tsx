import React, { useState } from 'react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Percent, 
  Sun, 
  FileSpreadsheet, 
  Award, 
  Building2, 
  Briefcase, 
  UserPlus, 
  AlertCircle, 
  Plus, 
  Search, 
  CheckCircle2, 
  X, 
  Trash2,
  Edit,
  Eye,
  Printer,
  Download
} from 'lucide-react';
import { HRSubTab, StoreSettings } from '../../types';
import { validateEcuadorianDocument } from '../../utils/ecuadorianValidator';
import { useModal } from '../../context/ModalContext';
import { formatCurrency } from '../../utils/formatters';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { Select } from '../Shared/Select';

interface HRManagerProps {
  subTab: HRSubTab;
  settings: StoreSettings;
}

export interface Employee {
  id: string;
  code: string;
  idNumber: string;
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  departmentName: string;
  positionId: string;
  positionName: string;
  hireDate: string;
  baseSalary: number;
  contractType: 'INDEFINIDO' | 'EVENTUAL' | 'PRUEBA' | 'SERVICIOS_PROFESIONALES';
  iessAffiliationNumber: string;
  bankAccount: string;
  status: 'ACTIVO' | 'VACACIONES' | 'SUSPENDIDO' | 'INACTIVO';
}

export interface PayrollRole {
  id: string;
  period: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  positionName: string;
  baseSalary: number;
  overtimeAmount: number;
  commissionsAmount: number;
  otherIncomes: number;
  totalGrossIncome: number;
  iessPersonalDeduction: number;
  advancesDeduction: number;
  loansDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  status: 'BORRADOR' | 'APROBADO' | 'PAGADO';
}

export interface ExtraIncome {
  id: string;
  employeeId: string;
  employeeName: string;
  concept: 'COMISION_VENTAS' | 'BONO_CUMPLIMIENTO' | 'HORAS_EXTRAS_50' | 'HORAS_EXTRAS_100' | 'VIATICOS';
  date: string;
  amount: number;
  description: string;
}

export interface Discount {
  id: string;
  employeeId: string;
  employeeName: string;
  concept: 'PRESTAMO_EMPRESA' | 'PRESTAMO_QUIROGRAFARIO' | 'ATRASO_MULTA' | 'ANTICIPO_SUELDO';
  date: string;
  amount: number;
  description: string;
}

export interface VacationRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  periodYears: string;
  daysEarned: number;
  daysTaken: number;
  daysPending: number;
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'SOLICITADO' | 'APROBADO' | 'EN_GOSE' | 'COMPLETADO';
}

export interface SeverancePay {
  id: string;
  employeeId: string;
  employeeName: string;
  terminationDate: string;
  reason: 'DESAHUCIO' | 'DESPIDO_INTEMPESTIVO' | 'RENUNCIA_VOLUNTARIA' | 'FIN_CONTRATO';
  yearsWorked: number;
  indemnificationAmount: number;
  vacationPendingAmount: number;
  decimosProportionalAmount: number;
  discountsAmount?: number;
  totalLiquidation: number;
  status: 'EN_CALCULO' | 'APROBADO' | 'PAGADO';
}

export interface DecimoRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'DECIMO_TERCERO' | 'DECIMO_CUARTO';
  year: number;
  mode: 'ACUMULADO' | 'MENSUALIZADO';
  calculatedAmount: number;
  paymentDate: string;
  status: 'PENDIENTE' | 'PAGADO_IESS';
}

export interface Department {
  id: string;
  code: string;
  name: string;
  headPerson: string;
  employeeCount: number;
  address?: string;
}

export interface JobPosition {
  id: string;
  code: string;
  title: string;
  departmentName: string;
  minSalary: number;
}

export interface HRNovelty {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  type: 'ATRASO' | 'FALTA_JUSTIFICADA' | 'PERMISO_MEDICO' | 'MEMORANDO' | 'FELICITACION';
  description: string;
  penaltyAmount?: number;
}

export const HRManager: React.FC<HRManagerProps> = ({
  subTab,
  settings
}) => {
  const { showAlert, showToast, showConfirm } = useModal();
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editingDepId, setEditingDepId] = useState<string | null>(null);
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [departments, setDepartments] = useFirestoreSync<Department[]>('ferreteria_hr_departments', []);

  const [positions, setPositions] = useFirestoreSync<JobPosition[]>('ferreteria_hr_positions', []);

  const [employees, setEmployees] = useFirestoreSync<Employee[]>('ferreteria_hr_employees', []);
  const [payrollRoles, setPayrollRoles] = useFirestoreSync<PayrollRole[]>('ferreteria_hr_payroll_roles', []);
  const [incomes, setIncomes] = useFirestoreSync<ExtraIncome[]>('ferreteria_hr_incomes', []);
  const [discounts, setDiscounts] = useFirestoreSync<Discount[]>('ferreteria_hr_discounts', []);
  const [vacations, setVacations] = useFirestoreSync<VacationRecord[]>('ferreteria_hr_vacations', []);
  const [liquidations, setLiquidations] = useFirestoreSync<SeverancePay[]>('ferreteria_hr_liquidations', []);
  const [decimos, setDecimos] = useFirestoreSync<DecimoRecord[]>('ferreteria_hr_decimos', []);
  const [novelties, setNovelties] = useFirestoreSync<HRNovelty[]>('ferreteria_hr_novelties', []);

  const [searchTerm, setSearchTerm] = useState('');

  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isIncModalOpen, setIsIncModalOpen] = useState(false);
  const [isDscModalOpen, setIsDscModalOpen] = useState(false);
  const [isVacModalOpen, setIsVacModalOpen] = useState(false);
  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [isNovModalOpen, setIsNovModalOpen] = useState(false);
  const [isLiqModalOpen, setIsLiqModalOpen] = useState(false);
  const [isDecimoModalOpen, setIsDecimoModalOpen] = useState(false);
  const [newDecimo, setNewDecimo] = useState({
    employeeId: '',
    employeeName: '',
    type: 'DECIMO_TERCERO',
    year: new Date().getFullYear(),
    mode: 'ACUMULADO',
    calculatedAmount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    status: 'PENDIENTE'
  });
  const [newLiq, setNewLiq] = useState({
    employeeId: '',
    employeeName: '',
    terminationDate: new Date().toISOString().split('T')[0],
    reason: 'DESAHUCIO',
    yearsWorked: 1,
    indemnificationAmount: 0,
    vacationPendingAmount: 0,
    decimosProportionalAmount: 0,
    discountsAmount: 0,
  });

  const [newEmp, setNewEmp] = useState({
    code: '',
    idNumber: '',
    fullName: '',
    email: '',
    phone: '',
    departmentId: 'dep-1',
    positionId: 'pos-1',
    hireDate: new Date().toISOString().split('T')[0],
    baseSalary: 460,
    contractType: 'INDEFINIDO' as Employee['contractType'],
    iessAffiliationNumber: '',
    bankAccount: ''
  });

  const [newRole, setNewRole] = useState({
    employeeId: 'emp-1',
    period: '2026-08',
    overtimeAmount: 0,
    commissionsAmount: 0,
    otherIncomes: 0,
    advancesDeduction: 0,
    loansDeduction: 0,
    otherDeductions: 0
  });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [viewingRole, setViewingRole] = useState<PayrollRole | null>(null);

  const [newInc, setNewInc] = useState({
    employeeId: 'emp-1',
    concept: 'COMISION_VENTAS' as ExtraIncome['concept'],
    amount: '',
    description: ''
  });

  const [newDsc, setNewDsc] = useState({
    employeeId: 'emp-1',
    concept: 'ANTICIPO_SUELDO' as Discount['concept'],
    amount: '',
    description: ''
  });

  const [newVac, setNewVac] = useState({
    employeeId: 'emp-1',
    daysTaken: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const [newDep, setNewDep] = useState({ code: '', name: '', headPerson: '', address: '' });
  const [newPos, setNewPos] = useState({ code: '', title: '', departmentName: 'Ventas & Atención al Cliente', minSalary: 460 });
  const [newNov, setNewNov] = useState({ employeeId: 'emp-1', type: 'ATRASO' as HRNovelty['type'], description: '', penaltyAmount: '' });

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.fullName || !newEmp.idNumber) return;

    // SRI Validation for Ecuador
    const valResult = validateEcuadorianDocument('AUTO', newEmp.idNumber);
    if (!valResult.isValid) {
      showAlert(
        valResult.message || 'La Cédula o RUC ingresado no cumple con las reglas de validación de Ecuador.',
        'Identificación Inválida',
        'warning'
      );
      return;
    }

    const dep = departments.find(d => d.id === newEmp.departmentId) || departments[0] || { id: '', name: 'General' };
    const pos = positions.find(p => p.id === newEmp.positionId) || positions[0] || { id: '', title: 'General' };

    const item: Employee = {
      id: editingEmpId || `emp-${Date.now()}`,
      code: newEmp.code || `EMP-00${employees.length + 1}`,
      idNumber: newEmp.idNumber,
      fullName: newEmp.fullName,
      email: newEmp.email || '',
      phone: newEmp.phone || '',
      departmentId: dep.id,
      departmentName: dep.name,
      positionId: pos.id,
      positionName: pos.title,
      hireDate: newEmp.hireDate,
      baseSalary: parseFloat(newEmp.baseSalary.toString()) || 460,
      contractType: newEmp.contractType,
      iessAffiliationNumber: newEmp.iessAffiliationNumber || '',
      bankAccount: newEmp.bankAccount || '',
      status: 'ACTIVO'
    };

    if (editingEmpId) {
      setEmployees(prev => prev.map(e => e.id === editingEmpId ? { ...item, code: e.code } : e));
      showToast(`Empleado ${item.fullName} actualizado correctamente.`, 'success');
    } else {
      setEmployees(prev => [...prev, item]);
      showToast(`Empleado ${item.fullName} registrado correctamente.`, 'success');
    }
    
    setIsEmpModalOpen(false);
    setEditingEmpId(null);
    setNewEmp({
      code: '',
      idNumber: '',
      fullName: '',
      email: '',
      phone: '',
      departmentId: departments[0]?.id || '',
      positionId: positions[0]?.id || '',
      hireDate: new Date().toISOString().split('T')[0],
      baseSalary: 460,
      contractType: 'INDEFINIDO',
      iessAffiliationNumber: '',
      bankAccount: ''
    });
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setNewEmp({
      code: emp.code,
      idNumber: emp.idNumber,
      fullName: emp.fullName,
      email: emp.email,
      phone: emp.phone,
      departmentId: emp.departmentId,
      positionId: emp.positionId,
      hireDate: emp.hireDate,
      baseSalary: emp.baseSalary,
      contractType: emp.contractType,
      iessAffiliationNumber: emp.iessAffiliationNumber,
      bankAccount: emp.bankAccount
    });
    setIsEmpModalOpen(true);
  };

  const handleDeleteEmployee = (emp: Employee) => {
    showConfirm(
      `¿Estás seguro que deseas dar de baja o eliminar a ${emp.fullName}?`,
      () => {
        setEmployees(prev => prev.filter(e => e.id !== emp.id));
        showToast('Empleado eliminado correctamente.', 'success');
      },
      'Eliminar Empleado',
      'Eliminar',
      'Cancelar'
    );
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newRole.employeeId) || employees[0];
    const overtime = parseFloat(newRole.overtimeAmount.toString()) || 0;
    const commissions = parseFloat(newRole.commissionsAmount.toString()) || 0;
    const otherInc = parseFloat(newRole.otherIncomes.toString()) || 0;

    const gross = emp.baseSalary + overtime + commissions + otherInc;
    const iessPersonal = Number((gross * 0.0945).toFixed(4));

    const adv = parseFloat(newRole.advancesDeduction.toString()) || 0;
    const loans = parseFloat(newRole.loansDeduction.toString()) || 0;
    const otherDsc = parseFloat(newRole.otherDeductions.toString()) || 0;

    const totalDsc = iessPersonal + adv + loans + otherDsc;
    const net = gross - totalDsc;

    const role: PayrollRole = {
      id: `rol-${Date.now()}`,
      period: newRole.period,
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.fullName,
      departmentName: emp.departmentName,
      positionName: emp.positionName,
      baseSalary: emp.baseSalary,
      overtimeAmount: overtime,
      commissionsAmount: commissions,
      otherIncomes: otherInc,
      totalGrossIncome: gross,
      iessPersonalDeduction: iessPersonal,
      advancesDeduction: adv,
      loansDeduction: loans,
      otherDeductions: otherDsc,
      totalDeductions: totalDsc,
      netSalary: net,
      status: 'BORRADOR'
    };

    if (editingRoleId) {
      setPayrollRoles(payrollRoles.map(r => r.id === editingRoleId ? role : r));
      showToast(`Rol de pago para ${role.employeeName} actualizado.`, 'success');
    } else {
      setPayrollRoles([role, ...payrollRoles]);
      showToast(`Rol de pago para ${role.employeeName} generado.`, 'success');
    }
    
    setIsRoleModalOpen(false);
    setEditingRoleId(null);
    setNewRole({
      employeeId: 'emp-1',
      period: '2026-08',
      overtimeAmount: 0,
      commissionsAmount: 0,
      otherIncomes: 0,
      advancesDeduction: 0,
      loansDeduction: 0,
      otherDeductions: 0
    });
  };

  const handleEditRole = (role: PayrollRole) => {
    setEditingRoleId(role.id);
    setNewRole({
      employeeId: role.employeeId,
      period: role.period,
      overtimeAmount: role.overtimeAmount,
      commissionsAmount: role.commissionsAmount,
      otherIncomes: role.otherIncomes,
      advancesDeduction: role.advancesDeduction,
      loansDeduction: role.loansDeduction,
      otherDeductions: role.otherDeductions
    });
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = (id: string) => {
    showConfirm('¿Eliminar este rol de pago? Esta acción no se puede deshacer.', () => {
      setPayrollRoles(payrollRoles.filter(r => r.id !== id));
      showToast('Rol de pago eliminado.', 'success');
    });
  };

  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newInc.employeeId) || employees[0];
    const item: ExtraIncome = {
      id: `inc-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.fullName,
      concept: newInc.concept,
      date: new Date().toISOString().split('T')[0],
      amount: parseFloat(newInc.amount) || 0,
      description: newInc.description || 'Ingreso adicional'
    };
    setIncomes([item, ...incomes]);
    setIsIncModalOpen(false);
    setNewInc({ employeeId: 'emp-1', concept: 'COMISION_VENTAS', amount: '', description: '' });
  };

  const handleSaveDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newDsc.employeeId) || employees[0];
    const item: Discount = {
      id: `dsc-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.fullName,
      concept: newDsc.concept,
      date: new Date().toISOString().split('T')[0],
      amount: parseFloat(newDsc.amount) || 0,
      description: newDsc.description || 'Descuento aplicado'
    };
    setDiscounts([item, ...discounts]);
    setIsDscModalOpen(false);
    setNewDsc({ employeeId: 'emp-1', concept: 'ANTICIPO_SUELDO', amount: '', description: '' });
  };

  const handleSaveVacation = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newVac.employeeId) || employees[0];
    const currentYear = new Date().getFullYear();
    const item: VacationRecord = {
      id: `vac-${Date.now()}`,
      employeeId: emp ? emp.id : (newVac.employeeId || 'emp-1'),
      employeeName: emp ? emp.fullName : 'Empleado',
      periodYears: `${currentYear - 1}-${currentYear}`,
      daysEarned: 15,
      daysTaken: newVac.daysTaken,
      daysPending: Math.max(0, 15 - newVac.daysTaken),
      startDate: newVac.startDate,
      endDate: newVac.endDate,
      reason: newVac.reason.trim() || 'Vacaciones Anuales Reglamentarias',
      status: 'SOLICITADO'
    };
    setVacations([item, ...vacations]);
    setIsVacModalOpen(false);
    setNewVac({
      employeeId: employees[0]?.id || 'emp-1',
      daysTaken: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      reason: ''
    });
  };

  
  const handleEditDepartment = (dep: Department) => {
    setEditingDepId(dep.id);
    setNewDep({ code: dep.code, name: dep.name, headPerson: dep.headPerson, address: dep.address || '' });
    setIsDepModalOpen(true);
  };

  const handleDeleteDepartment = (id: string) => {
    showConfirm("¿Eliminar departamento? Esta acción no se puede deshacer.", () => {
      setDepartments(departments.filter(d => d.id !== id));
      showToast("Departamento eliminado correctamente.", "success");
    });
  };

  const handleSaveDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDep.name) return;
    
    if (editingDepId) {
      setDepartments(departments.map(d => d.id === editingDepId ? { ...d, ...newDep } : d));
      showToast("Departamento actualizado correctamente", "success");
    } else {
      const dep: Department = {
        id: `dep-${Date.now()}`,
        code: newDep.code || `DEP-0${departments.length + 1}`,
        name: newDep.name,
        headPerson: newDep.headPerson || 'Por definir',
        employeeCount: 0,
        address: newDep.address || ''
      };
      setDepartments([...departments, dep]);
      showToast("Departamento creado correctamente", "success");
    }
    
    setIsDepModalOpen(false);
    setEditingDepId(null);
    setNewDep({ code: '', name: '', headPerson: '', address: '' });
  };

  
  
  const handleSaveDecimo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecimo.employeeId || !newDecimo.employeeName) {
      showToast("Debe seleccionar un empleado", "error");
      return;
    }
    
    const decimoData = {
      id: Date.now().toString(),
      employeeId: newDecimo.employeeId || 'EMP-' + Date.now(),
      employeeName: newDecimo.employeeName,
      type: newDecimo.type as any,
      year: newDecimo.year,
      mode: newDecimo.mode as any,
      calculatedAmount: newDecimo.calculatedAmount,
      paymentDate: newDecimo.paymentDate,
      status: newDecimo.status as any,
    };
    
    setDecimos([...decimos, decimoData]);
    setIsDecimoModalOpen(false);
    showToast("Décimo guardado correctamente", "success");
    setNewDecimo({
      employeeId: '',
      employeeName: '',
      type: 'DECIMO_TERCERO',
      year: new Date().getFullYear(),
      mode: 'ACUMULADO',
      calculatedAmount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      status: 'PENDIENTE'
    });
  };

  const handleSaveLiquidation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLiq.employeeId || !newLiq.employeeName) {
      showToast("Debe seleccionar un empleado", "error");
      return;
    }
    
    const totalLiquidation = newLiq.indemnificationAmount + newLiq.vacationPendingAmount + newLiq.decimosProportionalAmount - (newLiq.discountsAmount || 0);
    
    const liqData = {
      id: Date.now().toString(),
      employeeId: newLiq.employeeId || 'EMP-' + Date.now(),
      employeeName: newLiq.employeeName,
      terminationDate: newLiq.terminationDate,
      reason: newLiq.reason as any,
      yearsWorked: newLiq.yearsWorked,
      indemnificationAmount: newLiq.indemnificationAmount,
      vacationPendingAmount: newLiq.vacationPendingAmount,
      decimosProportionalAmount: newLiq.decimosProportionalAmount,
      discountsAmount: newLiq.discountsAmount || 0,
      totalLiquidation: totalLiquidation,
      status: 'EN_CALCULO' as any,
    };
    
    setLiquidations([...liquidations, liqData]);
    setIsLiqModalOpen(false);
    showToast("Liquidación guardada correctamente", "success");
    setNewLiq({
      employeeId: '',
      employeeName: '',
      terminationDate: new Date().toISOString().split('T')[0],
      reason: 'DESAHUCIO',
      yearsWorked: 1,
      indemnificationAmount: 0,
      vacationPendingAmount: 0,
      decimosProportionalAmount: 0,
      discountsAmount: 0,
    });
  };

  
  const handleEditPosition = (pos: JobPosition) => {
    setEditingPosId(pos.id);
    setNewPos({ code: pos.code, title: pos.title, departmentName: pos.departmentName, minSalary: pos.minSalary });
    setIsPosModalOpen(true);
  };

  const handleDeletePosition = (id: string) => {
    showConfirm("¿Eliminar cargo? Esta acción no se puede deshacer.", () => {
      setPositions(positions.filter(p => p.id !== id));
      showToast("Cargo eliminado correctamente.", "success");
    });
  };

  const handleSavePosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPos.title) return;

    if (editingPosId) {
      setPositions(positions.map(p => p.id === editingPosId ? { ...p, ...newPos, minSalary: parseFloat(newPos.minSalary.toString()) || 0 } : p));
      showToast("Cargo actualizado correctamente", "success");
    } else {
      const pos: JobPosition = {
        id: `pos-${Date.now()}`,
        code: newPos.code || `CAR-0${positions.length + 1}`,
        title: newPos.title,
        departmentName: newPos.departmentName,
        minSalary: parseFloat(newPos.minSalary.toString()) || 460
      };
      setPositions([...positions, pos]);
      showToast("Cargo creado correctamente", "success");
    }

    setIsPosModalOpen(false);
    setEditingPosId(null);
    setNewPos({ code: '', title: '', departmentName: 'Ventas & Atención al Cliente', minSalary: 460 });
  };

  const handleSaveNovelty = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newNov.employeeId) || employees[0];
    const nov: HRNovelty = {
      id: `nov-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.fullName,
      date: new Date().toISOString().split('T')[0],
      type: newNov.type,
      description: newNov.description || 'Novedad registrada',
      penaltyAmount: newNov.penaltyAmount ? parseFloat(newNov.penaltyAmount) : undefined
    };
    setNovelties([nov, ...novelties]);
    setIsNovModalOpen(false);
    setNewNov({ employeeId: 'emp-1', type: 'ATRASO', description: '', penaltyAmount: '' });
  };

  const totalGrossPayroll = payrollRoles.reduce((acc, curr) => acc + curr.totalGrossIncome, 0);
  const totalIessPersonal = payrollRoles.reduce((acc, curr) => acc + curr.iessPersonalDeduction, 0);
  const totalNetPayroll = payrollRoles.reduce((acc, curr) => acc + curr.netSalary, 0);

  return (
    <div className="space-y-6">
      {/* ROLES_PAGO */}
      {subTab === 'ROLES_PAGO' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <span>Gestión de Roles de Pago & Nómina Mensual (Ecuador IESS)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Generación de liquidación de sueldos, descuento 9.45% IESS, horas extras y neto a pagar.
              </p>
            </div>

            <button
              onClick={() => setIsRoleModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Generar Rol de Pago</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Ingresos Brutos</div>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {formatCurrency(totalGrossPayroll, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aporte Personal IESS (9.45%)</div>
              <div className="text-xl font-black text-rose-400 mt-1">
                {formatCurrency(totalIessPersonal, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Liquido a Pagar</div>
              <div className="text-xl font-black text-amber-400 mt-1">
                {formatCurrency(totalNetPayroll, settings.currencySymbol)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4">Empleado / Cargo</th>
                  <th className="py-3 px-4 text-right">Sueldo Base</th>
                  <th className="py-3 px-4 text-right">+ Ingresos H.E.</th>
                  <th className="py-3 px-4 text-right">Total Bruto</th>
                  <th className="py-3 px-4 text-right">- IESS (9.45%)</th>
                  <th className="py-3 px-4 text-right">- Anticipos/Prest.</th>
                  <th className="py-3 px-4 text-right">Neto a Recibir</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {payrollRoles.map((rol) => (
                  <tr key={rol.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-black text-indigo-600">{rol.period}</td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-slate-900">{rol.employeeName}</div>
                      <div className="text-[10px] text-slate-400">{rol.positionName}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      {formatCurrency(rol.baseSalary, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-bold">
                      +{formatCurrency(rol.overtimeAmount + rol.commissionsAmount + rol.otherIncomes, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {formatCurrency(rol.totalGrossIncome, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 font-bold">
                      -{formatCurrency(rol.iessPersonalDeduction, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 font-bold">
                      -{formatCurrency(rol.advancesDeduction + rol.loansDeduction + rol.otherDeductions, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                      {formatCurrency(rol.netSalary, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        rol.status === 'PAGADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {rol.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setViewingRole(rol)} title="Vista Previa" className="p-1.5 bg-slate-100 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => {
                          showToast('Generando PDF...', 'success');
                          setTimeout(() => window.print(), 500);
                        }} title="Descargar PDF" className="p-1.5 bg-slate-100 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEditRole(rol)} title="Editar Rol" className="p-1.5 bg-slate-100 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteRole(rol.id)} title="Eliminar" className="p-1.5 bg-slate-100 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                          <Trash2 className="w-4 h-4" />
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

      {/* OTROS_INGRESOS */}
      {subTab === 'OTROS_INGRESOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <span>Comisiones, Horas Extras & Bonificaciones</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ingresos adicionales imponibles o no imponibles a sumarse al rol de pago del empleado.
              </p>
            </div>

            <button
              onClick={() => setIsIncModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Ingreso</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Empleado</th>
                  <th className="py-3 px-4">Concepto Ingreso</th>
                  <th className="py-3 px-4">Descripción / Observación</th>
                  <th className="py-3 px-4 text-right">Monto Adicional ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {incomes.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500">{inc.date}</td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{inc.employeeName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded border border-emerald-200">
                        {inc.concept}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600">{inc.description}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                      +{formatCurrency(inc.amount, settings.currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DESCUENTOS */}
      {subTab === 'DESCUENTOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Percent className="w-5 h-5 text-rose-500" />
                <span>Anticipos de Sueldo, Préstamos & Multas</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Deducciones periódicas a restarse del valor neto a recibir en el rol de pago.
              </p>
            </div>

            <button
              onClick={() => setIsDscModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Descuento</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Empleado</th>
                  <th className="py-3 px-4">Concepto Descuento</th>
                  <th className="py-3 px-4">Detalle / Justificación</th>
                  <th className="py-3 px-4 text-right">Monto Deducción ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {discounts.map((dsc) => (
                  <tr key={dsc.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500">{dsc.date}</td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{dsc.employeeName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold text-[10px] rounded border border-rose-200">
                        {dsc.concept}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600">{dsc.description}</td>
                    <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                      -{formatCurrency(dsc.amount, settings.currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VACACIONES */}
      {subTab === 'VACACIONES' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Sun className="w-5 h-5 text-amber-500" />
                <span>Control de Vacaciones Anuales (Código del Trabajo)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cálculo de 15 días reglamentarios por año, solicitudes de goce y días acumulados.
              </p>
            </div>

            <button
              onClick={() => setIsVacModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Solicitar Vacaciones</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Empleado</th>
                  <th className="py-3 px-4">Período Fiscal</th>
                  <th className="py-3 px-4">Motivo / Justificación</th>
                  <th className="py-3 px-4 text-center">Días Ganados</th>
                  <th className="py-3 px-4 text-center">Días Tomados</th>
                  <th className="py-3 px-4 text-center">Días Pendientes</th>
                  <th className="py-3 px-4">Fechas Goce</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {vacations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans text-xs">
                      No hay solicitudes de vacaciones registradas.
                    </td>
                  </tr>
                ) : (
                  vacations.map((vac) => (
                    <tr key={vac.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-sans font-bold text-slate-900">{vac.employeeName}</td>
                      <td className="py-3 px-4 font-black text-indigo-600">{vac.periodYears}</td>
                      <td className="py-3 px-4 font-sans text-slate-700 max-w-xs truncate" title={vac.reason || 'Vacaciones Anuales'}>
                        {vac.reason || 'Vacaciones Anuales Reglamentarias'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">{vac.daysEarned} Días</td>
                      <td className="py-3 px-4 text-center font-bold text-amber-600">{vac.daysTaken} Días</td>
                      <td className="py-3 px-4 text-center font-black text-emerald-600 text-sm">{vac.daysPending} Días</td>
                      <td className="py-3 px-4 font-sans text-slate-600">{vac.startDate} al {vac.endDate}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded">
                          {vac.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LIQUIDACIONES */}
      {subTab === 'LIQUIDACIONES' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-rose-500" />
                <span>Actas de Finiquito & Liquidación Laboral</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cálculo de indemnización por despido/desahucio, vacaciones pendientes y proporcionales.
              </p>
            </div>
            <button
              onClick={() => setIsLiqModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>NUEVA LIQUIDACIÓN</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Empleado</th>
                  <th className="py-3 px-4">Fecha Salida</th>
                  <th className="py-3 px-4">Causal de Salida</th>
                  <th className="py-3 px-4 text-center">Tiempo Servido</th>
                  <th className="py-3 px-4 text-right">Indemnización</th>
                  <th className="py-3 px-4 text-right">Vacaciones/Décimos</th>
                  <th className="py-3 px-4 text-right">Total Liquidación ($)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {liquidations.map((liq) => (
                  <tr key={liq.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{liq.employeeName}</td>
                    <td className="py-3 px-4 text-slate-500">{liq.terminationDate}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold text-[10px] rounded">
                        {liq.reason}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{liq.yearsWorked} Años</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(liq.indemnificationAmount, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-bold">
                      +{formatCurrency(liq.vacationPendingAmount + liq.decimosProportionalAmount, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                      {formatCurrency(liq.totalLiquidation, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded">
                        {liq.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DECIMOS */}
      {subTab === 'DECIMOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-500" />
                <span>Décimo Tercero (Navideño) & Décimo Cuarto (Escolar)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cálculo de beneficios de ley con acumulación anual o pago mensualizado en rol.
              </p>
            </div>
            <button
              onClick={() => setIsDecimoModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>NUEVO DÉCIMO</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Empleado</th>
                  <th className="py-3 px-4">Tipo de Décimo</th>
                  <th className="py-3 px-4">Año Fiscal</th>
                  <th className="py-3 px-4">Modalidad</th>
                  <th className="py-3 px-4 text-right">Monto a Pagar ($)</th>
                  <th className="py-3 px-4">Fecha Pago Exigible</th>
                  <th className="py-3 px-4 text-center">Estado IESS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {decimos.map((dec) => (
                  <tr key={dec.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{dec.employeeName}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                        dec.type === 'DECIMO_TERCERO' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}>
                        {dec.type === 'DECIMO_TERCERO' ? '13ro Navideño (Bono 12va parte)' : '14to Escolar (Bono 1 SBU)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-700">{dec.year}</td>
                    <td className="py-3 px-4 font-bold text-indigo-600">{dec.mode}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                      {formatCurrency(dec.calculatedAmount, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{dec.paymentDate}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        dec.status === 'PAGADO_IESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {dec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEPARTAMENTOS_RRHH */}
      {subTab === 'DEPARTAMENTOS_RRHH' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-500" />
                <span>Departamentos & Unidades de Trabajo</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Estructura orgánica funcional de la ferretería y jefes directos.
              </p>
            </div>

            <button
              onClick={() => setIsDepModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Departamento</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {departments.map((dep) => (
              <div key={dep.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 group relative">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm z-10">
                  <button onClick={() => handleEditDepartment(dep)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md" title="Editar">
                    <Edit className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleDeleteDepartment(dep.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md" title="Eliminar">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between pr-14">
                  <span className="font-mono font-black text-indigo-600 text-xs">{dep.code}</span>
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold text-[10px] rounded">
                    {employees.filter(e => e.departmentId === dep.id).length} Empleados
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{dep.name}</h3>
                {dep.address && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    📍 {dep.address}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CARGOS_RRHH */}
      {subTab === 'CARGOS_RRHH' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-teal-500" />
                <span>Catálogo de Cargos & Salarios Mínimos Sectoriales</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Definición de puestos de trabajo y escalas salariales según tabla IESS/MDT.
              </p>
            </div>

            <button
              onClick={() => setIsPosModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Cargo</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código Cargo</th>
                  <th className="py-3 px-4">Título del Puesto</th>
                  <th className="py-3 px-4">Departamento Pertenece</th>
                  <th className="py-3 px-4 text-right">Sueldo Mínimo Sectorial ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-slate-50 group">
                    <td className="py-3 px-4 font-black text-indigo-600">{pos.code}</td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{pos.title}</td>
                    <td className="py-3 px-4 font-sans text-slate-600">{pos.departmentName}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                      {formatCurrency(pos.minSalary, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEditPosition(pos)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md" title="Editar">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeletePosition(pos.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-md" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
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

      {/* EMPLEADOS */}
      {subTab === 'EMPLEADOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <span>Expedientes de Empleados & Ficha Personal</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nómina activa, número de afiliación IESS, contratos y cuentas bancarias.
              </p>
            </div>

            <button
              onClick={() => {
              setEditingEmpId(null);
              setNewEmp({
                code: '',
                idNumber: '',
                fullName: '',
                email: '',
                phone: '',
                departmentId: 'dep-1',
                positionId: 'pos-1',
                hireDate: new Date().toISOString().split('T')[0],
                baseSalary: 460,
                contractType: 'INDEFINIDO',
                iessAffiliationNumber: '',
                bankAccount: ''
              });
              setIsEmpModalOpen(true);
            }}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Registrar Empleado</span>
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar empleado por nombre, cédula, cargo o departamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-slate-800 font-medium placeholder-slate-400"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código / Cédula</th>
                  <th className="py-3 px-4">Nombre Completo</th>
                  <th className="py-3 px-4">Cargo & Departamento</th>
                  <th className="py-3 px-4">Fecha Ingreso</th>
                  <th className="py-3 px-4 text-right">Sueldo Base ($)</th>
                  <th className="py-3 px-4">Banco / Cuenta</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {employees
                  .filter(e => 
                    e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    e.idNumber.includes(searchTerm) ||
                    e.positionName.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-indigo-600">
                        {emp.code}
                        <div className="text-[10px] text-slate-400">CI: {emp.idNumber}</div>
                      </td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-900">
                        {emp.fullName}
                        <div className="text-[10px] text-slate-400">{emp.email} | {emp.phone}</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-slate-800">{emp.positionName}</div>
                        <div className="text-[10px] text-slate-500">{emp.departmentName}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{emp.hireDate}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                        {formatCurrency(emp.baseSalary, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-[10px]">
                        <div className="font-bold text-slate-700">{emp.bankAccount}</div>
                        <div className="text-slate-400">N° Cuenta: {emp.iessAffiliationNumber}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded">
                          {emp.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEditEmployee(emp)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteEmployee(emp)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
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

      {/* NOVEDADES_RRHH */}
      {subTab === 'NOVEDADES_RRHH' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span>Novedades, Atrasos, Permisos & Memorandos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bitácora de incidencias de asistencia, justificaciones médicas y felicitaciones.
              </p>
            </div>

            <button
              onClick={() => setIsNovModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Novedad</span>
            </button>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {novelties.map((nov) => (
              <div key={nov.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-sans font-bold text-slate-900">{nov.employeeName}</span>
                    <span className={`px-2 py-0.5 font-black text-[10px] rounded ${
                      nov.type === 'ATRASO' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {nov.type}
                    </span>
                  </div>
                  <p className="text-slate-700 font-sans text-xs">{nov.description}</p>
                </div>
                <div className="text-right shrink-0 text-[10px]">
                  <div className="font-bold text-slate-500">{nov.date}</div>
                  {nov.penaltyAmount && (
                    <div className="text-rose-600 font-bold">Multa: -${nov.penaltyAmount}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      {isEmpModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-500" />
                <span>{editingEmpId ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}</span>
              </h3>
              <button onClick={() => setIsEmpModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Código / Cédula</label>
                  <input
                    type="text"
                    required
                    placeholder="17XXXXXXXX"
                    value={newEmp.idNumber}
                    onChange={(e) => setNewEmp({ ...newEmp, idNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  {newEmp.idNumber && (() => {
                    const res = validateEcuadorianDocument('AUTO', newEmp.idNumber);
                    return (
                      <div className={`mt-1 px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 border ${
                        res.isValid 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {res.isValid ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Válido ({res.type})</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>{res.message}</span>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Nombres y Apellidos"
                    value={newEmp.fullName}
                    onChange={(e) => setNewEmp({ ...newEmp, fullName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Departamento</label>
                  <Select
                    value={newEmp.departmentId}
                    onChange={(e) => setNewEmp({ ...newEmp, departmentId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Cargo</label>
                  <Select
                    value={newEmp.positionId}
                    onChange={(e) => setNewEmp({ ...newEmp, positionId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Sueldo Base ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    value={newEmp.baseSalary === 0 ? '' : newEmp.baseSalary}
                    onChange={(e) => setNewEmp({ ...newEmp, baseSalary: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Fecha Ingreso</label>
                  <CustomDatePicker value={newEmp.hireDate} onChange={(val) => setNewEmp({ ...newEmp, hireDate: val })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Número de Cuenta</label>
                  <input
                    type="text"
                    placeholder="Ej. 220011..."
                    value={newEmp.iessAffiliationNumber}
                    onChange={(e) => setNewEmp({ ...newEmp, iessAffiliationNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Banco (Institución)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Banco Pichincha"
                    value={newEmp.bankAccount}
                    onChange={(e) => setNewEmp({ ...newEmp, bankAccount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEmpModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Guardar Empleado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingRole && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-fadeIn my-auto print:shadow-none print:w-full print:max-w-none print:h-auto print:rounded-none print:max-h-none">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl print:hidden">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Liquidación de Rol de Pago</h3>
                  <p className="text-xs text-slate-500 font-medium">Período: <span className="font-bold text-slate-800">{viewingRole.period}</span></p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setViewingRole(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-xs">
              {/* Employee Info & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                {/* Employee Info */}
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider border-b border-slate-200/60 pb-1">Datos del Empleado</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Nombre:</span> <span className="font-bold text-slate-900">{viewingRole.employeeName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Cédula/RUC:</span> <span className="font-bold font-mono text-slate-900">{viewingRole.employeeCode}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Cargo:</span> <span className="font-bold text-slate-900">{viewingRole.positionName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Departamento:</span> <span className="font-bold text-slate-900">{viewingRole.departmentName}</span></div>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider border-b border-slate-200/60 pb-1">Estado del Rol</h4>
                  <div className="flex flex-col items-start sm:items-end gap-1.5 pt-1">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${
                      viewingRole.status === 'PAGADO' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                    } print:border-none`}>
                      {viewingRole.status}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">ID: {viewingRole.id}</div>
                  </div>
                </div>
              </div>

              {/* Income & Deductions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-100 print:bg-white print:border-none print:p-0">
                {/* Incomes */}
                <div className="space-y-2.5">
                  <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 print:hidden" />
                    <span>Ingresos</span>
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-slate-600">Sueldo Base:</span> <span className="font-bold font-mono text-slate-900">{formatCurrency(viewingRole.baseSalary, settings.currencySymbol)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Horas Extras:</span> <span className="font-bold font-mono text-slate-900">{formatCurrency(viewingRole.overtimeAmount, settings.currencySymbol)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Comisiones:</span> <span className="font-bold font-mono text-slate-900">{formatCurrency(viewingRole.commissionsAmount, settings.currencySymbol)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Otros Ingresos:</span> <span className="font-bold font-mono text-slate-900">{formatCurrency(viewingRole.otherIncomes, settings.currencySymbol)}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5"><span className="font-black text-slate-800">Total Ingresos:</span> <span className="font-black font-mono text-emerald-600">{formatCurrency(viewingRole.totalGrossIncome, settings.currencySymbol)}</span></div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-2.5">
                  <h4 className="text-[11px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 print:hidden" />
                    <span>Deducciones</span>
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-slate-600">Aporte IESS (9.45%):</span> <span className="font-bold font-mono text-slate-900">{formatCurrency(viewingRole.iessPersonalDeduction, settings.currencySymbol)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Anticipos:</span> <span className="font-bold font-mono text-slate-900">{formatCurrency(viewingRole.advancesDeduction, settings.currencySymbol)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Préstamos IESS/Cía:</span> <span className="font-bold font-mono text-slate-900">{formatCurrency(viewingRole.loansDeduction, settings.currencySymbol)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Otras Deducciones:</span> <span className="font-bold font-mono text-slate-900">{formatCurrency(viewingRole.otherDeductions, settings.currencySymbol)}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5"><span className="font-black text-slate-800">Total Deducciones:</span> <span className="font-black font-mono text-rose-600">{formatCurrency(viewingRole.totalDeductions, settings.currencySymbol)}</span></div>
                  </div>
                </div>
              </div>

              {/* Total Net */}
              <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-inner print:bg-slate-100 print:text-slate-900 print:border print:border-slate-300">
                <div className="text-slate-300 font-bold uppercase tracking-widest text-xs print:text-slate-600">Neto a Recibir</div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono print:text-slate-900">{formatCurrency(viewingRole.netSalary, settings.currencySymbol)}</div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 pb-2">
                <div className="border-t border-slate-300 text-center">
                  <p className="text-xs font-bold text-slate-800 mt-1.5">Firma Empleador</p>
                </div>
                <div className="border-t border-slate-300 text-center">
                  <p className="text-xs font-bold text-slate-800 mt-1.5">Firma Empleado</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">C.I: {viewingRole.employeeCode}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 p-4 px-6 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl shrink-0 print:hidden">
              <button
                type="button"
                onClick={() => setViewingRole(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeout(() => window.print(), 300);
                }}
                className="px-5 py-2.5 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Documento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Generar Rol de Pago Mensual</span>
              </h3>
              <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Seleccionar Empleado</label>
                <Select
                  value={newRole.employeeId}
                  onChange={(e) => setNewRole({ ...newRole, employeeId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} (${e.baseSalary})</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Período (Año-Mes)</label>
                  <input
                    type="text"
                    placeholder="2026-08"
                    value={newRole.period}
                    onChange={(e) => setNewRole({ ...newRole, period: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Horas Extras ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    value={newRole.overtimeAmount === 0 ? '' : newRole.overtimeAmount}
                    onChange={(e) => setNewRole({ ...newRole, overtimeAmount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Comisiones ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    value={newRole.commissionsAmount === 0 ? '' : newRole.commissionsAmount}
                    onChange={(e) => setNewRole({ ...newRole, commissionsAmount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Anticipo Sueldo ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    value={newRole.advancesDeduction === 0 ? '' : newRole.advancesDeduction}
                    onChange={(e) => setNewRole({ ...newRole, advancesDeduction: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[11px] text-indigo-900">
                <span className="font-bold">* Nota:</span> El aporte personal IESS del 9.45% se calculará automáticamente sobre el valor bruto acumulado.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Generar Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isIncModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Registrar Ingreso Adicional</span>
              </h3>
              <button onClick={() => setIsIncModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIncome} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Empleado</label>
                <Select
                  value={newInc.employeeId}
                  onChange={(e) => setNewInc({ ...newInc, employeeId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Concepto</label>
                <Select
                  value={newInc.concept}
                  onChange={(e) => setNewInc({ ...newInc, concept: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="COMISION_VENTAS">Comisiones por Ventas</option>
                  <option value="BONO_CUMPLIMIENTO">Bono por Cumplimiento de Metas</option>
                  <option value="HORAS_EXTRAS_50">Horas Suplementarias (50%)</option>
                  <option value="HORAS_EXTRAS_100">Horas Extraordinarias (100%)</option>
                  <option value="VIATICOS">Viáticos y Movilización</option>
                </Select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Monto ($)</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="0.00"
                  value={newInc.amount}
                  onChange={(e) => setNewInc({ ...newInc, amount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Detalle o motivo del bono..."
                  value={newInc.description}
                  onChange={(e) => setNewInc({ ...newInc, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsIncModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Guardar Ingreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDscModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Percent className="w-4 h-4 text-rose-500" />
                <span>Registrar Descuento / Deducción</span>
              </h3>
              <button onClick={() => setIsDscModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDiscount} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Empleado</label>
                <Select
                  value={newDsc.employeeId}
                  onChange={(e) => setNewDsc({ ...newDsc, employeeId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Concepto Descuento</label>
                <Select
                  value={newDsc.concept}
                  onChange={(e) => setNewDsc({ ...newDsc, concept: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ANTICIPO_SUELDO">Anticipo de Sueldo</option>
                  <option value="PRESTAMO_QUIROGRAFARIO">Préstamo Quirografario IESS</option>
                  <option value="PRESTAMO_EMPRESA">Préstamo Interno Empresa</option>
                  <option value="ATRASO_MULTA">Atrasos o Multas</option>
                </Select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Monto ($)</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="0.00"
                  value={newDsc.amount}
                  onChange={(e) => setNewDsc({ ...newDsc, amount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Detalle</label>
                <input
                  type="text"
                  placeholder="Detalle o motivo..."
                  value={newDsc.description}
                  onChange={(e) => setNewDsc({ ...newDsc, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsDscModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Guardar Descuento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isVacModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Solicitud de Vacaciones</span>
              </h3>
              <button onClick={() => setIsVacModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVacation} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Empleado</label>
                <Select
                  value={newVac.employeeId}
                  onChange={(e) => setNewVac({ ...newVac, employeeId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Días Solicitados</label>
                <input
                  type="number"
                  required
                  value={newVac.daysTaken}
                  onChange={(e) => setNewVac({ ...newVac, daysTaken: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Motivo / Justificación</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Vacaciones anuales, descanso, motivos personales..."
                  value={newVac.reason}
                  onChange={(e) => setNewVac({ ...newVac, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Fecha Inicio</label>
                  <CustomDatePicker value={newVac.startDate} onChange={(val) => setNewVac({ ...newVac, startDate: val })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Fecha Retorno</label>
                  <CustomDatePicker value={newVac.endDate} onChange={(val) => setNewVac({ ...newVac, endDate: val })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsVacModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl cursor-pointer"
                >
                  Aprobar Vacaciones
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNovModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Registrar Novedad / Permiso / Memorando</span>
              </h3>
              <button onClick={() => setIsNovModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNovelty} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Empleado</label>
                <Select
                  value={newNov.employeeId}
                  onChange={(e) => setNewNov({ ...newNov, employeeId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tipo de Incidencia</label>
                <Select
                  value={newNov.type}
                  onChange={(e) => setNewNov({ ...newNov, type: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ATRASO">Atraso en Asistencia</option>
                  <option value="PERMISO_MEDICO">Permiso Médico IESS</option>
                  <option value="FALTA_JUSTIFICADA">Falta Justificada</option>
                  <option value="MEMORANDO">Llamado de Atención / Memorando</option>
                  <option value="FELICITACION">Felicitación / Reconocimiento</option>
                </Select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Descripción / Detalle</label>
                <input
                  type="text"
                  required
                  placeholder="Detalle de la novedad..."
                  value={newNov.description}
                  onChange={(e) => setNewNov({ ...newNov, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Multa Opcional ($)</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="0.00"
                  value={newNov.penaltyAmount}
                  onChange={(e) => setNewNov({ ...newNov, penaltyAmount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNovModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl cursor-pointer"
                >
                  Guardar Novedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDepModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-500" />
                <span>Crear Departamento</span>
              </h3>
              <button onClick={() => setIsDepModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre Departamento</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Logística & Despacho"
                  value={newDep.name}
                  onChange={(e) => setNewDep({ ...newDep, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>



              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Dirección / Ubicación</label>
                <input
                  type="text"
                  placeholder="ej: Planta Alta / Sucursal Norte"
                  value={newDep.address}
                  onChange={(e) => setNewDep({ ...newDep, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsDepModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Guardar Departamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {isDecimoModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-fadeIn my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-500" />
                <span>Registrar Décimo</span>
              </h3>
              <button onClick={() => setIsDecimoModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDecimo} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre del Empleado</label>
                  <Select
                    required
                    value={newDecimo.employeeId}
                    onChange={(e: any) => {
                      const emp = employees.find(emp => emp.id === e.target.value);
                      setNewDecimo({ 
                        ...newDecimo, 
                        employeeId: e.target.value,
                        employeeName: emp ? emp.fullName : ''
                      });
                    }}
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  >
                    <option value="">-- Seleccionar Empleado --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tipo de Décimo</label>
                  <Select
                    value={newDecimo.type}
                    onChange={(e: any) => setNewDecimo({ ...newDecimo, type: e.target.value })}
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  >
                    <option value="DECIMO_TERCERO">Décimo Tercero (Navideño)</option>
                    <option value="DECIMO_CUARTO">Décimo Cuarto (Escolar)</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Año Fiscal</label>
                  <input
                    type="number"
                    required
                    value={newDecimo.year}
                    onChange={(e) => setNewDecimo({ ...newDecimo, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Modalidad</label>
                  <Select
                    value={newDecimo.mode}
                    onChange={(e: any) => setNewDecimo({ ...newDecimo, mode: e.target.value })}
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  >
                    <option value="ACUMULADO">Acumulado</option>
                    <option value="MENSUALIZADO">Mensualizado</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Fecha de Pago</label>
                  <CustomDatePicker value={newDecimo.paymentDate} onChange={(val) => setNewDecimo({ ...newDecimo, paymentDate: val })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Estado</label>
                  <Select
                    value={newDecimo.status}
                    onChange={(e: any) => setNewDecimo({ ...newDecimo, status: e.target.value })}
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="PAGADO_IESS">Pagado / Registrado IESS</option>
                  </Select>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Monto Calculado ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    placeholder="0.00"
                    value={newDecimo.calculatedAmount === 0 ? '' : newDecimo.calculatedAmount}
                    onChange={(e) => setNewDecimo({ ...newDecimo, calculatedAmount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-indigo-700 font-black text-lg focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDecimoModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Guardar Décimo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLiqModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-fadeIn my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-rose-500" />
                <span>Ingresar Liquidación de Personal</span>
              </h3>
              <button onClick={() => setIsLiqModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveLiquidation} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre del Empleado</label>
                  <Select
                    required
                    value={newLiq.employeeId}
                    onChange={(e: any) => {
                      const emp = employees.find(emp => emp.id === e.target.value);
                      setNewLiq({ 
                        ...newLiq, 
                        employeeId: e.target.value,
                        employeeName: emp ? emp.fullName : ''
                      });
                    }}
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  >
                    <option value="">-- Seleccionar Empleado --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Causal de Salida</label>
                  <Select
                    value={newLiq.reason}
                    onChange={(e: any) => setNewLiq({ ...newLiq, reason: e.target.value })}
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  >
                    <option value="DESAHUCIO">Desahucio</option>
                    <option value="DESPIDO_INTEMPESTIVO">Despido Intempestivo</option>
                    <option value="RENUNCIA_VOLUNTARIA">Renuncia Voluntaria</option>
                    <option value="FIN_CONTRATO">Fin de Contrato</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Fecha de Salida</label>
                  <CustomDatePicker value={newLiq.terminationDate} onChange={(val) => setNewLiq({ ...newLiq, terminationDate: val })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-rose-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Años Trabajados</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={newLiq.yearsWorked}
                    onChange={(e) => setNewLiq({ ...newLiq, yearsWorked: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-slate-700 text-xs uppercase mb-2">Valores a Liquidar</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Indemnización ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={newLiq.indemnificationAmount}
                      onChange={(e) => setNewLiq({ ...newLiq, indemnificationAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-rose-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Vacaciones ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={newLiq.vacationPendingAmount}
                      onChange={(e) => setNewLiq({ ...newLiq, vacationPendingAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-rose-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Décimos Prop. ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={newLiq.decimosProportionalAmount}
                      onChange={(e) => setNewLiq({ ...newLiq, decimosProportionalAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-rose-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Descuentos ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={newLiq.discountsAmount || 0}
                      onChange={(e) => setNewLiq({ ...newLiq, discountsAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-rose-500 font-mono"
                    />
                  </div>
                </div>
                <div className="pt-3 flex justify-between items-center border-t border-slate-200">
                  <span className="font-bold text-slate-500 uppercase">Total Liquidación:</span>
                  <span className="font-black text-rose-600 text-lg font-mono">
                    $ {Math.max(0, newLiq.indemnificationAmount + newLiq.vacationPendingAmount + newLiq.decimosProportionalAmount - (newLiq.discountsAmount || 0)).toFixed(4)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsLiqModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Guardar Liquidación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPosModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-teal-500" />
                <span>Crear Cargo / Puesto</span>
              </h3>
              <button onClick={() => setIsPosModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePosition} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Título del Cargo</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Despachador de Mostrador"
                  value={newPos.title}
                  onChange={(e) => setNewPos({ ...newPos, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Sueldo Mínimo Sectorial ($)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newPos.minSalary}
                  onChange={(e) => setNewPos({ ...newPos, minSalary: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsPosModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Guardar Cargo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
