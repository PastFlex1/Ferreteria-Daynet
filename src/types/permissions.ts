// Definición del sistema exhaustivo de permisos y roles granulares

export type PermissionDangerLevel = 'low' | 'medium' | 'high';

export interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  category: string;
  module: string;
  dangerLevel: PermissionDangerLevel;
}

export type PermissionMap = Record<string, boolean>;

// Categorías organizadas por módulos de la ferretería
export const PERMISSION_MODULES = [
  { id: 'NAV', name: 'Navegación y Acceso a Módulos' },
  { id: 'POS', name: 'Punto de Venta (POS) y Caja' },
  { id: 'SALES', name: 'Ventas, Facturas y Comprobantes' },
  { id: 'INVENTORY', name: 'Inventario y Catálogo de Productos' },
  { id: 'CUSTOMERS', name: 'Clientes y Créditos' },
  { id: 'CASH', name: 'Caja, Turnos y Arqueos' },
  { id: 'PURCHASES', name: 'Compras y Proveedores' },
  { id: 'FINANCE', name: 'Finanzas, Bancos y Tesorería' },
  { id: 'ACCOUNTING', name: 'Contabilidad y ATS' },
  { id: 'ASSETS', name: 'Activos Fijos' },
  { id: 'HR', name: 'Recursos Humanos y Nómina' },
  { id: 'REPORTS', name: 'Reportes y Estadísticas' },
  { id: 'SETTINGS', name: 'Configuración y Seguridad' },
] as const;

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // ─── 1. NAVEGACIÓN Y ACCESO A MÓDULOS ─────────────────────────────────────────
  {
    id: 'nav.ventas',
    label: 'Acceso al módulo de Ventas',
    description: 'Permite visualizar y acceder al módulo principal de Ventas.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.ventas.caja',
    label: 'Acceso a Terminal de Facturación (Caja)',
    description: 'Permite acceder a la pantalla del punto de venta para cobrar y emitir comprobantes.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.ventas.facturas',
    label: 'Acceso al Historial de Facturas',
    description: 'Permite consultar el listado de facturas emitidas.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.ventas.pedidos',
    label: 'Acceso a Pedidos de Clientes',
    description: 'Permite consultar y gestionar pedidos preventa.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.ventas.guias',
    label: 'Acceso a Guías de Remisión',
    description: 'Permite consultar y emitir guías de remisión de mercadería.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.ventas.cotizaciones',
    label: 'Acceso a Cotizaciones / Proformas',
    description: 'Permite crear y consultar proformas de clientes.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.ventas.devoluciones',
    label: 'Acceso a Devoluciones SRI',
    description: 'Permite gestionar devoluciones de ventas reportadas al SRI.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.ventas.nota_credito',
    label: 'Acceso a Notas de Crédito',
    description: 'Permite ver y gestionar notas de crédito emitidas.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.ventas.comprobantes_electronicos',
    label: 'Acceso a Comprobantes Electrónicos SRI',
    description: 'Permite ver el estado de sincronización y autorización ante el SRI.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.ventas.retencion',
    label: 'Acceso a Retenciones Electrónicas',
    description: 'Permite emitir comprobantes de retención ATS v2.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.ventas.recetas_medicas',
    label: 'Acceso a Recetas Médicas / Agrícolas',
    description: 'Permite registrar prescripciones o recetas asociadas a productos.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.ventas.comisiones',
    label: 'Acceso a Comisiones y Metas',
    description: 'Permite consultar las metas de ventas y comisiones asignadas.',
    category: 'Ventas',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.clientes',
    label: 'Acceso a Módulo de Clientes',
    description: 'Permite ver el módulo de clientes y cuentas por cobrar.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.clientes.lista',
    label: 'Acceso al Directorio de Clientes',
    description: 'Permite consultar el listado de clientes registrados.',
    category: 'Clientes',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.clientes.cuentas_cobrar',
    label: 'Acceso a Cuentas por Cobrar (Cartera)',
    description: 'Permite ver saldos pendientes, créditos y estados de cuenta.',
    category: 'Clientes',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.inventario',
    label: 'Acceso a Módulo de Inventario',
    description: 'Permite ver el módulo de inventario y almacén.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.inventario.productos',
    label: 'Acceso a Catálogo de Productos',
    description: 'Permite ver el listado de productos y stock actual.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.inventario.categorias',
    label: 'Acceso a Categorías de Productos',
    description: 'Permite ver y organizar categorías.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.inventario.promociones',
    label: 'Acceso a Promociones y Descuentos',
    description: 'Permite ver y gestionar campañas promocionales.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.inventario.unidades',
    label: 'Acceso a Unidades de Medida',
    description: 'Permite ver y configurar unidades de medida y factores.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.inventario.lotes',
    label: 'Acceso a Lotes y Vencimientos',
    description: 'Permite consultar trazabilidad de lotes y fechas de caducidad.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.inventario.precios_masivos',
    label: 'Acceso a Cambio Masivo de Precios',
    description: 'Permite acceder a la herramienta de actualización masiva.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.inventario.ajustes',
    label: 'Acceso a Ajustes de Stock',
    description: 'Permite ver e ingresar ajustes manuales de inventario.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.inventario.transferencias',
    label: 'Acceso a Transferencias entre Bodegas',
    description: 'Permite transferir existencias entre sucursales o bodegas.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.inventario.etiquetas',
    label: 'Acceso a Impresión de Etiquetas / Códigos',
    description: 'Permite generar e imprimir etiquetas con código de barras.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.inventario.kardex',
    label: 'Acceso a Kardex de Movimientos',
    description: 'Permite auditar el historial de movimientos de inventario.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.inventario.toma_fisica',
    label: 'Acceso a Toma Física de Inventario',
    description: 'Permite realizar conteos físicos y cruces de existencias.',
    category: 'Inventario',
    module: 'NAV',
    dangerLevel: 'high',
  },
  // ─── COMPRAS Y PROVEEDORES ─────────────────────────────────────────────────
  {
    id: 'nav.compras',
    label: 'Acceso al Módulo de Compras',
    description: 'Permite ver el módulo de compras y facturación con proveedores.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.compras.facturas',
    label: 'Acceso a Facturas de Compra',
    description: 'Permite ver el historial e ingreso de compras.',
    category: 'Compras',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.compras.ordenes',
    label: 'Acceso a Órdenes de Compra',
    description: 'Permite crear y consultar órdenes de compra a proveedores.',
    category: 'Compras',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.compras.pre_ordenes',
    label: 'Acceso a Pre-Órdenes',
    description: 'Permite gestionar pre-órdenes y solicitudes de abastecimiento.',
    category: 'Compras',
    module: 'NAV',
    dangerLevel: 'low',
  },
  {
    id: 'nav.proveedores',
    label: 'Acceso al Módulo de Proveedores',
    description: 'Permite ver el directorio de proveedores y cuentas por pagar.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.proveedores.directorio',
    label: 'Acceso al Directorio de Proveedores',
    description: 'Permite ver el listado y fichas de proveedores.',
    category: 'Proveedores',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.proveedores.cuentas_pagar',
    label: 'Acceso a Cuentas por Pagar',
    description: 'Permite ver deudas y registrar pagos a proveedores.',
    category: 'Proveedores',
    module: 'NAV',
    dangerLevel: 'high',
  },

  // ─── FINANZAS, BANCOS Y CONTABILIDAD ────────────────────────────────────────
  {
    id: 'nav.finanzas',
    label: 'Acceso al Módulo de Finanzas',
    description: 'Permite ver bancos, depósitos, caja chica y presupuestos.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.finanzas.bancos',
    label: 'Acceso a Cuentas Bancarias',
    description: 'Permite ver saldos y movimientos bancarios.',
    category: 'Finanzas',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.finanzas.depositos',
    label: 'Acceso a Depósitos Bancarios',
    description: 'Permite ver y asentar papeletas de depósitos.',
    category: 'Finanzas',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.finanzas.caja_chica',
    label: 'Acceso a Caja Chica',
    description: 'Permite ver movimientos y reposición de caja chica.',
    category: 'Finanzas',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.finanzas.presupuesto',
    label: 'Acceso a Presupuestos',
    description: 'Permite consultar y planificar presupuestos.',
    category: 'Finanzas',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.contabilidad',
    label: 'Acceso al Módulo de Contabilidad',
    description: 'Permite ver asientos, libro mayor, balance general y ATS.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.contabilidad.resumen',
    label: 'Acceso a Resumen Contable',
    description: 'Permite ver el panel principal de contabilidad.',
    category: 'Contabilidad',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.contabilidad.asientos',
    label: 'Acceso a Asientos y Libro Diario',
    description: 'Permite registrar y consultar asientos contables.',
    category: 'Contabilidad',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.contabilidad.mayores',
    label: 'Acceso a Libro Mayor',
    description: 'Permite auditar el movimiento de cuentas.',
    category: 'Contabilidad',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.contabilidad.balances',
    label: 'Acceso a Estados Financieros y Balances',
    description: 'Permite consultar balance de comprobación y resultados.',
    category: 'Contabilidad',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.contabilidad.ats',
    label: 'Acceso a Módulo ATS SRI',
    description: 'Permite generar y validar el Anexo Transaccional SRI.',
    category: 'Contabilidad',
    module: 'NAV',
    dangerLevel: 'high',
  },

  // ─── ACTIVOS FIJOS ──────────────────────────────────────────────────────────
  {
    id: 'nav.activos',
    label: 'Acceso al Módulo de Activos Fijos',
    description: 'Permite consultar y registrar activos de la ferretería.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'medium',
  },

  // ─── RECURSOS HUMANOS ───────────────────────────────────────────────────────
  {
    id: 'nav.rrhh',
    label: 'Acceso al Módulo de Recursos Humanos',
    description: 'Permite ver empleados, roles de pago y asistencias.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.rrhh.empleados',
    label: 'Acceso a Directorio de Empleados',
    description: 'Permite consultar y administrar expedientes del personal.',
    category: 'Recursos Humanos',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.rrhh.roles',
    label: 'Acceso a Roles de Pago y Nómina',
    description: 'Permite generar y revisar roles de pago del personal.',
    category: 'Recursos Humanos',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.rrhh.decimos',
    label: 'Acceso a Décimos y Liquidaciones',
    description: 'Permite consultar provisiones de 13ro, 14to y finiquitos.',
    category: 'Recursos Humanos',
    module: 'NAV',
    dangerLevel: 'high',
  },

  // ─── REPORTES Y ESTADÍSTICAS ────────────────────────────────────────────────
  {
    id: 'nav.reportes',
    label: 'Acceso al Módulo de Reportes',
    description: 'Permite consultar reportes ejecutivos, ventas y utilidades.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.reportes.ventas',
    label: 'Acceso a Reportes de Ventas',
    description: 'Permite ver estadísticas y facturación diaria/mensual.',
    category: 'Reportes',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.reportes.inventario',
    label: 'Acceso a Reportes de Inventario y Stock',
    description: 'Permite ver valorización y productos más vendidos.',
    category: 'Reportes',
    module: 'NAV',
    dangerLevel: 'medium',
  },
  {
    id: 'nav.reportes.rentabilidad',
    label: 'Acceso a Reportes de Rentabilidad y Ganancias',
    description: 'Permite consultar márgenes brutos y utilidades netas.',
    category: 'Reportes',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.reportes.caja',
    label: 'Acceso a Reportes de Caja y Arqueos',
    description: 'Permite auditar ingresos y cierres de terminales.',
    category: 'Reportes',
    module: 'NAV',
    dangerLevel: 'medium',
  },

  // ─── CONFIGURACIÓN Y SEGURIDAD ──────────────────────────────────────────────
  {
    id: 'nav.configuracion',
    label: 'Acceso al Módulo de Configuración',
    description: 'Permite ingresar al menú de ajustes globales del sistema.',
    category: 'Módulos Principales',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.configuracion.empresa',
    label: 'Acceso a Datos de la Empresa y Logo',
    description: 'Permite configurar información de la matriz y sucursales.',
    category: 'Configuración',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.configuracion.usuarios',
    label: 'Acceso a Usuarios y Permisos',
    description: 'Permite gestionar trabajadores, roles y credenciales.',
    category: 'Configuración',
    module: 'NAV',
    dangerLevel: 'high',
  },
  {
    id: 'nav.configuracion.firma',
    label: 'Acceso a Firma Electrónica y SRI',
    description: 'Permite configurar certificados .p12 y ambientes del SRI.',
    category: 'Configuración',
    module: 'NAV',
    dangerLevel: 'high',
  },

  // ─── 2. PUNTO DE VENTA (POS) Y CAJA — ACCIONES E INPUTS ─────────────────────
  {
    id: 'pos.create_invoice',
    label: 'Emitir Facturas Electrónicas en Caja',
    description: 'Permite finalizar y emitir facturas legales autorizadas por el SRI.',
    category: 'Operaciones en Caja',
    module: 'POS',
    dangerLevel: 'low',
  },
  {
    id: 'pos.create_nota_venta',
    label: 'Emitir Notas de Venta / Boletas',
    description: 'Permite emitir comprobantes de nota de venta física o ticket simplificado.',
    category: 'Operaciones en Caja',
    module: 'POS',
    dangerLevel: 'low',
  },
  {
    id: 'pos.create_quote',
    label: 'Crear Proformas / Cotizaciones en Caja',
    description: 'Permite guardar cotizaciones desde la terminal de ventas.',
    category: 'Operaciones en Caja',
    module: 'POS',
    dangerLevel: 'low',
  },
  {
    id: 'pos.apply_discount',
    label: 'Input: Modificar % de Descuento en Carrito',
    description: 'Permite al cajero/vendedor ingresar un porcentaje de descuento manual por ítem.',
    category: 'Inputs y Edición en Caja',
    module: 'POS',
    dangerLevel: 'high',
  },
  {
    id: 'pos.edit_price',
    label: 'Input: Modificar Precio Unitario al Vender',
    description: 'Permite alterar manualmente el precio unitario del producto en el carrito de venta.',
    category: 'Inputs y Edición en Caja',
    module: 'POS',
    dangerLevel: 'high',
  },
  {
    id: 'pos.delete_cart_item',
    label: 'Botón: Eliminar Producto del Carrito',
    description: 'Permite remover líneas de productos ya agregadas al carrito de venta.',
    category: 'Inputs y Edición en Caja',
    module: 'POS',
    dangerLevel: 'medium',
  },
  {
    id: 'pos.clear_cart',
    label: 'Botón: Vaciar Carrito Completo',
    description: 'Permite cancelar la venta actual y limpiar todos los productos del carrito.',
    category: 'Inputs y Edición en Caja',
    module: 'POS',
    dangerLevel: 'medium',
  },
  {
    id: 'pos.allow_credit_sale',
    label: 'Opción: Permitir Venta a Crédito',
    description: 'Habilita la opción de cobrar con forma de pago a Crédito directo.',
    category: 'Formas de Pago',
    module: 'POS',
    dangerLevel: 'high',
  },
  {
    id: 'pos.allow_negative_stock',
    label: 'Opción: Facturar sin Stock (Stock Negativo)',
    description: 'Permite vender productos cuya existencia actual sea 0 o insuficiente.',
    category: 'Operaciones en Caja',
    module: 'POS',
    dangerLevel: 'high',
  },
  {
    id: 'pos.create_customer',
    label: 'Botón: Crear Cliente Rápido desde Caja',
    description: 'Permite abrir el formulario de alta rápida de nuevos clientes mientras factura.',
    category: 'Operaciones en Caja',
    module: 'POS',
    dangerLevel: 'low',
  },
  {
    id: 'pos.view_cost_price',
    label: 'Visibilidad: Ver Costo y Margen en Buscador',
    description: 'Muestra el precio de costo del producto y el margen de ganancia en el buscador de caja.',
    category: 'Seguridad y Visibilidad',
    module: 'POS',
    dangerLevel: 'high',
  },
  {
    id: 'pos.change_seller',
    label: 'Selector: Cambiar Vendedor Asignado',
    description: 'Permite asignar la venta a otro vendedor o comisionista en caja.',
    category: 'Operaciones en Caja',
    module: 'POS',
    dangerLevel: 'low',
  },

  // ─── 3. VENTAS, FACTURAS Y RETENCIONES ───────────────────────────────────────
  {
    id: 'sales.anular_invoice',
    label: 'Botón: Anular Facturas Emitidas',
    description: 'Permite anular comprobantes emitidos en el sistema y revertir el stock.',
    category: 'Acciones Críticas en Facturas',
    module: 'SALES',
    dangerLevel: 'high',
  },
  {
    id: 'sales.delete_quote',
    label: 'Botón: Eliminar Cotizaciones',
    description: 'Permite borrar proformas archivadas en el historial.',
    category: 'Gestión de Cotizaciones',
    module: 'SALES',
    dangerLevel: 'medium',
  },
  {
    id: 'sales.convert_quote',
    label: 'Botón: Convertir Cotización en Factura',
    description: 'Permite cargar una proforma directamente a caja para facturarla.',
    category: 'Gestión de Cotizaciones',
    module: 'SALES',
    dangerLevel: 'low',
  },
  {
    id: 'sales.create_credit_note',
    label: 'Emitir Notas de Crédito Electrónicas',
    description: 'Permite generar notas de crédito por devoluciones totales o parciales.',
    category: 'Comprobantes Tributarios',
    module: 'SALES',
    dangerLevel: 'high',
  },
  {
    id: 'sales.create_retention',
    label: 'Emitir Comprobantes de Retención',
    description: 'Permite generar retenciones a proveedores en la fuente y de IVA.',
    category: 'Comprobantes Tributarios',
    module: 'SALES',
    dangerLevel: 'high',
  },
  {
    id: 'sales.import_retention_xml',
    label: 'Botón: Importar Facturas XML para Retener',
    description: 'Permite cargar o consultar facturas electrónicas de proveedores vía XML/Clave de Acceso.',
    category: 'Comprobantes Tributarios',
    module: 'SALES',
    dangerLevel: 'medium',
  },
  {
    id: 'sales.export_invoices_excel',
    label: 'Botón: Exportar Historial de Facturas a Excel',
    description: 'Permite descargar el libro de ventas y listados en hoja de cálculo.',
    category: 'Exportaciones y Reportes',
    module: 'SALES',
    dangerLevel: 'medium',
  },

  // ─── 4. INVENTARIO Y PRODUCTOS ──────────────────────────────────────────────
  {
    id: 'inventory.create_product',
    label: 'Botón: Crear Nuevo Producto',
    description: 'Permite registrar nuevos ítems en el catálogo de mercadería.',
    category: 'Catálogo de Productos',
    module: 'INVENTORY',
    dangerLevel: 'medium',
  },
  {
    id: 'inventory.edit_product_info',
    label: 'Editar Información Básica del Producto',
    description: 'Permite modificar nombre, código de barras, categoría y unidad de medida.',
    category: 'Catálogo de Productos',
    module: 'INVENTORY',
    dangerLevel: 'medium',
  },
  {
    id: 'inventory.edit_sale_price',
    label: 'Input: Modificar Precios de Venta (PVP / Mayorista)',
    description: 'Permite cambiar los precios de venta al público en la ficha del producto.',
    category: 'Precios y Costos',
    module: 'INVENTORY',
    dangerLevel: 'high',
  },
  {
    id: 'inventory.edit_cost_price',
    label: 'Input: Modificar Precio de Costo de Compra',
    description: 'Permite modificar el costo unitario de adquisición del producto.',
    category: 'Precios y Costos',
    module: 'INVENTORY',
    dangerLevel: 'high',
  },
  {
    id: 'inventory.view_cost_price',
    label: 'Visibilidad: Ver Precios de Costo en Tablas',
    description: 'Muestra las columnas de costo unitario y margen de ganancia en el inventario.',
    category: 'Seguridad y Visibilidad',
    module: 'INVENTORY',
    dangerLevel: 'high',
  },
  {
    id: 'inventory.delete_product',
    label: 'Botón: Eliminar Producto del Catálogo',
    description: 'Permite dar de baja o borrar productos existentes.',
    category: 'Catálogo de Productos',
    module: 'INVENTORY',
    dangerLevel: 'high',
  },
  {
    id: 'inventory.stock_manual_adjust',
    label: 'Botón: Realizar Ajuste Rápido de Stock',
    description: 'Permite incrementar o disminuir existencias de manera manual sin factura.',
    category: 'Control de Stock',
    module: 'INVENTORY',
    dangerLevel: 'high',
  },
  {
    id: 'inventory.bulk_price_update',
    label: 'Herramienta: Cambio Masivo de Precios',
    description: 'Permite subir o bajar porcentualmente los precios de categorías enteras.',
    category: 'Precios y Costos',
    module: 'INVENTORY',
    dangerLevel: 'high',
  },
  {
    id: 'inventory.import_excel',
    label: 'Botón: Importar Inventario desde Excel',
    description: 'Permite cargar o sobrescribir productos masivamente vía archivo XLS/CSV.',
    category: 'Importación y Exportación',
    module: 'INVENTORY',
    dangerLevel: 'high',
  },
  {
    id: 'inventory.export_excel',
    label: 'Botón: Exportar Inventario a Excel',
    description: 'Permite descargar la lista completa de productos y existencias.',
    category: 'Importación y Exportación',
    module: 'INVENTORY',
    dangerLevel: 'medium',
  },

  // ─── 5. CLIENTES Y CRÉDITOS ──────────────────────────────────────────────────
  {
    id: 'customers.create',
    label: 'Botón: Registrar Nuevo Cliente',
    description: 'Permite agregar clientes en el directorio de clientes.',
    category: 'Directorio de Clientes',
    module: 'CUSTOMERS',
    dangerLevel: 'low',
  },
  {
    id: 'customers.edit',
    label: 'Editar Datos de Clientes',
    description: 'Permite modificar dirección, correo, teléfono o razón social.',
    category: 'Directorio de Clientes',
    module: 'CUSTOMERS',
    dangerLevel: 'low',
  },
  {
    id: 'customers.delete',
    label: 'Botón: Eliminar Cliente',
    description: 'Permite borrar registros de clientes del sistema.',
    category: 'Directorio de Clientes',
    module: 'CUSTOMERS',
    dangerLevel: 'high',
  },
  {
    id: 'customers.edit_credit_limit',
    label: 'Input: Modificar Límite / Cupo de Crédito',
    description: 'Permite asignar o aumentar el cupo máximo de crédito a un cliente.',
    category: 'Gestión de Crédito',
    module: 'CUSTOMERS',
    dangerLevel: 'high',
  },
  {
    id: 'customers.collect_payment',
    label: 'Botón: Registrar Cobro / Abono a Cuenta',
    description: 'Permite asentar pagos de clientes a deudas y emitir recibos de cobro.',
    category: 'Gestión de Crédito',
    module: 'CUSTOMERS',
    dangerLevel: 'medium',
  },
  {
    id: 'customers.export_excel',
    label: 'Botón: Exportar Clientes a Excel',
    description: 'Permite descargar el padrón de clientes y cartera.',
    category: 'Exportaciones',
    module: 'CUSTOMERS',
    dangerLevel: 'medium',
  },

  // ─── 6. CAJA, TURNOS Y ARQUEOS ───────────────────────────────────────────────
  {
    id: 'cash.open_shift',
    label: 'Abrir Turno de Caja con Saldo Inicial',
    description: 'Permite aperturar la caja del día ingresando el fondo de sencillo.',
    category: 'Control de Turnos',
    module: 'CASH',
    dangerLevel: 'low',
  },
  {
    id: 'cash.close_shift',
    label: 'Cerrar Turno y Realizar Arqueo',
    description: 'Permite efectuar el cierre de turno y cuadre de efectivo.',
    category: 'Control de Turnos',
    module: 'CASH',
    dangerLevel: 'medium',
  },
  {
    id: 'cash.view_expected_cash',
    label: 'Opción: Ver Dinero Esperado en Arqueo (Cierre Ciego si se apaga)',
    description: 'Si se desactiva, el cajero realiza un arqueo a ciegas sin saber cuánto calculó el sistema.',
    category: 'Control de Turnos',
    module: 'CASH',
    dangerLevel: 'high',
  },
  {
    id: 'cash.petty_cash_inout',
    label: 'Registrar Ingresos / Salidas de Caja Chica',
    description: 'Permite registrar gastos menores de la caja.',
    category: 'Caja Chica',
    module: 'CASH',
    dangerLevel: 'medium',
  },
  {
    id: 'cash.view_history',
    label: 'Ver Historial de Cierres de Otros Cajeros',
    description: 'Permite ver los reportes de arqueos de turnos anteriores.',
    category: 'Auditoría de Caja',
    module: 'CASH',
    dangerLevel: 'medium',
  },

  // ─── 7. COMPRAS Y PROVEEDORES ───────────────────────────────────────────────
  {
    id: 'purchases.create_order',
    label: 'Crear Órdenes de Compra',
    description: 'Permite generar pedidos formales a proveedores.',
    category: 'Compras',
    module: 'PURCHASES',
    dangerLevel: 'medium',
  },
  {
    id: 'purchases.receive_bill',
    label: 'Ingresar Facturas de Compra al Inventario',
    description: 'Permite cargar existencias y costos a partir de facturas de proveedores.',
    category: 'Compras',
    module: 'PURCHASES',
    dangerLevel: 'high',
  },
  {
    id: 'purchases.anular',
    label: 'Anular Facturas de Compra Registradas',
    description: 'Permite dar de baja una compra ingresada y revertir el stock.',
    category: 'Compras',
    module: 'PURCHASES',
    dangerLevel: 'high',
  },
  {
    id: 'suppliers.create',
    label: 'Crear y Editar Proveedores',
    description: 'Permite registrar nuevas casas comerciales o distribuidoras.',
    category: 'Proveedores',
    module: 'PURCHASES',
    dangerLevel: 'low',
  },
  {
    id: 'suppliers.pay_debt',
    label: 'Registrar Pagos a Proveedores (Cuentas por Pagar)',
    description: 'Permite asentar pagos de facturas a crédito de proveedores.',
    category: 'Proveedores',
    module: 'PURCHASES',
    dangerLevel: 'high',
  },

  // ─── 8. FINANZAS, BANCOS Y CONTABILIDAD ──────────────────────────────────────
  {
    id: 'finance.manage_banks',
    label: 'Gestionar Cuentas Bancarias y Movimientos',
    description: 'Permite ver y conciliar transferencias bancarias y cheques.',
    category: 'Finanzas',
    module: 'FINANCE',
    dangerLevel: 'high',
  },
  {
    id: 'accounting.journal_entries',
    label: 'Crear y Modificar Asientos Contables',
    description: 'Permite realizar registros contables en el libro diario.',
    category: 'Contabilidad',
    module: 'ACCOUNTING',
    dangerLevel: 'high',
  },
  {
    id: 'accounting.ats_export',
    label: 'Generar Anexo Transaccional Simplificado (ATS)',
    description: 'Permite exportar el archivo XML del ATS para el SRI.',
    category: 'Contabilidad',
    module: 'ACCOUNTING',
    dangerLevel: 'high',
  },

  // ─── 9. REPORTES Y ESTADÍSTICAS ──────────────────────────────────────────────
  {
    id: 'reports.view_sales',
    label: 'Ver Reportes de Ventas y Recaudación',
    description: 'Permite consultar totales facturados, volumen diario y mensual.',
    category: 'Reportes de Ventas',
    module: 'REPORTS',
    dangerLevel: 'medium',
  },
  {
    id: 'reports.view_profits',
    label: 'Ver Reporte de Rentabilidad y Utilidad Neta',
    description: 'Permite visualizar márgenes brutos, costos de venta y ganancia real.',
    category: 'Reportes Financieros',
    module: 'REPORTS',
    dangerLevel: 'high',
  },
  {
    id: 'reports.view_inventory_valuation',
    label: 'Ver Valorización Total del Inventario',
    description: 'Permite conocer el valor monetario total del stock en bodega.',
    category: 'Reportes de Inventario',
    module: 'REPORTS',
    dangerLevel: 'high',
  },
  {
    id: 'reports.view_commissions',
    label: 'Ver Reporte de Comisiones de Personal',
    description: 'Permite consultar el cálculo de comisiones devengadas por vendedor.',
    category: 'Reportes de Ventas',
    module: 'REPORTS',
    dangerLevel: 'medium',
  },
  {
    id: 'reports.export_files',
    label: 'Descargar / Exportar Reportes en Excel o PDF',
    description: 'Permite exportar informes a archivos externos.',
    category: 'Exportaciones',
    module: 'REPORTS',
    dangerLevel: 'medium',
  },

  // ─── 10. RECURSOS HUMANOS Y NÓMINA ───────────────────────────────────────────
  {
    id: 'hr.manage_employees',
    label: 'Administrar Directorio de Empleados',
    description: 'Permite crear o editar fichas laborales de trabajadores.',
    category: 'Personal',
    module: 'HR',
    dangerLevel: 'high',
  },
  {
    id: 'hr.calculate_payroll',
    label: 'Generar e Imprimir Roles de Pago',
    description: 'Permite calcular nómina, décimos, horas extras y descuentos IESS.',
    category: 'Nómina',
    module: 'HR',
    dangerLevel: 'high',
  },

  // ─── 11. CONFIGURACIÓN Y SEGURIDAD ───────────────────────────────────────────
  {
    id: 'settings.general_view',
    label: 'Acceso a Panel de Configuración General',
    description: 'Permite entrar al módulo de configuración.',
    category: 'Configuración del Sistema',
    module: 'SETTINGS',
    dangerLevel: 'high',
  },
  {
    id: 'settings.company_info',
    label: 'Modificar Datos de la Empresa y Logo',
    description: 'Permite cambiar razón social, RUC matriz, dirección y logos.',
    category: 'Configuración del Sistema',
    module: 'SETTINGS',
    dangerLevel: 'high',
  },
  {
    id: 'settings.sri_signature',
    label: 'Gestionar Firma Electrónica (.p12) y Ambiente SRI',
    description: 'Permite cambiar la firma digital, contraseña del certificado y ambiente SRI.',
    category: 'Seguridad y SRI',
    module: 'SETTINGS',
    dangerLevel: 'high',
  },
  {
    id: 'settings.users_manage',
    label: 'Administrar Usuarios y Permisos de Trabajadores',
    description: 'Permite crear credenciales y editar los permisos de todo el personal.',
    category: 'Seguridad y Accesos',
    module: 'SETTINGS',
    dangerLevel: 'high',
  },
  {
    id: 'settings.database_backup',
    label: 'Descargar y Restaurar Copias de Seguridad',
    description: 'Permite generar respaldos completos de la base de datos.',
    category: 'Seguridad y Datos',
    module: 'SETTINGS',
    dangerLevel: 'high',
  },
  {
    id: 'settings.system_reset',
    label: 'Restablecer o Vaciar Datos del Sistema',
    description: 'Permite reiniciar o purgar colecciones de datos.',
    category: 'Seguridad y Datos',
    module: 'SETTINGS',
    dangerLevel: 'high',
  },
];

