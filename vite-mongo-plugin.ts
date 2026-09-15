import { MongoClient } from 'mongodb';
import type { Plugin } from 'vite';

let cachedClient: MongoClient | null = null;
let currentUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
let currentDbName = process.env.MONGODB_DB_NAME || 'ferreteria_daynet';

async function getMongoClient(uri: string = currentUri): Promise<MongoClient> {
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

// Friendly collection names for MongoDB Compass
const COMPASS_COLLECTIONS: Record<string, string> = {
  // Productos e Inventario
  ferreteria_products: 'productos',
  ferreteria_inventory: 'productos',
  ferreteria_categories: 'categorias_productos',
  ferreteria_units: 'unidades_medida',
  ferreteria_promotions: 'promociones',
  ferreteria_product_batches: 'lotes_productos',
  ferreteria_taxes: 'tarifas_impuestos',
  ferreteria_inventory_adjustments: 'ajustes_inventario',
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
  ferreteria_cash_session: 'caja_sesiones',
  ferreteria_cash_sessions_history: 'caja_historial_cierres',
  ferreteria_bank_accounts: 'cuentas_bancarias',
  ferreteria_bank_transactions: 'transacciones_bancarias',
  ferreteria_bank_deposits: 'depositos_bancarios',
  ferreteria_petty_expenses: 'caja_chica_gastos',
  ferreteria_issued_checks: 'cheques_emitidos',
  ferreteria_postdated_checks: 'cheques_posfechados',
  ferreteria_card_reconciliations: 'conciliaciones_tarjetas',

  // Contabilidad
  ferreteria_journal_entries: 'asientos_contables',
  ferreteria_account_plan: 'plan_cuentas_contable',
  ferreteria_accounting_accounts: 'contabilidad_cuentas',
  ferreteria_fiscal_periods: 'periodos_fiscales',

  // Activos Fijos
  ferreteria_assets: 'activos_fijos',
  ferreteria_finance_assets: 'activos_fijos',
  ferreteria_asset_maintenances: 'activos_mantenimientos',
  ferreteria_asset_transfers: 'activos_transferencias',
  ferreteria_asset_classifications: 'activos_clasificaciones',
  ferreteria_asset_areas: 'activos_areas',
  ferreteria_asset_locations: 'activos_ubicaciones',
  ferreteria_asset_history_logs: 'activos_historial',

  // Recursos Humanos / Nómina
  ferreteria_hr_employees: 'empleados',
  ferreteria_hr_payroll_roles: 'roles_pago_nomina',
  ferreteria_hr_departments: 'departamentos_rrhh',
  ferreteria_hr_positions: 'cargos_rrhh',
  ferreteria_hr_vacations: 'vacaciones_rrhh',
  ferreteria_hr_liquidations: 'liquidaciones_rrhh',
  ferreteria_hr_decimos: 'decimos_rrhh',
  ferreteria_hr_novelties: 'novedades_rrhh',
  ferreteria_hr_incomes: 'ingresos_rrhh',
  ferreteria_hr_discounts: 'descuentos_rrhh',

  // Configuración del Sistema
  ferreteria_settings_users_list: 'usuarios_sistema',
  ferreteria_settings: 'configuracion_empresa',
  ferreteria_settings_payment_methods: 'formas_pago',
  ferreteria_settings_tax_rates: 'tarifas_impuestos',
};

function getFriendlyCollectionName(docId: string): string | null {
  if (COMPASS_COLLECTIONS[docId]) {
    return COMPASS_COLLECTIONS[docId];
  }
  // Group fine-grained system settings
  if (docId.startsWith('ferreteria_settings_')) {
    return 'configuracion_parametros';
  }
  // Fallback for any other module
  if (docId.startsWith('ferreteria_')) {
    return docId.replace(/^ferreteria_/, '');
  }
  if (docId.startsWith('doc_')) {
    return docId.replace(/^doc_/, '');
  }
  return null;
}

async function syncToFriendlyCompassCollection(db: any, docId: string, data: any) {
  const friendlyName = getFriendlyCollectionName(docId);
  if (!friendlyName) return;

  try {
    // Ensure collection exists so Compass immediately reflects all collections
    try {
      await db.createCollection(friendlyName);
    } catch {
      // Collection already exists, continue
    }

    const col = db.collection(friendlyName);
    if (Array.isArray(data)) {
      // Synchronize list items individually so Compass displays them as distinct documents
      await col.deleteMany({});
      if (data.length > 0) {
        const docsToInsert = data.map((item: any, index: number) => {
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
      const docKey = friendlyName === 'configuracion_empresa' ? 'general_config' : docId;
      await col.updateOne(
        { _id: docKey },
        { $set: { ...data, _syncedAt: new Date() } },
        { upsert: true }
      );
    } else {
      // Scalar/primitive setting value
      await col.updateOne(
        { _id: docId },
        { $set: { key: docId, value: data, _syncedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn(`[MongoDB Bridge] Warning syncing to friendly collection '${friendlyName}':`, (err as any)?.message);
  }
}

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: any, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function mongoBridgePlugin(): Plugin {
  return {
    name: 'vite-plugin-mongo-bridge',
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';
        if (!url.startsWith('/api/mongo')) {
          return next();
        }

        const pathname = url.split('?')[0];

        // 1. GET /api/mongo/status
        if (pathname === '/api/mongo/status' && req.method === 'GET') {
          try {
            const client = await getMongoClient(currentUri);
            const db = client.db(currentDbName);
            await db.admin().ping();
            const cols = await db.listCollections().toArray();
            
            // Count total docs in app_state
            let totalDocs = 0;
            try {
              totalDocs = await db.collection('app_state').countDocuments();
            } catch {}

            return sendJson(res, 200, {
              connected: true,
              uri: currentUri,
              dbName: currentDbName,
              collections: cols.map(c => c.name),
              totalDocs,
              timestamp: new Date().toISOString()
            });
          } catch (error: any) {
            return sendJson(res, 200, {
              connected: false,
              uri: currentUri,
              dbName: currentDbName,
              error: error.message || 'No se pudo conectar a MongoDB',
              timestamp: new Date().toISOString()
            });
          }
        }

        // 2. POST /api/mongo/test-connection
        if (pathname === '/api/mongo/test-connection' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const testUri = (body.uri || currentUri).trim();
            const testDbName = (body.dbName || currentDbName).trim();

            const testClient = new MongoClient(testUri, {
              serverSelectionTimeoutMS: 2500,
              connectTimeoutMS: 2500,
            });
            await testClient.connect();
            const db = testClient.db(testDbName);
            await db.admin().ping();
            const cols = await db.listCollections().toArray();
            
            // If successful and requested, update active connection
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
          } catch (error: any) {
            return sendJson(res, 200, {
              success: false,
              message: error.message || 'Error al conectar con MongoDB',
              error: error.message
            });
          }
        }

        // 3. GET /api/mongo/doc/:docId
        if (pathname.startsWith('/api/mongo/doc/') && req.method === 'GET') {
          const docId = decodeURIComponent(pathname.replace('/api/mongo/doc/', ''));
          try {
            const client = await getMongoClient(currentUri);
            const db = client.db(currentDbName);
            const doc = await db.collection('app_state').findOne({ _id: docId } as any);
            
            if (doc && doc.data !== undefined) {
              return sendJson(res, 200, { exists: true, data: doc.data, updatedAt: doc.updatedAt });
            } else {
              return sendJson(res, 200, { exists: false, data: null });
            }
          } catch (error: any) {
            return sendJson(res, 500, { error: error.message });
          }
        }

        // 4. POST /api/mongo/doc/:docId
        if (pathname.startsWith('/api/mongo/doc/') && req.method === 'POST') {
          const docId = decodeURIComponent(pathname.replace('/api/mongo/doc/', ''));
          try {
            const body = await parseJsonBody(req);
            const client = await getMongoClient(currentUri);
            const db = client.db(currentDbName);
            
            // Upsert in main app_state
            await db.collection('app_state').updateOne(
              { _id: docId } as any,
              { $set: { data: body.data, updatedAt: new Date() } },
              { upsert: true }
            );

            // Also synchronize into friendly MongoDB Compass collection for clear inspection
            await syncToFriendlyCompassCollection(db, docId, body.data);

            return sendJson(res, 200, { success: true, docId });
          } catch (error: any) {
            return sendJson(res, 500, { error: error.message });
          }
        }

        // 5. POST /api/mongo/sync-all
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
                { _id: docId } as any,
                { $set: { data: val, updatedAt: new Date() } },
                { upsert: true }
              );
              await syncToFriendlyCompassCollection(db, docId, val);
            }

            return sendJson(res, 200, {
              success: true,
              message: `Se sincronizaron ${docIds.length} colecciones con MongoDB Compass exitosamente.`,
              collectionsSynced: docIds
            });
          } catch (error: any) {
            return sendJson(res, 500, { error: error.message });
          }
        }

        // 6. GET /api/mongo/pull-all
        if (pathname === '/api/mongo/pull-all' && req.method === 'GET') {
          try {
            const client = await getMongoClient(currentUri);
            const db = client.db(currentDbName);
            const docs = await db.collection('app_state').find({}).toArray();
            
            const result: Record<string, any> = {};
            for (const d of docs) {
              result[String(d._id)] = d.data;
            }

            return sendJson(res, 200, {
              success: true,
              data: result,
              count: docs.length
            });
          } catch (error: any) {
            return sendJson(res, 500, { error: error.message });
          }
        }

        // Not handled by mongo bridge
        return next();
      });
    },
  };
}
