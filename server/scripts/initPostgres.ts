import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initPostgres() {
  const host = process.env.PGHOST || '127.0.0.1';
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || 'postgres';
  const targetDb = process.env.PGDATABASE || 'ferreteria_daynet';

  console.log(`\n======================================================`);
  console.log(`🐘 INICIALIZADOR DE BASE DE DATOS POSTGRESQL 18`);
  console.log(`Host: ${host}:${port} | Usuario: ${user} | DB: ${targetDb}`);
  console.log(`======================================================\n`);

  // Paso 1: Conectar a la base de datos 'postgres' del sistema para crear targetDb si no existe
  const sysClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    connectionTimeoutMillis: 5000
  });

  try {
    await sysClient.connect();
    console.log(`[PostgreSQL] ✓ Conexión inicial al servidor exitosa.`);

    const checkDbRes = await sysClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1;`,
      [targetDb]
    );

    if (checkDbRes.rows.length === 0) {
      console.log(`[PostgreSQL] Creando base de datos '${targetDb}'...`);
      await sysClient.query(`CREATE DATABASE "${targetDb}";`);
      console.log(`[PostgreSQL] ✓ Base de datos '${targetDb}' creada exitosamente.`);
    } else {
      console.log(`[PostgreSQL] ✓ Base de datos '${targetDb}' ya existe.`);
    }
  } catch (err: any) {
    console.warn(`[PostgreSQL Advertencia en verificación inicial]:`, err.message);
  } finally {
    try {
      await sysClient.end();
    } catch {}
  }

  // Paso 2: Conectar directamente a targetDb y aplicar schema.sql
  const appClient = new Client({
    host,
    port,
    user,
    password,
    database: targetDb,
    connectionTimeoutMillis: 5000
  });

  try {
    await appClient.connect();
    console.log(`[PostgreSQL] Conectado a '${targetDb}'. Aplicando esquema DDL relacional...`);

    const schemaPath = path.resolve(__dirname, '../sql/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await appClient.query(sql);
      console.log(`[PostgreSQL] ✓ Esquema formal DDL ejecutado con éxito (tablas, índices, claves primarias y JSONB).`);
    } else {
      console.warn(`[PostgreSQL] No se encontró el archivo schema.sql en: ${schemaPath}`);
    }

    const tablesRes = await appClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`\n📋 Tablas activas en PostgreSQL (${tablesRes.rows.length}):`);
    tablesRes.rows.forEach(r => console.log(`   - ${r.table_name}`));

    console.log(`\n🎉 ¡PostgreSQL 18 inicializado y listo para Ferretería Daynet!`);
  } catch (err: any) {
    console.error(`[PostgreSQL Error aplicando esquema]:`, err.message);
    process.exit(1);
  } finally {
    await appClient.end();
  }
}

initPostgres();
