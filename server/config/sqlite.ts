import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio y archivo de persistencia local SQLite
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const sqliteFilePath = process.env.SQLITE_FILE 
  ? path.resolve(process.env.SQLITE_FILE) 
  : path.resolve(dataDir, 'ferreteria_daynet.sqlite');

export const currentDbName = path.basename(sqliteFilePath);
export const currentUri = `sqlite://${sqliteFilePath}`;

let dbInstance: sqlite3.Database | null = null;

/**
 * Obtiene la instancia singleton de la base de datos SQLite con WAL y Foreign Keys activos.
 */
export function getSqliteDb(): sqlite3.Database {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(sqliteFilePath, (err) => {
      if (err) {
        console.error('[SQLite Connection Error]:', err.message);
      }
    });

    // Activar soporte para claves foráneas y modo WAL para alta velocidad y concurrencia
    dbInstance.serialize(() => {
      dbInstance?.run('PRAGMA foreign_keys = ON;');
      dbInstance?.run('PRAGMA journal_mode = WAL;');
      dbInstance?.run('PRAGMA synchronous = NORMAL;');
    });
  }
  return dbInstance;
}

/**
 * Parsea campos de cadenas JSON automáticamente (data, items, permissions, etc.)
 * para mantener paridad 100% con los objetos retornados por PostgreSQL (JSONB).
 */
export function parseRow(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const parsed = { ...row };
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
      try {
        parsed[key] = JSON.parse(val);
      } catch {
        // Dejar como cadena si no es JSON válido
      }
    }
  }
  return parsed;
}

/**
 * Adapta consultas SQL de sintaxis PostgreSQL ($1, $2, ILIKE, NOW(), ::jsonb)
 * a sintaxis nativa de SQLite (?, LIKE, datetime(), etc.).
 */
export function normalizeSqlAndParams(sql: string, rawParams: any[] = []): { sql: string; params: any[] } {
  let adaptedSql = sql;
  const adaptedParams: any[] = [];

  // 1. Quitar operadores de casting de PostgreSQL (::jsonb, ::text, ::int, etc.)
  adaptedSql = adaptedSql.replace(/::[a-zA-Z0-9_]+/g, '');

  // 2. Mapear ILIKE a LIKE (SQLite LIKE es insensible a mayúsculas para caracteres ASCII)
  adaptedSql = adaptedSql.replace(/\bILIKE\b/gi, 'LIKE');

  // 3. Funciones de fecha PostgreSQL -> SQLite
  adaptedSql = adaptedSql.replace(/\bNOW\(\)/gi, "datetime('now', 'localtime')");

  // 4. Funciones de inspección de servidor PostgreSQL
  adaptedSql = adaptedSql.replace(/current_database\(\)/gi, `'${currentDbName}'`);
  adaptedSql = adaptedSql.replace(/version\(\)/gi, "'SQLite 3 (Embedded Local)'");

  // 5. Manejo de parámetros posicionales $1, $2, ...
  if (/\$[0-9]+/.test(adaptedSql)) {
    adaptedSql = adaptedSql.replace(/\$([0-9]+)/g, (_, numStr) => {
      const idx = parseInt(numStr, 10) - 1;
      let val = (rawParams && idx < rawParams.length) ? rawParams[idx] : null;

      if (val instanceof Date) {
        val = val.toISOString();
      } else if (typeof val === 'boolean') {
        val = val ? 1 : 0;
      } else if (val !== null && typeof val === 'object') {
        val = JSON.stringify(val);
      }

      adaptedParams.push(val);
      return '?';
    });
  } else if (rawParams && rawParams.length > 0) {
    for (let val of rawParams) {
      if (val instanceof Date) {
        val = val.toISOString();
      } else if (typeof val === 'boolean') {
        val = val ? 1 : 0;
      } else if (val !== null && typeof val === 'object') {
        val = JSON.stringify(val);
      }
      adaptedParams.push(val);
    }
  }

  return { sql: adaptedSql, params: adaptedParams };
}

