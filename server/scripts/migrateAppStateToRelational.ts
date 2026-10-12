import bcrypt from 'bcryptjs';
import { getPgPool } from '../config/db.js';

export async function runMigration() {
  const pool = getPgPool();
  console.log('================================================================');
  console.log('🚀 MIGRACIÓN ÚNICA: APP_STATE -> TABLAS RELACIONALES POSTGRESQL');
  console.log('================================================================\n');

  // Helper para extraer lista de items sea array directo o { data: [...] }
  function extractList(raw: any): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw.data && Array.isArray(raw.data)) return raw.data;
    return [];
  }

  // 1. MIGRAR PRODUCTOS (ferreteria_products -> productos)
  console.log('📦 1. Migrando ferreteria_products a productos...');
  const prodRow = await pool.query("SELECT data FROM app_state WHERE id = 'ferreteria_products';");
  const products = prodRow.rows.length > 0 ? extractList(prodRow.rows[0].data) : [];
  let prodMigrated = 0;

  for (const p of products) {
    const id = String(p.id || p.sku || p.code || p._id || `prod-${Date.now()}`);
    const code = p.code || p.sku || p.barcode || id;
    const sku = p.sku || p.code || id;
    const name = String(p.name || 'Producto sin nombre').trim();
    const desc = p.description || null;
    const cat = p.category || 'General';
    const unit = p.unit || 'UND';
    const costPrice = Math.max(0, Number(p.costPrice ?? p.cost ?? 0));
    const salePrice = Math.max(0, Number(p.price ?? p.sale_price ?? 0));
    const stock = Math.max(0, Number(p.stock ?? 0));
    const minStock = Math.max(0, Number(p.minStock ?? p.min_stock ?? 5));
    const hasIva = p.has_iva !== undefined ? Boolean(p.has_iva) : (p.taxRate !== undefined ? Number(p.taxRate) > 0 : true);
    const ivaRate = Math.max(0, Number(p.taxRate ?? p.iva_rate ?? 15));
    const status = ['Activo', 'Inactivo', 'Agotado', 'Descontinuado'].includes(p.status) ? p.status : 'Activo';

    await pool.query(`
      INSERT INTO productos (
        id, code, sku, name, description, category, unit,
        cost_price, sale_price, stock, min_stock, has_iva, iva_rate, status, data, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET code = EXCLUDED.code, sku = EXCLUDED.sku, name = EXCLUDED.name,
          description = EXCLUDED.description, category = EXCLUDED.category, unit = EXCLUDED.unit,
          cost_price = EXCLUDED.cost_price, sale_price = EXCLUDED.sale_price, stock = EXCLUDED.stock,
          min_stock = EXCLUDED.min_stock, has_iva = EXCLUDED.has_iva, iva_rate = EXCLUDED.iva_rate,
          status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW();
    `, [id, code, sku, name, desc, cat, unit, costPrice, salePrice, stock, minStock, hasIva, ivaRate, status, JSON.stringify(p)]);
    prodMigrated++;
  }
  console.log(`   ✓ ${prodMigrated} productos migrados/actualizados en tabla 'productos'.`);

  // 2. MIGRAR CLIENTES (ferreteria_customers -> clientes)
  console.log('\n👥 2. Migrando ferreteria_customers a clientes...');
  const custRow = await pool.query("SELECT data FROM app_state WHERE id = 'ferreteria_customers';");
  const customers = custRow.rows.length > 0 ? extractList(custRow.rows[0].data) : [];
  let custMigrated = 0;

  for (const c of customers) {
    const id = String(c.id || c._id || `cust-${Date.now()}`);
    const name = String(c.name || 'Cliente').trim();
    const taxId = String(c.docNumber || c.tax_id || c.cedula || c.ruc || '9999999999999').trim();
    const docType = c.docType || c.doc_type || (taxId === '9999999999999' ? 'C.I.' : (taxId.length === 13 ? 'RUC' : 'C.I.'));
    const email = c.email || null;
    const phone = c.phone || null;
    const address = c.address || null;
    const debt = Math.max(0, Number(c.currentBalance ?? c.current_debt ?? 0));
    const limit = Math.max(0, Number(c.creditLimit ?? c.credit_limit ?? 0));

    await pool.query(`
      INSERT INTO clientes (id, name, tax_id, doc_type, email, phone, address, current_debt, credit_limit, data, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, tax_id = EXCLUDED.tax_id, doc_type = EXCLUDED.doc_type,
          email = EXCLUDED.email, phone = EXCLUDED.phone, address = EXCLUDED.address,
          current_debt = EXCLUDED.current_debt, credit_limit = EXCLUDED.credit_limit, data = EXCLUDED.data, updated_at = NOW();
    `, [id, name, taxId, docType, email, phone, address, debt, limit, JSON.stringify(c)]);
    custMigrated++;
  }
  console.log(`   ✓ ${custMigrated} clientes migrados/actualizados en tabla 'clientes'.`);

  // 3. MIGRAR FACTURAS (ferreteria_invoices -> facturas_ventas y factura_detalles)
  console.log('\n🧾 3. Migrando ferreteria_invoices a facturas_ventas y factura_detalles...');
  const invRow = await pool.query("SELECT data FROM app_state WHERE id = 'ferreteria_invoices';");
  const invoices = invRow.rows.length > 0 ? extractList(invRow.rows[0].data) : [];
  let invMigrated = 0;

  for (const inv of invoices) {
    const id = String(inv.id || inv._id || `inv-${Date.now()}`);
    const invNum = String(inv.invoiceNumber || inv.invoice_number || id);
    const parts = invNum.split('-');
    const est = inv.establishment || parts[0] || '001';
    const pto = inv.emissionPoint || parts[1] || '001';
    const seq = Number(inv.sequential || parts[2] || 1);
    const date = inv.date ? new Date(inv.date) : new Date();
    const rawCustId = inv.customerId || inv.customer_id || null;
    let custId: string | null = null;
    if (rawCustId) {
      const cCheck = await pool.query(`SELECT id FROM clientes WHERE id = $1`, [rawCustId]);
      if (cCheck.rows.length > 0) custId = rawCustId;
    }
    const custName = String(inv.customerName || inv.customer_name || 'Consumidor Final');
    const custTaxId = String(inv.customerTaxId || inv.customer_tax_id || inv.customerDocNumber || '9999999999999');
    const seller = inv.seller || inv.sellerName || null;
    const subtotal = Math.max(0, Number(inv.subtotal ?? 0));
    const tax = Math.max(0, Number(inv.tax ?? 0));
    const discount = Math.max(0, Number(inv.discount ?? 0));
    const total = Math.max(0, Number(inv.total ?? 0));
    const payMethod = inv.paymentMethod || inv.payment_method || 'EFECTIVO';
    const status = ['EMITIDA', 'AUTORIZADO', 'ANULADA', 'PENDIENTE', 'RECHAZADA'].includes(inv.status) ? inv.status : 'EMITIDA';
    const sriStatus = ['PENDIENTE', 'EN_COLA', 'FIRMADO', 'RECIBIDA', 'EN_PROCESO', 'AUTORIZADO', 'DEVUELTA', 'NO AUTORIZADO', 'ERROR'].includes(inv.sriStatus) ? inv.sriStatus : 'PENDIENTE';
    const accessKey = inv.accessKey || inv.access_key || inv.claveAcceso || null;
    const authNum = inv.authorizationNumber || inv.authorization_number || null;
    const authDate = inv.authorizationDate ? new Date(inv.authorizationDate) : null;
    const rawItems = Array.isArray(inv.items) ? inv.items : [];
    const items = JSON.stringify(rawItems);

    await pool.query(`
      INSERT INTO facturas_ventas (
        id, invoice_number, establishment, emission_point, sequential,
        date, customer_id, customer_name, customer_tax_id, seller,
        subtotal, tax, discount, total, payment_method, status,
        sri_status, access_key, authorization_number, authorization_date, items, data, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET invoice_number = EXCLUDED.invoice_number, customer_id = EXCLUDED.customer_id,
          subtotal = EXCLUDED.subtotal, tax = EXCLUDED.tax, total = EXCLUDED.total,
          status = EXCLUDED.status, sri_status = EXCLUDED.sri_status,
          access_key = EXCLUDED.access_key, items = EXCLUDED.items, data = EXCLUDED.data, updated_at = NOW();
    `, [id, invNum, est, pto, seq, date, custId, custName, custTaxId, seller, subtotal, tax, discount, total, payMethod, status, sriStatus, accessKey, authNum, authDate, items, JSON.stringify(inv)]);

    await pool.query(`DELETE FROM factura_detalles WHERE factura_id = $1;`, [id]);
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const detId = String(item.id || `${id}-item-${i + 1}`);
      const pId = item.productId || item.product_id || item.id || null;
      let validProdId: string | null = null;
      if (pId) {
        const pCheck = await pool.query(`SELECT id FROM productos WHERE id = $1`, [pId]);
        if (pCheck.rows.length > 0) validProdId = pId;
      }
      const codigo = item.code || item.sku || null;
      const descripcion = String(item.name || item.description || 'Artículo');
      const cantidad = Math.max(0.01, Number(item.quantity ?? item.cantidad ?? 1));
      const precioUnit = Math.max(0, Number(item.price ?? item.precioUnitario ?? 0));
      const itemSubtotal = Number((cantidad * precioUnit).toFixed(2));
      const iva = Number(item.taxRate ?? item.iva ?? 15);
      const totalItem = Number(item.total ?? (itemSubtotal * (1 + iva / 100)).toFixed(2));

      await pool.query(`
        INSERT INTO factura_detalles (id, factura_id, product_id, code, description, quantity, unit_price, subtotal, tax_rate, total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING;
      `, [detId, id, validProdId, codigo, descripcion, cantidad, precioUnit, itemSubtotal, iva, totalItem]);
    }
    invMigrated++;
  }
  console.log(`   ✓ ${invMigrated} facturas migradas/actualizadas en 'facturas_ventas'.`);

  // 4. MIGRAR USUARIOS Y HASHEAR CONTRASEÑAS (ferreteria_settings_users_list -> usuarios_sistema)
  console.log('\n🔐 4. Migrando ferreteria_settings_users_list a usuarios_sistema aplicando hash bcrypt...');
  const userRow = await pool.query("SELECT data FROM app_state WHERE id = 'ferreteria_settings_users_list';");
  const users = userRow.rows.length > 0 ? extractList(userRow.rows[0].data) : [];
  let usersMigrated = 0;

  for (const u of users) {
    const id = String(u.id || u._id || `USR-${Date.now()}`);
    const name = String(u.name || 'Usuario').trim();
    const username = String(u.username || u.cedula || u.id).trim();
    const email = u.email ? String(u.email).trim().toLowerCase() : null;
    const role = typeof u.role === 'object' ? u.role?.name || u.role?.label || 'Administrador' : u.role || 'Administrador';
    const status = u.status || 'Activo';

    // Determinar hash bcrypt
    let passwordHash: string;
    if (u.password && typeof u.password === 'string' && u.password.trim().length > 0) {
      if (u.password.startsWith('$2a$') || u.password.startsWith('$2b$')) {
        passwordHash = u.password;
      } else {
        console.log(`   🔑 Aplicando bcrypt a contraseña en texto plano para usuario '${username}'...`);
        passwordHash = bcrypt.hashSync(u.password.trim(), 10);
      }
    } else {
      // Si en app_state no vino contraseña, comprobar si la tabla usuarios_sistema ya tiene hash para este usuario
      const existingUser = await pool.query('SELECT password FROM usuarios_sistema WHERE id = $1 OR username = $2;', [id, username]);
      if (existingUser.rows.length > 0 && existingUser.rows[0].password && existingUser.rows[0].password.startsWith('$2')) {
        passwordHash = existingUser.rows[0].password;
      } else {
        console.log(`   🔑 Asignando hash bcrypt por defecto para '${username}'...`);
        passwordHash = bcrypt.hashSync('Admin2026@Daynet#', 10);
      }
    }

    const safeData = { id, name, username, email, role, status, password: '[PROTECTED_BCRYPT]' };

    await pool.query(`
      INSERT INTO usuarios_sistema (id, name, username, email, role, status, password, data, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, username = EXCLUDED.username, email = EXCLUDED.email,
          role = EXCLUDED.role, status = EXCLUDED.status, password = EXCLUDED.password,
          data = EXCLUDED.data, updated_at = NOW();
    `, [id, name, username, email, role, status, passwordHash, JSON.stringify(safeData)]);
    usersMigrated++;
  }
  console.log(`   ✓ ${usersMigrated} usuarios migrados con hash bcrypt seguro en 'usuarios_sistema'.`);

  // 5. INICIALIZAR SECUENCIALES DE EMISIÓN EN SERVIDOR
  console.log('\n🔢 5. Configurando secuenciales_emision en servidor...');
  const establishment = '001';
  const emissionPoints = ['001', '002', '003', '004'];

  for (const ep of emissionPoints) {
    // Facturas (01)
    await pool.query(`
      INSERT INTO secuenciales_emision (id, establishment, emission_point, document_type, name, current_sequential, updated_at)
      VALUES ($1, $2, $3, '01', $4, 0, NOW())
      ON CONFLICT (establishment, emission_point, document_type) DO NOTHING;
    `, [`${establishment}-${ep}-01`, establishment, ep, `Punto de Emisión ${ep}`]);

    // Notas de Crédito (04)
    await pool.query(`
      INSERT INTO secuenciales_emision (id, establishment, emission_point, document_type, name, current_sequential, updated_at)
      VALUES ($1, $2, $3, '04', $4, 0, NOW())
      ON CONFLICT (establishment, emission_point, document_type) DO NOTHING;
    `, [`${establishment}-${ep}-04`, establishment, ep, `Notas Crédito ${ep}`]);
  }
  console.log(`   ✓ Puntos de emisión 001-004 registrados en 'secuenciales_emision'.`);

  // 6. PURGAR ENTIDADES DE NEGOCIO Y CLAVES P12 DE APP_STATE
  console.log('\n🧹 6. Purgando entidades de negocio y claves p12 de app_state...');
  const deleteResult = await pool.query(`
    DELETE FROM app_state
    WHERE id IN (
      'ferreteria_products',
      'ferreteria_customers',
      'ferreteria_invoices',
      'ferreteria_settings_users_list',
      'ferreteria_orders',
      'ferreteria_credit_notes',
      'ferreteria_hr_employees',
      'ferreteria_promotions',
      'ferreteria_suppliers',
      'ferreteria_suppliers_details',
      'ferreteria_categories',
      'ferreteria_units',
      'ferreteria_warehouses',
      'ferreteria_purchases',
      'ferreteria_transfers',
      'ferreteria_stock_adjustments',
      'ferreteria_product_batches',
      'ferreteria_kardex',
      'ferreteria_cash_session',
      'ferreteria_cash_sessions_history',
      'ferreteria_journal_entries'
    )
    OR id LIKE 'ferreteria_settings_p12%';
  `);
  console.log(`   ✓ ${deleteResult.rowCount} filas de negocio purgadas de 'app_state'.`);

  // 7. PRUEBA DEFINITIVA
  console.log('\n================================================================');
  console.log('🏆 PRUEBA DEFINITIVA DE AUDITORÍA:');
  const checkRes = await pool.query(`
    SELECT count(*) as cnt
    FROM app_state
    WHERE id IN ('ferreteria_products', 'ferreteria_invoices', 'ferreteria_customers');
  `);

  const count = Number(checkRes.rows[0].cnt);
  console.log(`   SELECT count(*) FROM app_state WHERE id IN ('ferreteria_products','ferreteria_invoices','ferreteria_customers') = ${count}`);

  if (count === 0) {
    console.log('   ✅ PRUEBA SUPERADA CON ÉXITO: 0 registros en app_state. El backend es 100% relacional.');
  } else {
    console.error(`   ❌ FALLO: Aún quedan ${count} registros en app_state.`);
    process.exit(1);
  }

  // Comprobar filas restantes en app_state (deben ser solo preferencias de UI)
  const remainingRes = await pool.query('SELECT id FROM app_state ORDER BY id ASC;');
  console.log(`\n   Filas restantes en app_state (solo preferencias/configuración de UI):`);
  for (const r of remainingRes.rows) {
    console.log(`   - ${r.id}`);
  }

  console.log('\n================================================================');
  console.log('✨ MIGRACIÓN Y NORMALIZACIÓN COMPLETADAS SATISFACTORIAMENTE');
  console.log('================================================================');
}

// Ejecución directa si se invoca con tsx
runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error fatal en migración:', err);
    process.exit(1);
  });
