import { Router } from 'express';
import { generateServerDump } from '../controllers/backup.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Endpoint de respaldo ejecutado exclusivamente en el servidor (requiere rol Administrador)
router.get('/dump', verifyToken, requireRole(['administrador']), generateServerDump);
router.post('/server-dump', verifyToken, requireRole(['administrador']), generateServerDump);

export default router;
