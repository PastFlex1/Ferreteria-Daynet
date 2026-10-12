const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://tbuser1:Kgg3nljw3V96Lq2J04ol6YKIX19AxI1S@2.31.13.25:12707/app_db'
});

(async () => {
  await client.connect();
  try {
    const res = await client.query(`
      INSERT INTO "productos" (id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      RETURNING *;
    `, ['TEST-1', JSON.stringify({ name: 'Martillo', price: 10 })]);
    console.log('Success:', res.rows[0]);
  } catch (err) {
    console.error('EXPECTED_ERROR:', err.message);
  }
  await client.end();
})();
