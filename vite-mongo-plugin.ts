import { MongoClient } from 'mongodb';
import type { Plugin } from 'vite';

function extractDbNameFromUri(uri: string, fallback: string): string {
  try {
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, '');
    const parts = withoutProtocol.split('/');
    if (parts.length > 1) {
      const dbAndQuery = parts[1].split('?')[0];
      if (dbAndQuery && dbAndQuery.trim().length > 0) {
        return dbAndQuery.trim();
      }
    }
  } catch {}
  return fallback;
}

let cachedClient: MongoClient | null = null;
let currentUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ferreteria_daynet';
let currentDbName = process.env.MONGODB_DB_NAME || extractDbNameFromUri(currentUri, 'ferreteria_daynet');

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
  currentDbName = extractDbNameFromUri(uri, currentDbName);
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
  ferreteria_settings_roles: 'roles_sistema',
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
      if (data.length > 0) {
        const docsToInsert = data.map((item: any, index: number) => {
          const itemCopy = typeof item === 'object' && item !== null ? { ...item } : { value: item };
          const customId = itemCopy.id || itemCopy.code || itemCopy.sku || itemCopy.cedula || itemCopy.ruc || `item_${index + 1}`;
          
          if (docId === 'ferreteria_products') {
            if (itemCopy.sku && !itemCopy.code) itemCopy.code = itemCopy.sku;
            if (itemCopy.code && !itemCopy.sku) itemCopy.sku = itemCopy.code;
            if (itemCopy.costPrice !== undefined && itemCopy.cost === undefined) itemCopy.cost = itemCopy.costPrice;
            if (itemCopy.cost !== undefined && itemCopy.costPrice === undefined) itemCopy.costPrice = itemCopy.cost;
          }

          return {
            _id: String(customId),
            ...itemCopy,
            _syncedAt: new Date()
          };
        });

        // Use bulkWrite with replaceOne + upsert to eliminate E11000 race conditions during rapid concurrent syncs
        const bulkOps = docsToInsert.map((doc: any) => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true
          }
        }));
        await col.bulkWrite(bulkOps, { ordered: false });

        const activeIds = docsToInsert.map((d: any) => d._id);
        await col.deleteMany({ _id: { $nin: activeIds } });
      } else {
        await col.deleteMany({});
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

const sseClients = new Set<any>();

function broadcastSse(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function viteMongoPlugin(): Plugin {
  return {
    name: 'vite-mongo-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/mongo')) {
          return next();
        }

        const pathname = url.split('?')[0];

        // 0. GET /api/mongo/events (Server-Sent Events for real-time LAN push)
        if (pathname === '/api/mongo/events' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });
          res.write('data: {"type":"connected"}\n\n');
          sseClients.add(res);
          req.on('close', () => {
            sseClients.delete(res);
          });
          return;
        }

        // 1. GET /api/mongo/status
        if (pathname === '/api/mongo/status' && req.method === 'GET') {
          try {
            const client = await getMongoClient(currentUri);
            const db = client.db(currentDbName);
            await db.admin().ping();
            const cols = await db.listCollections().toArray();
            
            // Count total docs across all real collections in MongoDB
            let totalDocs = 0;
            try {
              for (const c of cols) {
                if (!c.name.startsWith('system.')) {
                  totalDocs += await db.collection(c.name).countDocuments();
                }
              }
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
            
            // If app_state has the document and it has content, return it
            if (doc && doc.data !== undefined && (Array.isArray(doc.data) ? doc.data.length > 0 : true)) {
              return sendJson(res, 200, { exists: true, data: doc.data, updatedAt: doc.updatedAt });
            }

            // Fallback: check friendly collection directly!
            const friendlyName = getFriendlyCollectionName(docId);
            if (friendlyName) {
              const friendlyCol = db.collection(friendlyName);
              const count = await friendlyCol.countDocuments();
              if (count > 0) {
                if (friendlyName === 'configuracion_empresa') {
                  const confDoc = await friendlyCol.findOne({ _id: 'general_config' } as any);
                  if (confDoc) {
                    const { _id, _syncedAt, ...cleanData } = confDoc;
                    // Cache into app_state
                    await db.collection('app_state').updateOne(
                      { _id: docId } as any,
                      { $set: { data: cleanData, updatedAt: new Date() } },
                      { upsert: true }
                    );
                    return sendJson(res, 200, { exists: true, data: cleanData, updatedAt: _syncedAt || new Date() });
                  }
                } else if (friendlyName === 'configuracion_parametros') {
                  const paramDoc = await friendlyCol.findOne({ _id: docId } as any);
                  if (paramDoc && paramDoc.value !== undefined) {
                    await db.collection('app_state').updateOne(
                      { _id: docId } as any,
                      { $set: { data: paramDoc.value, updatedAt: new Date() } },
                      { upsert: true }
                    );
                    return sendJson(res, 200, { exists: true, data: paramDoc.value, updatedAt: paramDoc._syncedAt || new Date() });
                  }
                } else {
                  const items = await friendlyCol.find({}).toArray();
                  const cleanItems = items.map((item: any) => {
                    const { _syncedAt, ...clean } = item;
                    clean.id = String(clean.id || clean._id);
                    if (docId === 'ferreteria_products') {
                      if (!clean.sku && clean.code) clean.sku = clean.code;
                      if (!clean.code && clean.sku) clean.code = clean.sku;
                      if (clean.costPrice === undefined && clean.cost !== undefined) clean.costPrice = clean.cost;
                      if (clean.cost === undefined && clean.costPrice !== undefined) clean.cost = clean.costPrice;
                    }
                    return clean;
                  });

                  // Cache into app_state
                  await db.collection('app_state').updateOne(
                    { _id: docId } as any,
                    { $set: { data: cleanItems, updatedAt: new Date() } },
                    { upsert: true }
                  );

                  return sendJson(res, 200, { exists: true, data: cleanItems, updatedAt: new Date() });
                }
              }
            }

            // If it was explicitly empty in app_state, return it
            if (doc && doc.data !== undefined) {
              return sendJson(res, 200, { exists: true, data: doc.data, updatedAt: doc.updatedAt });
            }

            return sendJson(res, 200, { exists: false, data: null });
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

            // Broadcast to all connected clients on LAN
            broadcastSse({ type: 'doc_updated', docId, data: body.data });

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

            // Broadcast to all connected clients on LAN
            broadcastSse({ type: 'all_synced', docIds });

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

            // Also check all friendly collections for any collection missing or empty in app_state
            for (const [docId, friendlyName] of Object.entries(COMPASS_COLLECTIONS)) {
              if (!result[docId] || (Array.isArray(result[docId]) && result[docId].length === 0)) {
                try {
                  const friendlyCol = db.collection<any>(friendlyName);
                  const count = await friendlyCol.countDocuments();
                  if (count > 0) {
                    if (friendlyName === 'configuracion_empresa') {
                      const confDoc = await friendlyCol.findOne({ _id: 'general_config' });
                      if (confDoc) {
                        const { _id, _syncedAt, ...cleanData } = confDoc;
                        result[docId] = cleanData;
                      }
                    } else {
                      const items = await friendlyCol.find({}).toArray();
                      result[docId] = items.map((item: any) => {
                        const { _syncedAt, ...clean } = item;
                        clean.id = String(clean.id || clean._id);
                        if (docId === 'ferreteria_products') {
                          if (!clean.sku && clean.code) clean.sku = clean.code;
                          if (!clean.code && clean.sku) clean.code = clean.sku;
                          if (clean.costPrice === undefined && clean.cost !== undefined) clean.costPrice = clean.cost;
                          if (clean.cost === undefined && clean.costPrice !== undefined) clean.cost = clean.costPrice;
                        }
                        return clean;
                      });
                    }
                  }
                } catch {}
              }
            }

            return sendJson(res, 200, {
              success: true,
              data: result,
              count: Object.keys(result).length
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

export const mongoBridgePlugin = viteMongoPlugin;
export default viteMongoPlugin;

