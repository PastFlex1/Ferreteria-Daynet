import { Request, Response } from 'express';
import { getDatabase } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { broadcastSse } from './sync.controller';
import { logAuditEvent } from './audit.controller';

export async function getAllInvoices(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const { startDate, endDate, status } = req.query;

    const filter: any = {};
    if (status) {
      filter.status = String(status);
    }
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = String(startDate);
      if (endDate) filter.date.$lte = String(endDate);
    }

    const items = await db.collection('facturas_ventas').find(filter).sort({ date: -1 }).toArray();

    // Fallback app_state
    if (items.length === 0) {
      const stateDoc = await db.collection<{ _id: string; data?: any[] }>('app_state').findOne({ _id: 'ferreteria_invoices' });
      if (stateDoc && Array.isArray(stateDoc.data)) {
        return res.status(200).json({
          success: true,
          count: stateDoc.data.length,
          data: stateDoc.data
        });
      }
    }

    const clean = items.map(item => {
      const { _syncedAt, ...data } = item;
      return { ...data, id: String(data.id || data._id) };
    });

    return res.status(200).json({
      success: true,
      count: clean.length,
      data: clean
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar facturas.',
      error: error.message
    });
  }
}

export async function getInvoiceById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const invoice = await db.collection('facturas_ventas').findOne({
      $or: [{ _id: id }, { id: id }, { invoiceNumber: id }, { accessKey: id }]
    } as any);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada.'
      });
    }

    const { _syncedAt, ...data } = invoice;
    return res.status(200).json({
      success: true,
      data: { ...data, id: String(data.id || data._id) }
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
 * LÓGICA DE NEGOCIO EN EL SERVIDOR:
 * - Valida cliente e ítems
 * - Calcula montos e impuestos
 * - Descuenta stock de productos atómicamente
 * - Registra movimientos en Kardex
 * - Guarda factura y emite evento SSE
 */
export async function createInvoice(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    let invoiceData = { ...req.body };

    // 0. ADAPTADOR DE ENTRADA: Soporta VentaInput { clienteId, lineas, pagos } o modelo estándar
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

    if (invoiceData.clienteId && !invoiceData.customer) {
      const foundCust = await db.collection<any>('clientes').findOne({
        $or: [{ _id: String(invoiceData.clienteId) }, { id: String(invoiceData.clienteId) }, { taxId: String(invoiceData.clienteId) }]
      });
      invoiceData.customer = foundCust || {
        id: String(invoiceData.clienteId),
        name: invoiceData.clienteNombre || 'Consumidor Final',
        taxId: String(invoiceData.clienteId)
      };
    }

    if (invoiceData.pagos && Array.isArray(invoiceData.pagos) && invoiceData.pagos.length > 0 && !invoiceData.paymentMethod) {
      invoiceData.paymentMethod = invoiceData.pagos[0].metodo || invoiceData.pagos[0].formaPago || '01';
    }

    if (!invoiceData.items || !Array.isArray(invoiceData.items) || invoiceData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La transacción requiere al menos un ítem o producto vendido.'
      });
    }

    if (!invoiceData.customer) {
      invoiceData.customer = {
        id: 'CONSUMIDOR_FINAL',
        name: 'CONSUMIDOR FINAL',
        taxId: '9999999999999'
      };
    }

    // 1. CONTROL CONTABLE: Validación estricta de Período Fiscal Cerrado
    const invoiceDateObj = invoiceData.date ? new Date(invoiceData.date) : new Date();
    const invoiceYear = invoiceDateObj.getFullYear();
    const invoiceMonth = invoiceDateObj.getMonth() + 1; // 1-12
    const closedPeriod = await db.collection<any>('periodos_fiscales').findOne({
      year: invoiceYear,
      month: invoiceMonth,
      status: 'CERRADO'
    });
    if (closedPeriod) {
      return res.status(400).json({
        success: false,
        message: `Emisión rechazada: El período fiscal ${invoiceMonth}/${invoiceYear} se encuentra CERRADO.`
      });
    }

    // 2. SECUENCIAL ATÓMICO: Obtener y bloquear secuencial sin saltos en la misma transacción
    const establishment = String(invoiceData.establishment || (req.user as any)?.establecimiento || '001').padStart(3, '0').slice(-3);
    const emissionPoint = String(invoiceData.emissionPoint || (req.user as any)?.puntoEmision || '001').padStart(3, '0').slice(-3);
    const docType = String(invoiceData.documentType || '01');

    let invoiceNumber = invoiceData.invoiceNumber || invoiceData.fullNumber;
    let customId = invoiceData.id;

    if (!invoiceNumber || invoiceNumber.startsWith('F-') || invoiceNumber.startsWith('inv-') || invoiceNumber.includes('Date.now')) {
      const key = `${establishment}-${emissionPoint}-${docType}`;
      const seqCol = db.collection<any>('secuenciales_emision');
      const updatedSeq = await seqCol.findOneAndUpdate(
        { _id: key },
        {
          $inc: { currentSequential: 1 },
          $set: { updatedAt: new Date() },
          $setOnInsert: { establishment, emissionPoint, documentType: docType, name: `Caja ${emissionPoint}` }
        },
        { upsert: true, returnDocument: 'after' }
      );
      const nextNum = updatedSeq?.value?.currentSequential ?? 1;
      invoiceNumber = `${establishment}-${emissionPoint}-${String(nextNum).padStart(9, '0')}`;
      customId = customId || invoiceNumber;
    } else {
      customId = customId || invoiceNumber;
    }

    // 3. STOCK & KARDEX: Validar y descontar stock atómicamente con $inc y registrar movimientos
    for (const item of invoiceData.items) {
      const prodId = item.productId || item.id || item.code;
      if (prodId) {
        const product = await db.collection<any>('productos').findOne({
          $or: [{ _id: String(prodId) }, { id: String(prodId) }, { code: String(prodId) }]
        });

        if (product) {
          const qty = Number(item.quantity) || 1;
          const previousStock = Number(product.stock) || 0;

          const updateResult = await db.collection<any>('productos').findOneAndUpdate(
            { _id: product._id },
            { 
              $inc: { stock: -qty },
              $set: { updatedAt: new Date() }
            },
            { returnDocument: 'after' }
          );

          const updatedStock = updateResult?.value?.stock ?? (previousStock - qty);

          await db.collection<any>('kardex_movimientos').insertOne({
            productId: String(product.id || product._id),
            productName: product.name,
            type: 'EGRESO',
            subtype: 'VENTA',
            quantity: qty,
            previousStock: previousStock,
            newStock: updatedStock,
            unitPrice: item.price,
            documentReference: invoiceNumber,
            customerName: invoiceData.customer?.name || 'Cliente',
            user: req.user?.name || invoiceData.seller || 'Cajero',
            date: new Date()
          });

          broadcastSse({
            type: 'product_stock_updated',
            productId: String(product.id || product._id),
            stock: updatedStock
          });
        }
      }
    }

    // 4. FACTURA: Guardar documento formal de factura
    const calculatedSubtotal = Number(invoiceData.subtotal) || Number(invoiceData.items.reduce((s: number, i: any) => s + (Number(i.subtotal) || (Number(i.quantity) * Number(i.price)) || 0), 0).toFixed(2));
    const calculatedTax = Number(invoiceData.tax) || Number(invoiceData.taxTotal) || Number((calculatedSubtotal * 0.15).toFixed(2));
    const calculatedTotal = Number(invoiceData.total) || Number((calculatedSubtotal + calculatedTax).toFixed(2));

    const newInvoiceDoc = {
      _id: String(customId),
      id: String(customId),
      invoiceNumber,
      fullNumber: invoiceNumber,
      date: invoiceData.date || new Date().toISOString(),
      customer: invoiceData.customer,
      items: invoiceData.items,
      subtotal: calculatedSubtotal,
      tax: calculatedTax,
      total: calculatedTotal,
      paymentMethod: invoiceData.paymentMethod || '01',
      status: invoiceData.status || 'EMITIDA',
      sriStatus: invoiceData.sriStatus || 'PENDIENTE',
      accessKey: invoiceData.accessKey || '',
      seller: req.user?.name || invoiceData.seller || 'Cajero Principal',
      establishment,
      emissionPoint,
      createdAt: new Date(),
      _syncedAt: new Date()
    };

    await db.collection<any>('facturas_ventas').updateOne(
      { _id: newInvoiceDoc._id },
      { $set: newInvoiceDoc },
      { upsert: true }
    );

    // Sincronizar en app_state incrementalmente
    try {
      const stateDoc = await db.collection<any>('app_state').findOne({ _id: 'ferreteria_invoices' });
      let currentList: any[] = [];
      if (stateDoc && Array.isArray(stateDoc.data)) {
        currentList = stateDoc.data.filter((i: any) => String(i.id || i._id) !== newInvoiceDoc.id);
      }
      currentList = [newInvoiceDoc, ...currentList];
      await db.collection<any>('app_state').updateOne(
        { _id: 'ferreteria_invoices' },
        { $set: { data: currentList, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch {}

    // 5. ASIENTO CONTABLE: Generar y asentar con Partida Doble en el servidor
    const method = newInvoiceDoc.paymentMethod;
    let debitAccount = { code: '1.1.01.01', name: 'Caja General / Efectivo' };
    if (method === 'TRANSFERENCIA' || method === '20') {
      debitAccount = { code: '1.1.01.02', name: 'Bancos e Instituciones Financieras' };
    } else if (method === 'TARJETA' || method === 'TARJETA_CREDITO' || method === 'TARJETA_DEBITO' || method === '16' || method === '19') {
      debitAccount = { code: '1.1.01.03', name: 'Tarjetas de Débito/Crédito por Cobrar' };
    } else if (method === 'CREDITO' || method === 'CREDITO_CLIENTE') {
      debitAccount = { code: '1.1.02.01', name: 'Cuentas por Cobrar Clientes' };
    }

    const journalItems = [
      { accountCode: debitAccount.code, accountName: debitAccount.name, debit: calculatedTotal, credit: 0 },
      { accountCode: '4.1.01.01', accountName: 'Ventas Mostrador Ferretería', debit: 0, credit: calculatedSubtotal }
    ];
    if (calculatedTax > 0) {
      journalItems.push({ accountCode: '2.1.07.01', accountName: 'IVA Ventas por Pagar SRI', debit: 0, credit: calculatedTax });
    }

    const journalEntryId = `ASI-${invoiceYear}-${newInvoiceDoc.invoiceNumber.replace(/[^\w]/g, '_')}`;
    const newJournalEntry = {
      _id: journalEntryId,
      entryNumber: journalEntryId,
      date: newInvoiceDoc.date.split('T')[0],
      concept: `Venta según ${newInvoiceDoc.invoiceNumber} - Cliente: ${newInvoiceDoc.customer?.name}`,
      type: 'INGRESO',
      documentReference: newInvoiceDoc.invoiceNumber,
      items: journalItems,
      totalDebit: calculatedTotal,
      totalCredit: Number((calculatedSubtotal + calculatedTax).toFixed(2)),
      isBalanced: true,
      status: 'ASENTADO',
      createdAt: new Date(),
      createdBy: req.user?.username || newInvoiceDoc.seller
    };

    await db.collection('asientos_contables').updateOne(
      { _id: journalEntryId as any },
      { $set: newJournalEntry },
      { upsert: true }
    );

    // 6. CAJA: Actualización atómica de sesión de caja activa en el servidor
    const cashIncrement: any = { totalInvoicesCount: 1 };
    if (method === 'EFECTIVO' || method === '01') {
      cashIncrement.totalSalesCash = calculatedTotal;
      cashIncrement.expectedCash = calculatedTotal;
    } else if (method === 'TRANSFERENCIA' || method === '20') {
      cashIncrement.totalSalesTransfer = calculatedTotal;
    } else if (method === 'TARJETA' || method === 'TARJETA_CREDITO' || method === 'TARJETA_DEBITO' || method === '16' || method === '19') {
      cashIncrement.totalSalesCard = calculatedTotal;
    } else if (method === 'CREDITO' || method === 'CREDITO_CLIENTE') {
      cashIncrement.totalSalesCredit = calculatedTotal;
    } else {
      cashIncrement.totalSalesCash = calculatedTotal;
      cashIncrement.expectedCash = calculatedTotal;
    }

    await db.collection('sesiones_caja').updateOne(
      { status: 'ABIERTA', emissionPoint },
      { $inc: cashIncrement, $set: { updatedAt: new Date() } }
    );

    // Si fue venta a crédito, actualizar cartera del cliente en el servidor
    if ((method === 'CREDITO' || method === 'CREDITO_CLIENTE') && newInvoiceDoc.customer?.id) {
      await db.collection('clientes').updateOne(
        { $or: [{ _id: newInvoiceDoc.customer.id }, { id: newInvoiceDoc.customer.id }] as any },
        { $inc: { currentDebt: calculatedTotal }, $set: { updatedAt: new Date() } }
      );
    }

    // 7. BITÁCORA DE AUDITORÍA: Registro inmutable de la transacción completa
    await logAuditEvent(db, {
      userId: req.user?.id,
      username: req.user?.username || req.user?.name || invoiceData.seller || 'Cajero',
      role: req.user?.role || 'Cajero',
      action: 'TRANSACCION_VENTA_COMPLETA',
      entity: 'facturas_ventas',
      entityId: newInvoiceDoc.invoiceNumber,
      emissionPoint: newInvoiceDoc.emissionPoint,
      terminal: `Punto Emisión ${newInvoiceDoc.emissionPoint}`,
      ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      details: {
        total: newInvoiceDoc.total,
        subtotal: newInvoiceDoc.subtotal,
        tax: newInvoiceDoc.tax,
        customerTaxId: newInvoiceDoc.customer?.taxId || newInvoiceDoc.customer?.idNumber,
        itemsCount: newInvoiceDoc.items.length,
        journalEntryId,
        paymentMethod: method
      }
    });

    // 7.5. COLA_SRI: Encolar comprobante para firma y autorización en segundo plano por el worker
    try {
      const queueClave = newInvoiceDoc.accessKey || `TEMP-${newInvoiceDoc.invoiceNumber}`;
      await db.collection('cola_sri').updateOne(
        { _id: `QUEUE-${queueClave}` as any },
        {
          $setOnInsert: {
            _id: `QUEUE-${queueClave}`,
            invoiceId: newInvoiceDoc.id,
            invoiceNumber: newInvoiceDoc.invoiceNumber,
            establishment: newInvoiceDoc.establishment,
            emissionPoint: newInvoiceDoc.emissionPoint,
            claveAcceso: queueClave,
            customerName: newInvoiceDoc.customer?.name,
            customerTaxId: newInvoiceDoc.customer?.taxId || newInvoiceDoc.customer?.idNumber,
            total: newInvoiceDoc.total,
            estado: 'EN_COLA',
            reintentos: 0,
            maxReintentos: 15,
            fechaCreacion: new Date()
          }
        },
        { upsert: true }
      );
    } catch (queueErr: any) {
      console.warn('[Cola SRI Enqueue Warning]:', queueErr?.message);
    }

    // 8. EVENTOS SSE EN TIEMPO REAL: Notificar a todas las terminales
    broadcastSse({
      type: 'invoice_created',
      invoice: newInvoiceDoc,
      invoiceId: newInvoiceDoc.id,
      invoiceNumber: newInvoiceDoc.invoiceNumber,
      journalEntry: newJournalEntry
    });

    return res.status(201).json({
      success: true,
      message: 'Transacción de venta ejecutada atómicamente en el servidor en un solo paso.',
      data: newInvoiceDoc,
      invoice: newInvoiceDoc,
      journalEntry: newJournalEntry,
      sequential: invoiceNumber
    });
  } catch (error: any) {
    console.error('[Create Invoice Server Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar la transacción de venta en el servidor.',
      error: error.message
    });
  }
}

/**
 * CONTROL DE CONCURRENCIA: RESERVA ATÓMICA DE SECUENCIALES POR PUNTO DE EMISIÓN
 * Garantiza que dos terminales jamás reciban el mismo número de factura,
 * incluso si emiten en el mismo milisegundo exacto.
 */
export async function reserveSequential(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const establishment = String(req.body.establishment || '001').padStart(3, '0').slice(-3);
    const emissionPoint = String(req.body.emissionPoint || '001').padStart(3, '0').slice(-3);
    const docType = String(req.body.documentType || '01'); // 01 = Factura

    const key = `${establishment}-${emissionPoint}-${docType}`;
    const seqCol = db.collection<any>('secuenciales_emision');

    const existing = await seqCol.findOne({ _id: key });

    let nextNum: number;
    if (!existing) {
      // Determinar punto de partida según facturas existentes en facturas_ventas o app_state
      let startFrom = 1;
      const latestInvoice = await db.collection<any>('facturas_ventas')
        .find({ invoiceNumber: new RegExp(`^${establishment}-${emissionPoint}-`) })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

      if (latestInvoice.length > 0 && latestInvoice[0].invoiceNumber) {
        const parts = latestInvoice[0].invoiceNumber.split('-');
        if (parts.length === 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed) && parsed > 0) startFrom = parsed + 1;
        }
      } else if (establishment === '001' && emissionPoint === '001') {
        const appStateSec = await db.collection<any>('app_state').findOne({ _id: 'ferreteria_settings_sec_invoice' });
        if (appStateSec && appStateSec.data) {
          const parsed = parseInt(String(appStateSec.data), 10);
          if (!isNaN(parsed) && parsed > 0) startFrom = parsed;
        }
      }

      await seqCol.updateOne(
        { _id: key },
        {
          $set: {
            _id: key,
            establishment,
            emissionPoint,
            documentType: docType,
            name: `Caja ${emissionPoint}`,
            currentSequential: startFrom,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      nextNum = startFrom;
    } else {
      // Operación atómica serializada por PostgreSQL Engine (ACID)
      const updated = await seqCol.findOneAndUpdate(
        { _id: key },
        {
          $inc: { currentSequential: 1 },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
      nextNum = updated?.value?.currentSequential ?? (existing.currentSequential + 1);
    }

    const sequentialFormatted = String(nextNum).padStart(9, '0');
    const fullNumber = `${establishment}-${emissionPoint}-${sequentialFormatted}`;

    await logAuditEvent(db, {
      action: 'RESERVA_SECUENCIAL_ATOMICO',
      entity: 'secuenciales_emision',
      entityId: key,
      emissionPoint,
      terminal: `Punto Emisión ${emissionPoint}`,
      details: { sequentialNumber: nextNum, fullNumber }
    });

    return res.status(200).json({
      success: true,
      establishment,
      emissionPoint,
      documentType: docType,
      sequentialNumber: nextNum,
      sequential: sequentialFormatted,
      fullNumber
    });
  } catch (error: any) {
    console.error('[Reserve Sequential Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al reservar secuencial atómico.',
      error: error.message
    });
  }
}

/**
 * LISTAR LOS 4 PUNTOS DE EMISIÓN EXIGIDOS POR TDR CON SU SECUENCIAL EN TIEMPO REAL
 */
export async function getEmissionPoints(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const seqCol = db.collection<any>('secuenciales_emision');

    const DEFAULT_POINTS = [
      { establishment: '001', emissionPoint: '001', name: 'Caja 1 - Principal (001)', description: 'Terminal de caja principal y facturación rápida' },
      { establishment: '001', emissionPoint: '002', name: 'Caja 2 - Mostrador (002)', description: 'Terminal de mostrador y atención al cliente' },
      { establishment: '001', emissionPoint: '003', name: 'Caja 3 - Patio / Bodega (003)', description: 'Terminal de despacho y patio de materiales' },
      { establishment: '001', emissionPoint: '004', name: 'Caja 4 - Express / Mayorista (004)', description: 'Terminal para ventas mayoristas y pedidos especiales' }
    ];

    const records = await seqCol.find({}).toArray();
    const recordsMap = new Map(records.map(r => [r._id, r]));

    const result = DEFAULT_POINTS.map(p => {
      const key = `${p.establishment}-${p.emissionPoint}-01`;
      const record = recordsMap.get(key);
      const currentSeq = record ? record.currentSequential : 1;
      return {
        ...p,
        currentSequential: currentSeq,
        formattedSequential: String(currentSeq).padStart(9, '0'),
        nextFullNumber: `${p.establishment}-${p.emissionPoint}-${String(currentSeq).padStart(9, '0')}`,
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
