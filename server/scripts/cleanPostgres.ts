import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;

async function cleanPostgresForProduction() {
  const host = process.env.PGHOST || '127.0.0.1';
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || 'postgres';
  const targetDb = process.env.PGDATABASE || 'ferreteria_daynet';

  console.log(`\n======================================================`);
  console.log(`🧹 LIMPIEZA DE TABLAS TRANSACCIONALES POSTGRESQL`);
  console.log(`Host: ${host}:${port} | Base de Datos: ${targetDb}`);
  console.log(`======================================================\n`);

  const client = new Client({
    host,
    port,
    user,
    password,
    database: targetDb,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();

    // Tablas de movimientos/transaccionales de prueba para limpiar antes de producción
    const tablesToTruncate = [
      'facturas_ventas',
      'cola_sri',
      'kardex_movimientos',
      'asientos_contables',
      'caja_sesiones',
      'bitacora_auditoria'
    ];

    for (const t of tablesToTruncate) {
      try {
        await client.query(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE;`);
        console.log(`   ✓ Tabla '${t}' truncada.`);
      } catch (e: any) {
        // Si no existe la tabla relacional, intentar borrar de la tabla JSONB
        try {
          await client.query(`DELETE FROM "${t}";`);
          console.log(`   ✓ Tabla '${t}' limpiada.`);
        } catch {}
      }
    }

    console.log(`\n✅ Limpieza completada. Las tablas maestras (usuarios, roles, plan contable, parámetros) permanecen intactas.`);
  } catch (err: any) {
    console.error(`[PostgreSQL Clean Error]:`, err.message);
  } finally {
    await client.end();
  }
}

cleanPostgresForProduction();
