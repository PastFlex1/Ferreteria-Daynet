import dotenv from 'dotenv';
import { 
  getSqlitePool, 
  getSqliteDb,
  SqliteDatabase, 
  initializeSqliteSchema, 
  currentDbName, 
  currentUri,
  sqliteFilePath 
} from './sqlite';

dotenv.config();

export { currentDbName, currentUri, sqliteFilePath };

let cachedDb: SqliteDatabase | null = null;

/**
 * Retorna la instancia de Base de Datos SQLite Institucional:
 * 100% Offline, portable, embebida y con soporte completo para transacciones ACID.
 */
export async function getDatabase(): Promise<SqliteDatabase> {
  if (!cachedDb) {
    cachedDb = new SqliteDatabase(currentDbName);
    // Verificar y crear esquema al conectar
    await initializeSqliteSchema();
  }
  return cachedDb;
}

// Exportamos el pool SQLite bajo el alias getPgPool para que ningún controlador falle
export const getPgPool = getSqlitePool;
export { getSqlitePool, getSqliteDb, initializeSqliteSchema };
export const initializePostgresSchema = initializeSqliteSchema;
export { SqliteDatabase as PostgresDatabase };

export const COMPASS_COLLECTIONS: Record<string, string> = {
  // Productos e Inventario
  ferreteria_products: 'productos',
  ferreteria_inventory: 'productos',
  ferreteria_categories: 'categorias_productos',
  ferreteria_units: 'unidades_medida',
  ferreteria_promotions: 'promociones',
  ferreteria_product_batches: 'lotes_productos',
  ferreteria_taxes: 'tarifas_impuestos',
  ferreteria_inventory_adjustments: 'ajustes_inventario',
  ferreteria_stock_adjustments: 'ajustes_inventario',
  ferreteria_kardex: 'kardex_movimientos',

  // Ventas y Facturación
  ferreteria_invoices: 'facturas_ventas',
  ferreteria_orders: 'cotizaciones_pedidos',
  ferreteria_guias: 'guias_remision',
  ferreteria_credit_notes: 'notas_credito',
  ferreteria_retenciones: 'retenciones',
  ferreteria_recetas: 'recetas_ordenes',
  ferreteria_recetas_medicas: 'recetas_ordenes',
  ferreteria_sellers: 'vendedores',

  // Clientes
  ferreteria_customers: 'clientes',

  // Compras y Proveedores
  ferreteria_purchases: 'compras',
  ferreteria_purchase_orders: 'ordenes_compra',
  ferreteria_suppliers: 'proveedores',
  ferreteria_suppliers_details: 'proveedores',
  ferreteria_payables: 'cuentas_por_pagar',
  ferreteria_supplier_payments: 'pagos_proveedores',

  // Caja, Bancos y Tesorería
  ferreteria_cash_session: 'sesiones_caja',
  ferreteria_cash_sessions_history: 'caja_historial_cierres',
  ferreteria_bank_accounts: 'cuentas_bancarias',
  ferreteria_bank_transactions: 'transacciones_bancarias',
  ferreteria_bank_deposits: 'depositos_bancarios',
  ferreteria_petty_expenses: 'caja_chica_gastos',
  ferreteria_finance_assets: 'activos_financieros',
  ferreteria_budget_categories: 'categorias_presupuesto',
  ferreteria_issued_checks: 'cheques_emitidos',
  ferreteria_postdated_checks: 'cheques_posfechados',
  ferreteria_card_reconciliations: 'conciliaciones_tarjetas',

  // Contabilidad Formal
  ferreteria_journal_entries: 'asientos_contables',
  ferreteria_account_plan: 'plan_cuentas_contable',
  ferreteria_fiscal_periods: 'periodos_fiscales',
  ferreteria_accounting_mapping: 'mapeo_contable',
  ferreteria_accounting_vouchers: 'comprobantes_contables',

  // Activos Fijos
  ferreteria_assets: 'activos_fijos',
  ferreteria_asset_maintenances: 'activos_mantenimientos',
  ferreteria_asset_transfers: 'activos_transferencias',
  ferreteria_asset_classifications: 'activos_clasificaciones',
  ferreteria_asset_areas: 'activos_areas',
  ferreteria_asset_locations: 'activos_ubicaciones',
  ferreteria_asset_history_logs: 'activos_historial',

  // Recursos Humanos y Nómina
  ferreteria_hr_departments: 'departamentos_rrhh',
  ferreteria_hr_positions: 'cargos_rrhh',
  ferreteria_hr_employees: 'empleados',
  ferreteria_hr_payroll_roles: 'roles_pago_nomina',
  ferreteria_hr_incomes: 'ingresos_rrhh',
  ferreteria_hr_discounts: 'descuentos_rrhh',
  ferreteria_hr_vacations: 'vacaciones_rrhh',
  ferreteria_hr_liquidations: 'liquidaciones_rrhh',
  ferreteria_hr_decimos: 'decimos_rrhh',
  ferreteria_hr_novelties: 'novedades_rrhh',

  // Configuración del Sistema
  ferreteria_settings_users_list: 'usuarios_sistema',
  ferreteria_settings_roles: 'roles_sistema',
  ferreteria_settings_payment_methods: 'formas_pago',
  ferreteria_settings: 'configuracion_empresa',
  ferreteria_settings_tax_rates: 'tarifas_impuestos',

  // Parámetros
  ferreteria_settings_establishment: 'configuracion_parametros',
  ferreteria_settings_emission_point: 'configuracion_parametros',
  ferreteria_settings_sec_invoice: 'configuracion_parametros',
  ferreteria_settings_sec_boleta: 'configuracion_parametros',
  ferreteria_settings_sec_quote: 'configuracion_parametros',
  ferreteria_settings_sec_credit_note: 'configuracion_parametros',
  ferreteria_settings_sec_retention: 'configuracion_parametros',
  ferreteria_settings_print_format: 'configuracion_parametros',
  ferreteria_settings_include_qr: 'configuracion_parametros',
  ferreteria_settings_print_logo: 'configuracion_parametros',
  ferreteria_settings_allow_negative_stock: 'configuracion_parametros',
  ferreteria_settings_block_no_stock_sales: 'configuracion_parametros',
  ferreteria_settings_min_stock_alert: 'configuracion_parametros',
  ferreteria_settings_auto_session_timeout: 'configuracion_parametros',
  ferreteria_settings_sri_mode: 'configuracion_parametros',
  ferreteria_settings_sri_api_url: 'configuracion_parametros',
};

export function getFriendlyCollectionName(docId: string): string | null {
  return COMPASS_COLLECTIONS[docId] || null;
}