/**
 * Ejecuta una consulta SQL en SQLite devolviendo una estructura equivalente a pg.QueryResult.
 */
export async function executeSqliteQuery(sqlText: string, rawParams: any[] = []): Promise<{ rows: any[]; rowCount: number; command: string }> {
  const db = getSqliteDb();
  const trimmed = sqlText.trim();

  // Control de transacciones atómicas directas
  if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(trimmed)) {
    return new Promise((resolve, reject) => {
      db.run(trimmed, (err) => {
        if (err) return reject(err);
        resolve({ rows: [], rowCount: 0, command: trimmed.split(' ')[0].toUpperCase() });
      });
    });
  }

  const { sql, params } = normalizeSqlAndParams(sqlText, rawParams);
  const isSelectOrReturning = /^(SELECT|WITH|PRAGMA)/i.test(sql.trim()) || /RETURNING/i.test(sql);

  if (isSelectOrReturning) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows: any[]) => {
        if (err) return reject(err);
        const parsedRows = (rows || []).map(r => parseRow(r));
        resolve({
          rows: parsedRows,
          rowCount: parsedRows.length,
          command: sql.trim().split(' ')[0].toUpperCase()
        });
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({
          rows: [],
          rowCount: this.changes || 0,
          command: sql.trim().split(' ')[0].toUpperCase()
        });
      });
    });
  }
}

/**
 * Emula el Pool de PostgreSQL para que los controladores no requieran ningún cambio en sus llamadas.
 */
class SqlitePool {
  async query(sqlText: string, params?: any[]): Promise<{ rows: any[]; rowCount: number; command: string }> {
    return executeSqliteQuery(sqlText, params);
  }

  async connect() {
    return {
      query: (sqlText: string, params?: any[]) => executeSqliteQuery(sqlText, params),
      release: () => {}
    };
  }

  on(_event: string, _callback: Function) {
    return this;
  }

  async end(): Promise<void> {
    if (dbInstance) {
      return new Promise((resolve) => {
        dbInstance?.close(() => {
          dbInstance = null;
          resolve();
        });
      });
    }
  }
}

const sqlitePoolInstance = new SqlitePool();

export function getSqlitePool() {
  return sqlitePoolInstance;
}

// Alias para compatibilidad transparente con todo el código que importa getPgPool
export const getPgPool = getSqlitePool;

/**
 * Inicializa el esquema DDL formal en SQLite desde server/sql/schema.sqlite.sql
 */
export async function initializeSqliteSchema(): Promise<void> {
  const db = getSqliteDb();
  try {
    const schemaPath = path.resolve(__dirname, '../sql/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await new Promise<void>((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      console.log('[SQLite] ✓ Esquema relacional DDL verificado y actualizado con éxito en:', sqliteFilePath);
    }
  } catch (err: any) {
    console.warn('[SQLite Schema Warning]:', err.message);
  }
}

// Alias para compatibilidad con llamadas existentes
export const initializePostgresSchema = initializeSqliteSchema;

/**
 * Interfaz de colección compatible para consultas de tipo Mongo/CouchDB sobre SQLite.
 */
class SqliteCollection {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private async ensureTable(): Promise<void> {
    const ddl = `
      CREATE TABLE IF NOT EXISTS "${this.tableName}" (
        id TEXT PRIMARY KEY,
        data TEXT DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `;
    const db = getSqliteDb();
    return new Promise((resolve) => {
      db.exec(ddl, () => resolve());
    });
  }

