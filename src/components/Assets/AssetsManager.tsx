import React, { useState } from 'react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { 
  Briefcase, 
  TrendingDown, 
  Wrench, 
  ArrowRightLeft, 
  History, 
  Building, 
  FolderGit2, 
  MapPin, 
  Plus, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  X, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  Filter, 
  Printer, 
  Download, 
  Calendar, 
  UserCheck, 
  Tag, 
  Layers, 
  Clock, 
  ShieldCheck,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { AssetsSubTab, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Select } from '../Shared/Select';
import { defaultAssetClassifications, defaultAssetAreas, defaultAssetLocations } from '../../data/initialData';

interface AssetsManagerProps {
  subTab: AssetsSubTab;
  settings: StoreSettings;
}

// ---------------------------------------------------------------------------
// INTERFACES FOR FIXED ASSETS MODULE
// ---------------------------------------------------------------------------

export interface FixedAssetItem {
  id: string;
  code: string; // ej: ACT-001
  name: string;
  serialNumber: string;
  classificationId: string;
  classificationName: string;
  areaId: string;
  areaName: string;
  locationId: string;
  locationName: string;
  custodian: string;
  purchaseDate: string;
  purchaseValue: number;
  residualValue: number;
  usefulLifeYears: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
  status: 'OPERATIVO' | 'EN_MANTENIMIENTO' | 'BAJA' | 'RESERVADO';
}

