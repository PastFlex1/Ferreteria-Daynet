import { Request, Response } from 'express';
import { getPgPool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { broadcastSse } from './sync.controller';

function mapInvoiceRow(r: any, details: any[] = []) {
  const customData = r.data || {};
  return {
    ...customData,
    id: r.id,
    invoiceNumber: r.invoice_number,
    fullNumber: r.invoice_number,
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
    authorizationNumber: r.authorization_number,
    authorizationDate: r.authorization_date,
    journalEntryId: r.journal_entry_id,
    items: details.length > 0 ? details : (r.items || []),
    updatedAt: r.updated_at
  };
}

export async function getAllInvoices(req: Request, res: Response) {
  try {
    const pool = getPgPool();
    const { startDate, endDate, status } = req.query;

    let queryText = 'SELECT * FROM facturas_ventas WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(String(status));
      queryText += ` AND status = $${params.length}`;
    }

    if (startDate) {
      params.push(new Date(String(startDate)));
      queryText += ` AND date >= $${params.length}`;
    }

    if (endDate) {
      params.push(new Date(String(endDate)));
      queryText += ` AND date <= $${params.length}`;
    }

    queryText += ' ORDER BY date DESC;';

    const result = await pool.query(queryText, params);
    const clean = result.rows.map(r => mapInvoiceRow(r));

    return res.status(200).json({
      success: true,
      count: clean.length,
      data: clean
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar facturas desde SQLite.',
      error: error.message
    });
  }
}

export async function getInvoiceById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const pool = getPgPool();

    const invRes = await pool.query(
      `SELECT * FROM facturas_ventas 
       WHERE id = $1 OR invoice_number = $1 OR access_key = $1 
       LIMIT 1;`,
      [id]
    );

    if (invRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada.'
      });
    }

    const inv = invRes.rows[0];
    const detRes = await pool.query(
      `SELECT * FROM factura_detalles WHERE factura_id = $1 ORDER BY created_at ASC;`,
      [inv.id]
    );

    return res.status(200).json({
      success: true,
      data: mapInvoiceRow(inv, detRes.rows)
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar factura.',
      error: error.message
    });
  }
}

/**
 * LÓGICA DE FACTURACIÓN EN EL SERVIDOR:
 * - Ejecutada dentro de una única transacción ACID en SQLite.
 * - Secuencial asignado atómicamente con UPDATE secuenciales_emision ... RETURNING current_sequential.
 * - Validación de períodos fiscales abiertos.
 * - Deducción atómica de existencias y registro inmutable en kardex_movimientos (RESTRICT).
 * - Inserción en facturas_ventas y detalle relacional en factura_detalles.
 * - Partida doble balanceada en asientos_contables y asiento_lineas.
 * - Actualización de sesiones_caja y encolado en cola_sri.
 * - CERO escrituras en app_state.
 */
