import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import apiRouter from './routes';
import { getDatabase, currentUri, currentDbName } from './config/db';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Middlewares globales y Seguridad CORS
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim().toLowerCase())
  : [];

const isAllowedOrigin = (origin: string | undefined): boolean => {
  // Peticiones sin origen (mismo origen, curl, postman, server-to-server, aplicaciones de escritorio)
  if (!origin) return true;

  const originLower = origin.toLowerCase();

  // Orígenes explícitos configurados por variable de entorno
  if (allowedOriginsEnv.includes(originLower)) return true;

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    // Permitir loopback / localhost (desarrollo y pruebas locales)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // Permitir subredes privadas locales (RFC 1918) de la ferretería / LAN
    // 192.168.0.0/16
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    // 10.0.0.0/8
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  } catch {
    return false;
  }

  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Bloqueado] Intento de acceso rechazado desde origen sospechoso: ${origin}`);
      callback(new Error('Acceso no permitido por política CORS institucional'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 2. Logging básico de peticiones
app.use((req, res, next) => {
  if (req.url.startsWith('/api') && !req.url.includes('/events')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  }
  next();
});

// 3. Montar todas las rutas de API formal
app.use('/api', apiRouter);

// 4. Servir la aplicación compilada de React (dist/) en producción
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log(`[Express] Sirviendo build de producción desde: ${distPath}`);
  app.use(express.static(distPath));

  // Fallback para React Router / SPA
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // En modo desarrollo sin build previo, mostrar mensaje informativo en raíz
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <head><title>Ferretería Daynet - Backend API</title></head>
        <body style="font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
          <h1 style="color: #f97316;">Ferretería Daynet - Servidor API Express</h1>
          <p>El backend está activo y escuchando en el puerto ${PORT}.</p>
          <p>Para la interfaz web en desarrollo, ejecuta: <code>npm run dev</code> (puerto 3000).</p>
          <p>Para producción completa compilada: ejecuta <code>npm run build</code> y luego <code>npm start</code>.</p>
        </body>
      </html>
    `);
  });
}

// 5. Manejador de errores
app.use(errorHandler);

import { startSriWorker } from './services/sriWorker';

// 6. Iniciar Servidor y verificar conexión a PostgreSQL
async function startServer() {
  try {
    console.log(`[Express] Conectando a PostgreSQL en: ${currentUri}...`);
    const db = await getDatabase();
    await db.admin().ping();
    console.log(`[PostgreSQL] ✓ Conexión exitosa a la base de datos relacional: '${currentDbName}'`);
  } catch (err: any) {
    console.warn(`[PostgreSQL] ⚠ Advertencia al conectar en el arranque: ${err.message}`);
    console.warn(`[PostgreSQL] Verifique credenciales PGUSER/PGPASSWORD en .env`);
  }

  // Iniciar worker de fondo de cola SRI (según auditoría: cola_sri con reintentos sin cambio de secuencial)
  startSriWorker(20000);

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 SERVIDOR INSTITUCIONAL EXPRESS ACTIVO`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📡 Endpoints REST: http://localhost:${PORT}/api/`);
    console.log(`📑 Bandeja Cola SRI: http://localhost:${PORT}/api/sri/cola`);
    console.log(`🔐 Autenticación JWT: http://localhost:${PORT}/api/auth/login`);
    console.log(`======================================================\n`);
  });
}

startServer();

export default app;
