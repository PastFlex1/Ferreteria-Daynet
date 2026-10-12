import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function dumpTargets() {
  const client = await pool.connect();
  const res = await client.query(`
    SELECT id, data 
    FROM app_state 
    WHERE id IN ('ferreteria_products', 'ferreteria_invoices', 'ferreteria_customers', 'ferreteria_settings_users_list');
  `);
  for (const row of res.rows) {
    console.log(`=== ${row.id} ===`);
    console.log(JSON.stringify(row.data, null, 2).slice(0, 1000));
  }
  client.release();
  await pool.end();
}

dumpTargets();