export async function createInvoice(req: AuthenticatedRequest, res: Response) {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const invoiceData = { ...req.body };

    // 0. Adaptador de entrada
    if (invoiceData.lineas && Array.isArray(invoiceData.lineas) && !invoiceData.items) {
      invoiceData.items = invoiceData.lineas.map((l: any, idx: number) => ({
        id: l.productoId || l.id || `item-${idx}`,
        productId: l.productoId || l.id,
        name: l.nombre || l.name || l.descripcion || 'Producto',
        quantity: Number(l.cantidad || l.quantity || 1),
        price: Number(l.precio || l.price || l.precioUnitario || 0),
        subtotal: Number(l.cantidad || 1) * Number(l.precio || 0)
      }));
    }

    if (!invoiceData.items || !Array.isArray(invoiceData.items) || invoiceData.items.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'La transacción requiere al menos un ítem o producto vendido.'
      });
    }

    // Si la factura ya existe en la base de datos (por ejemplo, actualización tras firma/emisión SRI), actualizarla
    const incomingId = invoiceData.id;
    const incomingNumber = invoiceData.invoiceNumber || invoiceData.fullNumber;
    if (incomingId || incomingNumber) {
      const existingCheck = await client.query(
        `SELECT id, invoice_number, data FROM facturas_ventas WHERE id = $1 OR invoice_number = $2;`,
        [incomingId || '', incomingNumber || '']
      );
      if (existingCheck.rows.length > 0) {
        const row = existingCheck.rows[0];
        const updateSriStatus = invoiceData.sriStatus || invoiceData.status || undefined;
        const updateAccessKey = invoiceData.accessKey || invoiceData.sriClaveAcceso || undefined;
        const updateAuthNum = invoiceData.authorizationNumber || invoiceData.sriNumeroAutorizacion || undefined;
        const updateAuthDate = invoiceData.authorizationDate || invoiceData.sriFechaAutorizacion || undefined;
        const mergedData = { ...(row.data || {}), ...invoiceData };

        await client.query(`
          UPDATE facturas_ventas
          SET sri_status = COALESCE($1, sri_status),
              access_key = COALESCE($2, access_key),
              authorization_number = COALESCE($3, authorization_number),
              authorization_date = COALESCE($4, authorization_date),
              data = $5::jsonb,
              updated_at = NOW()
          WHERE id = $6;
        `, [updateSriStatus, updateAccessKey, updateAuthNum, updateAuthDate, JSON.stringify(mergedData), row.id]);

        client.release();
        return res.status(200).json({
          success: true,
          message: 'Factura actualizada exitosamente.',
          invoice: mergedData
        });
      }
    }

    // 1. INICIAR TRANSACCIÓN ATÓMICA
    await client.query('BEGIN;');

    // 2. Control de Período Fiscal
    const invoiceDateObj = invoiceData.date ? new Date(invoiceData.date) : new Date();
    const invoiceYear = invoiceDateObj.getFullYear();
    const invoiceMonth = invoiceDateObj.getMonth() + 1;

    const periodCheck = await client.query(
      `SELECT id FROM periodos_fiscales WHERE year = $1 AND month = $2 AND status = 'CERRADO';`,
      [invoiceYear, invoiceMonth]
    );

    if (periodCheck.rows.length > 0) {
      await client.query('ROLLBACK;');
      client.release();
      return res.status(400).json({
        success: false,
        message: `Emisión rechazada: El período fiscal ${invoiceMonth}/${invoiceYear} se encuentra CERRADO.`
      });
    }

    // 3. SECUENCIAL ATÓMICO: Asignado en el servidor dentro de la misma transacción
    const establishment = String(invoiceData.establishment || (req.user as any)?.establecimiento || '001').padStart(3, '0').slice(-3);
    const emissionPoint = String(invoiceData.emissionPoint || (req.user as any)?.puntoEmision || '001').padStart(3, '0').slice(-3);
    const documentType = '01'; // 01 = Factura

    // Si la factura ya trae un secuencial asignado (ej. desde el modal de emisión o terminal), respetarlo y asegurar que la tabla secuenciales_emision esté sincronizada
    const explicitSeq = invoiceData.number || (invoiceData.fullNumber ? parseInt(invoiceData.fullNumber.split('-')[2], 10) : undefined);
    let currentSequential: number;

    if (explicitSeq && explicitSeq > 0) {
      currentSequential = explicitSeq;
      await client.query(`
        INSERT INTO secuenciales_emision (
          id, establishment, emission_point, document_type, name, current_sequential, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (establishment, emission_point, document_type)
        DO UPDATE SET current_sequential = GREATEST(secuenciales_emision.current_sequential, EXCLUDED.current_sequential), updated_at = NOW();
      `, [`${establishment}-${emissionPoint}-${documentType}`, establishment, emissionPoint, documentType, `Caja ${emissionPoint}`, explicitSeq]);
    } else {
      const seqUpdateRes = await client.query(`
        UPDATE secuenciales_emision
        SET current_sequential = current_sequential + 1, updated_at = NOW()
        WHERE establishment = $1 AND emission_point = $2 AND document_type = $3
        RETURNING current_sequential;
      `, [establishment, emissionPoint, documentType]);

      if (seqUpdateRes.rows.length > 0) {
        currentSequential = Number(seqUpdateRes.rows[0].current_sequential);
      } else {
        const seqInsertRes = await client.query(`
          INSERT INTO secuenciales_emision (
            id, establishment, emission_point, document_type, name, current_sequential, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, 1, NOW())
          ON CONFLICT (establishment, emission_point, document_type)
          DO UPDATE SET current_sequential = secuenciales_emision.current_sequential + 1, updated_at = NOW()
          RETURNING current_sequential;
        `, [`${establishment}-${emissionPoint}-${documentType}`, establishment, emissionPoint, documentType, `Caja ${emissionPoint}`]);
        currentSequential = Number(seqInsertRes.rows[0].current_sequential);
      }
    }

    const sequentialFormatted = String(currentSequential).padStart(9, '0');
    const invoiceNumber = `${establishment}-${emissionPoint}-${sequentialFormatted}`;
    const invoiceId = invoiceData.id || `inv-${Date.now()}-${sequentialFormatted}`;

    // 4. CLIENTE: Validar o registrar en clientes
    const rawCustomer = invoiceData.customer || {};
    const custTaxId = String(rawCustomer.taxId || rawCustomer.docNumber || rawCustomer.cedula || rawCustomer.ruc || invoiceData.customerTaxId || '9999999999999').trim();
    const custName = String(rawCustomer.name || invoiceData.customerName || 'CONSUMIDOR FINAL').trim();
    const custDocType = rawCustomer.docType || (custTaxId === '9999999999999' ? 'C.I.' : (custTaxId.length === 13 ? 'RUC' : 'C.I.'));
    const custEmail = rawCustomer.email || null;
    const custPhone = rawCustomer.phone || null;
    const custAddress = rawCustomer.address || 'Venta Mostrador';

    let customerDbId: string = 'cust-general';
    const custCheck = await client.query('SELECT id FROM clientes WHERE tax_id = $1;', [custTaxId]);
    if (custCheck.rows.length > 0) {
      customerDbId = custCheck.rows[0].id;
    } else {
      customerDbId = `cust-${Date.now()}`;
      await client.query(`
        INSERT INTO clientes (id, name, tax_id, doc_type, email, phone, address, current_debt, credit_limit, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0.00, 0.00, NOW())
        ON CONFLICT (tax_id) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
      `, [customerDbId, custName, custTaxId, custDocType, custEmail, custPhone, custAddress]);
    }

    // 5. CÁLCULO DE TOTALES Y VALIDACIONES
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedDiscount = 0;

    for (const item of invoiceData.items) {
      const qty = Math.max(0.01, Number(item.quantity ?? 1));
      const price = Math.max(0, Number(item.price ?? 0));
      const disc = Math.max(0, Number(item.discount ?? 0));
      const lineSubtotal = Math.max(0, qty * price - disc);
      const hasIva = item.has_iva !== undefined ? Boolean(item.has_iva) : (item.taxRate !== undefined ? Number(item.taxRate) > 0 : true);
      const ivaRate = hasIva ? Math.max(0, Number(item.taxRate ?? item.iva_rate ?? 15)) : 0;
      const lineTax = Number((lineSubtotal * (ivaRate / 100)).toFixed(2));

      calculatedSubtotal += lineSubtotal;
      calculatedTax += lineTax;
      calculatedDiscount += disc;
    }

    calculatedSubtotal = Number(calculatedSubtotal.toFixed(2));
    calculatedTax = Number(calculatedTax.toFixed(2));
    calculatedDiscount = Number(calculatedDiscount.toFixed(2));
    const calculatedTotal = Number((calculatedSubtotal + calculatedTax).toFixed(2));

    const paymentMethod = invoiceData.paymentMethod || 'EFECTIVO';
    const seller = req.user?.name || invoiceData.seller || 'Cajero';
    const accessKey = invoiceData.accessKey || invoiceData.claveAcceso || null;

    // 6. CONTROL DE EXISTENCIAS Y KARDEX: Lock exclusivo FOR UPDATE por producto
    for (const item of invoiceData.items) {
      const prodLookup = item.productId || item.id || item.code;
      if (prodLookup) {
        const prodRes = await client.query(`
          SELECT id, name, stock, cost_price, sale_price 
          FROM productos 
          WHERE id = $1 OR code = $1 OR sku = $1 
          FOR UPDATE;
        `, [prodLookup]);

        if (prodRes.rows.length > 0) {
          const product = prodRes.rows[0];
          const qty = Math.max(0.01, Number(item.quantity ?? 1));
          const currentStock = Number(product.stock);
          const newStock = Math.max(0, Number((currentStock - qty).toFixed(2)));
          const unitCost = Number(product.cost_price);
          const totalCost = Number((qty * unitCost).toFixed(4));

          await client.query(`
            UPDATE productos 
            SET stock = $1, updated_at = NOW() 
            WHERE id = $2;
          `, [newStock, product.id]);

          const kardexId = `kdx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await client.query(`
            INSERT INTO kardex_movimientos (
              id, product_id, product_name, date, type, reason,
              quantity, cost_unit, total_cost, stock_balance, document_ref, user_id
            )
            VALUES ($1, $2, $3, NOW(), 'VENTA', $4, $5, $6, $7, $8, $9, $10);
          `, [
            kardexId, product.id, product.name,
            `Venta mostrador factura ${invoiceNumber}`,
            -qty, unitCost, totalCost, newStock, invoiceNumber, req.user?.id || null
          ]);

          broadcastSse({
            type: 'product_stock_updated',
            productId: product.id,
            stock: newStock
          });
        }
      }
    }

    // 7. INSERTAR FACTURA EN facturas_ventas
    const insertInvRes = await client.query(`
      INSERT INTO facturas_ventas (
        id, invoice_number, establishment, emission_point, sequential,
        date, customer_id, customer_name, customer_tax_id, seller,
        subtotal, tax, discount, total, payment_method, status,
        sri_status, access_key, items, data, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11, $12, $13, $14, 'EMITIDA', 'PENDIENTE', $15, $16::jsonb, $17::jsonb, NOW())
      RETURNING *;
    `, [
      invoiceId, invoiceNumber, establishment, emissionPoint, currentSequential,
      customerDbId, custName, custTaxId, seller,
      calculatedSubtotal, calculatedTax, calculatedDiscount, calculatedTotal,
      paymentMethod, accessKey, JSON.stringify(invoiceData.items), JSON.stringify(invoiceData)
    ]);

    // 8. INSERTAR DETALLES NORMALIZADOS EN factura_detalles
    for (let i = 0; i < invoiceData.items.length; i++) {
      const it = invoiceData.items[i];
      const detId = `${invoiceId}-det-${i + 1}`;
      const qty = Math.max(0.01, Number(it.quantity ?? 1));
      const price = Math.max(0, Number(it.price ?? 0));
      const disc = Math.max(0, Number(it.discount ?? 0));
      const lineSubt = Math.max(0, qty * price - disc);
      const hasIva = it.has_iva !== undefined ? Boolean(it.has_iva) : true;
      const ivaRate = hasIva ? Math.max(0, Number(it.taxRate ?? 15)) : 0;
      const lineTax = Number((lineSubt * (ivaRate / 100)).toFixed(2));
      const lineTotal = Number((lineSubt + lineTax).toFixed(2));

      // Verificar si el producto existe para la FK
      let validProdId: string | null = null;
      const pCheck = await client.query('SELECT id FROM productos WHERE id = $1 OR code = $1;', [it.productId || it.id]);
      if (pCheck.rows.length > 0) {
        validProdId = pCheck.rows[0].id;
      }

      await client.query(`
        INSERT INTO factura_detalles (
          id, factura_id, product_id, codigo, descripcion,
          cantidad, precio_unitario, descuento, subtotal,
          has_iva, iva_rate, iva_valor, total, data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb);
      `, [
        detId, invoiceId, validProdId, it.code || it.sku || null,
        it.name || 'Artículo', qty, price, disc, lineSubt,
        hasIva, ivaRate, lineTax, lineTotal, JSON.stringify(it)
      ]);
    }

    // 9. ASIENTO CONTABLE RELACIONAL CON PARTIDA DOBLE
    const journalEntryId = `ASI-${invoiceYear}-${invoiceNumber.replace(/[^\w]/g, '_')}`;
    let debitAccountCode = '1.1.01.01';
    let debitAccountName = 'Caja General / Efectivo';

    if (paymentMethod === 'TRANSFERENCIA' || paymentMethod === '20') {
      debitAccountCode = '1.1.01.02';
      debitAccountName = 'Bancos e Instituciones Financieras';
    } else if (paymentMethod.includes('TARJETA') || paymentMethod === '16' || paymentMethod === '19') {
      debitAccountCode = '1.1.01.03';
      debitAccountName = 'Tarjetas de Débito/Crédito por Cobrar';
    } else if (paymentMethod.includes('CREDITO')) {
      debitAccountCode = '1.1.02.01';
      debitAccountName = 'Cuentas por Cobrar Clientes';
    }

    const journalItems = [
      { accountCode: debitAccountCode, accountName: debitAccountName, debit: calculatedTotal, credit: 0 },
      { accountCode: '4.1.01.01', accountName: 'Ventas Mostrador Ferretería', debit: 0, credit: calculatedSubtotal }
    ];
    if (calculatedTax > 0) {
      journalItems.push({ accountCode: '2.1.07.01', accountName: 'IVA Ventas por Pagar SRI', debit: 0, credit: calculatedTax });
    }

    await client.query(`
      INSERT INTO asientos_contables (
        id, entry_number, date, concept, type, document_reference,
        total_debit, total_credit, is_balanced, status, items, data, created_by
      )
      VALUES ($1, $2, NOW(), $3, 'INGRESO', $4, $5, $6, true, 'ASENTADO', $7::jsonb, $8::jsonb, $9)
      ON CONFLICT (id) DO NOTHING;
    `, [
      journalEntryId, journalEntryId, `Venta según ${invoiceNumber} - Cliente: ${custName}`,
      invoiceNumber, calculatedTotal, calculatedTotal, JSON.stringify(journalItems),
      JSON.stringify({ journalItems }), req.user?.username || seller
    ]);

    // Insertar líneas contables en asiento_lineas
    for (let j = 0; j < journalItems.length; j++) {
      const ji = journalItems[j];
      const lineaId = `${journalEntryId}-linea-${j + 1}`;
      let accId: string | null = null;
      const accRes = await client.query('SELECT id FROM plan_cuentas_contable WHERE code = $1 LIMIT 1;', [ji.accountCode]);
      if (accRes.rows.length > 0) accId = accRes.rows[0].id;

      await client.query(`
        INSERT INTO asiento_lineas (
          id, asiento_id, account_id, account_code, account_name, concept, debit, credit
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [lineaId, journalEntryId, accId, ji.accountCode, ji.accountName, `Factura ${invoiceNumber}`, ji.debit, ji.credit]);
    }

    // Enlazar factura con el asiento contable
    await client.query(`
      UPDATE facturas_ventas SET journal_entry_id = $1 WHERE id = $2;
    `, [journalEntryId, invoiceId]);

    // 10. CAJA: Actualización atómica en sesiones_caja
    const isCash = paymentMethod === 'EFECTIVO' || paymentMethod === '01';
    await client.query(`
      UPDATE sesiones_caja
      SET total_sales_cash = total_sales_cash + $1,
          expected_cash = expected_cash + $2,
          total_sales_transfer = total_sales_transfer + $3,
          total_sales_card = total_sales_card + $4,
          total_sales_credit = total_sales_credit + $5,
          total_invoices_count = total_invoices_count + 1,
          updated_at = NOW()
      WHERE status = 'ABIERTA' AND emission_point = $6;
    `, [
      isCash ? calculatedTotal : 0,
      isCash ? calculatedTotal : 0,
      paymentMethod === 'TRANSFERENCIA' || paymentMethod === '20' ? calculatedTotal : 0,
      paymentMethod.includes('TARJETA') ? calculatedTotal : 0,
      paymentMethod.includes('CREDITO') ? calculatedTotal : 0,
      emissionPoint
    ]);

    // 11. BITÁCORA DE AUDITORÍA
    await client.query(`
      INSERT INTO bitacora_auditoria (
        id, timestamp, user_id, username, role, action, entity, entity_id, emission_point, details
      )
      VALUES ($1, NOW(), $2, $3, $4, 'EMISION_FACTURA_ACID', 'facturas_ventas', $5, $6, $7::jsonb);
    `, [
      `aud-${Date.now()}`, req.user?.id || null, req.user?.username || seller,
      req.user?.role || 'Cajero', invoiceNumber, emissionPoint,
      JSON.stringify({ total: calculatedTotal, itemsCount: invoiceData.items.length, sequential: currentSequential })
    ]);

    // 12. ENCOLAR EN COLA_SRI
    const queueClave = accessKey || `PENDIENTE-${invoiceNumber}`;
    await client.query(`
      INSERT INTO cola_sri (
        id, invoice_id, invoice_number, establishment, emission_point,
        clave_acceso, customer_name, customer_tax_id, total, estado,
        reintentos, max_reintentos, fecha_creacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'EN_COLA', 0, 20, NOW())
      ON CONFLICT (id) DO UPDATE SET total = EXCLUDED.total;
    `, [
      `QUEUE-${queueClave}`, invoiceId, invoiceNumber, establishment, emissionPoint,
      queueClave, custName, custTaxId, calculatedTotal
    ]);

    // 13. CONFIRMAR TRANSACCIÓN ACID
    await client.query('COMMIT;');

    const createdRow = insertInvRes.rows[0];
    const finalInvoice = mapInvoiceRow(createdRow, invoiceData.items);

    // Notificar por SSE a terminales
    broadcastSse({
      type: 'invoice_created',
      invoice: finalInvoice,
      invoiceId,
      invoiceNumber
    });

    return res.status(201).json({
      success: true,
      message: 'Factura emitida y registrada exitosamente en SQLite (ACID).',
      data: finalInvoice,
      invoice: finalInvoice,
      sequential: invoiceNumber
    });
  } catch (error: any) {
    await client.query('ROLLBACK;');
    console.error('[Create Invoice Error - Rolled Back]:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar la factura en la base de datos (transacción revertida).',
      error: error.message
    });
  } finally {
    client.release();
  }
}