// Mapas de plantillas rápidas (Role Presets)
export const ROLE_PRESETS: Record<string, { label: string; description: string; permissions: PermissionMap }> = {
  Administrador: {
    label: '👑 Administrador',
    description: 'Acceso irrestricto y absoluto a todas las funciones, inputs, opciones y configuraciones.',
    permissions: ALL_PERMISSIONS.reduce((acc, p) => {
      acc[p.id] = true;
      return acc;
    }, {} as PermissionMap),
  },
  Cajero: {
    label: '💳 Cajero / Facturador',
    description: 'Enfocado en cobrar y emitir comprobantes en caja. Sin acceso a editar precios, ver costos ni anular sin permiso.',
    permissions: {
      'nav.ventas': true,
      'nav.ventas.caja': true,
      'nav.ventas.facturas': true,
      'nav.ventas.cotizaciones': true,
      'nav.clientes': true,
      'nav.clientes.lista': true,
      'nav.inventario': true,
      'nav.inventario.productos': true,
      'pos.create_invoice': true,
      'pos.create_nota_venta': true,
      'pos.create_quote': true,
      'pos.apply_discount': false,
      'pos.edit_price': false,
      'pos.delete_cart_item': true,
      'pos.clear_cart': true,
      'pos.allow_credit_sale': false,
      'pos.allow_negative_stock': false,
      'pos.create_customer': true,
      'pos.view_cost_price': false,
      'pos.change_seller': true,
      'sales.anular_invoice': false,
      'sales.delete_quote': false,
      'sales.convert_quote': true,
      'sales.export_invoices_excel': false,
      'inventory.create_product': false,
      'inventory.edit_sale_price': false,
      'inventory.edit_cost_price': false,
      'inventory.view_cost_price': false,
      'inventory.stock_manual_adjust': false,
      'customers.create': true,
      'customers.edit': true,
      'customers.delete': false,
      'customers.edit_credit_limit': false,
      'customers.collect_payment': true,
      'cash.open_shift': true,
      'cash.close_shift': true,
      'cash.view_expected_cash': false, // Arqueo a ciegas
      'cash.petty_cash_inout': false,
    },
  },
  Vendedor: {
    label: '🛍️ Vendedor / Asesor Comercial',
    description: 'Enfocado en consultar catálogo, hacer proformas y pedidos. No puede cobrar ni ver costos de compra.',
    permissions: {
      'nav.ventas': true,
      'nav.ventas.caja': true,
      'nav.ventas.pedidos': true,
      'nav.ventas.cotizaciones': true,
      'nav.clientes': true,
      'nav.clientes.lista': true,
      'nav.inventario': true,
      'nav.inventario.productos': true,
      'pos.create_invoice': false,
      'pos.create_quote': true,
      'pos.apply_discount': false,
      'pos.edit_price': false,
      'pos.delete_cart_item': true,
      'pos.clear_cart': true,
      'pos.allow_credit_sale': false,
      'pos.allow_negative_stock': false,
      'pos.create_customer': true,
      'pos.view_cost_price': false,
      'sales.delete_quote': false,
      'sales.convert_quote': true,
      'inventory.create_product': false,
      'inventory.edit_sale_price': false,
      'inventory.edit_cost_price': false,
      'inventory.view_cost_price': false,
      'customers.create': true,
      'customers.edit': true,
      'customers.delete': false,
      'customers.edit_credit_limit': false,
    },
  },
  Bodeguero: {
    label: '📦 Bodeguero / Almacén',
    description: 'Gestión de existencias, transferencias, tomas físicas y recepción de compras. Sin acceso a caja ni costos.',
    permissions: {
      'nav.inventario': true,
      'nav.inventario.productos': true,
      'nav.inventario.categorias': true,
      'nav.inventario.unidades': true,
      'nav.inventario.lotes': true,
      'nav.inventario.ajustes': true,
      'nav.inventario.transferencias': true,
      'nav.inventario.etiquetas': true,
      'nav.inventario.kardex': true,
      'nav.inventario.toma_fisica': true,
      'nav.compras': true,
      'inventory.create_product': true,
      'inventory.edit_product_info': true,
      'inventory.edit_sale_price': false,
      'inventory.edit_cost_price': false,
      'inventory.view_cost_price': false,
      'inventory.delete_product': false,
      'inventory.stock_manual_adjust': true,
      'inventory.import_excel': false,
      'inventory.export_excel': true,
      'purchases.receive_bill': true,
    },
  },
  Contador: {
    label: '📊 Contador / Auditor',
    description: 'Acceso a facturación, retenciones, compras, asientos contables, ATS y reportes financieros y tributarios.',
    permissions: {
      'nav.ventas': true,
      'nav.ventas.facturas': true,
      'nav.ventas.devoluciones': true,
      'nav.ventas.nota_credito': true,
      'nav.ventas.comprobantes_electronicos': true,
      'nav.ventas.retencion': true,
      'nav.clientes': true,
      'nav.clientes.lista': true,
      'nav.clientes.cuentas_cobrar': true,
      'nav.inventario': true,
      'nav.inventario.productos': true,
      'nav.inventario.kardex': true,
      'nav.compras': true,
      'nav.proveedores': true,
      'nav.finanzas': true,
      'nav.contabilidad': true,
      'nav.activos': true,
      'nav.rrhh': true,
      'nav.reportes': true,
      'sales.create_credit_note': true,
      'sales.create_retention': true,
      'sales.import_retention_xml': true,
      'sales.export_invoices_excel': true,
      'inventory.view_cost_price': true,
      'inventory.export_excel': true,
      'customers.export_excel': true,
      'purchases.create_order': true,
      'purchases.receive_bill': true,
      'suppliers.create': true,
      'suppliers.pay_debt': true,
      'finance.manage_banks': true,
      'accounting.journal_entries': true,
      'accounting.ats_export': true,
      'reports.view_sales': true,
      'reports.view_profits': true,
      'reports.view_inventory_valuation': true,
      'reports.view_commissions': true,
      'reports.export_files': true,
      'hr.manage_employees': true,
      'hr.calculate_payroll': true,
    },
  },
};

