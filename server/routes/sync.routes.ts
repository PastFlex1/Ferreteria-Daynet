import { Router, Request, Response, NextFunction } from 'express';
import {
  sseEvents,
  getStatus,
  testConnection,
  getDoc,
  saveDoc,
  syncAll,
  pullAll
} from '../controllers/sync.controller';
import { verifyToken, optionalToken, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// Colecciones públicas de solo lectura requeridas por el login inicial (branding, nombre de ferretería, impuestos)
const PUBLIC_READ_DOCS = new Set([
  'ferreteria_settings',
  'configuracion_empresa',
  'ferreteria_taxes'
]);

/**
 * Middleware para controlar lectura de documentos:
 * Permite branding público para la pantalla de inicio, pero bloquea y exige JWT
 * para colecciones sensibles (facturas, usuarios, inventario, clientes, etc.).
 */
function requireDocReadAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const docId = decodeURIComponent(req.params.docId || '');
  if (PUBLIC_READ_DOCS.has(docId)) {
    return next();
  }
  return verifyToken(req, res, next);
}

// 1. Canal de eventos SSE en tiempo real (admite autenticación con JWT por header o query parameter)
router.get('/events', optionalToken, sseEvents);

// 2. Consulta de estado y diagnóstico de PostgreSQL
router.get('/status', optionalToken, getStatus);

// 3. Probar o cambiar conexión a base de datos
router.post('/test-connection', optionalToken, testConnection);

// 4. Lectura de documentos
router.get('/doc/:docId', optionalToken, getDoc);

// 5. Escritura atómica de documentos en PostgreSQL
router.post('/doc/:docId', optionalToken, saveDoc);

// 6. Sincronización masiva hacia PostgreSQL
router.post('/sync-all', optionalToken, syncAll);

// 7. Extracción masiva de la base de datos PostgreSQL
router.get('/pull-all', optionalToken, pullAll);

export default router;
