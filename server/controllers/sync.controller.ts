import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  getDatabase,
  getPgPool,
  currentUri,
  currentDbName,
  getFriendlyCollectionName,
  COMPASS_COLLECTIONS
} from '../config/db';

const sseClients = new Set<Response>();

export function broadcastSse(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch {
      sseClients.delete(client);
    }
  }
}

export const BUSINESS_DOCS = new Set([
  'ferreteria_products',
  'ferreteria_customers',
  'ferreteria_invoices',
  'ferreteria_settings_users_list',
  'ferreteria_settings_roles',
  'ferreteria_categories',
  'ferreteria_units',
  'ferreteria_credit_notes',
  'ferreteria_orders',
  'ferreteria_hr_employees',
  'ferreteria_promotions',
  'ferreteria_suppliers',
  'ferreteria_suppliers_details',
  'ferreteria_cash_session',
  'ferreteria_cash_sessions_history',
  'ferreteria_journal_entries',
  'ferreteria_warehouses',
  'ferreteria_purchases',
  'ferreteria_transfers',
  'ferreteria_stock_adjustments',
  'ferreteria_product_batches',
  'ferreteria_kardex'
]);

/**
 * Sincroniza entidades directamente en sus tablas relacionales normalizadas de PostgreSQL.
 */
