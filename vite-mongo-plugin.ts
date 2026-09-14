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
  ferreteria_inventory: 'inventario_productos',
  ferreteria_invoices: 'facturas_ventas',
  ferreteria_customers: 'clientes',
  ferreteria_suppliers: 'proveedores',
  ferreteria_settings_users_list: 'usuarios_sistema',
  ferreteria_settings: 'configuracion_empresa',
  ferreteria_cash_session: 'caja_sesiones',
  ferreteria_accounting_accounts: 'contabilidad_cuentas',
};

async function syncToFriendlyCompassCollection(db: any, docId: string, data: any) {
  const friendlyName = COMPASS_COLLECTIONS[docId];
  if (!friendlyName) return;

  try {
    const col = db.collection(friendlyName);
    if (Array.isArray(data)) {
      // Synchronize list items individually so Compass displays them as distinct documents
      await col.deleteMany({});
      if (data.length > 0) {
        const docsToInsert = data.map((item: any, index: number) => {
          const itemCopy = typeof item === 'object' && item !== null ? { ...item } : { value: item };
          // Preserve custom ID or assign string _id
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
              result[d._id as string] = d.data;
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
