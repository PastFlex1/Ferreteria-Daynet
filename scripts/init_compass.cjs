const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'ferreteria_daynet';

async function seedCompass() {
  console.log(`Conectando a MongoDB en ${uri}, base de datos: ${dbName}...`);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  const db = client.db(dbName);

  // Limpiar colecciones auxiliares no deseadas
  try { await db.collection('test_ping').drop(); } catch(e){}
  try { await db.collection('inventario_productos').drop(); } catch(e){}

  // 1. Configuracion de la Empresa
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
        _syncedAt: new Date()
      }
    },
    { upsert: true }
  );

  // 2. Usuarios del Sistema
  const users = [
    { _id: 'USR-01', name: 'Administrador Principal', email: 'admin@ferreteria.com', username: '1799999999001', role: 'Administrador', status: 'Activo', _syncedAt: new Date() },
    { _id: 'USR-02', name: 'Juan Pérez (Cajero)', email: 'juan@ferreteria.com', username: '1724567890', role: 'Cajero', status: 'Activo', _syncedAt: new Date() },
    { _id: 'USR-03', name: 'María López (Ventas)', email: 'maria@ferreteria.com', username: '1724567891', role: 'Vendedor', status: 'Activo', _syncedAt: new Date() },
    { _id: 'USR-04', name: 'Carlos Ruiz (Contador)', email: 'carlos@ferreteria.com', username: '1724567892', role: 'Contador', status: 'Activo', _syncedAt: new Date() }
  ];
  for (const u of users) {
    await db.collection('usuarios_sistema').updateOne({ _id: u._id }, { $set: u }, { upsert: true });
  }

  // 3. Clientes
  const clientes = [
    { _id: 'cust-general', docType: 'C.I.', docNumber: '9999999999999', name: 'Consumidor Final', email: 'consumidor@final.com', phone: '0000000000', address: 'Venta Mostrador', _syncedAt: new Date() },
    { _id: 'cust-1', docType: 'RUC', docNumber: '1792345678001', name: 'Constructora del Valle Cía. Ltda.', email: 'compras@valle.ec', phone: '022345678', address: 'Av. Simón Bolívar Km 4', _syncedAt: new Date() }
  ];
  for (const c of clientes) {
    await db.collection('clientes').updateOne({ _id: c._id }, { $set: c }, { upsert: true });
  }

  // 4. Productos / Inventario
  const productos = [
    { _id: 'prod-001', code: 'FER-001', barcode: '786100123456', name: 'Cemento Selvalegre 50kg', category: 'Materiales de Construcción', price: 8.50, cost: 7.10, stock: 150, minStock: 20, taxRate: 5, unit: 'SACO', _syncedAt: new Date() },
    { _id: 'prod-002', code: 'FER-002', barcode: '786100123457', name: 'Varilla de Acero 12mm x 12m', category: 'Hierros y Aceros', price: 9.20, cost: 7.80, stock: 80, minStock: 15, taxRate: 5, unit: 'VARILLA', _syncedAt: new Date() },
    { _id: 'prod-003', code: 'FER-003', barcode: '786100123458', name: 'Taladro Percutor DeWalt 1/2" 710W', category: 'Herramientas Eléctricas', price: 85.00, cost: 68.00, stock: 12, minStock: 3, taxRate: 15, unit: 'UNIDAD', _syncedAt: new Date() },
    { _id: 'prod-004', code: 'FER-004', barcode: '786100123459', name: 'Pintura Látex Supremo Blanco Galón', category: 'Pinturas y Acabados', price: 18.50, cost: 14.20, stock: 35, minStock: 5, taxRate: 15, unit: 'GALON', _syncedAt: new Date() }
  ];
  for (const p of productos) {
    await db.collection('productos').updateOne({ _id: p._id }, { $set: p }, { upsert: true });
  }

  // 5. Proveedores
  const proveedores = [
    { _id: 'prov-01', taxId: '1790145239001', name: 'Unacem Ecuador S.A. (Selvalegre)', email: 'pedidos@unacem.com.ec', phone: '023940500', contactPerson: 'Ing. Fernando Vaca', address: 'Panamericana Norte Km 15, Quito', _syncedAt: new Date() },
    { _id: 'prov-02', taxId: '0990004523001', name: 'Adelca Acería del Ecuador C.A.', email: 'ventas@adelca.com', phone: '023829100', contactPerson: 'Lcdo. Patricio Ramos', address: 'Aloag, Pichincha', _syncedAt: new Date() }
  ];
  for (const prov of proveedores) {
    await db.collection('proveedores').updateOne({ _id: prov._id }, { $set: prov }, { upsert: true });
  }

  // 6. Formas de Pago
  const formasPago = [
    { _id: '01', code: '01', name: 'EFECTIVO', shortName: 'Efectivo', active: true, _syncedAt: new Date() },
    { _id: '16', code: '16', name: 'TARJETA DE DEBITO', shortName: 'T. Débito', active: true, _syncedAt: new Date() },
    { _id: '19', code: '19', name: 'TARJETA DE CREDITO', shortName: 'T. Crédito', active: true, _syncedAt: new Date() },
    { _id: '20', code: '20', name: 'TRANSFERENCIA BANCARIA', shortName: 'Transferencia', active: true, _syncedAt: new Date() }
  ];
  for (const fp of formasPago) {
    await db.collection('formas_pago').updateOne({ _id: fp._id }, { $set: fp }, { upsert: true });
  }

  // 7. Tarifas de Impuestos
  const impuestos = [
    { _id: 'tax-15', name: 'IVA 15% (Tarifa General)', rate: 15, codeSri: '4', active: true, _syncedAt: new Date() },
    { _id: 'tax-5', name: 'IVA 5% (Materiales Construcción)', rate: 5, codeSri: '5', active: true, _syncedAt: new Date() },
    { _id: 'tax-0', name: 'IVA 0% (Tarifa Cero)', rate: 0, codeSri: '0', active: true, _syncedAt: new Date() }
  ];
  for (const t of impuestos) {
    await db.collection('tarifas_impuestos').updateOne({ _id: t._id }, { $set: t }, { upsert: true });
  }

  // 8. Caja Sesiones
  await db.collection('caja_sesiones').updateOne(
    { _id: 'cash-session-activa' },
    {
      $set: {
        _id: 'cash-session-activa',
        openedAt: new Date().toISOString(),
        initialCash: 100,
        expectedCash: 100,
        status: 'ABIERTA',
        cajero: 'Juan Pérez',
        totalSalesCash: 0,
        _syncedAt: new Date()
      }
    },
    { upsert: true }
  );

  // 9. Categorias
  const cats = [
    { _id: 'cat-1', name: 'Materiales de Construcción', description: 'Cementos, arenas, bloques', _syncedAt: new Date() },
    { _id: 'cat-2', name: 'Hierros y Aceros', description: 'Varillas, mallas, ángulos', _syncedAt: new Date() },
    { _id: 'cat-3', name: 'Herramientas Eléctricas', description: 'Taladros, amoladoras, sierras', _syncedAt: new Date() },
    { _id: 'cat-4', name: 'Pinturas y Acabados', description: 'Látex, esmaltes, brochas', _syncedAt: new Date() },
    { _id: 'cat-5', name: 'Plomería y Grifería', description: 'Tubos PVC, accesorios, llaves', _syncedAt: new Date() }
  ];
  for (const c of cats) {
    await db.collection('categorias_productos').updateOne({ _id: c._id }, { $set: c }, { upsert: true });
  }

  // 10. Unidades de Medida
  const unidades = [
    { _id: 'u-1', code: 'UND', name: 'Unidad', _syncedAt: new Date() },
    { _id: 'u-2', code: 'MTR', name: 'Metro Lineal', _syncedAt: new Date() },
    { _id: 'u-3', code: 'KG', name: 'Kilogramo', _syncedAt: new Date() },
    { _id: 'u-4', code: 'GAL', name: 'Galón', _syncedAt: new Date() },
    { _id: 'u-5', code: 'SAC', name: 'Saco / Bulto', _syncedAt: new Date() }
  ];
  for (const u of unidades) {
    await db.collection('unidades_medida').updateOne({ _id: u._id }, { $set: u }, { upsert: true });
  }

  // 11. Cuentas Bancarias
  const bancos = [
    { _id: 'bank-1', bankName: 'Banco Pichincha', accountNumber: '2100876543', accountType: 'CORRIENTE', holderName: 'Ferretería DAYNET S.A.', balance: 4500.00, _syncedAt: new Date() },
    { _id: 'bank-2', bankName: 'Banco Guayaquil', accountNumber: '0012876451', accountType: 'CORRIENTE', holderName: 'Ferretería DAYNET S.A.', balance: 2800.00, _syncedAt: new Date() }
  ];
  for (const b of bancos) {
    await db.collection('cuentas_bancarias').updateOne({ _id: b._id }, { $set: b }, { upsert: true });
  }

  // 12. Plan de Cuentas Contable
  const cuentas = [
    { _id: 'acc-1', code: '1.1.01.01.01', name: 'Caja General Mostrador', type: 'ACTIVO', balance: 100.00, _syncedAt: new Date() },
    { _id: 'acc-2', code: '1.1.01.02.01', name: 'Banco Pichincha Cta Cte', type: 'ACTIVO', balance: 4500.00, _syncedAt: new Date() },
    { _id: 'acc-3', code: '1.1.03.01.01', name: 'Inventario de Mercaderías', type: 'ACTIVO', balance: 12450.00, _syncedAt: new Date() },
    { _id: 'acc-4', code: '4.1.01.01.01', name: 'Ventas de Mostrador Ferretería', type: 'INGRESO', balance: 0.00, _syncedAt: new Date() }
  ];
  for (const acc of cuentas) {
    await db.collection('plan_cuentas_contable').updateOne({ _id: acc._id }, { $set: acc }, { upsert: true });
  }

  // 13. Empleados
  const empleados = [
    { _id: 'emp-1', idNumber: '1724567890', fullName: 'Juan Pérez', position: 'Cajero / Asesor de Ventas', salary: 650, status: 'ACTIVO', _syncedAt: new Date() },
    { _id: 'emp-2', idNumber: '1724567891', fullName: 'María López', position: 'Asesora Comercial', salary: 700, status: 'ACTIVO', _syncedAt: new Date() }
  ];
  for (const emp of empleados) {
    await db.collection('empleados').updateOne({ _id: emp._id }, { $set: emp }, { upsert: true });
  }

  // 14. Compras
  await db.collection('compras').updateOne(
    { _id: 'comp-001' },
    {
      $set: {
        _id: 'comp-001',
        purchaseNumber: 'COM-000001',
        supplierName: 'Unacem Ecuador S.A.',
        supplierTaxId: '1790145239001',
        invoiceNumber: '001-002-000045231',
        date: new Date().toISOString().split('T')[0],
        total: 1065.00,
        paymentCondition: 'CONTADO',
        itemsCount: 1,
        _syncedAt: new Date()
      }
    },
    { upsert: true }
  );

  // 15. Cuentas por Pagar
  await db.collection('cuentas_por_pagar').updateOne(
    { _id: 'cxp-001' },
    {
      $set: {
        _id: 'cxp-001',
        supplierName: 'Adelca Acería del Ecuador C.A.',
        invoiceNumber: '001-005-000088912',
        totalAmount: 1500.00,
        paidAmount: 500.00,
        balance: 1000.00,
        status: 'PENDIENTE',
        dueDate: '2026-10-15',
        _syncedAt: new Date()
      }
    },
    { upsert: true }
  );

  // 16. Cotizaciones y Pedidos
  await db.collection('cotizaciones_pedidos').updateOne(
    { _id: 'cot-001' },
    {
      $set: {
        _id: 'cot-001',
        quoteNumber: 'COT-000001',
        customerName: 'Constructora del Valle Cía. Ltda.',
        date: new Date().toISOString().split('T')[0],
        subtotal: 450.00,
        tax: 22.50,
        total: 472.50,
        status: 'PENDIENTE',
        _syncedAt: new Date()
      }
    },
    { upsert: true }
  );

  // 17. Facturas de Venta
  await db.collection('facturas_ventas').updateOne(
    { _id: 'fac-001' },
    {
      $set: {
        _id: 'fac-001',
        invoiceNumber: '001-001-000000001',
        customerName: 'Consumidor Final',
        date: new Date().toISOString().split('T')[0],
        total: 25.50,
        paymentMethod: 'EFECTIVO',
        status: 'EMITIDA',
        _syncedAt: new Date()
      }
    },
    { upsert: true }
  );

  // 18. Activos Fijos
  await db.collection('activos_fijos').updateOne(
    { _id: 'act-001' },
    {
      $set: {
        _id: 'act-001',
        code: 'ACT-001',
        name: 'Computador POS Mostrador Principal',
        classification: 'Equipos de Computación',
        area: 'Mostrador / Ventas',
        purchaseCost: 850.00,
        status: 'OPERATIVO',
        _syncedAt: new Date()
      }
    },
    { upsert: true }
  );

  // 19. Asientos Contables
  await db.collection('asientos_contables').updateOne(
    { _id: 'asiento-001' },
    {
      $set: {
        _id: 'asiento-001',
        number: 1,
        date: new Date().toISOString().split('T')[0],
        concept: 'Apertura de operaciones caja y bancos',
        debit: 4600.00,
        credit: 4600.00,
        _syncedAt: new Date()
      }
    },
    { upsert: true }
  );

  // 20. Vendedores
  const vendedores = [
    { _id: 'v-1', code: 'V-001', name: 'Juan Pérez', commissionRate: 2.0, _syncedAt: new Date() },
    { _id: 'v-2', code: 'V-002', name: 'María López', commissionRate: 2.5, _syncedAt: new Date() }
  ];
  for (const v of vendedores) {
    await db.collection('vendedores').updateOne({ _id: v._id }, { $set: v }, { upsert: true });
  }

  // 21. Activos - Areas, Clasificaciones, Ubicaciones
  await db.collection('activos_areas').updateOne({ _id: 'are-1' }, { $set: { _id: 'are-1', name: 'Mostrador / Ventas', _syncedAt: new Date() } }, { upsert: true });
  await db.collection('activos_clasificaciones').updateOne({ _id: 'cls-1' }, { $set: { _id: 'cls-1', name: 'Equipos de Computación', _syncedAt: new Date() } }, { upsert: true });
  await db.collection('activos_ubicaciones').updateOne({ _id: 'loc-1' }, { $set: { _id: 'loc-1', name: 'Local Matriz Centro', _syncedAt: new Date() } }, { upsert: true });

  // 22. Departamentos y Cargos RRHH
  await db.collection('departamentos_rrhh').updateOne({ _id: 'dep-1' }, { $set: { _id: 'dep-1', name: 'Ventas y Mostrador', _syncedAt: new Date() } }, { upsert: true });
  await db.collection('cargos_rrhh').updateOne({ _id: 'pos-1' }, { $set: { _id: 'pos-1', name: 'Cajero / Asesor de Ventas', _syncedAt: new Date() } }, { upsert: true });

  // 23. App State Backup Snapshot
  await db.collection('app_state').updateOne(
    { _id: 'ferreteria_settings' },
    {
      $set: {
        _id: 'ferreteria_settings',
        data: { storeName: 'Ferretería DAYNET' },
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );

  // Eliminar colecciones que hayan quedado vacías (0 documentos) para que Compass no se confunda
  const allCols = await db.listCollections().toArray();
  for (const c of allCols) {
    const count = await db.collection(c.name).countDocuments();
    if (count === 0) {
      try { await db.collection(c.name).drop(); } catch(e){}
    }
  }

  const finalCols = await db.listCollections().toArray();
  console.log(`\n🎉 ¡COMPLETO! Se dejaron ${finalCols.length} colecciones limpias con documentos listos para MongoDB Compass:`);
  for (const c of finalCols.sort((a, b) => a.name.localeCompare(b.name))) {
    const cnt = await db.collection(c.name).countDocuments();
    console.log(`  ⭐ ${c.name.padEnd(26)} -> ${cnt} docs`);
  }

  await client.close();
}

seedCompass().catch(console.error);