// Interface para el catálogo extensible de roles dinámicos del sistema
export interface SystemRole {
  id: string;
  name: string;
  label: string;
  description: string;
  isSystem?: boolean;
  color?: string; // ej: 'amber' | 'emerald' | 'cyan' | 'purple' | 'blue' | 'rose' | 'orange' | 'indigo'
  permissions: PermissionMap;
  createdAt?: string;
  updatedAt?: string;
}

// Lista inicial de roles del sistema predeterminados
export const DEFAULT_SYSTEM_ROLES: SystemRole[] = [
  {
    id: 'Administrador',
    name: 'Administrador',
    label: '👑 Administrador',
    description: 'Acceso irrestricto y absoluto a todas las funciones, inputs, opciones y configuraciones del sistema.',
    isSystem: true,
    color: 'amber',
    permissions: ROLE_PRESETS.Administrador.permissions,
  },
  {
    id: 'Cajero',
    name: 'Cajero',
    label: '💳 Cajero / Facturador',
    description: 'Enfocado en cobrar y emitir comprobantes en caja. Sin acceso a editar precios, ver costos ni anular sin permiso.',
    isSystem: true,
    color: 'emerald',
    permissions: ROLE_PRESETS.Cajero.permissions,
  },
  {
    id: 'Vendedor',
    name: 'Vendedor',
    label: '🛍️ Vendedor / Asesor Comercial',
    description: 'Enfocado en consultar catálogo, hacer proformas y pedidos. No puede cobrar ni ver costos de compra.',
    isSystem: true,
    color: 'cyan',
    permissions: ROLE_PRESETS.Vendedor.permissions,
  },
  {
    id: 'Bodeguero',
    name: 'Bodeguero',
    label: '📦 Bodeguero / Almacén',
    description: 'Gestión de existencias, transferencias, tomas físicas y recepción de compras. Sin acceso a caja ni costos.',
    isSystem: true,
    color: 'purple',
    permissions: ROLE_PRESETS.Bodeguero.permissions,
  },
  {
    id: 'Contador',
    name: 'Contador',
    label: '📊 Contador / Auditor',
    description: 'Acceso a facturación, retenciones, compras, asientos contables, ATS y reportes financieros y tributarios.',
    isSystem: true,
    color: 'blue',
    permissions: ROLE_PRESETS.Contador.permissions,
  },
];

