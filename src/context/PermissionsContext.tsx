import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { SystemUser } from '../types';
import { ROLE_PRESETS, PermissionMap, SystemRole, DEFAULT_SYSTEM_ROLES, getCombinedRolePresets } from '../types/permissions';
import { Lock } from 'lucide-react';

interface PermissionsContextType {
  can: (permissionId: string) => boolean;
  canAny: (permissionIds: string[]) => boolean;
  canAll: (permissionIds: string[]) => boolean;
  isSuperAdmin: boolean;
  activeUser: SystemUser | null;
  userPermissions: PermissionMap;
  rolesList: SystemRole[];
}

const PermissionsContext = createContext<PermissionsContextType>({
  can: () => true,
  canAny: () => true,
  canAll: () => true,
  isSuperAdmin: true,
  activeUser: null,
  userPermissions: {},
  rolesList: DEFAULT_SYSTEM_ROLES,
});

interface PermissionsProviderProps {
  children: ReactNode;
  currentUser: any;
  usersList?: any[];
  rolesList?: SystemRole[];
}

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({
  children,
  currentUser,
  usersList = [],
  rolesList = DEFAULT_SYSTEM_ROLES,
}) => {
  // Obtener la versión reactiva más fresca del usuario desde usersList de Firestore
  const activeUser = useMemo<SystemUser | null>(() => {
    if (!currentUser) return null;
    const found = usersList.find(
      (u) => (u.id && u.id === currentUser.id) || (u.username && u.username === currentUser.username)
    );
    return found || currentUser;
  }, [currentUser, usersList]);

  const isSuperAdmin = useMemo(() => {
    if (!activeUser) return true;
    const role = (activeUser.role || '').toLowerCase();
    return role === 'administrador' || role === 'admin';
  }, [activeUser]);

  // Consolidar el mapa de permisos efectivos del trabajador
  const userPermissions = useMemo<PermissionMap>(() => {
    if (!activeUser) return {};
    if (isSuperAdmin) {
      // Administrador tiene acceso total a todo
      return ROLE_PRESETS.Administrador.permissions;
    }

    // 1. Obtener la plantilla según su rol asignado (soporta roles personalizados creados dinámicamente)
    const combinedPresets = getCombinedRolePresets(rolesList);
    const matchedRole = rolesList.find(
      (r) => r.name.toLowerCase() === (activeUser.role || '').toLowerCase() || r.id === activeUser.role
    );
    const basePreset = matchedRole?.permissions || combinedPresets[activeUser.role]?.permissions || {};

    // 2. Aplicar sobreescrituras granulares personalizadas para este trabajador
    const customPermissions = activeUser.permissions || {};

    return {
      ...basePreset,
      ...customPermissions,
    };
  }, [activeUser, isSuperAdmin, rolesList]);

  // Mapa de equivalencias entre accesos de navegación y acciones de módulo
  const PERMISSION_ALIASES: Record<string, string[]> = {
    'nav.reportes.ventas': ['reports.view_sales'],
    'nav.reportes.rentabilidad': ['reports.view_profits'],
    'nav.reportes.inventario': ['reports.view_inventory_valuation'],
    'nav.reportes.comisiones': ['reports.view_commissions'],
    'nav.rrhh.empleados': ['hr.manage_employees'],
    'nav.rrhh.roles': ['hr.calculate_payroll'],
    'nav.compras.ordenes': ['purchases.create_order'],
    'nav.compras.facturas': ['purchases.receive_bill'],
    'nav.proveedores.directorio': ['suppliers.create'],
    'nav.proveedores.cuentas_pagar': ['suppliers.pay_debt'],
    'nav.finanzas.bancos': ['finance.manage_banks'],
    'nav.contabilidad.asientos': ['accounting.journal_entries'],
    'nav.contabilidad.ats': ['accounting.ats_export'],
    'nav.configuracion.empresa': ['settings.company_info'],
    'nav.configuracion.usuarios': ['settings.users_manage'],
    'nav.configuracion.firma': ['settings.sri_signature'],
  };

  const can = (permissionId: string): boolean => {
    if (!activeUser) return true;
    if (isSuperAdmin) return true;

    // 1. Si el permiso está explícitamente configurado (true o false)
    if (typeof userPermissions[permissionId] === 'boolean') {
      return userPermissions[permissionId];
    }

    // 2. Verificar aliases / acciones equivalentes
    const aliases = PERMISSION_ALIASES[permissionId];
    if (aliases) {
      for (const alias of aliases) {
        if (typeof userPermissions[alias] === 'boolean') {
          return userPermissions[alias];
        }
      }
    }

    // 3. Si se consulta un módulo padre (ej: 'nav.ventas'), verificar si tiene AL MENOS un permiso hijo activo
    const hasChildActive = Object.keys(userPermissions).some(
      (k) => k.startsWith(`${permissionId}.`) && userPermissions[k] === true
    );
    if (hasChildActive) {
      return true;
    }

    // 4. Si no está configurado, verificar si tiene acceso al módulo padre (solo si el padre está explícitamente en true)
    const parts = permissionId.split('.');
    if (parts.length > 1) {
      const parentModuleKey = parts.slice(0, -1).join('.');
      if (userPermissions[parentModuleKey] === true) {
        return true;
      }
    }

    // Por defecto para roles que no sean administrador: si no está otorgado, denegar
    return false;
  };

  const canAny = (permissionIds: string[]): boolean => {
    if (!activeUser || isSuperAdmin) return true;
    return permissionIds.some((id) => can(id));
  };

  const canAll = (permissionIds: string[]): boolean => {
    if (!activeUser || isSuperAdmin) return true;
    return permissionIds.every((id) => can(id));
  };

  return (
    <PermissionsContext.Provider
      value={{
        can,
        canAny,
        canAll,
        isSuperAdmin,
        activeUser,
        userPermissions,
        rolesList,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions debe ser usado dentro de un PermissionsProvider');
  }
  return context;
};

// Componente guard para proteger elementos de la interfaz de forma declarativa
interface PermissionGateProps {
  permission: string;
  fallback?: ReactNode;
  showLockedNotice?: boolean;
  lockedTitle?: string;
  children: ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  fallback = null,
  showLockedNotice = false,
  lockedTitle = 'Acceso restringido por el administrador',
  children,
}) => {
  const { can } = usePermissions();
  const allowed = can(permission);

  if (allowed) {
    return <>{children}</>;
  }

  if (showLockedNotice) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 border border-slate-700/60 rounded-lg text-slate-400 text-[11px] font-medium select-none">
        <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>{lockedTitle}</span>
      </div>
    );
  }

  return <>{fallback}</>;
};
