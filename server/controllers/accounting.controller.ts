import { Request, Response } from 'express';
import { getDatabase } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAuditEvent } from './audit.controller';

/**
 * Consulta de asientos del Libro Diario
 */
export async function getJournalEntries(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const { startDate, endDate, status } = req.query;

    const filter: any = {};
    if (status) filter.status = String(status);
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = String(startDate);
      if (endDate) filter.date.$lte = String(endDate);
    }

    const entries = await db.collection('asientos_contables')
      .find(filter)
      .sort({ date: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: entries.length,
      data: entries
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar asientos contables.',
      error: error.message
    });
  }
}

/**
 * REGISTRO DE ASIENTO CONTABLE CON PARTIDA DOBLE VALIDADA EN LA BASE DE DATOS
 * Regla contable estricta: Suma de Débitos == Suma de Créditos (Debe = Haber)
 * Regla de períodos: Bloqueado si la fecha corresponde a un período fiscal CERRADO.
 */
export async function createJournalEntry(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    const { entryNumber, date, concept, items, type = 'DIARIO' } = req.body;

    if (!items || !Array.isArray(items) || items.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Un asiento contable requiere al menos dos movimientos de cuentas (Debe y Haber).'
      });
    }

    // 1. Verificación de Partida Doble matemática
    const totalDebit = Number(items.reduce((acc: number, it: any) => acc + (Number(it.debit) || 0), 0).toFixed(2));
    const totalCredit = Number(items.reduce((acc: number, it: any) => acc + (Number(it.credit) || 0), 0).toFixed(2));

    if (Math.abs(totalDebit - totalCredit) > 0.009) {
      return res.status(400).json({
        success: false,
        message: `Violación de Partida Doble: El asiento contable está descuadrado. Total Debe ($${totalDebit.toFixed(2)}) ≠ Total Haber ($${totalCredit.toFixed(2)}).`
      });
    }

    // 2. Verificación de Período Fiscal Cerrado
    const entryDate = date ? new Date(date) : new Date();
    const entryYear = entryDate.getFullYear();
    const entryMonth = entryDate.getMonth() + 1; // 1 a 12

    const closedPeriod = await db.collection<any>('periodos_fiscales').findOne({
      year: entryYear,
      month: entryMonth,
      status: 'CERRADO'
    });

    if (closedPeriod) {
      return res.status(400).json({
        success: false,
        message: `Operación denegada: El período fiscal ${entryMonth}/${entryYear} se encuentra CERRADO y no admite nuevos asientos contables.`
      });
    }

    const docId = entryNumber || `ASI-${entryYear}-${Date.now()}`;
    const newEntry = {
      _id: docId,
      entryNumber: docId,
      date: date || new Date().toISOString().split('T')[0],
      concept: concept || 'Asiento de operaciones',
      type,
      items,
      totalDebit,
      totalCredit,
      isBalanced: true,
      status: 'ASENTADO',
      createdAt: new Date(),
      createdBy: req.user?.username || 'sistema'
    };

    await db.collection('asientos_contables').updateOne(
      { _id: newEntry._id as any },
      { $set: newEntry },
      { upsert: true }
    );

    // Registro inmutable en bitácora de auditoría
    await logAuditEvent(db, {
      userId: req.user?.id,
      username: req.user?.username || 'sistema',
      role: req.user?.role || 'Contador',
      action: 'CREAR_ASIENTO_CONTABLE',
      entity: 'asientos_contables',
      entityId: docId,
      details: { totalDebit, totalCredit, concept }
    });

    return res.status(201).json({
      success: true,
      message: 'Asiento contable registrado exitosamente con partida doble validada.',
      data: newEntry
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al registrar asiento contable.',
      error: error.message
    });
  }
}

/**
 * Consulta de períodos fiscales
 */
export async function getFiscalPeriods(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const periods = await db.collection('periodos_fiscales').find({}).sort({ year: -1, month: -1 }).toArray();
    return res.status(200).json({ success: true, data: periods });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Cierre formal de un período fiscal (Bloquea nuevas escrituras)
 */
export async function closeFiscalPeriod(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'Año y mes son requeridos.' });
    }

    const key = `${year}-${String(month).padStart(2, '0')}`;
    await db.collection('periodos_fiscales').updateOne(
      { _id: key as any },
      {
        $set: {
          year: Number(year),
          month: Number(month),
          status: 'CERRADO',
          closedDate: new Date().toISOString(),
          closedBy: req.user?.username || 'Administrador'
        }
      },
      { upsert: true }
    );

    await logAuditEvent(db, {
      userId: req.user?.id,
      username: req.user?.username || 'admin',
      action: 'CIERRE_PERIODO_FISCAL',
      entity: 'periodos_fiscales',
      entityId: key,
      details: { year, month }
    });

    return res.status(200).json({
      success: true,
      message: `Período fiscal ${month}/${year} cerrado con éxito.`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