/**
 * CONTROL DE CONCURRENCIA: RESERVA ATÓMICA DE SECUENCIALES POR PUNTO DE EMISIÓN
 */
export async function reserveSequential(req: Request, res: Response) {
  const pool = getPgPool();
  try {
    const establishment = String(req.body.establishment || '001').padStart(3, '0').slice(-3);
    const emissionPoint = String(req.body.emissionPoint || '001').padStart(3, '0').slice(-3);
    const documentType = String(req.body.documentType || '01').padStart(2, '0').slice(-2);
    const requestedSequential = req.body.requestedSequential ? parseInt(String(req.body.requestedSequential), 10) : undefined;

    let nextNum: number;

    // Si se envía un secuencial solicitado (por ej. factura emitida offline, reenvío o terminal), respetarlo siempre y sincronizar la tabla
    if (requestedSequential && requestedSequential > 0) {
      await pool.query(`
        INSERT INTO secuenciales_emision (
          id, establishment, emission_point, document_type, name, current_sequential, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (establishment, emission_point, document_type)
        DO UPDATE SET current_sequential = GREATEST(secuenciales_emision.current_sequential, EXCLUDED.current_sequential), updated_at = NOW();
      `, [`${establishment}-${emissionPoint}-${documentType}`, establishment, emissionPoint, documentType, `Punto ${emissionPoint}`, requestedSequential]);
      nextNum = requestedSequential;
    } else {
      const seqRes = await pool.query(`
        UPDATE secuenciales_emision
        SET current_sequential = current_sequential + 1, updated_at = NOW()
        WHERE establishment = $1 AND emission_point = $2 AND document_type = $3
        RETURNING current_sequential;
      `, [establishment, emissionPoint, documentType]);

      if (seqRes.rows.length > 0) {
        nextNum = Number(seqRes.rows[0].current_sequential);
      } else {
        const initRes = await pool.query(`
          INSERT INTO secuenciales_emision (
            id, establishment, emission_point, document_type, name, current_sequential, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, 1, NOW())
          ON CONFLICT (establishment, emission_point, document_type)
          DO UPDATE SET current_sequential = secuenciales_emision.current_sequential + 1, updated_at = NOW()
          RETURNING current_sequential;
        `, [`${establishment}-${emissionPoint}-${documentType}`, establishment, emissionPoint, documentType, `Caja ${emissionPoint}`]);
        nextNum = Number(initRes.rows[0].current_sequential);
      }
    }

    const sequentialFormatted = String(nextNum).padStart(9, '0');
    const fullNumber = `${establishment}-${emissionPoint}-${sequentialFormatted}`;

    return res.status(200).json({
      success: true,
      establishment,
      emissionPoint,
      documentType,
      sequentialNumber: nextNum,
      sequential: sequentialFormatted,
      fullNumber
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al reservar secuencial atómico en SQLite.',
      error: error.message
    });
  }
}