/**
 * Combina las plantillas base del sistema con cualquier rol dinámico personalizado creado por el usuario.
 */
export function getCombinedRolePresets(customRoles?: SystemRole[]): Record<string, { label: string; description: string; permissions: PermissionMap; isSystem?: boolean; color?: string }> {
  const result: Record<string, { label: string; description: string; permissions: PermissionMap; isSystem?: boolean; color?: string }> = { ...ROLE_PRESETS };
  if (customRoles && Array.isArray(customRoles)) {
    customRoles.forEach((r) => {
      result[r.name] = {
        label: r.label || r.name,
        description: r.description || '',
        permissions: r.permissions || {},
        isSystem: !!r.isSystem,
        color: r.color || 'cyan',
      };
    });
  }
  return result;
}

// Mapeo exhaustivo de TabType a código de permiso
export const TAB_TO_PERMISSION_MAP: Record<string, string> = {
  // Ventas
  CAJA: 'nav.ventas.caja',
  FACTURAS: 'nav.ventas.facturas',
  HISTORIAL_FACTURAS: 'nav.ventas.facturas',
  PEDIDOS: 'nav.ventas.pedidos',
  GUIA_REMISION: 'nav.ventas.guias',
  COTIZACIONES: 'nav.ventas.cotizaciones',
  HISTORIAL_COTIZACIONES: 'nav.ventas.cotizaciones',
  DEVOLUCIONES: 'nav.ventas.devoluciones',
  NOTA_CREDITO: 'nav.ventas.nota_credito',
  COMPROBANTES_ELECTRONICOS: 'nav.ventas.comprobantes_electronicos',
  RETENCION: 'nav.ventas.retencion',
  RECETAS_MEDICAS: 'nav.ventas.recetas_medicas',
  COMISIONES_METAS: 'nav.ventas.comisiones',

  // Clientes
  CLIENTES: 'nav.clientes.lista',
  CUENTAS_POR_COBRAR: 'nav.clientes.cuentas_cobrar',

  // Inventario
  INVENTARIO: 'nav.inventario.productos',
  INVENTORY: 'nav.inventario.productos',
  CATEGORIAS: 'nav.inventario.categorias',
  PROMOCIONES: 'nav.inventario.promociones',
  UNIDADES_MEDIDAS: 'nav.inventario.unidades',
  LOTES_VENCIMIENTOS: 'nav.inventario.lotes',
  CAMBIO_PRECIO_MASIVO: 'nav.inventario.precios_masivos',
  AJUSTE_STOCK: 'nav.inventario.ajustes',
  TRANSFERENCIAS: 'nav.inventario.transferencias',
  ETIQUETAS: 'nav.inventario.etiquetas',
  KARDEX: 'nav.inventario.kardex',
  TOMA_FISICA: 'nav.inventario.toma_fisica',

  // Compras y Proveedores
  COMPRAS: 'nav.compras.facturas',
  HISTORIAL_COMPRAS: 'nav.compras.facturas',
  ORDENES_COMPRA: 'nav.compras.ordenes',
  PRE_ORDENES: 'nav.compras.pre_ordenes',
  PROVEEDORES: 'nav.proveedores.directorio',
  CUENTAS_POR_PAGAR: 'nav.proveedores.cuentas_pagar',

  // Finanzas y Bancos
  BANCOS: 'nav.finanzas.bancos',
  DEPOSITOS: 'nav.finanzas.depositos',
  CAJA_CHICA: 'nav.finanzas.caja_chica',
  ACTIVOS_FIJOS: 'nav.activos',
  PRESUPUESTO: 'nav.finanzas.presupuesto',
  CASH_REGISTER: 'cash.close_shift',

  // Contabilidad
  CONTABILIDAD_RESUMEN: 'nav.contabilidad.resumen',
  CHEQUES_GIRADOS: 'nav.contabilidad',
  CONCILIACION_TARJETAS: 'nav.contabilidad',
  CONCILIACION_BANCARIA: 'nav.contabilidad',
  COMPROBANTE_INGRESO: 'nav.contabilidad',
  COMPROBANTE_EGRESO: 'nav.contabilidad',
  ASIENTOS: 'nav.contabilidad.asientos',
  MAYORES: 'nav.contabilidad.mayores',
  BALANCE_COMPROBACION: 'nav.contabilidad.balances',
  ESTADO_SITUACION_FINANCIERA: 'nav.contabilidad.balances',
  ESTADO_RESULTADO: 'nav.contabilidad.balances',
  ATS: 'nav.contabilidad.ats',
  PLAN_CUENTAS: 'nav.contabilidad',
  PARAMETRIZACION: 'nav.contabilidad',
  PERIODOS_FISCALES: 'nav.contabilidad',
  FORMULARIOS_DIMM: 'nav.contabilidad',
  CHEQUES_POSFECHADOS: 'nav.contabilidad',

  // Activos Fijos
  ACTIVOS_LISTA: 'nav.activos',
  DEPRECIACIONES: 'nav.activos',
  MANTENIMIENTOS: 'nav.activos',
  TRANSFERENCIAS_ACTIVOS: 'nav.activos',
  HISTORICOS_ACTIVOS: 'nav.activos',
  AREAS_ACTIVOS: 'nav.activos',
  CLASIFICACIONES_ACTIVOS: 'nav.activos',
  UBICACIONES_ACTIVOS: 'nav.activos',

  // RRHH
  ROLES_PAGO: 'nav.rrhh.roles',
  OTROS_INGRESOS: 'nav.rrhh',
  DESCUENTOS: 'nav.rrhh',
  VACACIONES: 'nav.rrhh',
  LIQUIDACIONES: 'nav.rrhh.decimos',
  DECIMOS: 'nav.rrhh.decimos',
  DEPARTAMENTOS_RRHH: 'nav.rrhh',
  CARGOS_RRHH: 'nav.rrhh',
  EMPLEADOS: 'nav.rrhh.empleados',
  NOVEDADES_RRHH: 'nav.rrhh',

  // Reportes
  REP_VENTAS: 'nav.reportes.ventas',
  REP_PRODUCTOS: 'nav.reportes',
  REP_INVENTARIO: 'nav.reportes.inventario',
  REP_CAJA: 'nav.reportes.caja',
  REP_COMPRAS: 'nav.reportes',
  REP_COMISIONES: 'nav.reportes',
  REP_ATS: 'nav.contabilidad.ats',
  REP_FORMULARIO_104: 'nav.reportes',
  REP_FORMULARIO_103: 'nav.reportes',
  REP_RENTABILIDAD: 'nav.reportes.rentabilidad',
  REP_STOCK_MUERTO: 'nav.reportes.inventario',
  REP_NOMINA: 'nav.rrhh.roles',
  REP_DEVOLUCIONES: 'nav.reportes',
  REP_ROTACION: 'nav.reportes',
  REP_FLUJO_CAJA: 'nav.reportes',

  // Configuración
  SETTINGS: 'nav.configuracion',
  CFG_EMPRESA: 'nav.configuracion.empresa',
  CFG_FIRMA_ELECTRONICA: 'nav.configuracion.firma',
  CFG_PUNTO_EMISION: 'nav.configuracion',
  CFG_IMPUESTOS: 'nav.configuracion',
  CFG_CAJA: 'nav.configuracion',
  CFG_FORMAS_PAGO: 'nav.configuracion',
  CFG_USUARIOS: 'nav.configuracion.usuarios',
  CFG_FORMATO_IMPRESION: 'nav.configuracion',
  CFG_ADMINISTRACION: 'nav.configuracion',
  CFG_BACKUP: 'nav.configuracion',
};

