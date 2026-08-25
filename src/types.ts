export type UnitOfMeasure = string;

export type Category = string;

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: Category;
  description?: string;
  unit: UnitOfMeasure;
  price: number; // Precio de venta sin o con IVA segun config
  costPrice: number; // Precio de costo
  stock: number;
  minStock: number;
  location?: string; // Pasillo / Estante ej: "Pasillo 3 - Estante B"
  taxRate: number; // p.ej 15 para 15%
  allowFractional: boolean; // Si permite decimales (ej: 2.5 metros o 0.5 kg)
  priceScales?: PriceScale[]; // Escalas de precios por cantidad
}

export interface PriceScale {
  id: string;
  name: string;
  minQty: number;
  maxQty?: number;
  price: number;
}

export interface CartItem {
  product: Product;
  quantity: number; // puede ser decimal si allowFractional es true
  unitPrice: number; // precio unitario aplicado
  discountPercent: number; // descuento %
  subtotal: number;
  taxAmount: number;
  total: number;
  appliedPromo?: string; // nombre/código de la promo aplicada automáticamente
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVA' | 'PROGRAMADA' | 'EXPIRADA';
  minQuantity: number;
  appliedCategory: string; // nombre de la categoría a la que aplica
}


export interface Customer {
  id: string;
  docType: 'DNI' | 'RUC' | 'RFC' | 'NIT' | 'Pasaporte';
  docNumber: string;
  name: string; // Nombre o Razon Social
  email?: string;
  phone?: string;
  address?: string;
  creditLimit: number;
  currentBalance: number; // Deuda actual acumulada
}

export type DocumentType = 'FACTURA' | 'BOLETA' | 'COTIZACION';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'TRANSFERENCIA' | 'CREDITO_CLIENTE';
export type InvoiceStatus = 'PAGADA' | 'PENDIENTE' | 'ANULADA';

export interface InvoiceItem {
  productId: string;
  sku: string;
  productName: string;
  unit: UnitOfMeasure;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  subtotal: number;
  taxRate?: number; // e.g. 15, 5, 0
  taxAmount: number;
  total: number;
}

export interface Invoice {
  id: string;
  documentType: DocumentType;
  series: string; // ej: F001
  number: number; // ej: 124 -> F001-00000124
  fullNumber: string; // F001-00000124
  createdAt: string; // ISO String
  customer: Customer;
  items: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: InvoiceStatus;
  amountTendered?: number; // Monto entregado (si fue efectivo)
  changeGiven?: number; // Vuelto / Cambio entregado
  notes?: string;
  sellerName: string;
  // SRI Ecuador Electronic Invoicing fields
  sriStatus?: 'PENDIENTE' | 'FIRMADO' | 'ENVIADO' | 'AUTORIZADO' | 'NO AUTORIZADO' | 'DEVUELTA' | 'ERROR';
  sriClaveAcceso?: string;
  sriNumeroAutorizacion?: string;
  sriFechaAutorizacion?: string;
  sriXmlFirmado?: string;
  sriMensaje?: string;
}

export interface CashRegisterSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  initialCash: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  status: 'ABIERTA' | 'CERRADA';
  totalSalesCash: number;
  totalSalesCard: number;
  totalSalesTransfer: number;
  totalSalesCredit: number;
  totalInvoicesCount: number;
}

export interface StoreSettings {
  storeName: string;
  legalName: string;
  taxId: string; // RUC / RFC / NIT
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  currencySymbol: string;
  currencyCode: string;
  defaultTaxRate: number; // ej: 15%
  invoicePrefix: string; // ej: F001
  ticketPrefix: string; // ej: B001
  quotePrefix: string; // ej: COT
  nextInvoiceNumber: number;
  nextTicketNumber: number;
  nextQuoteNumber: number;
  footerNotes: string; // "¡Gracias por su compra! Garantía de 30 días con su comprobante."
  accountingRequired?: boolean;
  rimpe?: string;
}

export type SalesSubTab = 
  | 'CAJA'
  | 'FACTURAS'
  | 'PEDIDOS'
  | 'GUIA_REMISION'
  | 'COTIZACIONES'
  | 'DEVOLUCIONES'
  | 'NOTA_CREDITO'
  | 'COMPROBANTES_ELECTRONICOS'
  | 'RETENCION'
  | 'RECETAS_MEDICAS'
  | 'COMISIONES_METAS'
  | 'HISTORIAL_FACTURAS'
  | 'HISTORIAL_COTIZACIONES';

export type CustomersSubTab = 
  | 'CLIENTES'
  | 'CUENTAS_POR_COBRAR';

