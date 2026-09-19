import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { SystemUser } from '../types';
import { ROLE_PRESETS, PermissionMap, SystemRole, DEFAULT_SYSTEM_ROLES, getCombinedRolePresets, ALL_PERMISSIONS } from '../types/permissions';
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
    }    // 1. Obtener la plantilla según su rol asignado (soporta roles personalizados creados dinámicamente)
    const combinedPresets = getCombinedRolePresets(rolesList);
    const matchedRole = rolesList.find(
      (r) => r.name.toLowerCase() === (activeUser.role || '').toLowerCase() || r.id === activeUser.role
    );
    const basePreset = matchedRole?.permissions || combinedPresets[activeUser.role]?.permissions || {};

    // 2. Si el rol existe y el usuario no tiene una configuración explícita guardada como 'hasCustomPermissions',
    // los permisos efectivos provienen 100% de la definición de su rol asignado.
    // Esto previene que datos residuales en el objeto de usuario (ej: permisos de un rol anterior como Contador)
    // otorguen acceso indebido al asignarle un nuevo rol como "prueba".
    if (matchedRole && !(activeUser as any).hasCustomPermissions) {
      const rolePerms = matchedRole.permissions || {};
      const effective: PermissionMap = {};
      ALL_PERMISSIONS.forEach((p) => {
        effective[p.id] = !!rolePerms[p.id];
      });
      return effective;
    }

    // 3. Aplicar sobreescrituras granulares personalizadas para este trabajador si tiene hasCustomPermissions
    const customPermissions = activeUser.permissions || {};

    const effective: PermissionMap = {};
    ALL_PERMISSIONS.forEach((p) => {
      if (typeof customPermissions[p.id] === 'boolean') {
        effective[p.id] = customPermissions[p.id];
      } else if (typeof basePreset[p.id] === 'boolean') {
        effective[p.id] = basePreset[p.id];
      } else {
        effective[p.id] = false;
      }
    });
    return effective;
  }, [activeUser, isSuperAdmin, rolesList]);

  // Mapa de equivalencias entre accesos de navegación y acciones de módulo
  const PERMISSION_ALIASES: Record<string, string[]> = {
    // Ventas / POS / Facturación
    'nav.ventas.caja': ['pos.create_invoice', 'pos.create_nota_venta', 'pos.create_quote', 'pos.access'],
    'pos.create_invoice': ['nav.ventas.caja'],
    'nav.ventas.facturas': ['sales.anular_invoice', 'sales.export_invoices_excel'],
    'nav.ventas.cotizaciones': ['pos.create_quote', 'sales.convert_quote', 'sales.delete_quote'],
    'nav.ventas.nota_credito': ['sales.create_credit_note'],
    'nav.ventas.retencion': ['sales.create_retention', 'sales.import_retention_xml'],
    'nav.ventas': ['nav.ventas.caja', 'nav.ventas.facturas', 'nav.ventas.pedidos', 'nav.ventas.cotizaciones', 'pos.create_invoice', 'pos.create_nota_venta'],

    // Clientes y Cartera
    'nav.clientes.lista': ['customers.create', 'customers.edit', 'customers.delete'],
    'nav.clientes.cuentas_cobrar': ['customers.collect_payment', 'customers.edit_credit_limit'],
    'nav.clientes': ['nav.clientes.lista', 'nav.clientes.cuentas_cobrar', 'customers.create'],

    // Inventario y Almacén
    'nav.inventario.productos': ['inventory.create_product', 'inventory.edit_product_info', 'inventory.edit_sale_price', 'inventory.view_cost_price', 'inventory.stock_manual_adjust'],
    'nav.inventario.precios_masivos': ['inventory.bulk_price_update'],
    'nav.inventario.ajustes': ['inventory.stock_manual_adjust'],
    'nav.inventario': ['nav.inventario.productos', 'nav.inventario.categorias', 'nav.inventario.promociones', 'inventory.create_product'],

    // Compras y Proveedores
    'nav.compras.facturas': ['purchases.create_bill', 'purchases.receive_bill', 'purchases.view_cost_history'],
    'nav.compras.ordenes': ['purchases.create_order'],
    'nav.compras': ['nav.compras.facturas', 'nav.compras.ordenes', 'purchases.create_bill', 'purchases.receive_bill'],
    'nav.proveedores.directorio': ['suppliers.create', 'suppliers.edit', 'suppliers.delete'],
    'nav.proveedores.cuentas_pagar': ['suppliers.pay_debt'],
    'nav.proveedores': ['nav.proveedores.directorio', 'nav.proveedores.cuentas_pagar', 'suppliers.create'],

    // Finanzas y Bancos
    'nav.finanzas.bancos': ['finance.create_account', 'finance.register_movement'],
    'nav.finanzas.cajas_chicas': ['finance.petty_cash_open', 'finance.petty_cash_expense'],
    'nav.finanzas': ['nav.finanzas.bancos', 'nav.finanzas.cajas_chicas', 'finance.create_account'],

    // Contabilidad
    'nav.contabilidad.resumen': ['accounting.journal_entries'],
    'nav.contabilidad.asientos': ['accounting.journal_entries'],
    'nav.contabilidad.ats': ['accounting.ats_export'],
    'nav.contabilidad': ['nav.contabilidad.resumen', 'nav.contabilidad.asientos', 'nav.contabilidad.ats', 'accounting.journal_entries'],

    // Activos Fijos
    'nav.activos.inventario': ['assets.create', 'assets.edit'],
    'nav.activos': ['nav.activos.inventario', 'assets.create'],

    // Talento Humano / RRHH
    'nav.rrhh.empleados': ['hr.create_employee', 'hr.edit_employee'],
    'nav.rrhh.roles': ['hr.calculate_payroll', 'hr.pay_salary'],
    'nav.rrhh': ['nav.rrhh.empleados', 'nav.rrhh.roles', 'hr.create_employee', 'hr.calculate_payroll'],

    // Reportes
    'nav.reportes.ventas': ['reports.view_sales'],
    'nav.reportes.rentabilidad': ['reports.view_profits'],
    'nav.reportes.inventario': ['reports.view_inventory_valuation'],
    'nav.reportes.comisiones': ['reports.view_commissions'],
    'nav.reportes.caja': ['cash.view_history'],
    'nav.reportes': ['nav.reportes.ventas', 'reports.view_sales', 'reports.view_profits', 'reports.view_inventory_valuation'],

    // Configuración
    'nav.configuracion.empresa': ['settings.company_info', 'settings.general_view'],
    'nav.configuracion.usuarios': ['settings.users_manage'],
    'nav.configuracion.firma': ['settings.sri_signature'],
    'nav.configuracion': ['settings.general_view', 'settings.company_info', 'settings.users_manage', 'settings.sri_signature', 'settings.database_backup', 'settings.system_reset'],
  };

  const can = (permissionId: string): boolean => {
    if (!activeUser) return true;
    if (isSuperAdmin) return true;

    // 1. Si el permiso directo está explícitamente en true
    if (userPermissions[permissionId] === true) {
      return true;
    }

    // 2. Si tiene algún alias equivalente que esté activo en true
    const aliases = PERMISSION_ALIASES[permissionId];
    if (aliases && aliases.some((alias) => userPermissions[alias] === true)) {
      return true;
    }

    // 3. Si se consulta un módulo contenedor (ej: 'nav.ventas', 'nav.clientes'),
    // permitir si tiene AL MENOS un permiso o subtab hijo activo
    const hasChildActive = Object.keys(userPermissions).some(
      (k) => k.startsWith(`${permissionId}.`) && userPermissions[k] === true
    );
    if (hasChildActive) {
      return true;
    }

    // Por defecto para cualquier rol que no sea superadministrador: denegar
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
