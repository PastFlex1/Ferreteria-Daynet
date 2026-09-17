const { MongoClient } = require('mongodb');

async function syncAllMongo() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('ferreteria_daynet');

  // Check and sync productos
  const prods = await db.collection('productos').find({}).toArray();
  console.log('Productos in Compass collection:', prods.length);

  const cleanProds = prods.map(p => {
    const { _syncedAt, ...clean } = p;
    clean.id = String(clean.id || clean._id);
    clean.sku = clean.sku || clean.code || clean._id;
    clean.costPrice = clean.costPrice ?? clean.cost ?? 0;
    return clean;
  });

  const updateOp = {};
  updateOp['$set'] = { data: cleanProds, updatedAt: new Date() };

  await db.collection('app_state').updateOne(
    { _id: 'ferreteria_products' },
    updateOp,
    { upsert: true }
  );

  console.log('Synchronized ferreteria_products into app_state successfully!');

  // Check and sync other essential collections into app_state if missing
  const collectionsMap = {
    ferreteria_categories: 'categorias_productos',
    ferreteria_units: 'unidades_medida',
    ferreteria_customers: 'clientes',
    ferreteria_suppliers: 'proveedores',
    ferreteria_taxes: 'tarifas_impuestos',
    ferreteria_settings_users_list: 'usuarios_sistema',
    ferreteria_settings_payment_methods: 'formas_pago'
  };

  for (const [docId, colName] of Object.entries(collectionsMap)) {
    const items = await db.collection(colName).find({}).toArray();
    if (items.length > 0) {
      const cleanItems = items.map(item => {
        const { _syncedAt, ...clean } = item;
        clean.id = String(clean.id || clean._id);
        return clean;
      });
      const op = {};
      op['$set'] = { data: cleanItems, updatedAt: new Date() };
      await db.collection('app_state').updateOne({ _id: docId }, op, { upsert: true });
      console.log(`Synced ${docId} (${cleanItems.length} items) into app_state.`);
    }
  }

  const appStateDocs = await db.collection('app_state').find({}).toArray();
  console.log('\nFinal app_state documents:', appStateDocs.map(d => d._id));

  await client.close();
}

syncAllMongo().catch(console.error);
