const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ferreteria_daynet';
let dbName = process.env.MONGODB_DB_NAME || 'ferreteria_daynet';

try {
  const withoutProto = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  const parts = withoutProto.split('/');
  if (parts.length > 1 && parts[1].split('?')[0]) {
    dbName = parts[1].split('?')[0];
  }
} catch {}

async function cleanDatabaseForProduction() {
  console.log(`\n🧹 Iniciando limpieza completa de MongoDB para Puesta en Producción...`);
  console.log(`Conectando a: ${uri}`);
  console.log(`Base de Datos: ${dbName}\n`);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3500 });
  await client.connect();
  const db = client.db(dbName);

  // 1. Vaciar completamente tablas de movimientos y transacciones de prueba
  const transactionalCollections = [
    'facturas_ventas',
    'compras',
    'ordenes_compra',
    'cotizaciones_pedidos',
    'cuentas_por_pagar',
    'pagos_proveedores',
    'asientos_contables',
    'caja_historial_cierres',
    'caja_chica_gastos',
    'cheques_emitidos',
    'cheques_posfechados',
    'guias_remision',
    'notas_credito',
    'retenciones',
    'transacciones_bancarias',
    'depositos_bancarios',
    'roles_pago_nomina',
    'productos',
    'proveedores',
    'activos_fijos',
    'empleados'
  ];

  for (const colName of transactionalCollections) {
    try {
      await db.collection(colName).deleteMany({});
      console.log(`  ✓ Colección '${colName}' vaciada (0 registros).`);
    } catch (e) {
      console.warn(`  ! Advertencia en '${colName}':`, e.message);
    }
  }

  // 2. Dejar únicamente el Cliente Oficial obligatorio: CONSUMIDOR FINAL
  await db.collection('clientes').deleteMany({});
  await db.collection('clientes').insertOne({
    _id: 'cust-general',
    id: 'cust-general',
    docType: 'C.I.',
    docNumber: '9999999999999',
    name: 'Consumidor Final',
    email: 'consumidor@final.com',
    phone: '0000000000',
    address: 'Venta Mostrador',
    creditLimit: 0,
    currentBalance: 0,
    _syncedAt: new Date()
  });
  console.log(`  ✓ Clientes restablecidos: Consumidor Final (9999999999999).`);

  // 3. Dejar Caja cerrada lista para la primera apertura real
  await db.collection('caja_sesiones').deleteMany({});
  await db.collection('caja_sesiones').insertOne({
    _id: 'cash-0',
    id: 'cash-0',
    openedAt: new Date().toISOString(),
    initialCash: 0,
    expectedCash: 0,
    status: 'CERRADA',
    totalSalesCash: 0,
    totalSalesTransfer: 0,
    totalSalesCard: 0,
    totalSalesCredit: 0,
    totalInvoicesCount: 0,
    _syncedAt: new Date()
  });
  console.log(`  ✓ Caja registradora en CERO (Cerrada, lista para apertura de turno).`);

  // 4. Usuario Administrador Maestro Inicial (para no perder acceso)
  await db.collection('usuarios_sistema').deleteMany({});
  await db.collection('usuarios_sistema').insertMany([
    {
      _id: 'USR-01',
      id: 'USR-01',
      name: 'Administrador Principal',
      email: 'admin@ferreteria.com',
      username: '1799999999001',
      role: 'Administrador',
      status: 'Activo',
      password: 'admin',
      _syncedAt: new Date()
    }
  ]);
  console.log(`  ✓ Usuario Administrador inicial conservado (Usuario: 1799999999001 / Clave: admin).`);

  // 5. Configuración de Empresa limpia
  await db.collection('configuracion_empresa').updateOne(
    { _id: 'general_config' },
    {
      $set: {
        _id: 'general_config',
        storeName: 'Ferretería DAYNET',
        legalName: 'Ferretería DAYNET S.A.',
        taxId: '1790000000001',
        address: 'Av. Principal #100',
        phone: '0999999999',
        email: 'contacto@ferreteriadaynet.com',
        city: 'Quito',
        country: 'Ecuador',
        currencySymbol: '$',
        defaultTaxRate: 15,
        invoicePrefix: '001-001',
        nextInvoiceNumber: 1,
        _syncedAt: new Date()
      }
    },
    { upsert: true }
  );
  console.log(`  ✓ Configuración de empresa inicializada.`);

  // 6. Formas de Pago del SRI Oficiales
  await db.collection('formas_pago').deleteMany({});
  await db.collection('formas_pago').insertMany([
    { _id: '01', code: '01', name: 'SIN UTILIZACION DEL SISTEMA FINANCIERO (EFECTIVO)', shortName: 'Efectivo', active: true, default: true, _syncedAt: new Date() },
    { _id: '16', code: '16', name: 'TARJETA DE DEBITO', shortName: 'T. Débito', active: true, default: false, _syncedAt: new Date() },
    { _id: '19', code: '19', name: 'TARJETA DE CREDITO', shortName: 'T. Crédito', active: true, default: false, _syncedAt: new Date() },
    { _id: '20', code: '20', name: 'TRANSFERENCIA BANCARIA / DEPOSITO', shortName: 'Transferencia', active: true, default: false, _syncedAt: new Date() }
  ]);
  console.log(`  ✓ Formas de pago oficiales SRI configuradas.`);

  // 7. Tarifas de IVA vigentes
  await db.collection('tarifas_impuestos').deleteMany({});
  await db.collection('tarifas_impuestos').insertMany([
    { _id: 'tax-15', id: 'tax-15', name: 'IVA 15% (Tarifa General)', rate: 15, codeSri: '4', isDefault: true, active: true, _syncedAt: new Date() },
    { _id: 'tax-5', id: 'tax-5', name: 'IVA 5% (Materiales Construcción)', rate: 5, codeSri: '5', isDefault: false, active: true, _syncedAt: new Date() },
    { _id: 'tax-0', id: 'tax-0', name: 'IVA 0% (Tarifa Cero)', rate: 0, codeSri: '0', isDefault: false, active: true, _syncedAt: new Date() }
  ]);
  console.log(`  ✓ Tarifas de IVA oficiales configuradas.`);

  // 8. Catálogo base de Unidades de Medida
  await db.collection('unidades_medida').deleteMany({});
  await db.collection('unidades_medida').insertMany([
    { _id: 'u-1', code: 'UND', name: 'Unidad', symbol: 'und', _syncedAt: new Date() },
    { _id: 'u-2', code: 'MTR', name: 'Metro Lineal', symbol: 'm', _syncedAt: new Date() },
    { _id: 'u-3', code: 'KG', name: 'Kilogramo', symbol: 'kg', _syncedAt: new Date() },
    { _id: 'u-4', code: 'GAL', name: 'Galón', symbol: 'gal', _syncedAt: new Date() },
    { _id: 'u-5', code: 'SAC', name: 'Saco / Bulto', symbol: 'sac', _syncedAt: new Date() }
  ]);
  console.log(`  ✓ Unidades de medida listas.`);

  // 9. Plan de Cuentas Contable Estándar
  await db.collection('plan_cuentas_contable').deleteMany({});
  await db.collection('plan_cuentas_contable').insertMany([
    { _id: 'acc-1', code: '1.0.00.00.00', name: 'ACTIVO', level: 1, type: 'ACTIVO', balance: 0, _syncedAt: new Date() },
    { _id: 'acc-2', code: '1.1.01.01.01', name: 'Caja General Mostrador', level: 4, type: 'ACTIVO', balance: 0, _syncedAt: new Date() },
    { _id: 'acc-3', code: '1.1.01.02.01', name: 'Bancos Cuentas Corrientes', level: 4, type: 'ACTIVO', balance: 0, _syncedAt: new Date() },
    { _id: 'acc-4', code: '1.1.03.01.01', name: 'Inventario de Mercaderías Ferretería', level: 4, type: 'ACTIVO', balance: 0, _syncedAt: new Date() },
    { _id: 'acc-5', code: '2.0.00.00.00', name: 'PASIVO', level: 1, type: 'PASIVO', balance: 0, _syncedAt: new Date() },
    { _id: 'acc-6', code: '2.1.01.01.01', name: 'Cuentas por Pagar Proveedores', level: 4, type: 'PASIVO', balance: 0, _syncedAt: new Date() },
    { _id: 'acc-7', code: '4.1.01.01.01', name: 'Ventas de Mercaderías Mostrador', level: 4, type: 'INGRESO', balance: 0, _syncedAt: new Date() },
    { _id: 'acc-8', code: '5.1.01.01.01', name: 'Costo de Ventas Ferretería', level: 4, type: 'GASTO', balance: 0, _syncedAt: new Date() }
  ]);
  console.log(`  ✓ Plan de cuentas contable base establecido.`);

  console.log(`\n✨ ¡SISTEMA Y BASE DE DATOS RESTABLECIDOS AL 100% PARA PRODUCCIÓN!`);
  console.log(`Todos los datos ficticios fueron removidos y la estructura del ERP quedó lista para facturar en vivo.`);

  await client.close();
}

cleanDatabaseForProduction().catch(console.error);
