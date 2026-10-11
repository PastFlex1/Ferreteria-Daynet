import { Request, Response } from 'express';
import { getDatabase } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { runFullMigration } from '../scripts/migrateData';
import { logAuditEvent } from './audit.controller';

/**
 * EJECUTAR SCRIPT ÚNICO DE MIGRACIÓN Y NORMALIZACIÓN:
 * Cumple con Item 7 de Auditoría: Normaliza documentos de app_state a colecciones formales
 * y genera reporte explícito de hallazgos para depurar con el cliente.
 */
export async function executeMigration(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    const executedBy = req.user?.username || req.user?.name || 'Administrador';

    const report = await runFullMigration(db, executedBy);

    await logAuditEvent(db, {
      userId: req.user?.id,
      username: executedBy,
      action: 'MIGRACION_AUDITORIA_NORMALIZADA',
      entity: 'reportes_migracion',
      entityId: `report-${Date.now()}`,
      details: {
        totalAnalyzed: report.totalRecordsAnalyzed,
        totalMigrated: report.totalRecordsMigrated,
        totalIssues: report.totalIssuesFound
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Migración y auditoría normalizada ejecutada exitosamente.',
      data: report
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al ejecutar la migración.',
      error: error.message
    });
  }
}

/**
 * CONSULTAR EL ÚLTIMO INFORME DE MIGRACIÓN Y HALLAZGOS
 */
export async function getLatestMigrationReport(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const latest = await db.collection<any>('reportes_migracion')
      .find({})
      .sort({ _migratedAt: -1 })
      .limit(1)
      .toArray();

    if (latest.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aún no se ha ejecutado ninguna migración. Ejecute POST /api/migration/run o npm run migrate.'
      });
    }

    return res.status(200).json({
      success: true,
      data: latest[0]
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar informe de migración.',
      error: error.message
    });
  }
}
