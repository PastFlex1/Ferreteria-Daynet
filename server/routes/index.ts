import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './products.routes';
import invoiceRoutes from './invoices.routes';
import customerRoutes from './customers.routes';
import supplierRoutes from './suppliers.routes';
import inventoryRoutes from './inventory.routes';
import sriRoutes from './sri.routes';
import syncRoutes from './sync.routes';
import auditRoutes from './audit.routes';
import accountingRoutes from './accounting.routes';
import backupRoutes from './backup.routes';
import migrationRoutes from './migration.routes';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/productos', productRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/facturas', invoiceRoutes);
apiRouter.use('/ventas', invoiceRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/clientes', customerRoutes);
apiRouter.use('/suppliers', supplierRoutes);
apiRouter.use('/proveedores', supplierRoutes);
apiRouter.use('/inventory', inventoryRoutes);
apiRouter.use('/sri', sriRoutes);
apiRouter.use('/sync', syncRoutes);
apiRouter.use('/sqlite', syncRoutes);
apiRouter.use('/postgres', syncRoutes); // Alias retrocompatible
apiRouter.use('/audit', auditRoutes);
apiRouter.use('/accounting', accountingRoutes);
apiRouter.use('/backup', backupRoutes);
apiRouter.use('/migration', migrationRoutes);

// Root API documentation and health endpoint
apiRouter.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Ferretería Daynet - Core ERP Backend API Institucional',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    concurrencyControl: 'Habilitado (SQLite ACID WAL Concurrency + SSE)',
    emissionPointsTDR: '4 Puntos de Emisión activos (001, 002, 003, 004)',
    architectureCompliance: {
      spaStaticServer: 'dist/ servido con Nginx/Express en puerto 5000',
      atomicSequentials: 'secuenciales_emision (estricto sin saltos por establecimiento/punto/tipo)',
      doubleEntryAccounting: 'Partida Doble validada matemáticamente (Debe == Haber)',
      closedFiscalPeriods: 'Períodos cerrados bloquean escrituras contables/ventas',
      auditLog: 'Bitácora de auditoría inmutable en bitacora_auditoria',
      sriSignatureServer: 'Certificado .p12 vive ÚNICAMENTE en el backend (/api/sri/certificate)'
    },
    endpoints: {
      health: 'GET /api/health',
      emissionPoints: 'GET /api/invoices/emission-points',
      reserveSequential: 'POST /api/invoices/reserve-sequential',
      invoices: 'GET /api/invoices',
      products: 'GET /api/products',
      customers: 'GET /api/customers',
      suppliers: 'GET /api/suppliers',
      inventory: 'GET /api/inventory/kardex',
      accountingEntries: 'GET /api/accounting/entries',
      accountingPeriods: 'GET /api/accounting/periods',
      auditLogs: 'GET /api/audit',
      sriCertificateStatus: 'GET /api/sri/certificate/status',
      authLogin: 'POST /api/auth/login'
    }
  });
});

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    version: '1.0.0',
    service: 'Ferretería Daynet - Core ERP Backend API',
    timestamp: new Date().toISOString()
  });
});

export default apiRouter;
