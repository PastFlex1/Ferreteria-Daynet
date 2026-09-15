const http = require('http');
const { MongoClient } = require('mongodb');

const PORT = process.env.MONGO_BRIDGE_PORT || 5000;
let currentUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
let currentDbName = process.env.MONGODB_DB_NAME || 'ferreteria_daynet';
let cachedClient = null;

async function getMongoClient(uri = currentUri) {
  if (cachedClient) {
    try {
      await cachedClient.db().admin().ping();
      return cachedClient;
    } catch {
      try { await cachedClient.close(); } catch {}
      cachedClient = null;
    }
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 2500,
    connectTimeoutMS: 2500,
  });

  await client.connect();
  cachedClient = client;
  currentUri = uri;
  return client;
}

const COMPASS_COLLECTIONS = {
  ferreteria_products: 'productos',
  ferreteria_inventory: 'productos',
  ferreteria_invoices: 'facturas_ventas',
  ferreteria_customers: 'clientes',
  ferreteria_suppliers: 'proveedores',
  ferreteria_suppliers_details: 'proveedores',
  ferreteria_purchases: 'compras',
  ferreteria_purchase_orders: 'ordenes_compra',
  ferreteria_payables: 'cuentas_por_pagar',
  ferreteria_supplier_payments: 'pagos_proveedores',
  ferreteria_orders: 'cotizaciones_pedidos',
  ferreteria_guias: 'guias_remision',
  ferreteria_credit_notes: 'notas_credito',
  ferreteria_retenciones: 'retenciones',
  ferreteria_categories: 'categorias_productos',
  ferreteria_units: 'unidades_medida',
  ferreteria_promotions: 'promociones',
  ferreteria_cash_session: 'caja_sesiones',
  ferreteria_cash_sessions_history: 'caja_historial_cierres',
  ferreteria_bank_accounts: 'cuentas_bancarias',
  ferreteria_bank_transactions: 'transacciones_bancarias',
  ferreteria_petty_expenses: 'caja_chica_gastos',
  ferreteria_issued_checks: 'cheques_emitidos',
  ferreteria_journal_entries: 'asientos_contables',
  ferreteria_account_plan: 'plan_cuentas_contable',
  ferreteria_accounting_accounts: 'contabilidad_cuentas',
  ferreteria_assets: 'activos_fijos',
  ferreteria_hr_employees: 'empleados',
  ferreteria_hr_payroll_roles: 'roles_pago_nomina',
  ferreteria_settings_users_list: 'usuarios_sistema',
  ferreteria_settings: 'configuracion_empresa',
  ferreteria_settings_payment_methods: 'formas_pago',
  ferreteria_settings_tax_rates: 'tarifas_impuestos',
};

async function syncToFriendlyCompassCollection(db, docId, data) {
  const friendlyName = COMPASS_COLLECTIONS[docId];
  if (!friendlyName) return;

  try {
    const col = db.collection(friendlyName);
    if (Array.isArray(data)) {
      await col.deleteMany({});
      if (data.length > 0) {
        const docsToInsert = data.map((item, index) => {
          const itemCopy = typeof item === 'object' && item !== null ? { ...item } : { value: item };
          const customId = itemCopy.id || itemCopy.code || itemCopy.cedula || itemCopy.ruc || `item_${index + 1}`;
          return {
            _id: String(customId),
            ...itemCopy,
            _syncedAt: new Date()
          };
        });
        await col.insertMany(docsToInsert, { ordered: false });
      }
    } else if (typeof data === 'object' && data !== null) {
      await col.updateOne(
        { _id: 'general_config' },
        { $set: { ...data, _syncedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn(`[MongoDB Bridge] Warning syncing to friendly collection '${friendlyName}':`, err.message);
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }

  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname === '/api/mongo/status' && req.method === 'GET') {
    try {
      const client = await getMongoClient(currentUri);
      const db = client.db(currentDbName);
      await db.admin().ping();
      const cols = await db.listCollections().toArray();
      const totalDocs = await db.collection('app_state').countDocuments().catch(() => 0);

      return sendJson(res, 200, {
        connected: true,
        uri: currentUri,
        dbName: currentDbName,
        collections: cols.map(c => c.name),
        totalDocs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return sendJson(res, 200, {
        connected: false,
        uri: currentUri,
        dbName: currentDbName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  if (pathname === '/api/mongo/test-connection' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const testUri = (body.uri || currentUri).trim();
      const testDbName = (body.dbName || currentDbName).trim();

      const testClient = new MongoClient(testUri, { serverSelectionTimeoutMS: 2500 });
      await testClient.connect();
      const db = testClient.db(testDbName);
      await db.admin().ping();
      const cols = await db.listCollections().toArray();

      if (body.saveAsActive) {
        if (cachedClient && cachedClient !== testClient) {
          try { await cachedClient.close(); } catch {}
        }
        cachedClient = testClient;
        currentUri = testUri;
        currentDbName = testDbName;
      } else {
        await testClient.close();
      }

      return sendJson(res, 200, {
        success: true,
        message: `Conexión exitosa con MongoDB en ${testUri}`,
        dbName: testDbName,
        collections: cols.map(c => c.name)
      });
    } catch (error) {
      return sendJson(res, 200, { success: false, message: error.message, error: error.message });
    }
  }

  if (pathname.startsWith('/api/mongo/doc/') && req.method === 'GET') {
    const docId = decodeURIComponent(pathname.replace('/api/mongo/doc/', ''));
    try {
      const client = await getMongoClient(currentUri);
      const db = client.db(currentDbName);
      const doc = await db.collection('app_state').findOne({ _id: docId });
      return sendJson(res, 200, { exists: !!doc, data: doc ? doc.data : null });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (pathname.startsWith('/api/mongo/doc/') && req.method === 'POST') {
    const docId = decodeURIComponent(pathname.replace('/api/mongo/doc/', ''));
    try {
      const body = await parseJsonBody(req);
      const client = await getMongoClient(currentUri);
      const db = client.db(currentDbName);

      await db.collection('app_state').updateOne(
        { _id: docId },
        { $set: { data: body.data, updatedAt: new Date() } },
        { upsert: true }
      );
      await syncToFriendlyCompassCollection(db, docId, body.data);

      return sendJson(res, 200, { success: true, docId });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (pathname === '/api/mongo/sync-all' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const allData = body.data || {};
      const client = await getMongoClient(currentUri);
      const db = client.db(currentDbName);

      const docIds = Object.keys(allData);
      for (const docId of docIds) {
        const val = allData[docId];
        await db.collection('app_state').updateOne(
          { _id: docId },
          { $set: { data: val, updatedAt: new Date() } },
          { upsert: true }
        );
        await syncToFriendlyCompassCollection(db, docId, val);
      }

      return sendJson(res, 200, {
        success: true,
        message: `Sincronizadas ${docIds.length} colecciones con MongoDB Compass.`,
        collectionsSynced: docIds
      });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (pathname === '/api/mongo/pull-all' && req.method === 'GET') {
    try {
      const client = await getMongoClient(currentUri);
      const db = client.db(currentDbName);
      const docs = await db.collection('app_state').find({}).toArray();

      const result = {};
      for (const d of docs) {
        result[d._id] = d.data;
      }

      return sendJson(res, 200, { success: true, data: result, count: docs.length });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[MongoDB Bridge] Corriendo en http://localhost:${PORT}`);
  console.log(`[MongoDB Bridge] Destino: ${currentUri} | BD: ${currentDbName}`);
});