  async findOne(filter: any): Promise<any> {
    await this.ensureTable();
    try {
      if (!filter || Object.keys(filter).length === 0) {
        const res = await executeSqliteQuery(`SELECT data, updated_at FROM "${this.tableName}" LIMIT 1`);
        if (res.rows.length === 0) return null;
        const dataObj = typeof res.rows[0].data === 'string' ? JSON.parse(res.rows[0].data) : res.rows[0].data;
        return { ...dataObj, updatedAt: res.rows[0].updated_at };
      }

      const targetId = filter._id || filter.id;
      if (typeof targetId === 'string' && Object.keys(filter).length === 1) {
        const res = await executeSqliteQuery(`SELECT data, updated_at FROM "${this.tableName}" WHERE id = $1`, [targetId]);
        if (res.rows.length === 0) return null;
        const dataObj = typeof res.rows[0].data === 'string' ? JSON.parse(res.rows[0].data) : res.rows[0].data;
        return { ...dataObj, updatedAt: res.rows[0].updated_at };
      }

      const docs = await this.find(filter).toArray();
      return docs.length > 0 ? docs[0] : null;
    } catch (err: any) {
      console.warn(`[SQLite findOne Warning on ${this.tableName}]:`, err.message);
      return null;
    }
  }

  find(filter: any = {}) {
    const collection = this;
    let sortObj: any = null;
    let limitVal: number | null = null;

    return {
      sort(s: any) {
        sortObj = s;
        return this;
      },
      limit(l: number) {
        limitVal = l;
        return this;
      },
      async toArray(): Promise<any[]> {
        await collection.ensureTable();
        try {
          const res = await executeSqliteQuery(`SELECT id, data, updated_at FROM "${collection.tableName}"`);
          let results = res.rows.map(r => {
            const dataObj = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {});
            return { ...dataObj, _id: r.id, id: r.id, updatedAt: r.updated_at };
          });

          // Filtrado en memoria
          if (filter && Object.keys(filter).length > 0) {
            results = results.filter(item => {
              if (filter._id && item._id !== filter._id && item.id !== filter._id) return false;
              if (filter.id && item.id !== filter.id && item._id !== filter.id) return false;
              if (filter.status && item.status !== filter.status) return false;
              if (filter.estado && item.estado !== filter.estado) return false;
              if (filter.emissionPoint && item.emissionPoint !== filter.emissionPoint) return false;
              if (filter.$or && Array.isArray(filter.$or)) {
                return filter.$or.some((cond: any) => {
                  return Object.entries(cond).some(([k, v]) => item[k] === v);
                });
              }
              return true;
            });
          }

          // Ordenamiento
          if (sortObj) {
            const [field, dir] = Object.entries(sortObj)[0] as [string, any];
            results.sort((a, b) => {
              const va = a[field] || '';
              const vb = b[field] || '';
              const comp = va > vb ? 1 : va < vb ? -1 : 0;
              return dir === -1 ? -comp : comp;
            });
          }

          if (limitVal !== null && limitVal > 0) {
            results = results.slice(0, limitVal);
          }

          return results;
        } catch (err: any) {
          console.warn(`[SQLite find toArray Warning on ${collection.tableName}]:`, err.message);
          return [];
        }
      }
    };
  }

  async updateOne(filter: any, update: any, _options: { upsert?: boolean } = {}): Promise<any> {
    await this.ensureTable();
    try {
      const id = String(filter._id || filter.id || (filter.$or ? filter.$or[0]?._id || filter.$or[0]?.id : '') || `item-${Date.now()}`);
      let payload: any = {};

      if (update.$set) {
        payload = { ...payload, ...update.$set };
      } else if (update.$setOnInsert) {
        payload = { ...payload, ...update.$setOnInsert };
      } else {
        payload = update;
      }

      if (update.$inc) {
        const existing = await this.findOne({ _id: id });
        for (const [incKey, incVal] of Object.entries(update.$inc)) {
          const currentVal = Number(existing ? existing[incKey] || 0 : 0);
          payload[incKey] = currentVal + Number(incVal);
        }
      }

      payload._id = id;
      payload.id = id;

      const query = `
        INSERT INTO "${this.tableName}" (id, data, updated_at)
        VALUES ($1, $2, datetime('now', 'localtime'))
        ON CONFLICT (id) DO UPDATE
        SET data = $2, updated_at = datetime('now', 'localtime');
      `;

      const res = await executeSqliteQuery(query, [id, JSON.stringify(payload)]);
      return { acknowledged: true, modifiedCount: 1, upsertedCount: res.rowCount };
    } catch (err: any) {
      console.warn(`[SQLite updateOne Warning on ${this.tableName}]:`, err.message);
      return { acknowledged: false, error: err.message };
    }
  }

  async findOneAndUpdate(filter: any, update: any, options: any = {}): Promise<any> {
    await this.updateOne(filter, update, { upsert: true });
    const id = filter._id || filter.id;
    const doc = await this.findOne({ _id: id });
    return { value: doc };
  }

  async insertOne(doc: any): Promise<any> {
    const id = String(doc._id || doc.id || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    const clean = { ...doc, _id: id, id };
    return this.updateOne({ _id: id }, { $set: clean }, { upsert: true });
  }

  async bulkWrite(ops: any[]): Promise<any> {
    for (const op of ops) {
      if (op.replaceOne) {
        await this.updateOne(op.replaceOne.filter, { $set: op.replaceOne.replacement }, { upsert: op.replaceOne.upsert });
      } else if (op.updateOne) {
        await this.updateOne(op.updateOne.filter, op.updateOne.update, { upsert: op.updateOne.upsert });
      } else if (op.insertOne) {
        await this.insertOne(op.insertOne.document);
      }
    }
    return { acknowledged: true, insertedCount: ops.length };
  }

  async deleteOne(filter: any): Promise<any> {
    await this.ensureTable();
    const id = filter._id || filter.id;
    if (id) {
      const res = await executeSqliteQuery(`DELETE FROM "${this.tableName}" WHERE id = $1`, [id]);
      return { deletedCount: res.rowCount };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(filter: any = {}): Promise<any> {
    await this.ensureTable();
    if (filter._id && filter._id.$nin) {
      const activeIds = filter._id.$nin as string[];
      if (activeIds.length === 0) {
        const res = await executeSqliteQuery(`DELETE FROM "${this.tableName}"`);
        return { deletedCount: res.rowCount };
      }
      const placeholders = activeIds.map((_, i) => `$${i + 1}`).join(', ');
      const res = await executeSqliteQuery(`DELETE FROM "${this.tableName}" WHERE id NOT IN (${placeholders})`, activeIds);
      return { deletedCount: res.rowCount };
    }
    if (!filter || Object.keys(filter).length === 0) {
      const res = await executeSqliteQuery(`DELETE FROM "${this.tableName}"`);
      return { deletedCount: res.rowCount };
    }
    return { deletedCount: 0 };
  }

  async countDocuments(_filter: any = {}): Promise<number> {
    await this.ensureTable();
    try {
      const res = await executeSqliteQuery(`SELECT COUNT(*) as count FROM "${this.tableName}"`);
      return parseInt(res.rows[0]?.count, 10) || 0;
    } catch {
      return 0;
    }
  }
}

/**
 * Cliente de Base de Datos SQLite Unificado para Ferretería Daynet:
 * 100% SQLite con tablas nativas, control de concurrencia ACID y almacenamiento offline.
 */
export class SqliteDatabase {
  public databaseName: string;

  constructor(databaseName: string) {
    this.databaseName = databaseName;
  }

  collection<T = any>(collectionName: string): SqliteCollection {
    return new SqliteCollection(collectionName);
  }

  async query(sqlText: string, params?: any[]): Promise<{ rows: any[]; rowCount: number; command: string }> {
    return executeSqliteQuery(sqlText, params);
  }

  async listCollections(): Promise<{ name: string }[]> {
    try {
      const res = await executeSqliteQuery(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
      `);
      return res.rows;
    } catch {
      return [];
    }
  }

  admin() {
    return {
      async ping() {
        await executeSqliteQuery('SELECT 1;');
        return true;
      }
    };
  }
}

// Alias para mantener compatibilidad con tipos y clases anteriores
export { SqliteDatabase as PostgresDatabase };
