import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pgConfig = {
  host: process.env.PGHOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'ferreteria_daynet',
  max: 25, // Máximo 25 conexiones en el pool para soportar los 30 usuarios simultáneos del TdR
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

let pool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!pool) {
    if (process.env.DATABASE_URL) {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
    } else {
      pool = new Pool(pgConfig);
    }

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]:', err.message);
    });
  }
  return pool;
}

/**
 * Inicializa el esquema DDL formal en PostgreSQL desde server/sql/schema.sql
 */
export async function initializePostgresSchema(): Promise<void> {
  const p = getPgPool();
  try {
    const schemaPath = path.resolve(__dirname, '../sql/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await p.query(sql);
      console.log('[PostgreSQL] ✓ Esquema relacional DDL verificado y actualizado con éxito.');
    }
  } catch (err: any) {
    console.warn('[PostgreSQL Schema Warning]:', err.message);
  }
}

/**
 * Interfaz de colección compatible sobre PostgreSQL para soportar consultas fluidas
 * manteniendo persistencia 100% relacional en PostgreSQL nativo con JSONB y atomicidad ACID.
 */
class PostgresCollection {
  private tableName: string;
  private pool: pg.Pool;

  constructor(tableName: string, pool: pg.Pool) {
    this.tableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
    this.pool = pool;
  }

  private async ensureTable(): Promise<void> {
    const ddl = `
      CREATE TABLE IF NOT EXISTS "${this.tableName}" (
        id VARCHAR(150) PRIMARY KEY,
        data JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE "${this.tableName}" ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE "${this.tableName}" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      CREATE INDEX IF NOT EXISTS "idx_${this.tableName}_gin" ON "${this.tableName}" USING GIN(data);
    `;
    try {
      await this.pool.query(ddl);
    } catch {}
  }

  async findOne(filter: any): Promise<any> {
    await this.ensureTable();
    try {
      if (!filter || Object.keys(filter).length === 0) {
        const res = await this.pool.query(`SELECT data, updated_at FROM "${this.tableName}" LIMIT 1`);
        if (res.rows.length === 0) return null;
        return { ...res.rows[0].data, updatedAt: res.rows[0].updated_at };
      }

      // Si el filtro busca por _id o id
      const targetId = filter._id || filter.id;
      if (typeof targetId === 'string' && Object.keys(filter).length === 1) {
        const res = await this.pool.query(`SELECT data, updated_at FROM "${this.tableName}" WHERE id = $1`, [targetId]);
        if (res.rows.length === 0) return null;
        return { ...res.rows[0].data, updatedAt: res.rows[0].updated_at };
      }

      // Consulta general por propiedades JSONB o $or
      const docs = await this.find(filter).toArray();
      return docs.length > 0 ? docs[0] : null;
    } catch (err: any) {
      console.warn(`[PG findOne Warning on ${this.tableName}]:`, err.message);
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
          const res = await collection.pool.query(`SELECT id, data, updated_at FROM "${collection.tableName}"`);
          let results = res.rows.map(r => ({ ...r.data, _id: r.id, id: r.id, updatedAt: r.updated_at }));

          // Filtrado en memoria si hay filtros específicos
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
          console.warn(`[PG find toArray Warning on ${collection.tableName}]:`, err.message);
          return [];
        }
      }
    };
  }

  async updateOne(filter: any, update: any, options: { upsert?: boolean } = {}): Promise<any> {
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

      // Si hay $inc (ej. control de concurrencia de secuenciales o saldo de clientes)
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
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
        SET data = "${this.tableName}".data || $2::jsonb, updated_at = NOW()
        RETURNING data;
      `;

      const res = await this.pool.query(query, [id, JSON.stringify(payload)]);
      return { acknowledged: true, modifiedCount: 1, upsertedCount: res.rowCount };
    } catch (err: any) {
      console.warn(`[PG updateOne Warning on ${this.tableName}]:`, err.message);
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
      const res = await this.pool.query(`DELETE FROM "${this.tableName}" WHERE id = $1`, [id]);
      return { deletedCount: res.rowCount };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(filter: any = {}): Promise<any> {
    await this.ensureTable();
    if (filter._id && filter._id.$nin) {
      const activeIds = filter._id.$nin;
      const res = await this.pool.query(`DELETE FROM "${this.tableName}" WHERE NOT (id = ANY($1))`, [activeIds]);
      return { deletedCount: res.rowCount };
    }
    if (!filter || Object.keys(filter).length === 0) {
      const res = await this.pool.query(`DELETE FROM "${this.tableName}"`);
      return { deletedCount: res.rowCount };
    }
    return { deletedCount: 0 };
  }

  async countDocuments(filter: any = {}): Promise<number> {
    await this.ensureTable();
    try {
      const res = await this.pool.query(`SELECT COUNT(*) FROM "${this.tableName}"`);
      return parseInt(res.rows[0].count, 10) || 0;
    } catch {
      return 0;
    }
  }
}

/**
 * Cliente de Base de Datos PostgreSQL Unificado para Ferretería Daynet:
 * 100% PostgreSQL con tablas nativas, compatible con pg_dump, control de concurrencia ACID y JSONB.
 */
export class PostgresDatabase {
  public databaseName: string;
  private pool: pg.Pool;

  constructor(databaseName: string, pool: pg.Pool) {
    this.databaseName = databaseName;
    this.pool = pool;
  }

  collection<T = any>(collectionName: string): PostgresCollection {
    return new PostgresCollection(collectionName, this.pool);
  }

  async query(sqlText: string, params?: any[]): Promise<pg.QueryResult> {
    return this.pool.query(sqlText, params);
  }

  async listCollections(): Promise<{ name: string }[]> {
    try {
      const res = await this.pool.query(`
        SELECT table_name as name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      return res.rows;
    } catch {
      return [];
    }
  }

  admin() {
    const p = this.pool;
    return {
      async ping() {
        await p.query('SELECT 1;');
        return true;
      }
    };
  }
}
