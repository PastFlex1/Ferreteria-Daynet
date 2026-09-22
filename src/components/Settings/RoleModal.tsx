import React, { useState, useMemo, useEffect } from 'react';
import { Select } from '../Shared/Select';
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
  Copy,
  Tag,
  Palette
} from 'lucide-react';
import { 
  ALL_PERMISSIONS, 
  PERMISSION_MODULES, 
  ROLE_PRESETS, 
  PermissionMap, 
  PermissionDefinition,
  SystemRole,
  DEFAULT_SYSTEM_ROLES,
  autoLinkPermissionDependencies
} from '../../types/permissions';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (role: SystemRole) => void;
  editingRole?: SystemRole | null;
  existingRoles: SystemRole[];
}

const COLOR_OPTIONS = [
  { id: 'cyan', label: 'Cian', bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40', ring: 'ring-cyan-500' },
  { id: 'amber', label: 'Ámbar', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', ring: 'ring-amber-500' },
  { id: 'emerald', label: 'Esmeralda', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', ring: 'ring-emerald-500' },
  { id: 'purple', label: 'Púrpura', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40', ring: 'ring-purple-500' },
  { id: 'blue', label: 'Azul', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', ring: 'ring-blue-500' },
  { id: 'rose', label: 'Rosa', bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40', ring: 'ring-rose-500' },
  { id: 'orange', label: 'Naranja', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40', ring: 'ring-orange-500' },
  { id: 'indigo', label: 'Índigo', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/40', ring: 'ring-indigo-500' },
];

const EMOJI_OPTIONS = ['🛡️', '👑', '💳', '🛍️', '📦', '📊', '💼', '👷', '🚚', '🏷️', '📝', '🔑', '⭐', '🔧', '🎯'];

export const RoleModal: React.FC<RoleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingRole,
  existingRoles,
}) => {
  if (!isOpen) return null;

  const isEditing = !!editingRole;

  // Estados del rol
  const [roleName, setRoleName] = useState(editingRole?.name || '');
  const [roleEmoji, setRoleEmoji] = useState(() => {
    if (editingRole?.label) {
      const match = editingRole.label.match(/^(\p{Extended_Pictographic}|\S+)/u);
      if (match) return match[1];
    }
    return '🛡️';
  });
  const [roleDescription, setRoleDescription] = useState(editingRole?.description || '');
  const [roleColor, setRoleColor] = useState(editingRole?.color || 'cyan');
  const [cloneSource, setCloneSource] = useState<string>('');

  // Matriz de permisos
  const [permissions, setPermissions] = useState<PermissionMap>(() => {
    const initialMap: PermissionMap = {};
    ALL_PERMISSIONS.forEach((p) => {
      initialMap[p.id] = editingRole?.permissions ? !!editingRole.permissions[p.id] : false;
    });
    return initialMap;
  });

  // Filtros de navegación en la matriz
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModuleFilter, setActiveModuleFilter] = useState<string>('ALL');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    return PERMISSION_MODULES.reduce((acc, m) => {
      acc[m.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
  });

  // Error de validación
  const [errorMsg, setErrorMsg] = useState('');

  // Reset state al abrir
  useEffect(() => {
    if (editingRole) {
      setRoleName(editingRole.name);
      setRoleDescription(editingRole.description);
      setRoleColor(editingRole.color || 'cyan');
      const match = editingRole.label.match(/^(\p{Extended_Pictographic}|\S+)/u);
      setRoleEmoji(match ? match[1] : '🛡️');
      const initialMap: PermissionMap = {};
      ALL_PERMISSIONS.forEach((p) => {
        initialMap[p.id] = !!editingRole.permissions?.[p.id];
      });
      setPermissions(initialMap);
    } else {
      setRoleName('');
      setRoleEmoji('🛡️');
      setRoleDescription('');
      setRoleColor('cyan');
      setCloneSource('');
      const initialMap: PermissionMap = {};
      ALL_PERMISSIONS.forEach((p) => {
        initialMap[p.id] = false;
      });
      setPermissions(initialMap);
    }
    setErrorMsg('');
  }, [editingRole, isOpen]);

  // Clonar permisos de un rol existente
  const handleClonePermissions = (sourceName: string) => {
    setCloneSource(sourceName);
    if (!sourceName) return;

    const foundRole = (existingRoles || []).find((r) => r?.name === sourceName) || DEFAULT_SYSTEM_ROLES.find((r) => r?.name === sourceName);
    const sourcePerms = foundRole?.permissions || ROLE_PRESETS[sourceName]?.permissions || {};

    setPermissions((prev) => {
      const next = { ...prev };
      ALL_PERMISSIONS.forEach((p) => {
        next[p.id] = !!sourcePerms[p.id];
      });
      return next;
    });
  };

  // Toggle individual
  const handleTogglePermission = (id: string) => {
    setPermissions((prev) => {
      const nextVal = !prev[id];
      return autoLinkPermissionDependencies(id, nextVal, prev);
    });
  };

  // Toggle todos
  const handleSelectAll = (val: boolean) => {
    setPermissions(() => {
      const next: PermissionMap = {};
      ALL_PERMISSIONS.forEach((p) => {
        next[p.id] = val;
      });
      return next;
    });
  };

  // Toggle módulo específico
  const handleToggleModule = (moduleId: string, val: boolean) => {
    const modulePerms = ALL_PERMISSIONS.filter((p) => p.module === moduleId);
    setPermissions((prev) => {
      let next = { ...prev };
      modulePerms.forEach((p) => {
        next = autoLinkPermissionDependencies(p.id, val, next);
      });
      return next;
    });
  };

  // Contadores
  const totalPermissionsCount = ALL_PERMISSIONS.length;
  const activePermissionsCount = useMemo(() => {
    return Object.values(permissions).filter(Boolean).length;
  }, [permissions]);

  // Filtrado de permisos
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

  // Agrupado por módulos
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

  // Guardar rol
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = roleName.trim();
    if (!cleanName) {
      setErrorMsg('El nombre del rol es obligatorio.');
      return;
    }

    // Comprobar si ya existe otro rol con ese nombre (no sensible a mayúsculas)
    const duplicate = (existingRoles || []).find(
      (r) => (r?.name || '').toLowerCase() === cleanName.toLowerCase() && r?.id !== editingRole?.id
    );
    if (duplicate) {
      setErrorMsg(`Ya existe un rol con el nombre "${cleanName}".`);
      return;
    }

    const fullLabel = `${roleEmoji} ${cleanName}`;
    const roleId = editingRole?.id || `role-${Date.now()}`;

    const newRole: SystemRole = {
      id: roleId,
      name: cleanName,
      label: fullLabel,
      description: roleDescription.trim() || `Rol personalizado ${cleanName}`,
      isSystem: editingRole?.isSystem || false,
      color: roleColor,
      permissions,
      updatedAt: new Date().toISOString(),
      createdAt: editingRole?.createdAt || new Date().toISOString(),
    };

    onSave(newRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-750/90 ring-1 ring-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 px-6 py-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-wide">
                  {isEditing ? `Editar Rol: ${editingRole.name}` : 'Crear Nuevo Rol de Usuario'}
                </h3>
                {editingRole?.isSystem && (
                  <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded-md uppercase">
                    Rol del Sistema
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Defina el nombre, perfil y matriz de permisos que tendrán los trabajadores asignados a este rol.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
          {/* DATOS BÁSICOS DEL ROL */}
          <div className="p-5 sm:p-6 bg-slate-950/40 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              {/* Emoji Selector */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-300 block mb-1.5">Ícono / Emoji</label>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={roleEmoji}
                    onChange={(e: any) => setRoleEmoji(e.target.value)}
                    searchable={false}
                    className="w-full bg-slate-900 border-slate-800 text-white text-lg text-center font-bold"
                  >
                    {EMOJI_OPTIONS.map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Nombre del Rol */}
              <div className="sm:col-span-6">
                <label className="text-[11px] font-bold text-slate-300 block mb-1.5">
                  Nombre del Rol <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: Supervisor de Turno, Jefe de Almacén..."
                  value={roleName}
                  onChange={(e) => {
                    setRoleName(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-3.5 py-2 text-xs font-bold placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition [color-scheme:dark]"
                />
              </div>

              {/* Color distintivo */}
              <div className="sm:col-span-4">
                <label className="text-[11px] font-bold text-slate-300 block mb-1.5 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-cyan-400" />
                  <span>Color de Identificación</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setRoleColor(c.id)}
                      title={c.label}
                      className={`w-6 h-6 rounded-lg ${c.bg} ${c.border} border transition cursor-pointer flex items-center justify-center ${
                        roleColor === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {roleColor === c.id && <Check className={`w-3 h-3 ${c.text}`} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div className="sm:col-span-8">
                <label className="text-[11px] font-bold text-slate-300 block mb-1.5">Descripción de Funciones</label>
                <input
                  type="text"
                  placeholder="Responsable de supervisión, aprobación de descuentos y arqueo de cajas..."
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3.5 py-2 text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition [color-scheme:dark]"
                />
              </div>

              {/* Clonar de Rol Existente */}
              <div className="sm:col-span-4">
                <label className="text-[11px] font-bold text-slate-300 block mb-1.5 flex items-center gap-1">
                  <Copy className="w-3 h-3 text-amber-400" />
                  <span>Copiar Permisos de:</span>
                </label>
                <Select
                  value={cloneSource}
                  onChange={(e: any) => handleClonePermissions(e.target.value)}
                  className="w-full bg-slate-900 border-slate-800 text-white font-bold"
                >
                  <option value="">-- Personalizar desde cero --</option>
                  {(existingRoles || []).filter(Boolean).map((r) => (
                    <option key={r?.id || r?.name} value={r?.name}>
                      {r?.label || r?.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* MATRIZ DE PERMISOS: BARRA DE CONTROL */}
          <div className="bg-slate-950/70 px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Permisos Activos: <strong className="text-cyan-400">{activePermissionsCount}</strong> de {totalPermissionsCount}
                </span>
              </span>

              <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${Math.round((activePermissionsCount / totalPermissionsCount) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition flex items-center gap-1 cursor-pointer border border-emerald-500/25"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Marcar Todos</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-400 hover:bg-rose-500/10 rounded-lg transition flex items-center gap-1 cursor-pointer border border-rose-500/25"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Desmarcar Todos</span>
              </button>
            </div>
          </div>

          {/* BÚSQUEDA Y FILTROS DE MÓDULOS */}
          <div className="p-4 bg-slate-900 flex flex-wrap gap-2.5 items-center border-b border-slate-800">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar permiso, acción o módulo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition [color-scheme:dark]"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setActiveModuleFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer whitespace-nowrap ${
                  activeModuleFilter === 'ALL'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                TODOS ({ALL_PERMISSIONS.length})
              </button>
              {PERMISSION_MODULES.map((m) => {
                const count = ALL_PERMISSIONS.filter((p) => p.module === m.id).length;
                const activeCount = ALL_PERMISSIONS.filter((p) => p.module === m.id && permissions[p.id]).length;
                const isCurrent = activeModuleFilter === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveModuleFilter(m.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      isCurrent
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{m.name.split('(')[0].trim()}</span>
                    <span className={`text-[9px] px-1 rounded ${isCurrent ? 'bg-slate-900/40 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      {activeCount}/{count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* LISTA DE PERMISOS POR MÓDULO */}
          <div className="p-5 space-y-4">
            {Object.keys(groupedPermissions).length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No se encontraron permisos que coincidan con &quot;{searchTerm}&quot;.
              </div>
            ) : (
              Object.keys(groupedPermissions).map((moduleId) => {
                const moduleDef = PERMISSION_MODULES.find((m) => m.id === moduleId);
                const items = groupedPermissions[moduleId];
                const activeCount = items.filter((p) => permissions[p.id]).length;
                const allActive = activeCount === items.length;
                const isExpanded = expandedModules[moduleId] ?? true;

                return (
                  <div key={moduleId} className="bg-slate-950/60 border border-slate-800/90 rounded-2xl overflow-hidden">
                    {/* Header Módulo */}
                    <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedModules((prev) => ({
                            ...prev,
                            [moduleId]: !isExpanded,
                          }))
                        }
                        className="flex items-center gap-2 text-xs font-bold text-white hover:text-cyan-400 transition cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="text-cyan-300 font-mono text-[11px]">[{moduleId}]</span>
                        <span>{moduleDef?.name || moduleId}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-medium ml-1">
                          ({activeCount} de {items.length} activos)
                        </span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleModule(moduleId, !allActive)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                            allActive
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
                          }`}
                        >
                          {allActive ? 'Desmarcar Módulo' : 'Marcar Módulo'}
                        </button>
                      </div>
                    </div>

                    {/* Contenido Módulo */}
                    {isExpanded && (
                      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {items.map((perm) => {
                          const isChecked = !!permissions[perm.id];
                          return (
                            <div
                              key={perm.id}
                              onClick={() => handleTogglePermission(perm.id)}
                              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2.5 ${
                                isChecked
                                  ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  <span className={`text-xs font-bold truncate ${isChecked ? 'text-white' : 'text-slate-300'}`}>
                                    {perm.label}
                                  </span>
                                  {perm.dangerLevel === 'high' && (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-black uppercase border border-rose-500/30">
                                      Crítico
                                    </span>
                                  )}
                                  {perm.dangerLevel === 'medium' && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase border border-amber-500/30">
                                      Medio
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{perm.description}</p>
                                <div className="text-[9px] font-mono text-slate-500 mt-1">{perm.id}</div>
                              </div>

                              <div className="shrink-0 pt-0.5">
                                <div
                                  className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                                    isChecked ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-black' : 'border-slate-700 bg-slate-950'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
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
          <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-400">
              Rol configurado con <strong className="text-white">{activePermissionsCount}</strong> permisos activos.
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black rounded-xl transition shadow-lg shadow-cyan-600/20 flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isEditing ? 'GUARDAR CAMBIOS DEL ROL' : 'CREAR ROL'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
