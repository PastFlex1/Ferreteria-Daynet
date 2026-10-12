import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function checkAppState() {
  const client = await pool.connect();
  const res = await client.query('SELECT id, pg_typeof(data) as type, jsonb_typeof(data) as jtype FROM app_state;');
  console.log('Rows in app_state:');
  console.table(res.rows);

  const targetRes = await client.query(`
    SELECT id, 
           CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END as item_count
    FROM app_state 
    WHERE id IN ('ferreteria_products', 'ferreteria_invoices', 'ferreteria_customers', 'ferreteria_settings_users_list');
  `);
  console.log('\nTarget rows in app_state:');
  console.table(targetRes.rows);

  client.release();
  await pool.end();
}

checkAppState();
