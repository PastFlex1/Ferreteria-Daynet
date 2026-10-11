import { Request, Response } from 'express';
import { getDatabase, currentDbName } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAuditEvent } from './audit.controller';

/**
 * RESPALDOS DESDE EL SERVIDOR (Exigencia TdR):
 * Los respaldos se realizan directamente en el servidor contra la base de datos,
 * sin intermediación del navegador del cliente y excluyendo contraseñas y certificados.
 */
export async function generateServerDump(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    const cols = await db.listCollections();

    const dumpData: Record<string, any[]> = {};
    const summary: Record<string, number> = {};

    for (const c of cols) {
      const colName = c.name;
      // Excluir tablas de sistema y certificados privados
      if (colName.startsWith('system.') || colName === 'certificados_sri') {
        continue;
      }

      const rawItems = await db.collection(colName).find({}).toArray();

      // Sanitizar usuarios: eliminar contraseñas
      if (colName === 'usuarios_sistema' || colName === 'ferreteria_settings_users_list') {
        dumpData[colName] = rawItems.map((u: any) => {
          const { password, ...safe } = u;
          return safe;
        });
      } else {
        dumpData[colName] = rawItems;
      }

      summary[colName] = rawItems.length;
    }

    const payload = {
      metadata: {
        engine: 'PostgreSQL Server Dump Institucional',
        database: currentDbName,
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.username || 'admin',
        totalCollections: Object.keys(dumpData).length,
        summary
      },
      collections: dumpData
    };

    await logAuditEvent(db, {
      userId: req.user?.id,
      username: req.user?.username || 'admin',
      action: 'GENERAR_RESPALDO_SERVIDOR',
      entity: 'database_dump',
      entityId: `dump-${Date.now()}`,
      details: { totalCollections: Object.keys(dumpData).length }
    });

    const now = new Date();
    const fileName = `server_dump_ferreteria_${now.toISOString().slice(0, 10)}_${now.getHours()}-${now.getMinutes()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al generar respaldo del servidor.',
      error: error.message
    });
  }
}
