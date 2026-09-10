import { AccountPlanItem, JournalEntry, JournalEntryItem } from '../components/Accounting/AccountingManager';

export interface AccountingMapping {
  // Ventas
  salesCashAccountDebit: string;
  salesCreditAccountDebit: string;
  salesCardAccountDebit: string;
  salesAccountCredit: string;
  salesZeroTaxAccountCredit: string;
  salesVatAccountCredit: string;
  salesRetentionIncomeDebit: string;
  salesRetentionVatDebit: string;

  // Compras
  purchasesInventoryDebit: string;
  purchasesVatDebit: string;
  purchasesAccountsPayableCredit: string;
  purchasesRetentionIncomeCredit: string;
  purchasesRetentionVatCredit: string;

  // Kárdex & Costo de Ventas
  costOfSalesDebit: string;
  costOfSalesCredit: string;
  inventoryDeteriorationDebit: string;

  // Tesorería & Tarjetas
  cardBankDepositDebit: string;
  cardFeeAccountDebit: string;
  cardTransitAccountCredit: string;
  checkInTransitCredit: string;
}

export const DEFAULT_ACCOUNTING_MAPPING: AccountingMapping = {
  // Ventas
  salesCashAccountDebit: '1.1.01.01.01',          // Caja General Mostrador
  salesCreditAccountDebit: '1.1.02.01.01',        // Clientes Mostrador
  salesCardAccountDebit: '1.1.01.03.01',          // Vouchers por Liquidar
  salesAccountCredit: '4.1.01.01.01',             // Ventas de Mercadería 15%
  salesZeroTaxAccountCredit: '4.1.01.01.02',      // Ventas de Mercadería 0%
  salesVatAccountCredit: '2.1.04.01.01',          // IVA Cobrado en Ventas por Pagar SRI
  salesRetentionIncomeDebit: '1.1.02.05.01',      // Anticipo Retención IR
  salesRetentionVatDebit: '1.1.02.05.02',         // Crédito Tributario Retención IVA

  // Compras
  purchasesInventoryDebit: '1.1.03.01.01',        // Inventario de Mercaderías Ferretería
  purchasesVatDebit: '1.1.04.01.01',              // Crédito Tributario IVA Compras
  purchasesAccountsPayableCredit: '2.1.01.01.01', // Proveedores Mercadería
  purchasesRetentionIncomeCredit: '2.1.04.02.01', // Retención IR por Pagar SRI
  purchasesRetentionVatCredit: '2.1.04.02.02',    // Retención IVA por Pagar SRI

  // Kárdex & Costo
  costOfSalesDebit: '5.1.01.01.01',               // Costo de Ventas Ferretería
  costOfSalesCredit: '1.1.03.01.01',              // Inventario de Mercaderías Ferretería
  inventoryDeteriorationDebit: '5.4.02.01.01',    // Pérdida por Deterioro o Merma

  // Tesorería
  cardBankDepositDebit: '1.1.01.02.01',           // Banco Pichincha Cta Cte
  cardFeeAccountDebit: '5.2.03.01.01',            // Comisiones Bancarias y Red POS
  cardTransitAccountCredit: '1.1.01.03.01',       // Vouchers por Liquidar
  checkInTransitCredit: '2.1.01.01.03',           // Cheques Girados en Tránsito
};