/**
 * ACTUALIZAR O ESTABLECER SECUENCIALES DE EMISIÓN DESDE CONFIGURACIÓN
 */
export async function updateSequential(req: Request, res: Response) {
  const pool = getPgPool();
  try {
    const establishment = String(req.body.establishment || '001').padStart(3, '0').slice(-3);
    const emissionPoint = String(req.body.emissionPoint || '001').padStart(3, '0').slice(-3);
    const documentType = String(req.body.documentType || '01').padStart(2, '0').slice(-2);
    
    // nextSequential es el número que el usuario espera que sea emitido a continuación
    const nextSeq = Math.max(1, parseInt(String(req.body.nextSequential || req.body.sequential || '1'), 10));
    // current_sequential se establece en nextSeq - 1 para que el próximo incremento dé exactamente nextSeq
    const currentSequential = Math.max(0, nextSeq - 1);
    
    const id = `${establishment}-${emissionPoint}-${documentType}`;
    const name = req.body.name || (documentType === '01' ? 'Factura Electrónica' : (documentType === '04' ? 'Nota de Crédito' : 'Retención'));

    await pool.query(`
      INSERT INTO secuenciales_emision (
        id, establishment, emission_point, document_type, name, current_sequential, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (establishment, emission_point, document_type)
      DO UPDATE SET current_sequential = EXCLUDED.current_sequential, updated_at = NOW();
    `, [id, establishment, emissionPoint, documentType, name, currentSequential]);

    return res.status(200).json({
      success: true,
      message: `Secuencial para ${establishment}-${emissionPoint} (${documentType}) actualizado a ${nextSeq}.`,
      establishment,
      emissionPoint,
      documentType,
      currentSequential,
      nextSequential: nextSeq,
      formattedNext: String(nextSeq).padStart(9, '0'),
      fullNumber: `${establishment}-${emissionPoint}-${String(nextSeq).padStart(9, '0')}`
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar secuencial en SQLite.',
      error: error.message
    });
  }
}

