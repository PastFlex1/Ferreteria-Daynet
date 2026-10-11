import { Router } from 'express';
import { lookupSriId, uploadCertificate, getCertificateStatus } from '../controllers/sri.controller';
import {
  getSriQueue,
  getSriQueueStats,
  enqueueSriDocument,
  retrySriQueueItem
} from '../controllers/sriQueue.controller';
import { verifyToken, requireRole, optionalToken } from '../middleware/auth.middleware';

const router = Router();

// 1. Consulta oficial de cédula / RUC en línea del SRI
router.get('/cedula/:id', lookupSriId);

// 2. Almacenamiento seguro del certificado .p12 cifrado en el backend (solo administrador)
router.post('/certificate', verifyToken, requireRole(['administrador']), uploadCertificate);

// 3. Diagnóstico de certificado instalado en el backend (sin exponer contraseña)
router.get('/certificate/status', getCertificateStatus);

// 4. BANDEJA DE PENDIENTES CON ANTIGÜEDAD (Exigencia TdR):
router.get('/cola', optionalToken, getSriQueue);
router.get('/cola/stats', optionalToken, getSriQueueStats);

// 5. Encolamiento y Reintentos (con la MISMA clave de acceso, nunca secuencial nuevo)
router.post('/cola/enqueue', optionalToken, enqueueSriDocument);
router.post('/cola/reintentar/:id', verifyToken, retrySriQueueItem);

export default router;
