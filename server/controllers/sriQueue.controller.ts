import { Request, Response } from 'express';
import { getDatabase } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { broadcastSse } from './sync.controller';
import { logAuditEvent } from './audit.controller';

export interface SriQueueRecord {
  _id: string;
  invoiceId: string;
  invoiceNumber: string;
  establishment: string;
  emissionPoint: string;
  claveAcceso: string;
  customerName?: string;
  customerTaxId?: string;
  total?: number;
  estado: 'EN_COLA' | 'FIRMADO' | 'RECIBIDA' | 'EN_PROCESO' | 'AUTORIZADO' | 'DEVUELTA' | 'NO_AUTORIZADO' | 'ERROR';
  reintentos: number;
  maxReintentos: number;
  fechaCreacion: Date;
  fechaUltimoIntento?: Date;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  mensajesSri?: string[];
  ultimoError?: string;
  xmlOriginal?: string;
  xmlFirmado?: string;
}

function formatearAntiguedad(ms: number): string {
  const minutos = Math.floor(ms / (1000 * 60));
  if (minutos < 1) return 'Hace unos segundos';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const minRestantes = minutos % 60;
  if (horas < 24) return `${horas}h ${minRestantes}m`;
  const dias = Math.floor(horas / 24);
  const horasRestantes = horas % 24;
  return `${dias}d ${horasRestantes}h`;
}

/**
 * BANDEJA DE PENDIENTES CON ANTIGÜEDAD (Exigencia TdR):
 * Retorna todos los comprobantes en cola con cálculo de tiempo transcurrido,
 * ordenados por antigüedad para priorizar los que llevan más tiempo esperando.
 */
export async function getSriQueue(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const { status, emissionPoint, minAgeMinutes } = req.query;

    const filter: any = {};
    if (status && status !== 'TODOS') {
      filter.estado = String(status);
    }
    if (emissionPoint) {
      filter.emissionPoint = String(emissionPoint);
    }

    const records = await db.collection<SriQueueRecord>('cola_sri')
      .find(filter)
      .sort({ fechaCreacion: -1 })
      .toArray();

    const now = Date.now();
    const formattedRecords = records.map(r => {
      const createdAt = new Date(r.fechaCreacion || Date.now()).getTime();
      const diffMs = Math.max(0, now - createdAt);
      const antiguedadMinutos = Math.floor(diffMs / (1000 * 60));

      return {
        ...r,
        id: String(r._id),
        antiguedadMinutos,
        antiguedadTexto: formatearAntiguedad(diffMs)
      };
    });

    let result = formattedRecords;
    if (minAgeMinutes) {
      const minAge = parseInt(String(minAgeMinutes), 10);
      if (!isNaN(minAge)) {
        result = result.filter(r => r.antiguedadMinutos >= minAge);
      }
    }

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar bandeja de comprobantes SRI.',
      error: error.message
    });
  }
}

/**
 * ENCOLAR COMPROBANTE PARA PROCESAMIENTO ASÍNCRONO EN EL SERVIDOR
 */
export async function enqueueSriDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      invoiceId,
      invoiceNumber,
      establishment = '001',
      emissionPoint = '001',
      claveAcceso,
      customerName,
      customerTaxId,
      total,
      xmlOriginal,
      xmlFirmado
    } = req.body;

    if (!invoiceNumber || !claveAcceso) {
      return res.status(400).json({
        success: false,
        message: 'Número de factura y clave de acceso son obligatorios para encolar.'
      });
    }

    const db = await getDatabase();
    const queueId = `QUEUE-${claveAcceso}`;

    const newRecord: SriQueueRecord = {
      _id: queueId,
      invoiceId: invoiceId || invoiceNumber,
      invoiceNumber,
      establishment,
      emissionPoint,
      claveAcceso,
      customerName,
      customerTaxId,
      total: Number(total || 0),
      estado: xmlFirmado ? 'FIRMADO' : 'EN_COLA',
      reintentos: 0,
      maxReintentos: 15,
      fechaCreacion: new Date(),
      xmlOriginal,
      xmlFirmado
    };

    await db.collection('cola_sri').updateOne(
      { _id: queueId as any },
      { $setOnInsert: newRecord },
      { upsert: true }
    );

    broadcastSse({
      type: 'sri_queue_updated',
      queueId,
      invoiceNumber,
      estado: newRecord.estado
    });

    return res.status(201).json({
      success: true,
      message: 'Comprobante encolado exitosamente en cola_sri.',
      data: newRecord
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al encolar comprobante SRI.',
      error: error.message
    });
  }
}