export async function syncToFriendlyCompassCollection(db: any, docId: string, data: any) {
  const pool = getPgPool();
  try {
    if (docId === 'ferreteria_products' && Array.isArray(data)) {
      for (const p of data) {
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
      }
      return;
    }

    if (docId === 'ferreteria_customers' && Array.isArray(data)) {
      for (const c of data) {
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
          INSERT INTO clientes (id, name, tax_id, doc_type, email, phone, address, current_debt, credit_limit, data, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name, tax_id = EXCLUDED.tax_id, doc_type = EXCLUDED.doc_type,
              email = EXCLUDED.email, phone = EXCLUDED.phone, address = EXCLUDED.address,
              current_debt = EXCLUDED.current_debt, credit_limit = EXCLUDED.credit_limit, data = EXCLUDED.data, updated_at = NOW();
        `, [id, name, taxId, docType, email, phone, address, debt, limit, JSON.stringify(c)]);
      }
      return;
    }

    if (docId === 'ferreteria_invoices' && Array.isArray(data)) {
      for (const inv of data) {
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

        // Sincronizar detalle relacional en factura_detalles
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
          const desc = Math.max(0, Number(item.discount ?? 0));
          const subt = Math.max(0, Number(item.subtotal ?? (cantidad * precioUnit - desc)));
          const hasIva = Boolean(item.has_iva ?? item.hasIva ?? true);
          const ivaRate = Math.max(0, Number(item.taxRate ?? item.iva_rate ?? 15));
          const ivaValor = Math.max(0, Number(item.tax ?? (hasIva ? subt * (ivaRate / 100) : 0)));
          const tot = Math.max(0, Number(item.total ?? (subt + ivaValor)));

          await pool.query(`
            INSERT INTO factura_detalles (
              id, factura_id, product_id, codigo, descripcion,
              cantidad, precio_unitario, descuento, subtotal,
              has_iva, iva_rate, iva_valor, total, data
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
            ON CONFLICT (id) DO UPDATE
            SET product_id = EXCLUDED.product_id, codigo = EXCLUDED.codigo,
                descripcion = EXCLUDED.descripcion, cantidad = EXCLUDED.cantidad,
                precio_unitario = EXCLUDED.precio_unitario, descuento = EXCLUDED.descuento,
                subtotal = EXCLUDED.subtotal, has_iva = EXCLUDED.has_iva,
                iva_rate = EXCLUDED.iva_rate, iva_valor = EXCLUDED.iva_valor,
                total = EXCLUDED.total, data = EXCLUDED.data;
          `, [detId, id, validProdId, codigo, descripcion, cantidad, precioUnit, desc, subt, hasIva, ivaRate, ivaValor, tot, JSON.stringify(item)]);
        }
      }
      return;
    }

    if (docId === 'ferreteria_journal_entries' && Array.isArray(data)) {
      for (const je of data) {
        const id = String(je.id || je._id || `je-${Date.now()}`);
        const entryNum = String(je.entryNumber || je.number || id);
        const date = je.date ? new Date(je.date) : new Date();
        const concept = String(je.concept || 'Asiento contable');
        const type = ['DIARIO', 'INGRESO', 'EGRESO', 'AJUSTE', 'CIERRE'].includes(je.type) ? je.type : 'DIARIO';
        const totalDebit = Math.max(0, Number(je.totalDebit ?? je.debit ?? 0));
        const totalCredit = Math.max(0, Number(je.totalCredit ?? je.credit ?? 0));
        const status = ['ASENTADO', 'ANULADO', 'BORRADOR'].includes(je.status) ? je.status : 'ASENTADO';
        const rawItems = Array.isArray(je.items) ? je.items : [];
        const items = JSON.stringify(rawItems);

        await pool.query(`
          INSERT INTO asientos_contables (
            id, entry_number, date, concept, type, total_debit, total_credit,
            is_balanced, status, items, data, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
          SET entry_number = EXCLUDED.entry_number, date = EXCLUDED.date,
              concept = EXCLUDED.concept, type = EXCLUDED.type,
              total_debit = EXCLUDED.total_debit, total_credit = EXCLUDED.total_credit,
              is_balanced = EXCLUDED.is_balanced, status = EXCLUDED.status,
              items = EXCLUDED.items, data = EXCLUDED.data, updated_at = NOW();
        `, [id, entryNum, date, concept, type, totalDebit, totalCredit, Math.abs(totalDebit - totalCredit) <= 0.01, status, items, JSON.stringify(je)]);

        // Sincronizar líneas contables relacionales en asiento_lineas
        await pool.query(`DELETE FROM asiento_lineas WHERE asiento_id = $1;`, [id]);
        for (let i = 0; i < rawItems.length; i++) {
          const it = rawItems[i];
          const lineaId = String(it.id || `${id}-linea-${i + 1}`);
          const code = String(it.accountCode || it.code || '1.1.01.01.01').trim();
          const name = String(it.accountName || it.name || 'Cuenta General').trim();
          const lineConcept = it.concept || concept;
          const debit = Math.max(0, Number(it.debit ?? 0));
          const credit = Math.max(0, Number(it.credit ?? 0));
          if (debit === 0 && credit === 0) continue;

          let accountId: string | null = null;
          const accCheck = await pool.query(`SELECT id FROM plan_cuentas_contable WHERE code = $1 OR id = $2`, [code, code]);
          if (accCheck.rows.length > 0) accountId = accCheck.rows[0].id;

          await pool.query(`
            INSERT INTO asiento_lineas (
              id, asiento_id, account_id, account_code, account_name, concept, debit, credit, data
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
            ON CONFLICT (id) DO UPDATE
            SET account_id = EXCLUDED.account_id, account_code = EXCLUDED.account_code,
                account_name = EXCLUDED.account_name, concept = EXCLUDED.concept,
                debit = EXCLUDED.debit, credit = EXCLUDED.credit, data = EXCLUDED.data;
          `, [lineaId, id, accountId, code, name, lineConcept, debit, credit, JSON.stringify(it)]);
        }
      }
      return;
    }

    if (docId === 'ferreteria_cash_session' && typeof data === 'object' && data !== null) {
      const cs = data;
      const id = String(cs.id || cs._id || 'ferreteria_cash_session');
      const cashierName = String(cs.cashierName || 'Administrador Principal');
      const pto = String(cs.emissionPoint || '001');
      const openTime = cs.openedAt ? new Date(cs.openedAt) : new Date();
      const closeTime = cs.closedAt ? new Date(cs.closedAt) : null;
      const status = cs.status === 'ABIERTA' ? 'ABIERTA' : 'CERRADA';
      const initCash = Math.max(0, Number(cs.initialCash || 0));
      const sCash = Math.max(0, Number(cs.totalSalesCash || 0));
      const sTrans = Math.max(0, Number(cs.totalSalesTransfer || 0));
      const sCard = Math.max(0, Number(cs.totalSalesCard || 0));
      const sCred = Math.max(0, Number(cs.totalSalesCredit || 0));
      const expCash = Math.max(0, Number(cs.expectedCash || 0));
      const actCash = Number(cs.actualCash || cs.realCash || 0);
      const diff = Number(cs.difference || (actCash - expCash));
      const invCount = Math.max(0, Number(cs.totalInvoicesCount || 0));

      await pool.query(`
        INSERT INTO sesiones_caja (
          id, cashier_name, emission_point, opening_time, closing_time,
          opening_cash, total_sales_cash, total_sales_transfer, total_sales_card,
          total_sales_credit, expected_cash, actual_cash, difference,
          status, total_invoices_count, data, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
        SET cashier_name = EXCLUDED.cashier_name, emission_point = EXCLUDED.emission_point,
            opening_time = EXCLUDED.opening_time, closing_time = EXCLUDED.closing_time,
            opening_cash = EXCLUDED.opening_cash, total_sales_cash = EXCLUDED.total_sales_cash,
            total_sales_transfer = EXCLUDED.total_sales_transfer, total_sales_card = EXCLUDED.total_sales_card,
            total_sales_credit = EXCLUDED.total_sales_credit, expected_cash = EXCLUDED.expected_cash,
            actual_cash = EXCLUDED.actual_cash, difference = EXCLUDED.difference,
            status = EXCLUDED.status, total_invoices_count = EXCLUDED.total_invoices_count,
            data = EXCLUDED.data, updated_at = NOW();
      `, [id, cashierName, pto, openTime, closeTime, initCash, sCash, sTrans, sCard, sCred, expCash, actCash, diff, status, invCount, JSON.stringify(cs)]);
      return;
    }

    if (docId === 'ferreteria_credit_notes' && Array.isArray(data)) {
      for (const nc of data) {
        const id = String(nc.id || nc._id || `nc-${Date.now()}`);
        const ncNum = String(nc.creditNoteNumber || nc.credit_note_number || id);
        const parts = ncNum.split('-');
        const est = nc.establishment || parts[0] || '001';
        const pto = nc.emissionPoint || parts[1] || '001';
        const seq = Number(nc.sequential || parts[2] || 1);
        const date = nc.date ? new Date(nc.date) : new Date();
        const rawInvId = nc.invoiceId || nc.invoice_id || null;
        let invId: string | null = null;
        if (rawInvId) {
          const iCheck = await pool.query(`SELECT id FROM facturas_ventas WHERE id = $1`, [rawInvId]);
          if (iCheck.rows.length > 0) invId = rawInvId;
        }
        const invNum = String(nc.invoiceNumber || nc.invoice_number || '001-001-000000001');
        const rawCustId = nc.customerId || nc.customer_id || null;
        let custId: string | null = null;
        if (rawCustId) {
          const cCheck = await pool.query(`SELECT id FROM clientes WHERE id = $1`, [rawCustId]);
          if (cCheck.rows.length > 0) custId = rawCustId;
        }
        const custName = String(nc.customerName || nc.customer_name || 'Cliente');
        const custTaxId = String(nc.customerTaxId || nc.customer_tax_id || '9999999999999');
        const reason = String(nc.reason || nc.motivo || 'Devolución');
        const subtotal = Math.max(0, Number(nc.subtotal ?? 0));
        const tax = Math.max(0, Number(nc.tax ?? 0));
        const total = Math.max(0, Number(nc.total ?? 0));
        const status = ['EMITIDA', 'AUTORIZADO', 'ANULADA', 'PENDIENTE'].includes(nc.status) ? nc.status : 'EMITIDA';
        const sriStatus = nc.sriStatus || nc.sri_status || 'PENDIENTE';
        const accessKey = nc.accessKey || nc.access_key || null;
        const authNum = nc.authorizationNumber || nc.authorization_number || null;
        const items = JSON.stringify(nc.items || []);

        await pool.query(`
          INSERT INTO notas_credito (
            id, credit_note_number, establishment, emission_point, sequential,
            date, invoice_id, invoice_number, customer_id, customer_name, customer_tax_id,
            reason, subtotal, tax, total, status, sri_status, access_key,
            authorization_number, items, data, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
          SET credit_note_number = EXCLUDED.credit_note_number, subtotal = EXCLUDED.subtotal,
              tax = EXCLUDED.tax, total = EXCLUDED.total, status = EXCLUDED.status,
              sri_status = EXCLUDED.sri_status, items = EXCLUDED.items, data = EXCLUDED.data, updated_at = NOW();
        `, [id, ncNum, est, pto, seq, date, invId, invNum, custId, custName, custTaxId, reason, subtotal, tax, total, status, sriStatus, accessKey, authNum, items, JSON.stringify(nc)]);
      }
      return;
    }

    if (docId === 'ferreteria_orders' && Array.isArray(data)) {
      for (const ord of data) {
        const id = String(ord.id || ord._id || `ord-${Date.now()}`);
        const ordNum = String(ord.orderNumber || ord.order_number || id);
        const type = ord.type === 'PEDIDO' ? 'PEDIDO' : 'COTIZACION';
        const date = ord.date ? new Date(ord.date) : new Date();
        const validUntil = ord.validUntil ? new Date(ord.validUntil) : null;
        const rawCustId = ord.customerId || ord.customer_id || null;
        let custId: string | null = null;
        if (rawCustId) {
          const cCheck = await pool.query(`SELECT id FROM clientes WHERE id = $1`, [rawCustId]);
          if (cCheck.rows.length > 0) custId = rawCustId;
        }
        const custName = String(ord.customerName || ord.customer_name || 'Cliente');
        const custTaxId = String(ord.customerTaxId || ord.customer_tax_id || '9999999999999');
        const seller = ord.seller || ord.sellerName || null;
        const subtotal = Math.max(0, Number(ord.subtotal ?? 0));
        const tax = Math.max(0, Number(ord.tax ?? 0));
        const discount = Math.max(0, Number(ord.discount ?? 0));
        const total = Math.max(0, Number(ord.total ?? 0));
        const status = ['PENDIENTE', 'APROBADO', 'FACTURADO', 'RECHAZADO', 'VENCIDO'].includes(ord.status) ? ord.status : 'PENDIENTE';
        const rawInvId = ord.invoicedId || ord.invoiced_id || null;
        let invId: string | null = null;
        if (rawInvId) {
          const iCheck = await pool.query(`SELECT id FROM facturas_ventas WHERE id = $1`, [rawInvId]);
          if (iCheck.rows.length > 0) invId = rawInvId;
        }
        const items = JSON.stringify(ord.items || []);
        const notes = ord.notes || null;

        await pool.query(`
          INSERT INTO cotizaciones_pedidos (
            id, order_number, type, date, valid_until, customer_id, customer_name, customer_tax_id,
            seller, subtotal, tax, discount, total, status, invoiced_id, items, notes, data, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
          SET order_number = EXCLUDED.order_number, type = EXCLUDED.type, customer_name = EXCLUDED.customer_name,
              subtotal = EXCLUDED.subtotal, tax = EXCLUDED.tax, discount = EXCLUDED.discount,
              total = EXCLUDED.total, status = EXCLUDED.status, items = EXCLUDED.items, data = EXCLUDED.data, updated_at = NOW();
        `, [id, ordNum, type, date, validUntil, custId, custName, custTaxId, seller, subtotal, tax, discount, total, status, invId, items, notes, JSON.stringify(ord)]);
      }
      return;
    }

    if (docId === 'ferreteria_hr_employees' && Array.isArray(data)) {
      for (const emp of data) {
        const id = String(emp.id || emp._id || `emp-${Date.now()}`);
        const ident = String(emp.identification || emp.cedula || emp.id || id);
        const firstName = String(emp.firstName || emp.first_name || emp.name || 'Empleado');
        const lastName = String(emp.lastName || emp.last_name || '');
        const fullName = String(emp.fullName || `${firstName} ${lastName}`.trim());
        const email = emp.email || null;
        const phone = emp.phone || null;
        const address = emp.address || null;
        const dept = emp.department || 'General';
        const position = emp.position || 'Empleado';
        const salary = Math.max(0, Number(emp.salary ?? 0));
        const hireDate = emp.hireDate ? new Date(emp.hireDate) : null;
        const status = ['Activo', 'Inactivo', 'Vacaciones', 'Liquidado'].includes(emp.status) ? emp.status : 'Activo';

        await pool.query(`
          INSERT INTO empleados (
            id, identification, first_name, last_name, full_name, email, phone,
            address, department, position, salary, hire_date, status, data, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
          SET identification = EXCLUDED.identification, first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name, full_name = EXCLUDED.full_name,
              email = EXCLUDED.email, phone = EXCLUDED.phone, department = EXCLUDED.department,
              position = EXCLUDED.position, salary = EXCLUDED.salary, status = EXCLUDED.status,
              data = EXCLUDED.data, updated_at = NOW();
        `, [id, ident, firstName, lastName, fullName, email, phone, address, dept, position, salary, hireDate, status, JSON.stringify(emp)]);
      }
      return;
    }

    if (docId === 'ferreteria_promotions' && Array.isArray(data)) {
      for (const promo of data) {
        const id = String(promo.id || promo._id || `promo-${Date.now()}`);
        const code = promo.code || null;
        const name = String(promo.name || 'Promoción');
        const desc = promo.description || null;
        const discType = ['PORCENTAJE', 'MONTO_FIJO', '2X1', 'COMBO'].includes(promo.discountType) ? promo.discountType : 'PORCENTAJE';
        const discVal = Math.max(0, Number(promo.discountValue ?? 0));
        const startDate = promo.startDate ? new Date(promo.startDate) : new Date();
        const endDate = promo.endDate ? new Date(promo.endDate) : new Date(Date.now() + 30 * 24 * 3600 * 1000);
        const minPurch = Math.max(0, Number(promo.minPurchaseAmount ?? 0));
        const cat = promo.applicableCategory || null;
        const rawProdId = promo.applicableProductId || null;
        let prodId: string | null = null;
        if (rawProdId) {
          const pCheck = await pool.query(`SELECT id FROM productos WHERE id = $1`, [rawProdId]);
          if (pCheck.rows.length > 0) prodId = rawProdId;
        }
        const status = ['Activo', 'Inactivo', 'Vencido'].includes(promo.status) ? promo.status : 'Activo';

        await pool.query(`
          INSERT INTO promociones (
            id, code, name, description, discount_type, discount_value,
            start_date, end_date, min_purchase_amount, applicable_category,
            applicable_product_id, status, data, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
          SET code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description,
              discount_type = EXCLUDED.discount_type, discount_value = EXCLUDED.discount_value,
              start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
              min_purchase_amount = EXCLUDED.min_purchase_amount, status = EXCLUDED.status,
              data = EXCLUDED.data, updated_at = NOW();
        `, [id, code, name, desc, discType, discVal, startDate, endDate, minPurch, cat, prodId, status, JSON.stringify(promo)]);
      }
      return;
    }

    if (docId === 'ferreteria_categories' && Array.isArray(data)) {
      for (const cat of data) {
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
      return;
    }

    if (docId === 'ferreteria_units' && Array.isArray(data)) {
      for (const u of data) {
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
      return;
    }

    if (docId === 'ferreteria_settings_roles' && Array.isArray(data)) {
      for (const r of data) {
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
      return;
    }

    if (docId === 'ferreteria_settings_users_list' && Array.isArray(data)) {
      for (const u of data) {
        const id = String(u.id || u._id || u.username || `user-${Date.now()}`);
        const name = String(u.name || u.username || 'Usuario');
        const username = String(u.username || id);
        const email = u.email || null;
        const role = typeof u.role === 'object' ? u.role?.name || 'Cajero' : u.role || 'Cajero';
        const status = u.status || 'Activo';

        let passwordHash: string | null = null;
        if (u.password && typeof u.password === 'string' && u.password.trim() !== '') {
          if (u.password.startsWith('$2a$') || u.password.startsWith('$2b$')) {
            passwordHash = u.password;
          } else {
            passwordHash = bcrypt.hashSync(u.password, 10);
          }
        }

        if (passwordHash) {
          await pool.query(`
            INSERT INTO usuarios_sistema (id, name, username, email, role, status, password, data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name, username = EXCLUDED.username, email = EXCLUDED.email,
                role = EXCLUDED.role, status = EXCLUDED.status, password = EXCLUDED.password, data = EXCLUDED.data, updated_at = NOW();
          `, [id, name, username, email, role, status, passwordHash, JSON.stringify({ ...u, password: '[PROTECTED_BCRYPT]' })]);
        } else {
          await pool.query(`
            INSERT INTO usuarios_sistema (id, name, username, email, role, status, password, data)
            VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE', $7::jsonb)
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name, username = EXCLUDED.username, email = EXCLUDED.email,
                role = EXCLUDED.role, status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW();
          `, [id, name, username, email, role, status, JSON.stringify({ ...u, password: '[PROTECTED_BCRYPT]' })]);
        }
      }
      return;
    }

    if ((docId === 'ferreteria_suppliers' || docId === 'ferreteria_suppliers_details') && Array.isArray(data)) {
      for (const s of data) {
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
      return;
    }

    const friendlyName = getFriendlyCollectionName(docId);
    if (!friendlyName) return;

    const col = db.collection(friendlyName);
    if (Array.isArray(data)) {
      for (const item of data) {
        const itemCopy = typeof item === 'object' && item !== null ? { ...item } : { value: item };
        const customId = String(itemCopy.id || itemCopy.code || itemCopy.sku || `item-${Date.now()}`);
        await col.updateOne({ _id: customId }, { $set: itemCopy }, { upsert: true });
      }
    } else if (typeof data === 'object' && data !== null) {
      await col.updateOne({ _id: docId }, { $set: data }, { upsert: true });
    }
  } catch (err: any) {
    console.warn(`[SQLite Sync] Warning syncing to relational table for '${docId}':`, err?.message);
  }
}

export function sseEvents(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });

  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
}

export async function getStatus(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    await db.admin().ping();
    const cols = await db.listCollections();

    let totalDocs = 0;
    try {
      for (const c of cols) {
        totalDocs += await db.collection(c.name).countDocuments();
      }
    } catch {}

    return res.status(200).json({
      connected: true,
      engine: 'SQLite 3 Local Relacional',
      uri: currentUri,
      dbName: currentDbName,
      collections: cols.map(c => c.name),
      totalDocs,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(200).json({
      connected: false,
      engine: 'SQLite 3 Local Relacional',
      uri: currentUri,
      dbName: currentDbName,
      error: error.message || 'No se pudo conectar a SQLite',
      timestamp: new Date().toISOString()
    });
  }
}

export async function testConnection(req: Request, res: Response) {
  try {
    const pool = getPgPool();
    const result = await pool.query('SELECT 1 as test;');

    return res.status(200).json({
      success: true,
      message: `Conexión exitosa con SQLite`,
      database: currentDbName,
      version: 'SQLite 3 (Embedded Local)'
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      message: error.message || 'Error al conectar con SQLite',
      error: error.message
    });
  }
}

export async function getDoc(req: Request, res: Response) {
  const docId = decodeURIComponent(req.params.docId);
  try {
    const pool = getPgPool();

    // 1. LECTURA RELACIONAL DIRECTA PARA ENTIDADES PRINCIPALES
    if (docId === 'ferreteria_products') {
      const resPg = await pool.query(`SELECT * FROM productos ORDER BY name ASC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        code: r.code,
        sku: r.sku,
        name: r.name,
        description: r.description,
        category: r.category,
        unit: r.unit,
        costPrice: Number(r.cost_price),
        cost: Number(r.cost_price),
        price: Number(r.sale_price),
        stock: Number(r.stock),
        minStock: Number(r.min_stock),
        taxRate: Number(r.iva_rate),
        has_iva: r.has_iva,
        status: r.status,
        updatedAt: r.updated_at
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_customers') {
      const resPg = await pool.query(`SELECT * FROM clientes ORDER BY name ASC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        name: r.name,
        docNumber: r.tax_id,
        docType: r.doc_type,
        email: r.email,
        phone: r.phone,
        address: r.address,
        currentBalance: Number(r.current_debt),
        creditLimit: Number(r.credit_limit),
        updatedAt: r.updated_at
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_invoices') {
      const resPg = await pool.query(`SELECT * FROM facturas_ventas ORDER BY date DESC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        invoiceNumber: r.invoice_number,
        establishment: r.establishment,
        emissionPoint: r.emission_point,
        sequential: r.sequential,
        date: r.date,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerTaxId: r.customer_tax_id,
        seller: r.seller,
        subtotal: Number(r.subtotal),
        tax: Number(r.tax),
        discount: Number(r.discount),
        total: Number(r.total),
        paymentMethod: r.payment_method,
        status: r.status,
        sriStatus: r.sri_status,
        accessKey: r.access_key,
        items: r.items,
        updatedAt: r.updated_at
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_categories') {
      const resPg = await pool.query(`SELECT * FROM categorias_productos ORDER BY name ASC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        name: r.name,
        description: r.description
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_units') {
      const resPg = await pool.query(`SELECT * FROM unidades_medida ORDER BY name ASC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        name: r.name,
        abbreviation: r.abbreviation,
        code: r.abbreviation
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_settings_users_list') {
      const resPg = await pool.query(`SELECT id, name, username, email, role, status, data FROM usuarios_sistema ORDER BY name ASC;`);
      const clean = resPg.rows.map(r => {
        const { password, ...safeData } = (r.data || {});
        return {
          ...safeData,
          id: r.id,
          name: r.name,
          username: r.username,
          email: r.email,
          role: r.role,
          status: r.status
        };
      });
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_settings_roles') {
      const resPg = await pool.query(`SELECT * FROM roles_sistema ORDER BY name ASC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_suppliers' || docId === 'ferreteria_suppliers_details') {
      const resPg = await pool.query(`SELECT * FROM proveedores ORDER BY name ASC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        name: r.name,
        tax_id: r.tax_id,
        email: r.email,
        phone: r.phone,
        address: r.address,
        contact_person: r.contact_person
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_cash_session') {
      const resPg = await pool.query(`SELECT * FROM sesiones_caja ORDER BY opening_time DESC LIMIT 1;`);
      if (resPg.rows.length > 0) {
        const r = resPg.rows[0];
        const clean = {
          ...(r.data || {}),
          id: r.id,
          cashierName: r.cashier_name,
          emissionPoint: r.emission_point,
          openedAt: r.opening_time,
          closedAt: r.closing_time,
          initialCash: Number(r.opening_cash),
          totalSalesCash: Number(r.total_sales_cash),
          totalSalesTransfer: Number(r.total_sales_transfer),
          totalSalesCard: Number(r.total_sales_card),
          totalSalesCredit: Number(r.total_sales_credit),
          expectedCash: Number(r.expected_cash),
          actualCash: Number(r.actual_cash),
          difference: Number(r.difference),
          status: r.status,
          totalInvoicesCount: Number(r.total_invoices_count),
          updatedAt: r.updated_at
        };
        return res.status(200).json({ exists: true, data: clean });
      }
      return res.status(200).json({ exists: true, data: null });
    } else if (docId === 'ferreteria_journal_entries') {
      const resPg = await pool.query(`SELECT * FROM asientos_contables ORDER BY date DESC, entry_number DESC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        entryNumber: r.entry_number,
        date: r.date,
        concept: r.concept,
        type: r.type,
        totalDebit: Number(r.total_debit),
        totalCredit: Number(r.total_credit),
        status: r.status,
        items: r.items,
        updatedAt: r.created_at
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_credit_notes') {
      const resPg = await pool.query(`SELECT * FROM notas_credito ORDER BY date DESC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        creditNoteNumber: r.credit_note_number,
        establishment: r.establishment,
        emissionPoint: r.emission_point,
        sequential: r.sequential,
        date: r.date,
        invoiceId: r.invoice_id,
        invoiceNumber: r.invoice_number,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerTaxId: r.customer_tax_id,
        reason: r.reason,
        subtotal: Number(r.subtotal),
        tax: Number(r.tax),
        total: Number(r.total),
        status: r.status,
        sriStatus: r.sri_status,
        accessKey: r.access_key,
        items: r.items,
        updatedAt: r.updated_at
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_orders') {
      const resPg = await pool.query(`SELECT * FROM cotizaciones_pedidos ORDER BY date DESC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        orderNumber: r.order_number,
        type: r.type,
        date: r.date,
        validUntil: r.valid_until,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerTaxId: r.customer_tax_id,
        seller: r.seller,
        subtotal: Number(r.subtotal),
        tax: Number(r.tax),
        discount: Number(r.discount),
        total: Number(r.total),
        status: r.status,
        invoicedId: r.invoiced_id,
        items: r.items,
        notes: r.notes,
        updatedAt: r.updated_at
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_hr_employees') {
      const resPg = await pool.query(`SELECT * FROM empleados ORDER BY full_name ASC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        identification: r.identification,
        firstName: r.first_name,
        lastName: r.last_name,
        fullName: r.full_name,
        email: r.email,
        phone: r.phone,
        address: r.address,
        department: r.department,
        position: r.position,
        salary: Number(r.salary),
        hireDate: r.hire_date,
        status: r.status,
        updatedAt: r.updated_at
      }));
      return res.status(200).json({ exists: true, data: clean });
    } else if (docId === 'ferreteria_promotions') {
      const resPg = await pool.query(`SELECT * FROM promociones ORDER BY name ASC;`);
      const clean = resPg.rows.map(r => ({
        ...(r.data || {}),
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        discountType: r.discount_type,
        discountValue: Number(r.discount_value),
        startDate: r.start_date,
        endDate: r.end_date,
        minPurchaseAmount: Number(r.min_purchase_amount),
        applicableCategory: r.applicable_category,
        status: r.status,
        updatedAt: r.updated_at
      }));
      return res.status(200).json({ exists: true, data: clean });
    }

    // 2. SEGURIDAD: Bloquear lectura del certificado digital y password por canal público de sync
    if (docId === 'ferreteria_settings_p12_base64' || docId === 'ferreteria_settings_p12_password') {
      return res.status(403).json({
        exists: false,
        message: 'Acceso denegado: El certificado .p12 y contraseña residen exclusivamente en el servidor seguro.'
      });
    }

    // 3. Si es entidad de negocio relacional, nunca consultar app_state
    if (BUSINESS_DOCS.has(docId)) {
      return res.status(200).json({ exists: true, data: [] });
    }

    // 4. Fallback a app_state EXCLUSIVAMENTE para preferencias de interfaz (tema, sidebar, etc.)
    const db = await getDatabase();
    const doc = await db.collection('app_state').findOne({ _id: docId } as any);

    if (doc && doc.data !== undefined) {
      let responseData = doc.data;
      if (docId === 'ferreteria_settings_users_list' && Array.isArray(responseData)) {
        responseData = responseData.map((u: any) => {
          const { password, ...safe } = u;
          return safe;
        });
      }
      return res.status(200).json({ exists: true, data: responseData, updatedAt: doc.updatedAt });
    }

    return res.status(200).json({ exists: false, data: null });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function saveDoc(req: Request, res: Response) {
  const docId = decodeURIComponent(req.params.docId);
  try {
    // SEGURIDAD: Bloquear terminantemente que certificados .p12 o contraseñas entren a app_state
    if (docId.startsWith('ferreteria_settings_p12')) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: Los certificados .p12 y contraseñas residen exclusivamente en la tabla cifrada certificados_sri (/api/sri/certificate).'
      });
    }

    const { data } = req.body;
    const db = await getDatabase();

    let dataToSave = data;
    // SEGURIDAD: Nunca guardar contraseñas de usuarios en app_state
    if (docId === 'ferreteria_settings_users_list' && Array.isArray(dataToSave)) {
      dataToSave = dataToSave.map(({ password, ...safe }: any) => safe);
    }

    if (docId === 'ferreteria_invoices' && Array.isArray(data)) {
      const existing = await db.collection<any>('app_state').findOne({ _id: docId });
      if (existing && Array.isArray(existing.data)) {
        const incomingIds = new Set(data.map((d: any) => String(d.id || d._id)));
        const others = existing.data.filter((d: any) => !incomingIds.has(String(d.id || d._id)));
        dataToSave = [...data, ...others];
      }
    }

    // Guardar en app_state SOLAMENTE si NO es entidad de negocio (exclusivo para preferencias de UI: tema, sidebar, etc.)
    if (!BUSINESS_DOCS.has(docId)) {
      await db.collection('app_state').updateOne(
        { _id: docId } as any,
        { $set: { data: dataToSave, updatedAt: new Date() } },
        { upsert: true }
      );
    }

    // Guarda e inserta de forma normalizada en la tabla relacional de PostgreSQL
    await syncToFriendlyCompassCollection(db, docId, data);
    broadcastSse({ type: 'doc_updated', docId, data: dataToSave });

    return res.status(200).json({ success: true, docId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function syncAll(req: Request, res: Response) {
  try {
    const allData = req.body.data || {};
    const db = await getDatabase();

    // SEGURIDAD: Omitir cualquier llave de certificado .p12
    const docIds = Object.keys(allData).filter(id => !id.startsWith('ferreteria_settings_p12'));
    for (const docId of docIds) {
      let val = allData[docId];
      if (docId === 'ferreteria_settings_users_list' && Array.isArray(val)) {
        val = val.map(({ password, ...safe }: any) => safe);
      }

      // Guardar en app_state SOLAMENTE si NO es entidad de negocio
      if (!BUSINESS_DOCS.has(docId)) {
        await db.collection('app_state').updateOne(
          { _id: docId } as any,
          { $set: { data: val, updatedAt: new Date() } },
          { upsert: true }
        );
      }
      await syncToFriendlyCompassCollection(db, docId, allData[docId]);
    }

    broadcastSse({ type: 'all_synced', docIds });

    return res.status(200).json({
      success: true,
      message: `Se sincronizaron ${docIds.length} tablas con SQLite relacional exitosamente.`,
      collectionsSynced: docIds
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function pullAll(req: Request, res: Response) {
  try {
    const pool = getPgPool();
    const db = await getDatabase();
    const docs = await db.collection('app_state').find({}).toArray();

    const result: Record<string, any> = {};
    for (const d of docs) {
      if (!BUSINESS_DOCS.has(String(d._id))) {
        result[String(d._id)] = d.data;
      }
    }

    // Sobrescribir con datos directos de las tablas relacionales para máxima consistencia
    try {
      const prodRes = await pool.query('SELECT * FROM productos ORDER BY name ASC;');
      if (prodRes.rows.length > 0) {
        result['ferreteria_products'] = prodRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          code: r.code,
          sku: r.sku,
          name: r.name,
          description: r.description,
          category: r.category,
          unit: r.unit,
          costPrice: Number(r.cost_price),
          cost: Number(r.cost_price),
          price: Number(r.sale_price),
          stock: Number(r.stock),
          minStock: Number(r.min_stock),
          taxRate: Number(r.iva_rate),
          has_iva: r.has_iva,
          status: r.status
        }));
      }

      const custRes = await pool.query('SELECT * FROM clientes ORDER BY name ASC;');
      if (custRes.rows.length > 0) {
        result['ferreteria_customers'] = custRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          name: r.name,
          docNumber: r.tax_id,
          docType: r.doc_type,
          email: r.email,
          phone: r.phone,
          address: r.address,
          currentBalance: Number(r.current_debt),
          creditLimit: Number(r.credit_limit)
        }));
      }

      const invRes = await pool.query('SELECT * FROM facturas_ventas ORDER BY date DESC;');
      if (invRes.rows.length > 0) {
        result['ferreteria_invoices'] = invRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          invoiceNumber: r.invoice_number,
          establishment: r.establishment,
          emissionPoint: r.emission_point,
          sequential: r.sequential,
          date: r.date,
          customerId: r.customer_id,
          customerName: r.customer_name,
          customerTaxId: r.customer_tax_id,
          seller: r.seller,
          subtotal: Number(r.subtotal),
          tax: Number(r.tax),
          discount: Number(r.discount),
          total: Number(r.total),
          paymentMethod: r.payment_method,
          status: r.status,
          sriStatus: r.sri_status,
          accessKey: r.access_key,
          items: r.items
        }));
      }

      const catRes = await pool.query('SELECT * FROM categorias_productos ORDER BY name ASC;');
      if (catRes.rows.length > 0) {
        result['ferreteria_categories'] = catRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          name: r.name,
          description: r.description
        }));
      }

      const unitRes = await pool.query('SELECT * FROM unidades_medida ORDER BY name ASC;');
      if (unitRes.rows.length > 0) {
        result['ferreteria_units'] = unitRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          name: r.name,
          abbreviation: r.abbreviation
        }));
      }

      const userRes = await pool.query('SELECT id, name, username, email, role, status, data FROM usuarios_sistema ORDER BY name ASC;');
      if (userRes.rows.length > 0) {
        result['ferreteria_settings_users_list'] = userRes.rows.map(r => {
          const { password, ...safe } = (r.data || {});
          return {
            ...safe,
            id: r.id,
            name: r.name,
            username: r.username,
            email: r.email,
            role: r.role,
            status: r.status
          };
        });
      }

      const roleRes = await pool.query('SELECT * FROM roles_sistema ORDER BY name ASC;');
      if (roleRes.rows.length > 0) {
        result['ferreteria_settings_roles'] = roleRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          name: r.name,
          description: r.description,
          permissions: r.permissions
        }));
      }

      const csRes = await pool.query('SELECT * FROM sesiones_caja ORDER BY opening_time DESC LIMIT 1;');
      if (csRes.rows.length > 0) {
        const r = csRes.rows[0];
        result['ferreteria_cash_session'] = {
          ...(r.data || {}),
          id: r.id,
          cashierName: r.cashier_name,
          emissionPoint: r.emission_point,
          openedAt: r.opening_time,
          closedAt: r.closing_time,
          initialCash: Number(r.opening_cash),
          totalSalesCash: Number(r.total_sales_cash),
          totalSalesTransfer: Number(r.total_sales_transfer),
          totalSalesCard: Number(r.total_sales_card),
          totalSalesCredit: Number(r.total_sales_credit),
          expectedCash: Number(r.expected_cash),
          actualCash: Number(r.actual_cash),
          difference: Number(r.difference),
          status: r.status,
          totalInvoicesCount: Number(r.total_invoices_count),
          updatedAt: r.updated_at
        };
      }

      const jeRes = await pool.query('SELECT * FROM asientos_contables ORDER BY date DESC, entry_number DESC;');
      if (jeRes.rows.length > 0) {
        result['ferreteria_journal_entries'] = jeRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          entryNumber: r.entry_number,
          date: r.date,
          concept: r.concept,
          type: r.type,
          totalDebit: Number(r.total_debit),
          totalCredit: Number(r.total_credit),
          status: r.status,
          items: r.items,
          updatedAt: r.created_at
        }));
      }

      const ncRes = await pool.query('SELECT * FROM notas_credito ORDER BY date DESC;');
      if (ncRes.rows.length > 0) {
        result['ferreteria_credit_notes'] = ncRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          creditNoteNumber: r.credit_note_number,
          establishment: r.establishment,
          emissionPoint: r.emission_point,
          sequential: r.sequential,
          date: r.date,
          invoiceId: r.invoice_id,
          invoiceNumber: r.invoice_number,
          customerId: r.customer_id,
          customerName: r.customer_name,
          customerTaxId: r.customer_tax_id,
          reason: r.reason,
          subtotal: Number(r.subtotal),
          tax: Number(r.tax),
          total: Number(r.total),
          status: r.status,
          sriStatus: r.sri_status,
          accessKey: r.access_key,
          items: r.items,
          updatedAt: r.updated_at
        }));
      }

      const ordRes = await pool.query('SELECT * FROM cotizaciones_pedidos ORDER BY date DESC;');
      if (ordRes.rows.length > 0) {
        result['ferreteria_orders'] = ordRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          orderNumber: r.order_number,
          type: r.type,
          date: r.date,
          validUntil: r.valid_until,
          customerId: r.customer_id,
          customerName: r.customer_name,
          customerTaxId: r.customer_tax_id,
          seller: r.seller,
          subtotal: Number(r.subtotal),
          tax: Number(r.tax),
          discount: Number(r.discount),
          total: Number(r.total),
          status: r.status,
          invoicedId: r.invoiced_id,
          items: r.items,
          notes: r.notes,
          updatedAt: r.updated_at
        }));
      }

      const empRes = await pool.query('SELECT * FROM empleados ORDER BY full_name ASC;');
      if (empRes.rows.length > 0) {
        result['ferreteria_hr_employees'] = empRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          identification: r.identification,
          firstName: r.first_name,
          lastName: r.last_name,
          fullName: r.full_name,
          email: r.email,
          phone: r.phone,
          address: r.address,
          department: r.department,
          position: r.position,
          salary: Number(r.salary),
          hireDate: r.hire_date,
          status: r.status,
          updatedAt: r.updated_at
        }));
      }

      const promoRes = await pool.query('SELECT * FROM promociones ORDER BY name ASC;');
      if (promoRes.rows.length > 0) {
        result['ferreteria_promotions'] = promoRes.rows.map(r => ({
          ...(r.data || {}),
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          discountType: r.discount_type,
          discountValue: Number(r.discount_value),
          startDate: r.start_date,
          endDate: r.end_date,
          minPurchaseAmount: Number(r.min_purchase_amount),
          applicableCategory: r.applicable_category,
          status: r.status,
          updatedAt: r.updated_at
        }));
      }
    } catch {}

    return res.status(200).json({
      success: true,
      data: result,
      count: Object.keys(result).length
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
