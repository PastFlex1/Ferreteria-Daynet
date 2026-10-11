import { Router } from 'express';
import { executeMigration, getLatestMigrationReport } from '../controllers/migration.controller';
import { verifyToken, requireRole, optionalToken } from '../middleware/auth.middleware';

const router = Router();

// Ejecución de migración (requiere rol administrador)
router.post('/run', verifyToken, requireRole(['administrador']), executeMigration);

// Consulta del reporte de inconsistencias y auditoría
router.get('/report', optionalToken, getLatestMigrationReport);

export default router;