/**
 * REINTENTAR COMPROBANTE:
 * REGLA ESTRICTA TDR: Se reconsulta con LA MISMA CLAVE DE ACCESO.
 * NUNCA se emite con un secuencial nuevo para eliminar el doble cobro y el error 43.
 */
export async function retrySriQueueItem(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const item = await db.collection<SriQueueRecord>('cola_sri').findOne({
      $or: [{ _id: id as any }, { claveAcceso: id }, { invoiceNumber: id }]
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Comprobante no encontrado en cola_sri.'
      });
    }

    if (item.estado === 'AUTORIZADO') {
      return res.status(400).json({
        success: false,
        message: 'El comprobante ya se encuentra legalmente AUTORIZADO en el SRI.'
      });
    }

    // Actualizar estado a EN_PROCESO manteniendo la MISMA clave de acceso
    await db.collection('cola_sri').updateOne(
      { _id: item._id as any },
      {
        $inc: { reintentos: 1 },
        $set: {
          estado: 'EN_PROCESO',
          fechaUltimoIntento: new Date(),
          ultimoError: undefined
        }
      }
    );

    await logAuditEvent(db, {
      userId: req.user?.id,
      username: req.user?.username || 'Cajero',
      action: 'REINTENTO_SRI_MISMA_CLAVE',
      entity: 'cola_sri',
      entityId: String(item._id),
      details: {
        invoiceNumber: item.invoiceNumber,
        claveAcceso: item.claveAcceso,
        reintentos: item.reintentos + 1
      }
    });

    broadcastSse({
      type: 'sri_queue_updated',
      queueId: item._id,
      invoiceNumber: item.invoiceNumber,
      estado: 'EN_PROCESO',
      claveAcceso: item.claveAcceso
    });

    return res.status(200).json({
      success: true,
      message: `Reintento encolado con la misma clave de acceso (${item.claveAcceso}). No se generaron secuenciales duplicados.`,
      claveAcceso: item.claveAcceso,
      invoiceNumber: item.invoiceNumber
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al solicitar reintento de comprobante SRI.',
      error: error.message
    });
  }
}

/**
 * ESTADÍSTICAS Y MÉTRICAS DE LA COLA SRI (Para Dashboard y Auditoría TdR)
 */
export async function getSriQueueStats(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const records = await db.collection<SriQueueRecord>('cola_sri').find({}).toArray();

    const stats = {
      total: records.length,
      pendientes: 0,
      enProceso: 0,
      autorizados: 0,
      devueltos: 0,
      conError: 0,
      antiguedadPromedioMinutos: 0
    };

    const now = Date.now();
    let totalMinutes = 0;

    for (const r of records) {
      if (r.estado === 'AUTORIZADO') stats.autorizados++;
      else if (r.estado === 'EN_PROCESO' || r.estado === 'RECIBIDA') stats.enProceso++;
      else if (r.estado === 'DEVUELTA' || r.estado === 'NO_AUTORIZADO') stats.devueltos++;
      else if (r.estado === 'ERROR') stats.conError++;
      else stats.pendientes++;

      const createdAt = new Date(r.fechaCreacion || Date.now()).getTime();
      totalMinutes += Math.max(0, Math.floor((now - createdAt) / (1000 * 60)));
    }

    if (records.length > 0) {
      stats.antiguedadPromedioMinutos = Math.round(totalMinutes / records.length);
    }

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al calcular estadísticas de cola SRI.',
      error: error.message
    });
  }
}
