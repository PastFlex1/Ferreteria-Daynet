import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  X, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  AlertTriangle, 
  Lock, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  Check,
  Save,
  RotateCcw
} from 'lucide-react';
import { 
  ALL_PERMISSIONS, 
  PERMISSION_MODULES, 
  ROLE_PRESETS, 
  PermissionMap, 
  PermissionDefinition 
} from '../../types/permissions';
import { SystemUser } from '../../types';

interface UserPermissionsModalProps {
  user: SystemUser;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, updatedPermissions: PermissionMap, newRole?: string) => void;
}

export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
  user,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  // Inicializar estado local de permisos
  const [permissions, setPermissions] = useState<PermissionMap>(() => {
    // Si el usuario ya tiene permisos guardados, usarlos
    if (user.permissions && Object.keys(user.permissions).length > 0) {
      return { ...user.permissions };
    }
    // Si no, cargar la plantilla correspondiente a su rol actual
    const preset = ROLE_PRESETS[user.role]?.permissions || {};
    return { ...preset };
  });

  const [selectedRole, setSelectedRole] = useState<string>(user.role || 'Cajero');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModuleFilter, setActiveModuleFilter] = useState<string>('ALL');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    // Por defecto expandir todos los módulos
    return PERMISSION_MODULES.reduce((acc, m) => {
      acc[m.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
  });

  // Contador global de permisos activos
  const totalPermissionsCount = ALL_PERMISSIONS.length;
  const activePermissionsCount = useMemo(() => {
    return Object.values(permissions).filter(Boolean).length;
  }, [permissions]);

  // Filtrado de permisos por término de búsqueda y módulo
  const filteredPermissions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return ALL_PERMISSIONS.filter((p) => {
      const matchesSearch = 
        !term || 
        p.label.toLowerCase().includes(term) || 
        p.description.toLowerCase().includes(term) || 
        p.id.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term);

      const matchesModule = activeModuleFilter === 'ALL' || p.module === activeModuleFilter;

      return matchesSearch && matchesModule;
    });
  }, [searchTerm, activeModuleFilter]);

  // Agrupar permisos filtrados por módulo
  const groupedPermissions = useMemo(() => {
    const map: Record<string, PermissionDefinition[]> = {};
    for (const p of filteredPermissions) {
      if (!map[p.module]) {
        map[p.module] = [];
      }
      map[p.module].push(p);
    }
    return map;
  }, [filteredPermissions]);

  // Manejo de toggle individual
  const handleTogglePermission = (permissionId: string) => {
    setPermissions((prev) => ({
      ...prev,
      [permissionId]: !prev[permissionId],
    }));
  };

  // Cargar una plantilla de rol predeterminada
  const handleApplyPreset = (presetKey: string) => {
    const preset = ROLE_PRESETS[presetKey];
    if (preset) {
      setPermissions({ ...preset.permissions });
      setSelectedRole(presetKey);
    }
  };

  // Marcar / Desmarcar todos los permisos visibles o globales
  const handleSelectAll = (select: boolean) => {
    const updated = { ...permissions };
    ALL_PERMISSIONS.forEach((p) => {
      updated[p.id] = select;
    });
    setPermissions(updated);
  };

  // Marcar / Desmarcar módulo específico
  const handleToggleModuleAll = (moduleId: string, select: boolean) => {
    const modulePermissions = ALL_PERMISSIONS.filter((p) => p.module === moduleId);
    setPermissions((prev) => {
      const next = { ...prev };
      modulePermissions.forEach((p) => {
        next[p.id] = select;
      });
      return next;
    });
  };

  const toggleModuleCollapse = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const handleSave = () => {
    onSave(user.id, permissions, selectedRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-750/90 ring-1 ring-white/10 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* TOP BAR / HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-black text-lg shadow-inner shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white truncate">
                  Configuración Granular de Permisos
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  {user.name}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-slate-800">
                  {user.username || 'Sin Cédula'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                Controle cada menú, cada input de descuento o precio, y cada acción crítica para este trabajador.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PLANTILLAS RÁPIDAS (PRESETS) */}
        <div className="bg-slate-950/70 border-b border-slate-800/80 px-5 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
          <span className="text-[11px] font-black text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Plantillas Rápidas:</span>
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.keys(ROLE_PRESETS).map((key) => {
              const isSelected = selectedRole === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyPreset(key)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/50'
                  }`}
                >
                  <span>{ROLE_PRESETS[key].label}</span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Marcar Todos</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-400 hover:bg-rose-500/10 rounded-lg transition flex items-center gap-1 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Desmarcar Todos</span>
            </button>
          </div>
        </div>

        {/* BARRA DE FILTRO Y BÚSQUEDA */}
        <div className="px-5 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar input, botón, pestaña o acción... (ej: descuento, precio, costo, anular)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition [color-scheme:dark]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Selector de filtro rápido por módulo */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveModuleFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeModuleFilter === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Todos los Módulos
            </button>
            {PERMISSION_MODULES.slice(0, 6).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveModuleFilter(m.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeModuleFilter === m.id
                    ? 'bg-orange-600/90 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: LISTADO DE PERMISOS POR MÓDULO */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 divide-y divide-slate-800/60">
          {Object.keys(groupedPermissions).length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-400">No se encontraron permisos para "{searchTerm}"</p>
              <p className="text-xs text-slate-500">Pruebe buscando con otra palabra clave como "precio", "caja", "inventario" o "descuento".</p>
            </div>
          ) : (
            PERMISSION_MODULES.map((moduleMeta) => {
              const moduleItems = groupedPermissions[moduleMeta.id];
              if (!moduleItems || moduleItems.length === 0) return null;

              const isExpanded = expandedModules[moduleMeta.id] !== false;
              const moduleTotal = ALL_PERMISSIONS.filter((p) => p.module === moduleMeta.id).length;
              const moduleActive = moduleItems.filter((p) => permissions[p.id]).length;

              return (
                <div key={moduleMeta.id} className="pt-4 first:pt-0 space-y-3">
                  {/* Encabezado del Módulo */}
                  <div className="flex items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                    <div 
                      onClick={() => toggleModuleCollapse(moduleMeta.id)}
                      className="flex items-center gap-2.5 cursor-pointer select-none flex-1"
                    >
                      <button type="button" className="text-slate-400 hover:text-white transition">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <span>{moduleMeta.name}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                          {moduleActive} de {moduleTotal} activos
                        </span>
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleModuleAll(moduleMeta.id, true)}
                        className="text-[11px] font-bold text-emerald-400 hover:underline px-2 py-1 cursor-pointer"
                      >
                        Activar Todos
                      </button>
                      <span className="text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => handleToggleModuleAll(moduleMeta.id, false)}
                        className="text-[11px] font-bold text-rose-400 hover:underline px-2 py-1 cursor-pointer"
                      >
                        Apagar Módulo
                      </button>
                    </div>
                  </div>

                  {/* Lista de Permisos del Módulo */}
                  {isExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-1">
                      {moduleItems.map((perm) => {
                        const isEnabled = !!permissions[perm.id];
                        const isHighDanger = perm.dangerLevel === 'high';
                        const isMediumDanger = perm.dangerLevel === 'medium';

                        return (
                          <div
                            key={perm.id}
                            onClick={() => handleTogglePermission(perm.id)}
                            className={`p-3 rounded-xl border transition flex items-start gap-3 cursor-pointer select-none ${
                              isEnabled
                                ? 'bg-slate-850/90 border-slate-700/80 shadow-sm'
                                : 'bg-slate-950/40 border-slate-850 opacity-70 hover:opacity-100'
                            }`}
                          >
                            {/* Toggle Switch */}
                            <div className="pt-0.5 shrink-0">
                              <div
                                className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                                  isEnabled ? 'bg-orange-500' : 'bg-slate-700'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                    isEnabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs font-bold ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                                  {perm.label}
                                </span>
                                {isHighDanger && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    Crítico
                                  </span>
                                )}
                                {isMediumDanger && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Medio
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-snug">
                                {perm.description}
                              </p>
                              <span className="inline-block text-[9px] font-mono text-slate-500 pt-0.5">
                                Código: {perm.id}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER ACCIONES */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center font-black text-xs">
              {Math.round((activePermissionsCount / totalPermissionsCount) * 100)}%
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {activePermissionsCount} de {totalPermissionsCount} permisos asignados
              </div>
              <div className="text-[11px] text-slate-400">
                Rol actual: <strong className="text-orange-400 font-bold">{selectedRole}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white text-xs font-black rounded-xl shadow-lg shadow-orange-500/25 transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Permisos</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
