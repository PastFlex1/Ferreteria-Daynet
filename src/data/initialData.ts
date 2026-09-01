import { Customer, Invoice, Product, ProductCategory, StoreSettings, TaxRateItem } from '../types';

export const defaultTaxRates: TaxRateItem[] = [
  {
    id: 'tax-15',
    name: 'IVA 15% (Tarifa General)',
    rate: 15,
    codeSri: '4',
    isDefault: true,
    active: true,
    description: 'Tarifa general vigente en Ecuador para bienes y servicios gravados.',
  },
  {
    id: 'tax-5',
    name: 'IVA 5% (Materiales de Construcción)',
    rate: 5,
    codeSri: '5',
    isDefault: false,
    active: true,
    description: 'Tarifa reducida para transferencias de materiales de construcción según Ley.',
  },
  {
    id: 'tax-0',
    name: 'IVA 0% (Tarifa Cero)',
    rate: 0,
    codeSri: '0',
    isDefault: false,
    active: true,
    description: 'Productos de primera necesidad, medicinas y bienes no procesados.',
  },
  {
    id: 'tax-no-objeto',
    name: 'No Objeto de IVA',
    rate: 0,
    codeSri: '6',
    isDefault: false,
    active: true,
    description: 'Bienes y servicios que no son objeto del impuesto.',
  },
  {
    id: 'tax-exento',
    name: 'Exento de IVA',
    rate: 0,
    codeSri: '7',
    isDefault: false,
    active: true,
    description: 'Bienes y servicios exentos de IVA según régimen especial.',
  },
];

export const initialStoreSettings: StoreSettings = {
  storeName: 'Ferretería DAYNET',
  legalName: 'Ferretería DAYNET S.A.',
  taxId: '1790000000001',
  address: 'Av. Principal #100',
  phone: '0999999999',
  email: 'contacto@ferreteriadaynet.com',
  country: 'Ecuador',
  province: 'Pichincha',
  city: 'Quito',
  currencySymbol: '$',
  currencyCode: 'USD',
  defaultTaxRate: 15,
  invoicePrefix: '001-001',
  ticketPrefix: '001-001',
  quotePrefix: 'COT',
  nextInvoiceNumber: 1,
  nextTicketNumber: 1,
  nextQuoteNumber: 1,
  footerNotes: '¡Gracias por su compra!',
  accountingRequired: false,
  specialTaxpayerNumber: '',
  isMicroenterprise: false,
  isRimpe: false,
  rimpeType: 'NO_APLICA',
  isRetentionAgent: false,
  retentionAgentResolution: '',
};

export const CONSUMIDOR_FINAL: Customer = {
  id: 'cust-general',
  docType: 'C.I.',
  docNumber: '9999999999999',
  name: 'Público General / Consumidor Final',
  email: 'consumidor@final.com',
  phone: '000-000-0000',
  address: 'Venta Mostrador',
  creditLimit: 0,
  currentBalance: 0,
};

export const initialCustomers: Customer[] = [];
export const initialProducts: Product[] = [];
export const initialInvoices: Invoice[] = [];

export const defaultCategories: ProductCategory[] = [];