export type InventorySubTab =
  | 'INVENTORY'
  | 'INVENTARIO'
  | 'CATEGORIAS'
  | 'PROMOCIONES'
  | 'UNIDADES_MEDIDAS'
  | 'LOTES_VENCIMIENTOS'
  | 'CAMBIO_PRECIO_MASIVO'
  | 'AJUSTE_STOCK'
  | 'TRANSFERENCIAS'
  | 'ETIQUETAS'
  | 'KARDEX'
  | 'TOMA_FISICA';

export type PurchasesSubTab =
  | 'COMPRAS'
  | 'HISTORIAL_COMPRAS'
  | 'ORDENES_COMPRA'
  | 'PRE_ORDENES';

export type SuppliersSubTab =
  | 'PROVEEDORES'
  | 'CUENTAS_POR_PAGAR';

export type FinanceSubTab =
  | 'BANCOS'
  | 'DEPOSITOS'
  | 'CAJA_CHICA'
  | 'ACTIVOS_FIJOS'
  | 'PRESUPUESTO';

export type AccountingSubTab =
  | 'CONTABILIDAD_RESUMEN'
  | 'CHEQUES_GIRADOS'
  | 'CONCILIACION_TARJETAS'
  | 'CONCILIACION_BANCARIA'
  | 'COMPROBANTE_INGRESO'
  | 'COMPROBANTE_EGRESO'
  | 'ASIENTOS'
  | 'MAYORES'
  | 'BALANCE_COMPROBACION'
  | 'ESTADO_SITUACION_FINANCIERA'
  | 'ESTADO_RESULTADO'
  | 'ATS'
  | 'PLAN_CUENTAS'
  | 'PARAMETRIZACION'
  | 'PERIODOS_FISCALES'
  | 'FORMULARIOS_DIMM'
  | 'CHEQUES_POSFECHADOS';

export type AssetsSubTab =
  | 'ACTIVOS_LISTA'
  | 'DEPRECIACIONES'
  | 'MANTENIMIENTOS'
  | 'TRANSFERENCIAS_ACTIVOS'
  | 'HISTORICOS_ACTIVOS'
  | 'AREAS_ACTIVOS'
  | 'CLASIFICACIONES_ACTIVOS'
  | 'UBICACIONES_ACTIVOS';

export type HRSubTab =
  | 'ROLES_PAGO'
  | 'OTROS_INGRESOS'
  | 'DESCUENTOS'
  | 'VACACIONES'
  | 'LIQUIDACIONES'
  | 'DECIMOS'
  | 'DEPARTAMENTOS_RRHH'
  | 'CARGOS_RRHH'
  | 'EMPLEADOS'
  | 'NOVEDADES_RRHH';

export type ReportsSubTab =
  | 'REP_VENTAS'
  | 'REP_PRODUCTOS'
  | 'REP_INVENTARIO'
  | 'REP_CAJA'
  | 'REP_COMPRAS'
  | 'REP_COMISIONES'
  | 'REP_ATS'
  | 'REP_FORMULARIO_104'
  | 'REP_FORMULARIO_103'
  | 'REP_RENTABILIDAD'
  | 'REP_STOCK_MUERTO'
  | 'REP_NOMINA'
  | 'REP_DEVOLUCIONES'
  | 'REP_ROTACION'
  | 'REP_FLUJO_CAJA';

export type SettingsSubTab =
  | 'CFG_EMPRESA'
  | 'CFG_FIRMA_ELECTRONICA'
  | 'CFG_PUNTO_EMISION'
  | 'CFG_IMPUESTOS'
  | 'CFG_CAJA'
  | 'CFG_FORMAS_PAGO'
  | 'CFG_USUARIOS'
  | 'CFG_FORMATO_IMPRESION'
  | 'CFG_ADMINISTRACION'
  | 'CFG_BACKUP';

export type TabType = SalesSubTab | CustomersSubTab | InventorySubTab | PurchasesSubTab | SuppliersSubTab | FinanceSubTab | AccountingSubTab | AssetsSubTab | HRSubTab | ReportsSubTab | SettingsSubTab | 'CASH_REGISTER' | 'SETTINGS';


export interface UnitDefinition {
  id: string;
  code: string;
  name: string;
  symbol: string;
  baseRatio: number;
  category: string;
  fractional?: boolean;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  username: string; // Cédula o RUC
  role: 'Administrador' | 'Cajero' | 'Vendedor' | 'Contador';
  status: 'Activo' | 'Inactivo';
  password?: string;
}
