import { Request, Response } from 'express';
import pg from 'pg';
import {
  getDatabase,
  getPgPool,
  currentUri,
  currentDbName,
  getFriendlyCollectionName,
  COMPASS_COLLECTIONS
} from '../config/db';

const sseClients = new Set<Response>();

export function broadcastSse(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch {
      sseClients.delete(client);
    }
  }
}

export async function syncToFriendlyCompassCollection(db: any, docId: string, data: any) {
  const friendlyName = getFriendlyCollectionName(docId);
  if (!friendlyName) return;

  try {
    const col = db.collection(friendlyName);
    if (Array.isArray(data)) {
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

        const bulkOps = docsToInsert.map((doc: any) => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true
          }
        }));
        await col.bulkWrite(bulkOps);

        const activeIds = docsToInsert.map((d: any) => d._id);
        const isAppendOnly = ['facturas_ventas', 'kardex_movimientos', 'ajustes_inventario', 'cotizaciones_pedidos'].includes(friendlyName);
        if (!isAppendOnly) {
          await col.deleteMany({ _id: { $nin: activeIds } });
        }
      } else {
        const isAppendOnly = ['facturas_ventas', 'kardex_movimientos', 'ajustes_inventario', 'cotizaciones_pedidos'].includes(friendlyName);
        if (!isAppendOnly) {
          await col.deleteMany({});
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      const docKey = friendlyName === 'configuracion_empresa' ? 'general_config' : docId;
      await col.updateOne(
        { _id: docKey },
        { $set: { ...data, _syncedAt: new Date() } },
        { upsert: true }
      );
    } else {
      await col.updateOne(
        { _id: docId },
        { $set: { key: docId, value: data, _syncedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.warn(`[PostgreSQL Sync] Warning syncing to table '${friendlyName}':`, err?.message);
  }
}

export function sseEvents(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });

  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
}

export async function getStatus(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    await db.admin().ping();
    const cols = await db.listCollections();

    let totalDocs = 0;
    try {
      for (const c of cols) {
        totalDocs += await db.collection(c.name).countDocuments();
      }
    } catch {}

    return res.status(200).json({
      connected: true,
      engine: 'PostgreSQL 18 Relacional',
      uri: currentUri,
      dbName: currentDbName,
      collections: cols.map(c => c.name),
      totalDocs,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(200).json({
      connected: false,
      engine: 'PostgreSQL 18 Relacional',
      uri: currentUri,
      dbName: currentDbName,
      error: error.message || 'No se pudo conectar a PostgreSQL',
      timestamp: new Date().toISOString()
    });
  }
}

export async function testConnection(req: Request, res: Response) {
  try {
    const testUri = (req.body.uri || currentUri).trim();
    const testClient = new pg.Client({
      connectionString: testUri.includes('postgresql://') ? testUri : undefined,
      connectionTimeoutMillis: 3000
    });

    await testClient.connect();
    const result = await testClient.query('SELECT current_database(), version();');
    await testClient.end();

    return res.status(200).json({
      success: true,
      message: `Conexión exitosa con PostgreSQL`,
      database: result.rows[0]?.current_database,
      version: result.rows[0]?.version
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      message: error.message || 'Error al conectar con PostgreSQL',
      error: error.message
    });
  }
}

export async function getDoc(req: Request, res: Response) {
  const docId = decodeURIComponent(req.params.docId);
  try {
    const db = await getDatabase();
    // SEGURIDAD: Bloquear lectura del certificado digital y password por el canal de sync
    if (docId === 'ferreteria_settings_p12_base64' || docId === 'ferreteria_settings_p12_password') {
      return res.status(403).json({
        exists: false,
        message: 'Acceso denegado: El certificado .p12 y contraseña residen exclusivamente en el servidor seguro (/api/sri/certificate).'
      });
    }

    const doc = await db.collection('app_state').findOne({ _id: docId } as any);

    if (doc && doc.data !== undefined && (Array.isArray(doc.data) ? doc.data.length > 0 : true)) {
      let responseData = doc.data;
      // Requerimiento auditoría: La tabla de usuarios nunca viaja con passwords al navegador
      if (docId === 'ferreteria_settings_users_list' && Array.isArray(responseData)) {
        responseData = responseData.map((u: any) => {
          const { password, ...safe } = u;
          return safe;
        });
      }
      return res.status(200).json({ exists: true, data: responseData, updatedAt: doc.updatedAt });
    }

    const friendlyName = getFriendlyCollectionName(docId);
    if (friendlyName) {
      const friendlyCol = db.collection(friendlyName);
      const count = await friendlyCol.countDocuments();
      if (count > 0) {
        if (friendlyName === 'configuracion_empresa') {
          const confDoc = await friendlyCol.findOne({ _id: 'general_config' } as any);
          if (confDoc) {
            const { _id, _syncedAt, ...cleanData } = confDoc;
            await db.collection('app_state').updateOne(
              { _id: docId } as any,
              { $set: { data: cleanData, updatedAt: new Date() } },
              { upsert: true }
            );
            return res.status(200).json({ exists: true, data: cleanData, updatedAt: _syncedAt || new Date() });
          }
        } else if (friendlyName === 'configuracion_parametros') {
          const paramDoc = await friendlyCol.findOne({ _id: docId } as any);
          if (paramDoc && paramDoc.value !== undefined) {
            await db.collection('app_state').updateOne(
              { _id: docId } as any,
              { $set: { data: paramDoc.value, updatedAt: new Date() } },
              { upsert: true }
            );
            return res.status(200).json({ exists: true, data: paramDoc.value, updatedAt: paramDoc._syncedAt || new Date() });
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

          await db.collection('app_state').updateOne(
            { _id: docId } as any,
            { $set: { data: cleanItems, updatedAt: new Date() } },
            { upsert: true }
          );

          return res.status(200).json({ exists: true, data: cleanItems, updatedAt: new Date() });
        }
      }
    }

    if (doc && doc.data !== undefined) {
      return res.status(200).json({ exists: true, data: doc.data, updatedAt: doc.updatedAt });
    }

    return res.status(200).json({ exists: false, data: null });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function saveDoc(req: Request, res: Response) {
  const docId = decodeURIComponent(req.params.docId);
  try {
    const { data } = req.body;
    const db = await getDatabase();

    // CONTROL DE CONCURRENCIA: Si llega actualización de facturas vía docId, combinar sin borrar las de otras terminales
    let dataToSave = data;
    if (docId === 'ferreteria_invoices' && Array.isArray(data)) {
      const existing = await db.collection<any>('app_state').findOne({ _id: docId });
      if (existing && Array.isArray(existing.data)) {
        const incomingIds = new Set(data.map((d: any) => String(d.id || d._id)));
        const others = existing.data.filter((d: any) => !incomingIds.has(String(d.id || d._id)));
        dataToSave = [...data, ...others];
      }
    }

    await db.collection('app_state').updateOne(
      { _id: docId } as any,
      { $set: { data: dataToSave, updatedAt: new Date() } },
      { upsert: true }
    );

    await syncToFriendlyCompassCollection(db, docId, dataToSave);
    broadcastSse({ type: 'doc_updated', docId, data: dataToSave });

    return res.status(200).json({ success: true, docId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function syncAll(req: Request, res: Response) {
  try {
    const allData = req.body.data || {};
    const db = await getDatabase();

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

    broadcastSse({ type: 'all_synced', docIds });

    return res.status(200).json({
      success: true,
      message: `Se sincronizaron ${docIds.length} tablas con PostgreSQL exitosamente.`,
      collectionsSynced: docIds
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function pullAll(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const docs = await db.collection('app_state').find({}).toArray();

    const result: Record<string, any> = {};
    for (const d of docs) {
      result[String(d._id)] = d.data;
    }

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

    return res.status(200).json({
      success: true,
      data: result,
      count: Object.keys(result).length
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