// Prioridad de pestañas por defecto para redirección automática
export const DEFAULT_TAB_PRIORITY: string[] = [
  'CAJA',
  'FACTURAS',
  'COTIZACIONES',
  'PEDIDOS',
  'CLIENTES',
  'INVENTARIO',
  'COMPRAS',
  'ROLES_PAGO',
  'REP_VENTAS',
  'CFG_EMPRESA',
];

/**
 * Auto-enlaza dependencias lógicas de permisos al activar una opción.
 * Por ejemplo, si se activa emitir facturas en POS (pos.create_invoice), automáticamente
 * habilita el acceso a la pantalla de Caja (nav.ventas.caja) y al módulo de Ventas (nav.ventas).
 */
export function autoLinkPermissionDependencies(
  permissionId: string,
  nextValue: boolean,
  currentMap: PermissionMap
): PermissionMap {
  const next = { ...currentMap, [permissionId]: nextValue };
  if (!nextValue) return next;

  // Auto-activación de módulos contenedores y navegación correspondiente
  if (permissionId.startsWith('pos.')) {
    next['nav.ventas'] = true;
    next['nav.ventas.caja'] = true;
  } else if (permissionId.startsWith('sales.')) {
    next['nav.ventas'] = true;
    if (permissionId === 'sales.create_credit_note') next['nav.ventas.nota_credito'] = true;
    else if (permissionId === 'sales.create_retention') next['nav.ventas.retencion'] = true;
    else if (permissionId === 'sales.convert_quote' || permissionId === 'sales.delete_quote') next['nav.ventas.cotizaciones'] = true;
    else next['nav.ventas.facturas'] = true;
  } else if (permissionId.startsWith('inventory.')) {
    next['nav.inventario'] = true;
    next['nav.inventario.productos'] = true;
    if (permissionId === 'inventory.bulk_price_update') next['nav.inventario.precios_masivos'] = true;
    if (permissionId === 'inventory.stock_manual_adjust') next['nav.inventario.ajustes'] = true;
  } else if (permissionId.startsWith('customers.')) {
    next['nav.clientes'] = true;
    next['nav.clientes.lista'] = true;
    if (permissionId === 'customers.collect_payment' || permissionId === 'customers.edit_credit_limit') {
      next['nav.clientes.cuentas_cobrar'] = true;
    }
  } else if (permissionId.startsWith('cash.')) {
    next['nav.ventas'] = true;
    next['nav.ventas.caja'] = true;
  } else if (permissionId.startsWith('purchases.')) {
    next['nav.compras'] = true;
    next['nav.compras.facturas'] = true;
    if (permissionId === 'purchases.create_order') next['nav.compras.ordenes'] = true;
  } else if (permissionId.startsWith('suppliers.')) {
    next['nav.proveedores'] = true;
    next['nav.proveedores.directorio'] = true;
    if (permissionId === 'suppliers.pay_debt') next['nav.proveedores.cuentas_pagar'] = true;
  } else if (permissionId.startsWith('finance.')) {
    next['nav.finanzas'] = true;
    next['nav.finanzas.bancos'] = true;
  } else if (permissionId.startsWith('accounting.')) {
    next['nav.contabilidad'] = true;
    next['nav.contabilidad.resumen'] = true;
    if (permissionId === 'accounting.journal_entries') next['nav.contabilidad.asientos'] = true;
    if (permissionId === 'accounting.ats_export') next['nav.contabilidad.ats'] = true;
  } else if (permissionId.startsWith('hr.')) {
    next['nav.rrhh'] = true;
    if (permissionId === 'hr.calculate_payroll') next['nav.rrhh.roles'] = true;
    else next['nav.rrhh.empleados'] = true;
  } else if (permissionId.startsWith('reports.')) {
    next['nav.reportes'] = true;
    if (permissionId === 'reports.view_sales') next['nav.reportes.ventas'] = true;
    else if (permissionId === 'reports.view_profits') next['nav.reportes.rentabilidad'] = true;
    else if (permissionId === 'reports.view_inventory_valuation') next['nav.reportes.inventario'] = true;
    else if (permissionId === 'reports.view_commissions') next['nav.reportes.ventas'] = true;
  } else if (permissionId.startsWith('settings.')) {
    next['nav.configuracion'] = true;
    if (permissionId === 'settings.company_info') next['nav.configuracion.empresa'] = true;
    if (permissionId === 'settings.users_manage') next['nav.configuracion.usuarios'] = true;
    if (permissionId === 'settings.sri_signature') next['nav.configuracion.firma'] = true;
  } else if (permissionId.startsWith('nav.')) {
    const parts = permissionId.split('.');
    if (parts.length > 2) {
      const parentNav = parts.slice(0, 2).join('.');
      next[parentNav] = true;
    }
    if (permissionId === 'nav.ventas.caja') {
      next['nav.ventas'] = true;
      next['pos.create_invoice'] = true;
    }
  }

  return next;
}


