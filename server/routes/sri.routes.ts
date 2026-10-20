import { Router } from 'express';
import { 
  lookupSriId, 
  uploadCertificate, 
  getCertificateStatus, 
  deleteCertificate, 
  signXmlHandler,
  proxyRecepcionHandler,
  proxyAutorizacionHandler,
  testSriBackendConnection
} from '../controllers/sri.controller';
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
router.delete('/certificate', verifyToken, requireRole(['administrador']), deleteCertificate);

// 3. Diagnóstico de certificado instalado en el backend (sin exponer contraseña)
router.get('/certificate/status', getCertificateStatus);
router.get('/test-connection', testSriBackendConnection);

// 4. Servicio de firmado digital (usa certificado cifrado de la bóveda si no se envía en el body)
router.post('/firmar', signXmlHandler);

// 5. Proxy hacia Web Services SRI (Recepción y Autorización)
router.post('/recepcion', proxyRecepcionHandler);
router.get('/autorizacion/:clave', proxyAutorizacionHandler);

// 6. BANDEJA DE PENDIENTES CON ANTIGÜEDAD (Exigencia TdR):
router.get('/cola', optionalToken, getSriQueue);
router.get('/cola/stats', optionalToken, getSriQueueStats);

// 7. Encolamiento y Reintentos (con la MISMA clave de acceso, nunca secuencial nuevo)
router.post('/cola/enqueue', optionalToken, enqueueSriDocument);
router.post('/cola/reintentar/:id', verifyToken, retrySriQueueItem);

export default router;
