import { Request, Response } from 'express';
import { getDatabase } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export interface AuditLogEntry {
  timestamp: Date;
  userId?: string;
  username?: string;
  role?: string;
  action: string;
  entity: string;
  entityId?: string;
  ip?: string;
  terminal?: string;
  emissionPoint?: string;
  details?: any;
}

/**
 * Registra un evento inmutable en la bitácora de auditoría del sistema
 */
export async function logAuditEvent(db: any, entry: Omit<AuditLogEntry, 'timestamp'>) {
  try {
    await db.collection('bitacora_auditoria').insertOne({
      ...entry,
      timestamp: new Date()
    });
  } catch (err: any) {
    console.warn('[Auditoría] Error registrando bitácora:', err?.message);
  }
}

/**
 * Consulta la bitácora de auditoría con filtros por fecha, usuario, acción y entidad
 */
export async function getAuditLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    const { startDate, endDate, username, action, entity, limit = 100 } = req.query;

    const filter: any = {};
    if (username) filter.username = String(username);
    if (action) filter.action = String(action);
    if (entity) filter.entity = String(entity);

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(String(startDate));
      if (endDate) filter.timestamp.$lte = new Date(String(endDate));
    }

    const logs = await db.collection('bitacora_auditoria')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .toArray();

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar bitácora de auditoría.',
      error: error.message
    });
  }
}

/**
 * Registrar un evento de auditoría desde el frontend autenticado
 */
export async function recordClientAuditEvent(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    const { action, entity, entityId, details, emissionPoint, terminal } = req.body;

    if (!action || !entity) {
      return res.status(400).json({
        success: false,
        message: 'Acción y entidad son requeridas para la bitácora.'
      });
    }

    await logAuditEvent(db, {
      userId: req.user?.id || 'anonimo',
      username: req.user?.username || req.user?.name || 'sistema',
      role: req.user?.role || 'usuario',
      action,
      entity,
      entityId,
      ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      terminal: terminal || 'Terminal Web',
      emissionPoint: emissionPoint || '001',
      details
    });

    return res.status(201).json({
      success: true,
      message: 'Evento registrado en bitácora de auditoría.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al guardar bitácora.',
      error: error.message
    });
  }
}
