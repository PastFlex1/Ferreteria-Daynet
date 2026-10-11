import { Router } from 'express';
import { getAuditLogs, recordClientAuditEvent } from '../controllers/audit.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Consultar bitácora de auditoría (exige autenticación)
router.get('/', verifyToken, getAuditLogs);

// Registrar evento en la bitácora
router.post('/', verifyToken, recordClientAuditEvent);

export default router;