export const OFFICIAL_NIIF_ACCOUNT_PLAN: AccountPlanItem[] = [
  // ── 1. ACTIVOS ─────────────────────────────────────────────────────────────
  { code: '1.0.00.00.00', name: 'ACTIVO', level: 1, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  
  // 1.1 ACTIVO CORRIENTE
  { code: '1.1.00.00.00', name: 'ACTIVO CORRIENTE', level: 2, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  
  // 1.1.01 Efectivo y Equivalentes
  { code: '1.1.01.00.00', name: 'EFECTIVO Y EQUIVALENTES DE EFECTIVO', level: 3, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.01.01.00', name: 'Cajas', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.01.01.01', name: 'Caja General Mostrador', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.01.01.02', name: 'Caja Chica Administrativa', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.01.02.00', name: 'Bancos e Instituciones Financieras', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.01.02.01', name: 'Banco Pichincha Cta Cte #2100876543', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.01.02.02', name: 'Banco Guayaquil Cta Cte #0012876451', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.01.02.03', name: 'Banco Produbanco Cta Ahorros', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.01.03.00', name: 'Valores en Tránsito & Recaudación', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.01.03.01', name: 'Vouchers por Liquidar / Tarjetas en Tránsito', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.01.03.02', name: 'Cheques en Custodia por Depositar', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },

  // 1.1.02 Cuentas y Documentos por Cobrar
  { code: '1.1.02.00.00', name: 'CUENTAS Y DOCUMENTOS POR COBRAR', level: 3, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.02.01.00', name: 'Clientes Comerciales', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.02.01.01', name: 'Cuentas por Cobrar Clientes Mostrador', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.02.01.02', name: 'Cuentas por Cobrar Clientes a Crédito / Corporativos', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.02.05.00', name: 'Crédito Tributario e Impuestos Anticipados', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.02.05.01', name: 'Anticipo Retención IR por Tarjetas de Crédito y Clientes', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.02.05.02', name: 'Crédito Tributario Retención IVA Tarjetas y Clientes', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },

  // 1.1.03 Inventarios
  { code: '1.1.03.00.00', name: 'INVENTARIOS DE MERCADERÍAS', level: 3, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.03.01.00', name: 'Inventario Disponible para la Venta', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.03.01.01', name: 'Inventario de Mercaderías Ferretería (Percha)', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.03.01.02', name: 'Inventario Bodega Central / Materiales Pesados', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.03.01.03', name: 'Mercaderías en Tránsito / Pedidos Pendientes', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },

  // 1.1.04 Crédito Tributario IVA
  { code: '1.1.04.00.00', name: 'CRÉDITO TRIBUTARIO IVA ADQUISICIONES', level: 3, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.04.01.01', name: 'Crédito Tributario IVA Compras y Servicios (15%)', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },

  // 1.2 ACTIVO NO CORRIENTE
  { code: '1.2.00.00.00', name: 'ACTIVO NO CORRIENTE (PROPIEDADES, PLANTA Y EQUIPO)', level: 2, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.2.01.00.00', name: 'Propiedades, Planta y Equipo', level: 3, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.2.01.01.01', name: 'Terrenos e Inmuebles', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.2.01.02.01', name: 'Edificios e Instalaciones Comerciales', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.2.01.03.01', name: 'Maquinaria, Montacargas y Equipos de Carga', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.2.01.04.01', name: 'Vehículos de Transporte y Distribución', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.2.01.05.01', name: 'Equipos de Cómputo y Puntos de Venta (POS)', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.2.01.06.01', name: 'Muebles, Mostradores y Estanterías Metálicas', level: 5, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.2.02.00.00', name: 'Depreciación Acumulada Propiedades, Planta y Equipo', level: 3, type: 'ACTIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '1.2.02.01.01', name: '(-) Depreciación Acumulada Vehículos', level: 5, type: 'ACTIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '1.2.02.02.01', name: '(-) Depreciación Acumulada Equipos de Cómputo', level: 5, type: 'ACTIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '1.2.02.03.01', name: '(-) Depreciación Acumulada Muebles y Enseres', level: 5, type: 'ACTIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },

  // ── 2. PASIVOS ─────────────────────────────────────────────────────────────
  { code: '2.0.00.00.00', name: 'PASIVO', level: 1, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  
  // 2.1 PASIVO CORRIENTE
  { code: '2.1.00.00.00', name: 'PASIVO CORRIENTE', level: 2, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  
  // 2.1.01 Proveedores y Cuentas por Pagar
  { code: '2.1.01.00.00', name: 'CUENTAS Y DOCUMENTOS POR PAGAR COMERCIALES', level: 3, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '2.1.01.01.00', name: 'Proveedores Locales', level: 4, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '2.1.01.01.01', name: 'Cuentas por Pagar Proveedores Mercadería Ferretería', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '2.1.01.01.02', name: 'Cuentas por Pagar Proveedores de Servicios', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '2.1.01.01.03', name: 'Cheques Girados en Tránsito por Pagar', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },

  // 2.1.02 Obligaciones Financieras
  { code: '2.1.02.00.00', name: 'OBLIGACIONES CON INSTITUCIONES FINANCIERAS CP', level: 3, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '2.1.02.01.01', name: 'Préstamos Bancarios y Sobregiros Corto Plazo', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },

  // 2.1.03 Obligaciones Laborales
  { code: '2.1.03.00.00', name: 'OBLIGACIONES LABORALES Y PATRONALES', level: 3, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '2.1.03.01.01', name: 'Sueldos y Remuneraciones por Pagar', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '2.1.03.02.01', name: 'Aportes al IESS por Pagar', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '2.1.03.03.01', name: 'Beneficios Sociales por Pagar (Décimos / Fondos)', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '2.1.03.04.01', name: '15% Participación de Trabajadores en Utilidades', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },

  // 2.1.04 Obligaciones Tributarias SRI
  { code: '2.1.04.00.00', name: 'OBLIGACIONES CON LA ADMINISTRACIÓN TRIBUTARIA (SRI)', level: 3, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '2.1.04.01.01', name: 'IVA Cobrado en Ventas por Pagar SRI (15%)', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '2.1.04.02.01', name: 'Retenciones en la Fuente Impuesto a la Renta por Pagar', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '2.1.04.02.02', name: 'Retenciones en la Fuente IVA por Pagar SRI', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },

  // 2.2 PASIVO NO CORRIENTE
  { code: '2.2.00.00.00', name: 'PASIVO NO CORRIENTE', level: 2, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '2.2.01.01.01', name: 'Préstamos Bancarios y Obligaciones a Largo Plazo', level: 5, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },

  // ── 3. PATRIMONIO ──────────────────────────────────────────────────────────
  { code: '3.0.00.00.00', name: 'PATRIMONIO', level: 1, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '3.1.00.00.00', name: 'CAPITAL', level: 2, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '3.1.01.01.01', name: 'Capital Social Suscrito y Pagado', level: 5, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '3.2.00.00.00', name: 'RESERVAS', level: 2, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '3.2.01.01.01', name: 'Reserva Legal Estatutaria', level: 5, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '3.3.00.00.00', name: 'RESULTADOS ACUMULADOS', level: 2, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '3.3.01.01.01', name: 'Utilidades Acumuladas de Ejercicios Anteriores', level: 5, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '3.3.02.01.01', name: '(-) Pérdidas Acumuladas de Ejercicios Anteriores', level: 5, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '3.3.03.01.01', name: 'Resultado / Utilidad Neta del Ejercicio Corriente', level: 5, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },

  // ── 4. INGRESOS ────────────────────────────────────────────────────────────
  { code: '4.0.00.00.00', name: 'INGRESOS', level: 1, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '4.1.00.00.00', name: 'INGRESOS DE ACTIVIDADES ORDINARIAS', level: 2, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '4.1.01.00.00', name: 'Ventas de Mercaderías', level: 3, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '4.1.01.01.01', name: 'Ventas de Mercadería Mostrador Tarifa 15%', level: 5, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '4.1.01.01.02', name: 'Ventas de Mercadería Mostrador Tarifa 0%', level: 5, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '4.1.01.01.03', name: '(-) Descuentos y Rebajas en Ventas Concedidos', level: 5, type: 'INGRESO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '4.1.01.01.04', name: '(-) Devoluciones en Ventas por Clientes', level: 5, type: 'INGRESO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '4.2.00.00.00', name: 'OTROS INGRESOS Y GANANCIAS', level: 2, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '4.2.01.01.01', name: 'Rendimientos Financieros e Intereses Ganados', level: 5, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '4.2.02.01.01', name: 'Otros Ingresos No Operacionales y Sobrantes', level: 5, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },

  // ── 5. COSTOS Y GASTOS ─────────────────────────────────────────────────────
  { code: '5.0.00.00.00', name: 'COSTOS Y GASTOS', level: 1, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  
  // 5.1 Costo de Ventas
  { code: '5.1.00.00.00', name: 'COSTO DE VENTAS', level: 2, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '5.1.01.00.00', name: 'Costo de Mercaderías Vendidas', level: 3, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '5.1.01.01.01', name: 'Costo de Ventas Ferretería (Salida de Percha)', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },

  // 5.2 Gastos Operacionales
  { code: '5.2.00.00.00', name: 'GASTOS OPERACIONALES (ADMINISTRACIÓN Y VENTAS)', level: 2, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '5.2.01.00.00', name: 'Gastos de Personal', level: 3, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '5.2.01.01.01', name: 'Sueldos, Salarios y Remuneraciones Personal', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.01.01.02', name: 'Aporte Patronal IESS (12.15%)', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.01.01.03', name: 'Beneficios Sociales y Décimos Empleados', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  
  { code: '5.2.02.00.00', name: 'Gastos Generales, Mantenimiento y Servicios', level: 3, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '5.2.01.02.01', name: 'Gastos de Arriendo de Local y Bodegas', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.01.03.01', name: 'Servicios Básicos (Luz, Agua, Telecomunicaciones)', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.01.04.01', name: 'Mantenimiento y Reparación de Local y Equipos', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.01.05.01', name: 'Suministros de Oficina, Ferretería y Limpieza', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.01.06.01', name: 'Publicidad, Marketing y Promoción Comercial', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },

  // 5.3 Gastos Financieros
  { code: '5.3.00.00.00', name: 'GASTOS FINANCIEROS', level: 2, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '5.2.03.01.01', name: 'Comisiones Bancarias y Red POS Tarjetas (Datafast/Medianet)', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.03.02.01', name: 'Intereses Bancarios y Gastos Financieros', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },

  // 5.4 Depreciaciones y Deterioro
  { code: '5.4.00.00.00', name: 'DEPRECIACIONES Y DETERIORO DE VALOR (NIIF)', level: 2, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '5.4.01.01.01', name: 'Gasto por Depreciación Propiedades, Planta y Equipo', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.4.02.01.01', name: 'Pérdida por Deterioro o Mermas de Inventario (NIIF)', level: 5, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 }
];

/**
 * Validador y generador correlativo de código contable según el nivel y código padre.
 */
export function getNextChildAccountCode(parentCode: string, existingAccounts: AccountPlanItem[]): string {
  const parts = parentCode.split('.');
  const prefix = parts.slice(0, 4).join('.');
  const children = existingAccounts.filter(a => a.code.startsWith(prefix) && a.code !== parentCode);
  const nextSeq = String(children.length + 1).padStart(2, '0');
  
  if (parts.length === 5) {
    if (parts[1] === '00') return `${parts[0]}.${nextSeq}.00.00.00`;
    if (parts[2] === '00') return `${parts[0]}.${parts[1]}.${nextSeq}.00.00`;
    if (parts[3] === '00') return `${parts[0]}.${parts[1]}.${parts[2]}.${nextSeq}.00`;
    return `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}.${nextSeq}`;
  }
  return `${parentCode}.${nextSeq}`;
}

/**
 * Generador de asientos automáticos a partir de facturas no asentadas
 */
export function buildAutomaticInvoiceEntry(
  invoice: any,
  mapping: AccountingMapping,
  accountPlan: AccountPlanItem[],
  nextEntryNumber: string
): JournalEntry | null {
  const total = Number(invoice.total || 0);
  if (total <= 0 || invoice.paymentStatus === 'ANULADA') return null;

  const subtotal = Number(invoice.subtotal || 0);
  const taxTotal = Number(invoice.taxTotal || (total - subtotal) || 0);
  const isCard = invoice.paymentMethod === 'TARJETA' || invoice.paymentMethod === 'TARJETA_CREDITO' || invoice.paymentMethod === 'TARJETA_DEBITO';
  const isCredit = invoice.paymentMethod === 'CREDITO';

  // Cuenta deudora según método de pago
  const debitCode = isCard ? mapping.salesCardAccountDebit : (isCredit ? mapping.salesCreditAccountDebit : mapping.salesCashAccountDebit);
  const debitAcc = accountPlan.find(a => a.code === debitCode) || { name: 'Caja General / Valores' };

  // Cuenta acreedora de ventas e IVA
  const salesAcc = accountPlan.find(a => a.code === mapping.salesAccountCredit) || { name: 'Ventas Mostrador' };
  const vatAcc = accountPlan.find(a => a.code === mapping.salesVatAccountCredit) || { name: 'IVA Cobrado por Pagar SRI' };

  const items: JournalEntryItem[] = [];

  // Débito principal
  items.push({
    accountCode: debitCode,
    accountName: debitAcc.name,
    debit: Number(total.toFixed(2)),
    credit: 0
  });

  // Crédito Subtotal
  items.push({
    accountCode: mapping.salesAccountCredit,
    accountName: salesAcc.name,
    debit: 0,
    credit: Number(subtotal.toFixed(2))
  });

  // Crédito IVA
  if (taxTotal > 0) {
    items.push({
      accountCode: mapping.salesVatAccountCredit,
      accountName: vatAcc.name,
      debit: 0,
      credit: Number(taxTotal.toFixed(2))
    });
  }

  const totalDebit = Number(items.reduce((sum, it) => sum + it.debit, 0).toFixed(2));
  const totalCredit = Number(items.reduce((sum, it) => sum + it.credit, 0).toFixed(2));

  return {
    id: `AUT-INV-${invoice.id || Date.now()}`,
    entryNumber: nextEntryNumber,
    date: (invoice.date || new Date().toISOString()).split('T')[0],
    concept: `Venta Factura #${invoice.invoiceNumber || invoice.id || ''} - Cliente: ${invoice.customer?.name || invoice.customerName || 'Consumidor Final'} (${invoice.paymentMethod || 'EFECTIVO'})`,
    type: 'INGRESO',
    items,
    totalDebit,
    totalCredit,
    status: 'ASENTADO'
  };
}

/**
 * Generador de asientos automáticos a partir de compras no asentadas
 */
export function buildAutomaticPurchaseEntry(
  purchase: any,
  mapping: AccountingMapping,
  accountPlan: AccountPlanItem[],
  nextEntryNumber: string
): JournalEntry | null {
  const total = Number(purchase.total || 0);
  if (total <= 0) return null;

  const subtotal = Number(purchase.subtotal || 0);
  const taxTotal = Number(purchase.taxTotal || (total - subtotal) || 0);

  const invAcc = accountPlan.find(a => a.code === mapping.purchasesInventoryDebit) || { name: 'Inventario de Mercaderías Ferretería' };
  const vatAcc = accountPlan.find(a => a.code === mapping.purchasesVatDebit) || { name: 'Crédito Tributario IVA Compras' };
  const provAcc = accountPlan.find(a => a.code === mapping.purchasesAccountsPayableCredit) || { name: 'Cuentas por Pagar Proveedores Mercadería' };

  const items: JournalEntryItem[] = [];

  // Débito Inventario
  items.push({
    accountCode: mapping.purchasesInventoryDebit,
    accountName: invAcc.name,
    debit: Number(subtotal.toFixed(2)),
    credit: 0
  });

  // Débito IVA
  if (taxTotal > 0) {
    items.push({
      accountCode: mapping.purchasesVatDebit,
      accountName: vatAcc.name,
      debit: Number(taxTotal.toFixed(2)),
      credit: 0
    });
  }

  // Crédito Proveedor
  items.push({
    accountCode: mapping.purchasesAccountsPayableCredit,
    accountName: provAcc.name,
    debit: 0,
    credit: Number(total.toFixed(2))
  });

  const totalDebit = Number(items.reduce((sum, it) => sum + it.debit, 0).toFixed(2));
  const totalCredit = Number(items.reduce((sum, it) => sum + it.credit, 0).toFixed(2));

  return {
    id: `AUT-PUR-${purchase.id || Date.now()}`,
    entryNumber: nextEntryNumber,
    date: (purchase.date || new Date().toISOString()).split('T')[0],
    concept: `Compra / Adquisición #${purchase.invoiceNumber || purchase.documentNumber || purchase.id || ''} - Proveedor: ${purchase.supplier?.name || purchase.supplierName || 'Proveedor'}`,
    type: 'EGRESO',
    items,
    totalDebit,
    totalCredit,
    status: 'ASENTADO'
  };
}
