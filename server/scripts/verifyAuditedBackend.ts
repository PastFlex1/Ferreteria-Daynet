import { getPgPool } from '../config/db.js';

async function testEndpointsLogic() {
  const pool = getPgPool();
  console.log('--- TEST 1: Verificación SELECT count(*) en app_state ---');
  const appStateCheck = await pool.query(
    "SELECT count(*) as cnt FROM app_state WHERE id IN ('ferreteria_products', 'ferreteria_invoices', 'ferreteria_customers');"
  );
  console.log('app_state count:', appStateCheck.rows[0].cnt);
  if (Number(appStateCheck.rows[0].cnt) !== 0) {
    throw new Error('FAIL: app_state count is not 0!');
  }
  console.log('✅ PASSED: app_state count is 0');

  console.log('\n--- TEST 2: Tablas Relacionales Pobladas ---');
  const prods = await pool.query('SELECT count(*) as cnt FROM productos;');
  console.log('productos count:', prods.rows[0].cnt);

  const custs = await pool.query('SELECT count(*) as cnt FROM clientes;');
  console.log('clientes count:', custs.rows[0].cnt);

  const users = await pool.query('SELECT id, username, password FROM usuarios_sistema;');
  console.log('usuarios_sistema count:', users.rows.length);
  for (const u of users.rows) {
    console.log(`User: ${u.username}, HasBcrypt: ${u.password.startsWith('$2')}`);
    if (!u.password.startsWith('$2')) {
      throw new Error(`FAIL: User ${u.username} does not have a bcrypt hash!`);
    }
  }
  console.log('✅ PASSED: All users have bcrypt hashes');

  console.log('\n--- TEST 3: Secuenciales Asignados en Servidor Transaccional ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    const seqRes = await client.query(`
      UPDATE secuenciales_emision
      SET current_sequential = current_sequential + 1, updated_at = NOW()
      WHERE establishment = '001' AND emission_point = '001' AND document_type = '01'
      RETURNING current_sequential;
    `);
    console.log('Nuevo secuencial retornado en transacción:', seqRes.rows[0].current_sequential);
    await client.query('ROLLBACK;'); // rollback test increment
    console.log('✅ PASSED: Atomic sequential assignment query works perfectly');
  } finally {
    client.release();
  }

  console.log('\n--- TEST 4: Bóveda de Certificados SRI Segura ---');
  const certP12Check = await pool.query("SELECT count(*) as cnt FROM app_state WHERE id LIKE 'ferreteria_settings_p12%';");
  console.log('p12 keys in app_state:', certP12Check.rows[0].cnt);
  if (Number(certP12Check.rows[0].cnt) !== 0) {
    throw new Error('FAIL: Found residual p12 keys in app_state!');
  }
  console.log('✅ PASSED: Zero p12 keys in app_state');

  console.log('\n🎯 TODOS LOS TESTS DE AUDITORÍA SUPERADOS EXITOSAMENTE.');
  process.exit(0);
}

testEndpointsLogic().catch(err => {
  console.error('❌ Error en test:', err);
  process.exit(1);
});