/**
 * LISTAR LOS 4 PUNTOS DE EMISIÓN CON SU SECUENCIAL DIRECTO DE SQLITE
 */
export async function getEmissionPoints(req: Request, res: Response) {
  const pool = getPgPool();
  try {
    const DEFAULT_POINTS = [
      { establishment: '001', emissionPoint: '001', name: 'Caja 1 - Principal (001)', description: 'Terminal de caja principal y facturación rápida' },
      { establishment: '001', emissionPoint: '002', name: 'Caja 2 - Mostrador (002)', description: 'Terminal de mostrador y atención al cliente' },
      { establishment: '001', emissionPoint: '003', name: 'Caja 3 - Patio / Bodega (003)', description: 'Terminal de despacho y patio de materiales' },
      { establishment: '001', emissionPoint: '004', name: 'Caja 4 - Express / Mayorista (004)', description: 'Terminal para ventas mayoristas y pedidos especiales' }
    ];

    const records = await pool.query(`
      SELECT establishment, emission_point, current_sequential 
      FROM secuenciales_emision 
      WHERE document_type = '01';
    `);

    const recordsMap = new Map<string, number>();
    for (const r of records.rows) {
      recordsMap.set(`${r.establishment}-${r.emission_point}`, Number(r.current_sequential));
    }

    const result = DEFAULT_POINTS.map(p => {
      const key = `${p.establishment}-${p.emissionPoint}`;
      const currentSeq = recordsMap.get(key) ?? 0;
      const nextSeq = currentSeq === 0 ? 1 : currentSeq + 1;
      return {
        ...p,
        currentSequential: currentSeq,
        nextSequential: nextSeq,
        formattedSequential: String(nextSeq).padStart(9, '0'),
        nextFullNumber: `${p.establishment}-${p.emissionPoint}-${String(nextSeq).padStart(9, '0')}`,
        active: true
      };
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al listar puntos de emisión.',
      error: error.message
    });
  }
}
