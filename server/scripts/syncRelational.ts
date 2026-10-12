import { getPgPool } from '../config/postgres';

export async function populateRelationalFromAppState() {
  const pool = getPgPool();
  console.log('🔄 Sincronizando datos de app_state hacia tablas relacionales...');

  // 1. Obtener todo app_state
  const res = await pool.query('SELECT id, data FROM app_state;');
  const stateMap: Record<string, any> = {};
  for (const row of res.rows) {
    let d = row.data;
    if (d && typeof d === 'object' && d.data !== undefined && (d._id === row.id || d.id === row.id)) {
      d = d.data;
    }
    stateMap[row.id] = d;
  }

  // 2. Sincronizar CATEGORÍAS (categorias_productos)
  const categories = stateMap['ferreteria_categories'];
  if (Array.isArray(categories)) {
    for (const cat of categories) {
      const id = String(cat.id || cat._id || cat.name || `cat-${Date.now()}`);
      const name = String(cat.name || cat.label || id);
      const desc = cat.description || null;
      await pool.query(`
        INSERT INTO categorias_productos (id, name, description, data)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, description = EXCLUDED.description, data = EXCLUDED.data;
      `, [id, name, desc, JSON.stringify(cat)]);
    }
    console.log(`✓ Sincronizadas ${categories.length} categorías en 'categorias_productos'.`);
  }

  // 3. Sincronizar UNIDADES DE MEDIDA (unidades_medida)
  const units = stateMap['ferreteria_units'];
  if (Array.isArray(units)) {
    for (const u of units) {
      const id = String(u.id || u._id || u.code || `unit-${Date.now()}`);
      const name = String(u.name || u.label || id);
      const abbr = String(u.abbreviation || u.code || u.symbol || id).substring(0, 10);
      await pool.query(`
        INSERT INTO unidades_medida (id, name, abbreviation, data)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, abbreviation = EXCLUDED.abbreviation, data = EXCLUDED.data;
      `, [id, name, abbr, JSON.stringify(u)]);
    }
    console.log(`✓ Sincronizadas ${units.length} unidades en 'unidades_medida'.`);
  }

  // Auto-completar categorías desde el catálogo de productos si está vacío
  const catCount = await pool.query('SELECT count(*) FROM categorias_productos;');
  if (parseInt(catCount.rows[0].count, 10) === 0) {
    const catsFromProducts = await pool.query('SELECT DISTINCT category FROM productos WHERE category IS NOT NULL AND category != \'\';');
    for (const row of catsFromProducts.rows) {
      const catName = row.category;
      const catId = `cat-${catName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      await pool.query(`
        INSERT INTO categorias_productos (id, name, description, data)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
      `, [catId, catName, `Categoría: ${catName}`, JSON.stringify({ id: catId, name: catName })]);
    }
    console.log(`✓ Auto-pobladas ${catsFromProducts.rows.length} categorías desde el catálogo en 'categorias_productos'.`);
  }

  // Auto-completar unidades desde el catálogo de productos si está vacío
  const unitCount = await pool.query('SELECT count(*) FROM unidades_medida;');
  if (parseInt(unitCount.rows[0].count, 10) === 0) {
    const unitsFromProducts = await pool.query('SELECT DISTINCT unit FROM productos WHERE unit IS NOT NULL AND unit != \'\';');
    for (const row of unitsFromProducts.rows) {
      const uName = row.unit;
      const uId = `unit-${uName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      await pool.query(`
        INSERT INTO unidades_medida (id, name, abbreviation, data)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, abbreviation = EXCLUDED.abbreviation;
      `, [uId, uName, uName.substring(0, 10), JSON.stringify({ id: uId, name: uName, abbreviation: uName })]);
    }
    console.log(`✓ Auto-pobladas ${unitsFromProducts.rows.length} unidades de medida desde el catálogo en 'unidades_medida'.`);
  }

  // 4. Sincronizar ROLES (roles_sistema)
  const roles = stateMap['ferreteria_settings_roles'];
  if (Array.isArray(roles)) {
    for (const r of roles) {
      const id = String(r.id || r._id || r.name || `role-${Date.now()}`);
      const name = String(r.name || id);
      const desc = r.description || null;
      const permissions = JSON.stringify(r.permissions || []);
      await pool.query(`
        INSERT INTO roles_sistema (id, name, description, permissions, data)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, description = EXCLUDED.description, permissions = EXCLUDED.permissions, data = EXCLUDED.data;
      `, [id, name, desc, permissions, JSON.stringify(r)]);
    }
    console.log(`✓ Sincronizados ${roles.length} roles en 'roles_sistema'.`);
  }

  // 5. Sincronizar USUARIOS (usuarios_sistema)
  const users = stateMap['ferreteria_settings_users_list'];
  if (Array.isArray(users)) {
    for (const u of users) {
      const id = String(u.id || u._id || u.username || `user-${Date.now()}`);
      const name = String(u.name || u.username || 'Usuario');
      const username = String(u.username || id);
      const email = u.email || null;
      const role = u.role || 'Cajero';
      const status = u.status || 'Activo';
      const password = u.password || 'password';
      await pool.query(`
        INSERT INTO usuarios_sistema (id, name, username, email, role, status, password, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, username = EXCLUDED.username, email = EXCLUDED.email,
            role = EXCLUDED.role, status = EXCLUDED.status, password = EXCLUDED.password, data = EXCLUDED.data;
      `, [id, name, username, email, role, status, password, JSON.stringify(u)]);
    }
    console.log(`✓ Sincronizados ${users.length} usuarios en 'usuarios_sistema'.`);
  }

  // 6. Sincronizar CLIENTES (clientes)
  const customers = stateMap['ferreteria_customers'];
  if (Array.isArray(customers)) {
    for (const c of customers) {
      const id = String(c.id || c._id || `cust-${Date.now()}`);
      const name = String(c.name || 'Cliente');
      const taxId = c.docNumber || c.tax_id || c.cedula || c.ruc || null;
      const docType = c.docType || c.doc_type || 'C.I.';
      const email = c.email || null;
      const phone = c.phone || null;
      const address = c.address || null;
      const debt = Number(c.currentBalance ?? c.current_debt ?? 0);
      const limit = Number(c.creditLimit ?? c.credit_limit ?? 0);
      await pool.query(`
        INSERT INTO clientes (id, name, tax_id, doc_type, email, phone, address, current_debt, credit_limit, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, tax_id = EXCLUDED.tax_id, doc_type = EXCLUDED.doc_type,
            email = EXCLUDED.email, phone = EXCLUDED.phone, address = EXCLUDED.address,
            current_debt = EXCLUDED.current_debt, credit_limit = EXCLUDED.credit_limit, data = EXCLUDED.data;
      `, [id, name, taxId, docType, email, phone, address, debt, limit, JSON.stringify(c)]);
    }
    console.log(`✓ Sincronizados ${customers.length} clientes en 'clientes'.`);
  }

  // 7. Sincronizar PRODUCTOS (productos)
  const products = stateMap['ferreteria_products'];
  if (Array.isArray(products)) {
    for (const p of products) {
      const id = String(p.id || p._id || `prod-${Date.now()}`);
      const code = p.code || p.sku || id;
      const sku = p.sku || p.code || id;
      const name = String(p.name || 'Producto sin nombre');
      const desc = p.description || null;
      const cat = p.category || 'General';
      const unit = p.unit || 'UND';
      const costPrice = Number(p.costPrice ?? p.cost ?? 0);
      const salePrice = Number(p.price ?? p.sale_price ?? 0);
      const stock = Number(p.stock ?? 0);
      const minStock = Number(p.minStock ?? p.min_stock ?? 5);
      const hasIva = p.has_iva !== undefined ? Boolean(p.has_iva) : (p.taxRate !== undefined ? Number(p.taxRate) > 0 : true);
      const ivaRate = Number(p.taxRate ?? p.iva_rate ?? 15);
      const status = p.status || 'Activo';

      await pool.query(`
        INSERT INTO productos (
          id, code, sku, name, description, category, unit,
          cost_price, sale_price, stock, min_stock, has_iva, iva_rate, status, data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET code = EXCLUDED.code, sku = EXCLUDED.sku, name = EXCLUDED.name,
            description = EXCLUDED.description, category = EXCLUDED.category, unit = EXCLUDED.unit,
            cost_price = EXCLUDED.cost_price, sale_price = EXCLUDED.sale_price, stock = EXCLUDED.stock,
            min_stock = EXCLUDED.min_stock, has_iva = EXCLUDED.has_iva, iva_rate = EXCLUDED.iva_rate,
            status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW();
      `, [id, code, sku, name, desc, cat, unit, costPrice, salePrice, stock, minStock, hasIva, ivaRate, status, JSON.stringify(p)]);
    }
    console.log(`✓ Sincronizados ${products.length} productos en 'productos'.`);
  }

  // 8. Sincronizar FACTURAS (facturas_ventas)
  const invoices = stateMap['ferreteria_invoices'];
  if (Array.isArray(invoices)) {
    for (const inv of invoices) {
      const id = String(inv.id || inv._id || `inv-${Date.now()}`);
      const invNum = String(inv.invoiceNumber || inv.invoice_number || id);
      const parts = invNum.split('-');
      const est = inv.establishment || parts[0] || '001';
      const pto = inv.emissionPoint || parts[1] || '001';
      const seq = Number(inv.sequential || parts[2] || 1);
      const date = inv.date ? new Date(inv.date) : new Date();
      const custId = inv.customerId || inv.customer_id || null;
      const custName = String(inv.customerName || inv.customer_name || 'Consumidor Final');
      const custTaxId = String(inv.customerTaxId || inv.customer_tax_id || inv.customerDocNumber || '9999999999999');
      const seller = inv.seller || inv.sellerName || null;
      const subtotal = Number(inv.subtotal ?? 0);
      const tax = Number(inv.tax ?? 0);
      const discount = Number(inv.discount ?? 0);
      const total = Number(inv.total ?? 0);
      const payMethod = inv.paymentMethod || inv.payment_method || 'EFECTIVO';
      const status = inv.status || 'EMITIDA';
      const sriStatus = inv.sriStatus || inv.sri_status || 'PENDIENTE';
      const accessKey = inv.accessKey || inv.access_key || inv.claveAcceso || null;
      const authNum = inv.authorizationNumber || inv.authorization_number || null;
      const authDate = inv.authorizationDate ? new Date(inv.authorizationDate) : null;
      const items = JSON.stringify(inv.items || []);

      await pool.query(`
        INSERT INTO facturas_ventas (
          id, invoice_number, establishment, emission_point, sequential,
          date, customer_id, customer_name, customer_tax_id, seller,
          subtotal, tax, discount, total, payment_method, status,
          sri_status, access_key, authorization_number, authorization_date, items, data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET invoice_number = EXCLUDED.invoice_number, subtotal = EXCLUDED.subtotal, tax = EXCLUDED.tax,
            total = EXCLUDED.total, status = EXCLUDED.status, sri_status = EXCLUDED.sri_status,
            access_key = EXCLUDED.access_key, items = EXCLUDED.items, data = EXCLUDED.data, updated_at = NOW();
      `, [id, invNum, est, pto, seq, date, custId, custName, custTaxId, seller, subtotal, tax, discount, total, payMethod, status, sriStatus, accessKey, authNum, authDate, items, JSON.stringify(inv)]);
    }
    console.log(`✓ Sincronizadas ${invoices.length} facturas en 'facturas_ventas'.`);
  }

  // 9. Sincronizar PROVEEDORES (proveedores)
  const suppliers = stateMap['ferreteria_suppliers'] || stateMap['ferreteria_suppliers_details'];
  if (Array.isArray(suppliers)) {
    for (const s of suppliers) {
      const id = String(s.id || s._id || `sup-${Date.now()}`);
      const name = String(s.name || 'Proveedor');
      const taxId = s.tax_id || s.ruc || s.cedula || null;
      const email = s.email || null;
      const phone = s.phone || null;
      const address = s.address || null;
      const contact = s.contact_person || s.contact || null;

      await pool.query(`
        INSERT INTO proveedores (id, name, tax_id, email, phone, address, contact_person, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, tax_id = EXCLUDED.tax_id, email = EXCLUDED.email,
            phone = EXCLUDED.phone, address = EXCLUDED.address, contact_person = EXCLUDED.contact_person, data = EXCLUDED.data;
      `, [id, name, taxId, email, phone, address, contact, JSON.stringify(s)]);
    }
    console.log(`✓ Sincronizados ${suppliers.length} proveedores en 'proveedores'.`);
  }

  console.log('🎉 Sincronización relacional finalizada exitosamente.');
}

if (process.argv[1]?.includes('syncRelational')) {
  populateRelationalFromAppState()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error sincronizando tablas relacionales:', err);
      process.exit(1);
    });
}