export const defaultAccountPlan = [
  { code: '1.0.00.00.00', name: 'ACTIVO', level: 1, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.00.00.00', name: 'ACTIVO CORRIENTE', level: 2, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.01.00.00', name: 'EFECTIVO Y EQUIVALENTES DE EFECTIVO', level: 3, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '1.1.01.01.01', name: 'Caja General Mostrador', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.01.02.01', name: 'Banco Pichincha Cta Cte #2100876543', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.01.02.02', name: 'Banco Guayaquil Cta Cte #0012876451', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '1.1.03.01.01', name: 'Inventario de Mercaderías Ferretería', level: 4, type: 'ACTIVO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '2.0.00.00.00', name: 'PASIVO', level: 1, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '2.1.01.01.01', name: 'Cuentas por Pagar Proveedores Locales', level: 4, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '2.1.04.01.01', name: 'IVA Cobrado por Pagar SRI', level: 4, type: 'PASIVO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '3.0.00.00.00', name: 'PATRIMONIO', level: 1, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '3.1.01.01.01', name: 'Capital Social Suscrito', level: 4, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '3.3.01.01.01', name: 'Utilidades Acumuladas Ejercicios Anteriores', level: 4, type: 'PATRIMONIO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '4.0.00.00.00', name: 'INGRESOS', level: 1, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: false, balance: 0 },
  { code: '4.1.01.01.01', name: 'Ventas de Mercadería Mostrador', level: 4, type: 'INGRESO', nature: 'ACREEDORA', acceptsMovement: true, balance: 0 },
  { code: '5.0.00.00.00', name: 'GASTOS', level: 1, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: false, balance: 0 },
  { code: '5.1.01.01.01', name: 'Costo de Ventas Ferretería', level: 4, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.01.01.01', name: 'Gastos de Personal / Sueldos', level: 4, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.01.02.01', name: 'Gastos de Arriendo de Local', level: 4, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 },
  { code: '5.2.01.03.01', name: 'Servicios Básicos y Comunicaciones', level: 4, type: 'GASTO', nature: 'DEUDORA', acceptsMovement: true, balance: 0 }
];

export const defaultAssetClassifications = [
  { id: 'cls-1', code: 'CLA-01', name: 'Equipos de Computación', depreciationRatePercent: 33.33, usefulLifeYears: 3, accountingAccount: '1.2.01.01.01' },
  { id: 'cls-2', code: 'CLA-02', name: 'Maquinaria y Herramientas Pesadas', depreciationRatePercent: 10.00, usefulLifeYears: 10, accountingAccount: '1.2.01.02.01' },
  { id: 'cls-3', code: 'CLA-03', name: 'Vehículos y Transporte', depreciationRatePercent: 20.00, usefulLifeYears: 5, accountingAccount: '1.2.01.03.01' },
  { id: 'cls-4', code: 'CLA-04', name: 'Muebles y Enseres de Oficina', depreciationRatePercent: 10.00, usefulLifeYears: 10, accountingAccount: '1.2.01.04.01' },
  { id: 'cls-5', code: 'CLA-05', name: 'Equipos de Seguridad y POS', depreciationRatePercent: 20.00, usefulLifeYears: 5, accountingAccount: '1.2.01.05.01' }
];

export const defaultAssetAreas = [
  { id: 'are-1', code: 'ARE-01', name: 'Mostrador / Ventas', responsiblePerson: 'Ing. Carlos Mendoza', assetCount: 0 },
  { id: 'are-2', code: 'ARE-02', name: 'Bodega Principal Ferretería', responsiblePerson: 'Sr. Roberto Gómez', assetCount: 0 },
  { id: 'are-3', code: 'ARE-03', name: 'Administración & Contabilidad', responsiblePerson: 'Lcda. María Torres', assetCount: 0 },
  { id: 'are-4', code: 'ARE-04', name: 'Taller y Mantenimiento', responsiblePerson: 'Téc. Jorge Silva', assetCount: 0 }
];

export const defaultAssetLocations = [
  { id: 'loc-1', code: 'UBI-01', name: 'Local Matriz Centro', address: 'Av. 10 de Agosto y Colón', city: 'Quito' },
  { id: 'loc-2', code: 'UBI-02', name: 'Bodega Central Ferretera', address: 'Panamericana Norte Km 12', city: 'Quito' },
  { id: 'loc-3', code: 'UBI-03', name: 'Sucursal Sur', address: 'Av. Maldonado y Moraspungo', city: 'Quito' }
];

export const defaultPaymentMethods = [
  { id: '01', code: '01', name: 'SIN UTILIZACION DEL SISTEMA FINANCIERO (EFECTIVO)', shortName: 'Efectivo', methodKey: 'EFECTIVO', active: true, default: true },
  { id: '16', code: '16', name: 'TARJETA DE DEBITO', shortName: 'T. Débito', methodKey: 'TARJETA_DEBITO', active: true, default: false },
  { id: '19', code: '19', name: 'TARJETA DE CREDITO', shortName: 'T. Crédito', methodKey: 'TARJETA_CREDITO', active: true, default: false },
  { id: '20', code: '20', name: 'CON UTILIZACION DEL SISTEMA FINANCIERO (TRANSFERENCIA / DEPOSITO)', shortName: 'Transferencia', methodKey: 'TRANSFERENCIA', active: true, default: false },
  { id: '15', code: '15', name: 'COMPENSACION DE DEUDAS', shortName: 'Compensación', methodKey: 'COMPENSACION', active: false, default: false },
  { id: '21', code: '21', name: 'ENDOSO DE TITULOS', shortName: 'Endoso Títulos', methodKey: 'ENDOSO', active: false, default: false }
];

export const defaultUsersList = [
  { id: 'USR-01', name: 'Administrador Principal', email: 'admin@ferreteria.com', username: '1799999999001', role: 'Administrador', status: 'Activo', password: 'admin' },
  { id: 'USR-02', name: 'Juan Pérez (Caja 1)', email: 'juan.perez@ferreteria.com', username: '1724567890', role: 'Cajero', status: 'Activo', password: '1234' },
  { id: 'USR-03', name: 'María López (Ventas)', email: 'maria.lopez@ferreteria.com', username: '1724567891', role: 'Vendedor', status: 'Activo', password: '1234' },
  { id: 'USR-04', name: 'Carlos Ruiz (Contabilidad)', email: 'carlos.ruiz@ferreteria.com', username: '1724567892', role: 'Contador', status: 'Activo', password: '1234' }
];

export const defaultSellers = [
  { id: 'v-1', code: 'V-001', name: 'Juan Pérez', commissionRatePercent: 2 },
  { id: 'v-2', code: 'V-002', name: 'María López', commissionRatePercent: 2.5 }
];

export const defaultEmployees = [
  {
    id: 'emp-1',
    code: 'EMP-001',
    idNumber: '1724567890',
    fullName: 'Juan Pérez',
    email: 'juan.perez@ferreteria.com',
    phone: '0987654321',
    departmentId: 'dep-1',
    departmentName: 'Ventas y Mostrador',
    positionId: 'pos-1',
    positionName: 'Cajero / Asesor de Ventas',
    hireDate: '2023-01-15',
    baseSalary: 650,
    contractType: 'INDEFINIDO',
    iessAffiliationNumber: '1724567890001',
    bankAccount: '2100876543 - Banco Pichincha',
    status: 'ACTIVO'
  },
  {
    id: 'emp-2',
    code: 'EMP-002',
    idNumber: '1724567891',
    fullName: 'María López',
    email: 'maria.lopez@ferreteria.com',
    phone: '0987654322',
    departmentId: 'dep-1',
    departmentName: 'Ventas y Mostrador',
    positionId: 'pos-2',
    positionName: 'Ejecutiva de Ventas y Proyectos',
    hireDate: '2023-03-01',
    baseSalary: 700,
    contractType: 'INDEFINIDO',
    iessAffiliationNumber: '1724567891001',
    bankAccount: '0012876451 - Banco Guayaquil',
    status: 'ACTIVO'
  },
  {
    id: 'emp-3',
    code: 'EMP-003',
    idNumber: '1724567892',
    fullName: 'Carlos Ruiz',
    email: 'carlos.ruiz@ferreteria.com',
    phone: '0987654323',
    departmentId: 'dep-2',
    departmentName: 'Contabilidad y Finanzas',
    positionId: 'pos-3',
    positionName: 'Contador General',
    hireDate: '2022-06-10',
    baseSalary: 950,
    contractType: 'INDEFINIDO',
    iessAffiliationNumber: '1724567892001',
    bankAccount: '3100554433 - Banco Internacional',
    status: 'ACTIVO'
  },
  {
    id: 'emp-4',
    code: 'EMP-004',
    idNumber: '1724567893',
    fullName: 'Roberto Gómez',
    email: 'roberto.gomez@ferreteria.com',
    phone: '0987654324',
    departmentId: 'dep-3',
    departmentName: 'Bodega y Despacho',
    positionId: 'pos-4',
    positionName: 'Jefe de Bodega y Logística',
    hireDate: '2023-05-20',
    baseSalary: 600,
    contractType: 'INDEFINIDO',
    iessAffiliationNumber: '1724567893001',
    bankAccount: '1100998877 - Banco Bolivariano',
    status: 'ACTIVO'
  }
];

export const defaultCountries = [
  'Ecuador',
  'Colombia',
  'Perú',
  'Estados Unidos',
  'España',
  'México',
  'Chile',
  'Argentina',
  'Panamá',
  'Venezuela',
  'Brasil'
];

export const defaultProvinces = [
  'Pichincha',
  'Guayas',
  'Azuay',
  'Manabí',
  'El Oro',
  'Tungurahua',
  'Loja',
  'Imbabura',
  'Chimborazo',
  'Cotopaxi',
  'Esmeraldas',
  'Los Ríos',
  'Santo Domingo de los Tsáchilas',
  'Santa Elena',
  'Cañar',
  'Bolívar',
  'Carchi',
  'Sucumbíos',
  'Orellana',
  'Napo',
  'Pastaza',
  'Morona Santiago',
  'Zamora Chinchipe',
  'Galápagos'
];

export const defaultCities = [
  'Quito',
  'Guayaquil',
  'Cuenca',
  'Santo Domingo',
  'Machala',
  'Durán',
  'Manta',
  'Portoviejo',
  'Loja',
  'Ambato',
  'Esmeraldas',
  'Quevedo',
  'Riobamba',
  'Milagro',
  'Ibarra',
  'Latacunga',
  'Babahoyo',
  'Tulcán',
  'Daule',
  'Samborondón',
  'Cayambe',
  'Rumiñahui (Sangolquí)',
  'Otavalo',
  'Nueva Loja (Lago Agrio)',
  'El Coca',
  'Puyo',
  'Tena',
  'Macas',
  'Zamora',
  'Puerto Baquerizo Moreno',
  'Puerto Ayora'
];