export interface DepreciationEntry {
  assetId: string;
  assetCode: string;
  assetName: string;
  year: number;
  month: string;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

export interface AssetMaintenance {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  type: 'PREVENTIVO' | 'CORRECTIVO';
  date: string;
  nextDueDate: string;
  cost: number;
  provider: string;
  description: string;
  status: 'PROGRAMADO' | 'COMPLETADO' | 'CANCELADO';
}

export interface AssetTransfer {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  date: string;
  originArea: string;
  targetArea: string;
  originLocation: string;
  targetLocation: string;
  previousCustodian: string;
  newCustodian: string;
  reason: string;
  authorizedBy: string;
}

export interface AssetHistoryLog {
  id: string;
  assetCode: string;
  assetName: string;
  date: string;
  eventType: 'ALTA' | 'DEPRECIACION' | 'MANTENIMIENTO' | 'TRANSFERENCIA' | 'REVALORIZACION' | 'BAJA';
  description: string;
  user: string;
}

export interface AssetArea {
  id: string;
  code: string;
  name: string;
  responsiblePerson: string;
  assetCount: number;
}

export interface AssetClassification {
  id: string;
  code: string;
  name: string;
  depreciationRatePercent: number; // ej: 33.33% para computación (3 años)
  usefulLifeYears: number;
  accountingAccount: string;
}

export interface AssetLocation {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
}

export const AssetsManager: React.FC<AssetsManagerProps> = ({
  subTab,
  settings
}) => {
  // -------------------------------------------------------------------------
  // MOCK DATA STATES
  // -------------------------------------------------------------------------

  const [classifications, setClassifications] = useFirestoreSync<AssetClassification[]>('ferreteria_asset_classifications', defaultAssetClassifications);

  const [areas, setAreas] = useFirestoreSync<AssetArea[]>('ferreteria_asset_areas', defaultAssetAreas);

  const [locations, setLocations] = useFirestoreSync<AssetLocation[]>('ferreteria_asset_locations', defaultAssetLocations);

  const [assets, setAssets] = useFirestoreSync<FixedAssetItem[]>('ferreteria_assets', []);
  const [maintenances, setMaintenances] = useFirestoreSync<AssetMaintenance[]>('ferreteria_asset_maintenances', []);
  const [transfers, setTransfers] = useFirestoreSync<AssetTransfer[]>('ferreteria_asset_transfers', []);

  const [historyLogs, setHistoryLogs] = useFirestoreSync<AssetHistoryLog[]>('ferreteria_asset_history_logs', []);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Modals visibility
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isMntModalOpen, setIsMntModalOpen] = useState(false);
  const [isTrfModalOpen, setIsTrfModalOpen] = useState(false);
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);

  // Form States
  const [newAsset, setNewAsset] = useState<Partial<FixedAssetItem>>({
    code: '',
    name: '',
    serialNumber: '',
    classificationId: 'cls-1',
    areaId: 'are-1',
    locationId: 'loc-1',
    custodian: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchaseValue: 0,
    residualValue: 0,
    usefulLifeYears: 5
  });

  const [newMnt, setNewMnt] = useState({
    assetId: 'ast-1',
    type: 'PREVENTIVO' as AssetMaintenance['type'],
    date: new Date().toISOString().split('T')[0],
    nextDueDate: '',
    cost: '',
    provider: '',
    description: ''
  });

  const [newTrf, setNewTrf] = useState({
    assetId: 'ast-1',
    targetArea: 'are-1',
    targetLocation: 'loc-1',
    newCustodian: '',
    reason: '',
    authorizedBy: 'Gerencia'
  });

  const [newArea, setNewArea] = useState({ code: '', name: '', responsiblePerson: '' });
  const [newClass, setNewClass] = useState({ code: '', name: '', depreciationRatePercent: 10, usefulLifeYears: 10, accountingAccount: '1.2.01.01.01' });
  const [newLoc, setNewLoc] = useState({ code: '', name: '', address: '', city: 'Quito' });

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.name || !newAsset.purchaseValue) return;

    const cls = classifications.find(c => c.id === newAsset.classificationId) || classifications[0];
    const ar = areas.find(a => a.id === newAsset.areaId) || areas[0];
    const loc = locations.find(l => l.id === newAsset.locationId) || locations[0];

    const purchaseVal = parseFloat(newAsset.purchaseValue.toString()) || 0;
    const residualVal = parseFloat(newAsset.residualValue?.toString() || '0') || 0;
    const codeGen = newAsset.code || `ACT-2026-${(assets.length + 1).toString().padStart(3, '0')}`;

    const item: FixedAssetItem = {
      id: `ast-${Date.now()}`,
      code: codeGen,
      name: newAsset.name,
      serialNumber: newAsset.serialNumber || 'S/N',
      classificationId: cls.id,
      classificationName: cls.name,
      areaId: ar.id,
      areaName: ar.name,
      locationId: loc.id,
      locationName: loc.name,
      custodian: newAsset.custodian || 'Por Asignar',
      purchaseDate: newAsset.purchaseDate || new Date().toISOString().split('T')[0],
      purchaseValue: purchaseVal,
      residualValue: residualVal,
      usefulLifeYears: newAsset.usefulLifeYears || cls.usefulLifeYears,
      accumulatedDepreciation: 0,
      currentBookValue: purchaseVal,
      status: 'OPERATIVO'
    };

    setAssets([item, ...assets]);
    setHistoryLogs([
      {
        id: `log-${Date.now()}`,
        assetCode: item.code,
        assetName: item.name,
        date: new Date().toISOString().split('T')[0],
        eventType: 'ALTA',
        description: `Ingreso de nuevo activo fijo por valor de ${purchaseVal}.`,
        user: 'Usuario Sistema'
      },
      ...historyLogs
    ]);

    setIsAssetModalOpen(false);
    setNewAsset({
      code: '',
      name: '',
      serialNumber: '',
      classificationId: 'cls-1',
      areaId: 'are-1',
      locationId: 'loc-1',
      custodian: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      purchaseValue: 0,
      residualValue: 0,
      usefulLifeYears: 5
    });
  };

  const handleSaveMnt = (e: React.FormEvent) => {
    e.preventDefault();
    const ast = assets.find(a => a.id === newMnt.assetId) || assets[0];
    const costNum = parseFloat(newMnt.cost) || 0;

    const mnt: AssetMaintenance = {
      id: `mnt-${Date.now()}`,
      assetId: ast.id,
      assetCode: ast.code,
      assetName: ast.name,
      type: newMnt.type,
      date: newMnt.date,
      nextDueDate: newMnt.nextDueDate || newMnt.date,
      cost: costNum,
      provider: newMnt.provider || 'Proveedor Técnico',
      description: newMnt.description || 'Mantenimiento técnico',
      status: 'PROGRAMADO'
    };

    setMaintenances([mnt, ...maintenances]);
    setHistoryLogs([
      {
        id: `log-${Date.now()}`,
        assetCode: ast.code,
        assetName: ast.name,
        date: newMnt.date,
        eventType: 'MANTENIMIENTO',
        description: `Mantenimiento ${newMnt.type} programado/realizado con costo ${costNum}.`,
        user: 'Técnico'
      },
      ...historyLogs
    ]);

    setIsMntModalOpen(false);
    setNewMnt({
      assetId: 'ast-1',
      type: 'PREVENTIVO',
      date: new Date().toISOString().split('T')[0],
      nextDueDate: '',
      cost: '',
      provider: '',
      description: ''
    });
  };

  const handleSaveTrf = (e: React.FormEvent) => {
    e.preventDefault();
    const ast = assets.find(a => a.id === newTrf.assetId) || assets[0];
    const targetAr = areas.find(a => a.id === newTrf.targetArea) || areas[0];
    const targetLoc = locations.find(l => l.id === newTrf.targetLocation) || locations[0];

    const trf: AssetTransfer = {
      id: `trf-${Date.now()}`,
      assetId: ast.id,
      assetCode: ast.code,
      assetName: ast.name,
      date: new Date().toISOString().split('T')[0],
      originArea: ast.areaName,
      targetArea: targetAr.name,
      originLocation: ast.locationName,
      targetLocation: targetLoc.name,
      previousCustodian: ast.custodian,
      newCustodian: newTrf.newCustodian || ast.custodian,
      reason: newTrf.reason || 'Reubicación por necesidades operativas',
      authorizedBy: newTrf.authorizedBy || 'Gerencia'
    };

    // Update asset's area, location and custodian
    setAssets(assets.map(a => a.id === ast.id ? {
      ...a,
      areaId: targetAr.id,
      areaName: targetAr.name,
      locationId: targetLoc.id,
      locationName: targetLoc.name,
      custodian: trf.newCustodian
    } : a));

    setTransfers([trf, ...transfers]);
    setHistoryLogs([
      {
        id: `log-${Date.now()}`,
        assetCode: ast.code,
        assetName: ast.name,
        date: trf.date,
        eventType: 'TRANSFERENCIA',
        description: `Transferido de ${ast.areaName} a ${targetAr.name}. Custodio anterior: ${ast.custodian}, nuevo: ${trf.newCustodian}.`,
        user: 'Administrador'
      },
      ...historyLogs
    ]);

    setIsTrfModalOpen(false);
    setNewTrf({
      assetId: 'ast-1',
      targetArea: 'are-1',
      targetLocation: 'loc-1',
      newCustodian: '',
      reason: '',
      authorizedBy: 'Gerencia'
    });
  };

  const handleSaveArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArea.name) return;
    const ar: AssetArea = {
      id: `are-${Date.now()}`,
      code: newArea.code || `ARE-0${areas.length + 1}`,
      name: newArea.name,
      responsiblePerson: newArea.responsiblePerson || 'Sin Asignar',
      assetCount: 0
    };
    setAreas([...areas, ar]);
    setIsAreaModalOpen(false);
    setNewArea({ code: '', name: '', responsiblePerson: '' });
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name) return;
    const cls: AssetClassification = {
      id: `cls-${Date.now()}`,
      code: newClass.code || `CLA-0${classifications.length + 1}`,
      name: newClass.name,
      depreciationRatePercent: parseFloat(newClass.depreciationRatePercent.toString()) || 10,
      usefulLifeYears: parseInt(newClass.usefulLifeYears.toString()) || 10,
      accountingAccount: newClass.accountingAccount || '1.2.01.01.01'
    };
    setClassifications([...classifications, cls]);
    setIsClassModalOpen(false);
    setNewClass({ code: '', name: '', depreciationRatePercent: 10, usefulLifeYears: 10, accountingAccount: '1.2.01.01.01' });
  };

  const handleSaveLoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoc.name) return;
    const loc: AssetLocation = {
      id: `loc-${Date.now()}`,
      code: newLoc.code || `UBI-0${locations.length + 1}`,
      name: newLoc.name,
      address: newLoc.address || 'Matriz',
      city: newLoc.city || 'Quito'
    };
    setLocations([...locations, loc]);
    setIsLocModalOpen(false);
    setNewLoc({ code: '', name: '', address: '', city: 'Quito' });
  };

  // Calculating total metrics
  const totalAssetsValue = assets.reduce((acc, curr) => acc + curr.purchaseValue, 0);
  const totalAccumulatedDep = assets.reduce((acc, curr) => acc + curr.accumulatedDepreciation, 0);
  const totalNetBookValue = assets.reduce((acc, curr) => acc + curr.currentBookValue, 0);

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------
          SUBTAB 1: ACTIVOS_LISTA (Gestión Principal de Activos Fijos)
         --------------------------------------------------------------------- */}
      {subTab === 'ACTIVOS_LISTA' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-500" />
                <span>Gestión de Activos Fijos & Propiedad, Planta y Equipo</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Control individual de activos, códigos de barras/placas, custodios y ubicación física.
              </p>
            </div>

            <button
              onClick={() => setIsAssetModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Activo Fijo</span>
            </button>
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Valor Adquisición</div>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {formatCurrency(totalAssetsValue, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Depreciación Acumulada</div>
              <div className="text-xl font-black text-rose-400 mt-1">
                {formatCurrency(totalAccumulatedDep, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor Netos en Libros</div>
              <div className="text-xl font-black text-amber-400 mt-1">
                {formatCurrency(totalNetBookValue, settings.currencySymbol)}
              </div>
            </div>

            <div className="bg-slate-950 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activos Registrados</div>
              <div className="text-xl font-black text-blue-400 mt-1">
                {assets.length} Unidades
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar activo por código, nombre, custodio o serie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-slate-800 font-medium placeholder-slate-400"
            />
          </div>

          {/* Assets Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código / Placa</th>
                  <th className="py-3 px-4">Descripción del Activo</th>
                  <th className="py-3 px-4">Clasificación NIIF</th>
                  <th className="py-3 px-4">Área / Custodio</th>
                  <th className="py-3 px-4 text-right">Valor Compra</th>
                  <th className="py-3 px-4 text-right">Dep. Acumulada</th>
                  <th className="py-3 px-4 text-right">Valor Libros</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {assets
                  .filter(a => 
                    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    a.custodian.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((ast) => (
                    <tr key={ast.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-indigo-600">{ast.code}</td>
                      <td className="py-3 px-4">
                        <div className="font-sans font-bold text-slate-900">{ast.name}</div>
                        <div className="text-[10px] text-slate-400">Serie: {ast.serialNumber} | Adq: {ast.purchaseDate}</div>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-700 font-medium">{ast.classificationName}</td>
                      <td className="py-3 px-4">
                        <div className="font-sans font-bold text-slate-800">{ast.areaName}</div>
                        <div className="text-[10px] text-slate-500 font-sans">Custodio: {ast.custodian}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(ast.purchaseValue, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        -{formatCurrency(ast.accumulatedDepreciation, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                        {formatCurrency(ast.currentBookValue, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          ast.status === 'OPERATIVO'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : ast.status === 'EN_MANTENIMIENTO'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {ast.status}
                        </span>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 2: DEPRECIACIONES
         --------------------------------------------------------------------- */}
      {subTab === 'DEPRECIACIONES' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-500" />
                <span>Cálculo & Tabla de Depreciación Acumulada</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Método de depreciación en línea recta NIIF, vida útil estimada y generación automática de asientos contables.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código Activo</th>
                  <th className="py-3 px-4">Descripción del Activo</th>
                  <th className="py-3 px-4 text-right">Valor Adquisición</th>
                  <th className="py-3 px-4 text-right">Valor Residual</th>
                  <th className="py-3 px-4 text-center">Vida Útil (Años)</th>
                  <th className="py-3 px-4 text-right">Dep. Mensual ($)</th>
                  <th className="py-3 px-4 text-right">Dep. Acumulada ($)</th>
                  <th className="py-3 px-4 text-right">Valor en Libros ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {assets.map((ast) => {
                  const depreciableBase = ast.purchaseValue - ast.residualValue;
                  const monthlyDep = (depreciableBase / (ast.usefulLifeYears * 12));
                  return (
                    <tr key={ast.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-indigo-600">{ast.code}</td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-900">{ast.name}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        {formatCurrency(ast.purchaseValue, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {formatCurrency(ast.residualValue, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">
                        {ast.usefulLifeYears} Años
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        {formatCurrency(monthlyDep, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-700">
                        {formatCurrency(ast.accumulatedDepreciation, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                        {formatCurrency(ast.currentBookValue, settings.currencySymbol)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 3: MANTENIMIENTOS
         --------------------------------------------------------------------- */}
      {subTab === 'MANTENIMIENTOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                <span>Programación & Control de Mantenimientos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Histórico de mantenimientos preventivos/correctivos, técnicos responsables y próximos vencimientos.
              </p>
            </div>

            <button
              onClick={() => setIsMntModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Mantenimiento</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código Activo</th>
                  <th className="py-3 px-4">Descripción del Activo</th>
                  <th className="py-3 px-4">Tipo Mantenimiento</th>
                  <th className="py-3 px-4">Fecha Realizado</th>
                  <th className="py-3 px-4">Próximo Vencimiento</th>
                  <th className="py-3 px-4">Técnico / Proveedor</th>
                  <th className="py-3 px-4 text-right">Costo ($)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {maintenances.map((mnt) => (
                  <tr key={mnt.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-black text-indigo-600">{mnt.assetCode}</td>
                    <td className="py-3 px-4">
                      <div className="font-sans font-bold text-slate-900">{mnt.assetName}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">{mnt.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        mnt.type === 'PREVENTIVO' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {mnt.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{mnt.date}</td>
                    <td className="py-3 px-4 font-bold text-amber-700">{mnt.nextDueDate}</td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-800">{mnt.provider}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {formatCurrency(mnt.cost, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        mnt.status === 'COMPLETADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {mnt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 4: TRANSFERENCIAS_ACTIVOS
         --------------------------------------------------------------------- */}
      {subTab === 'TRANSFERENCIAS_ACTIVOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-teal-500" />
                <span>Transferencias de Activos entre Áreas & Sedes</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Reasignación de custodios, reubicaciones físicas y actas de entrega-recepción.
              </p>
            </div>

            <button
              onClick={() => setIsTrfModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Transferencia</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Código Activo</th>
                  <th className="py-3 px-4">Descripción Activo</th>
                  <th className="py-3 px-4">Origen (Área / Custodio)</th>
                  <th className="py-3 px-4">Destino (Área / Custodio)</th>
                  <th className="py-3 px-4">Motivo / Autorización</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {transfers.map((trf) => (
                  <tr key={trf.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-500">{trf.date}</td>
                    <td className="py-3 px-4 font-black text-indigo-600">{trf.assetCode}</td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{trf.assetName}</td>
                    <td className="py-3 px-4">
                      <div className="font-sans text-rose-700 font-bold">{trf.originArea}</div>
                      <div className="text-[10px] text-slate-400 font-sans">{trf.previousCustodian}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-sans text-emerald-700 font-bold">{trf.targetArea}</div>
                      <div className="text-[10px] text-slate-600 font-sans font-bold">{trf.newCustodian}</div>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600">
                      <div>{trf.reason}</div>
                      <div className="text-[10px] font-bold text-slate-400">Aut: {trf.authorizedBy}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 5: HISTORICOS_ACTIVOS
         --------------------------------------------------------------------- */}
      {subTab === 'HISTORICOS_ACTIVOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-500" />
                <span>Histórico & Bitácora de Eventos de Activos Fijos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Auditoría completa de bajas, revalorizaciones, transferencias y ciclo de vida de activos.
              </p>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {historyLogs.map((log) => (
              <div key={log.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-indigo-600">{log.assetCode}</span>
                    <span className="font-sans font-bold text-slate-900">{log.assetName}</span>
                    <span className="px-2 py-0.5 bg-slate-900 text-white font-black text-[10px] rounded uppercase">
                      {log.eventType}
                    </span>
                  </div>
                  <p className="text-slate-700 font-sans text-xs">{log.description}</p>
                </div>
                <div className="text-right shrink-0 text-[10px]">
                  <div className="font-bold text-slate-500">{log.date}</div>
                  <div className="text-slate-400">Usuario: {log.user}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 6: AREAS_ACTIVOS
         --------------------------------------------------------------------- */}
      {subTab === 'AREAS_ACTIVOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Building className="w-5 h-5 text-purple-500" />
                <span>Gestión de Áreas & Departamentos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Estructura organizacional y responsables por cada departamento de la ferretería.
              </p>
            </div>

            <button
              onClick={() => setIsAreaModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Área</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {areas.map((ar) => (
              <div key={ar.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-indigo-600 text-xs">{ar.code}</span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded">
                    {ar.assetCount} Activos
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{ar.name}</h3>
                <p className="text-xs text-slate-500">
                  Responsable: <span className="font-bold text-slate-700">{ar.responsiblePerson}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 7: CLASIFICACIONES_ACTIVOS
         --------------------------------------------------------------------- */}
      {subTab === 'CLASIFICACIONES_ACTIVOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-amber-500" />
                <span>Clasificaciones & Porcentajes NIIF</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Categorías de activos fijos, vida útil estándar e integración con la cuenta del Plan Contable.
              </p>
            </div>

            <button
              onClick={() => setIsClassModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Clasificación</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700 font-mono">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Categoría de Activo</th>
                  <th className="py-3 px-4 text-center">% Dep. Anual</th>
                  <th className="py-3 px-4 text-center">Vida Útil (Años)</th>
                  <th className="py-3 px-4">Cuenta Contable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {classifications.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-black text-indigo-600">{cls.code}</td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{cls.name}</td>
                    <td className="py-3 px-4 text-center font-bold text-amber-700">{cls.depreciationRatePercent}%</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{cls.usefulLifeYears} Años</td>
                    <td className="py-3 px-4 font-bold text-slate-600">{cls.accountingAccount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          SUBTAB 8: UBICACIONES_ACTIVOS
         --------------------------------------------------------------------- */}
      {subTab === 'UBICACIONES_ACTIVOS' && (
        <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-500" />
                <span>Ubicaciones Físicas & Sedes</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Directorio de inmuebles, locales y bodegas donde se encuentran distribuidos los activos.
              </p>
            </div>

            <button
              onClick={() => setIsLocModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Ubicación</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {locations.map((loc) => (
              <div key={loc.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <span className="font-mono font-black text-indigo-600 text-xs">{loc.code}</span>
                <h3 className="font-bold text-slate-900 text-sm">{loc.name}</h3>
                <p className="text-xs text-slate-500">{loc.address} - {loc.city}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODALS
         --------------------------------------------------------------------- */}

      {/* MODAL: NUEVO ACTIVO */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                <span>Registrar Nuevo Activo Fijo</span>
              </h3>
              <button onClick={() => setIsAssetModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Código / Placa</label>
                  <input
                    type="text"
                    placeholder="ej: ACT-2026-004"
                    value={newAsset.code}
                    onChange={(e) => setNewAsset({ ...newAsset, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">N° Serie / Modelo</label>
                  <input
                    type="text"
                    placeholder="ej: SN-88120"
                    value={newAsset.serialNumber}
                    onChange={(e) => setNewAsset({ ...newAsset, serialNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Descripción del Activo *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Taladro percutor de banco industrial 1000W"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Clasificación NIIF</label>
                  <Select
                    value={newAsset.classificationId}
                    onChange={(e) => setNewAsset({ ...newAsset, classificationId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none"
                  >
                    {classifications.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Área Asignada</label>
                  <Select
                    value={newAsset.areaId}
                    onChange={(e) => setNewAsset({ ...newAsset, areaId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none"
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Ubicación Física</label>
                  <Select
                    value={newAsset.locationId}
                    onChange={(e) => setNewAsset({ ...newAsset, locationId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Custodio Responsable</label>
                  <input
                    type="text"
                    placeholder="ej: Ing. Carlos Mendoza"
                    value={newAsset.custodian}
                    onChange={(e) => setNewAsset({ ...newAsset, custodian: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Valor Compra ($) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newAsset.purchaseValue || ''}
                    onChange={(e) => setNewAsset({ ...newAsset, purchaseValue: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Valor Residual ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newAsset.residualValue || ''}
                    onChange={(e) => setNewAsset({ ...newAsset, residualValue: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Vida Útil (Años)</label>
                  <input
                    type="number"
                    value={newAsset.usefulLifeYears || 5}
                    onChange={(e) => setNewAsset({ ...newAsset, usefulLifeYears: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssetModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-xl shadow-md hover:from-orange-600 hover:to-amber-600 cursor-pointer"
                >
                  Guardar Activo Fijo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO MANTENIMIENTO */}
      {isMntModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-950 text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-500" />
                <span>Programar Mantenimiento</span>
              </h3>
              <button onClick={() => setIsMntModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMnt} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Activo Fijo</label>
                <Select
                  value={newMnt.assetId}
                  onChange={(e) => setNewMnt({ ...newMnt, assetId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tipo Mantenimiento</label>
                  <Select
                    value={newMnt.type}
                    onChange={(e) => setNewMnt({ ...newMnt, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                  >
                    <option value="PREVENTIVO">PREVENTIVO</option>
                    <option value="CORRECTIVO">CORRECTIVO</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Costo Estimado ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    value={newMnt.cost}
                    onChange={(e) => setNewMnt({ ...newMnt, cost: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Técnico / Proveedor</label>
                <input
                  type="text"
                  placeholder="ej: Talleres Mecánicos S.A."
                  value={newMnt.provider}
                  onChange={(e) => setNewMnt({ ...newMnt, provider: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Descripción del Trabajo</label>
                <textarea
                  rows={2}
                  placeholder="Detalles del mantenimiento a realizar..."
                  value={newMnt.description}
                  onChange={(e) => setNewMnt({ ...newMnt, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMntModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-xl shadow-md cursor-pointer"
                >
                  Guardar Mantenimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA TRANSFERENCIA */}
      {isTrfModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-950 text-sm flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-teal-500" />
                <span>Registrar Transferencia de Activo</span>
              </h3>
              <button onClick={() => setIsTrfModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrf} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Seleccionar Activo Fijo</label>
                <Select
                  value={newTrf.assetId}
                  onChange={(e) => setNewTrf({ ...newTrf, assetId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.areaName})</option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Área Destino</label>
                  <Select
                    value={newTrf.targetArea}
                    onChange={(e) => setNewTrf({ ...newTrf, targetArea: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Ubicación Destino</label>
                  <Select
                    value={newTrf.targetLocation}
                    onChange={(e) => setNewTrf({ ...newTrf, targetLocation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nuevo Custodio Responsable</label>
                <input
                  type="text"
                  placeholder="ej: Ing. Fernando Morales"
                  value={newTrf.newCustodian}
                  onChange={(e) => setNewTrf({ ...newTrf, newCustodian: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Motivo de la Transferencia</label>
                <input
                  type="text"
                  placeholder="ej: Reubicación de equipo a la sucursal Norte"
                  value={newTrf.reason}
                  onChange={(e) => setNewTrf({ ...newTrf, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTrfModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-xl shadow-md cursor-pointer"
                >
                  Confirmar Transferencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA AREA */}
      {isAreaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-950 text-sm">Nueva Área</h3>
              <button onClick={() => setIsAreaModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveArea} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre Área *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Sistemas & TI"
                  value={newArea.name}
                  onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Responsable</label>
                <input
                  type="text"
                  placeholder="ej: Ing. María López"
                  value={newArea.responsiblePerson}
                  onChange={(e) => setNewArea({ ...newArea, responsiblePerson: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAreaModalOpen(false)} className="px-3 py-1.5 border rounded-xl font-bold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-3 py-1.5 bg-orange-500 text-white rounded-xl font-black cursor-pointer">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA CLASIFICACION */}
      {isClassModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-950 text-sm">Nueva Clasificación</h3>
              <button onClick={() => setIsClassModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveClass} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre Categoría *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Instalaciones Eléctricas"
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">% Dep. Anual</label>
                  <input
                    type="number"
                    value={newClass.depreciationRatePercent}
                    onChange={(e) => setNewClass({ ...newClass, depreciationRatePercent: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Vida Útil (Años)</label>
                  <input
                    type="number"
                    value={newClass.usefulLifeYears}
                    onChange={(e) => setNewClass({ ...newClass, usefulLifeYears: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsClassModalOpen(false)} className="px-3 py-1.5 border rounded-xl font-bold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-3 py-1.5 bg-orange-500 text-white rounded-xl font-black cursor-pointer">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA UBICACION */}
      {isLocModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-950 text-sm">Nueva Ubicación Físia</h3>
              <button onClick={() => setIsLocModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveLoc} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre Ubicación *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Sucursal Norte - Taller"
                  value={newLoc.name}
                  onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Dirección</label>
                <input
                  type="text"
                  placeholder="Av. Amazonas y Prensa"
                  value={newLoc.address}
                  onChange={(e) => setNewLoc({ ...newLoc, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsLocModalOpen(false)} className="px-3 py-1.5 border rounded-xl font-bold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-3 py-1.5 bg-orange-500 text-white rounded-xl font-black cursor-pointer">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
