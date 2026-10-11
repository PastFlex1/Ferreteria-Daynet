import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'ferreteria_daynet_secret_jwt_token_2026';

export interface AuthenticatedUser {
  id: string;
  username: string;
  name: string;
  role: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

function extractTokenFromCookies(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const [key, val] = c.trim().split('=');
    if (key === 'token' || key === 'auth_token' || key === 'jwt') {
      return decodeURIComponent(val || '');
    }
  }
  return undefined;
}

/**
 * Middleware que verifica el token JWT en el header Authorization, cookies httpOnly o parámetro query.
 * Si el token es inválido o no existe, retorna 401 Unauthorized.
 */
export function verifyToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    } else {
      return res.status(401).json({
        success: false,
        message: 'Formato de token no válido. Debe ser: Bearer <token>'
      });
    }
  } else if (req.headers.cookie) {
    token = extractTokenFromCookies(req.headers.cookie);
  } else if (req.query && req.query.token) {
    token = String(req.query.token);
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado: Token de autenticación requerido.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado.',
      error: err.message
    });
  }
}

/**
 * Middleware que verifica el token si viene presente, pero no bloquea la petición si no está.
 */
export function optionalToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  } else if (req.headers.cookie) {
    token = extractTokenFromCookies(req.headers.cookie);
  } else if (req.query && req.query.token) {
    token = String(req.query.token);
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
    } catch {}
  }
  next();
}

/**
 * Tabla de permisos institucionales por rol según Términos de Referencia
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  administrador: ['*'],
  admin: ['*'],
  cajero: [
    'ventas.crear', 'ventas.ver', 'caja.operar', 'clientes.ver', 'clientes.crear',
    'sri.consultar', 'sri.reintentar', 'comprobantes.imprimir'
  ],
  vendedor: [
    'ventas.crear', 'ventas.ver', 'productos.ver', 'clientes.ver', 'clientes.crear',
    'cotizaciones.crear', 'pedidos.crear'
  ],
  bodeguero: [
    'inventario.ver', 'inventario.ajustar', 'kardex.ver', 'productos.ver', 'productos.crear',
    'compras.recibir', 'guias.crear'
  ],
  contador: [
    'contabilidad.ver', 'contabilidad.asentar', 'reportes.ver', 'ventas.ver', 'compras.ver',
    'sri.ver', 'periodos.ver', 'auditoria.ver'
  ]
};

/**
 * Middleware para controlar acceso por roles institucionales
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado. Inicie sesión para continuar.'
      });
    }

    const userRole = String(req.user.role || '').toLowerCase();
    const hasPermission = allowedRoles.some(r => r.toLowerCase() === userRole || userRole === 'administrador');

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado: El rol '${req.user.role}' no cuenta con permisos suficientes.`
      });
    }

    next();
  };
}

/**
 * Middleware de verificación estricta de permisos por endpoint:
 * Cumple el requerimiento del auditor: "Permisos verificados en cada endpoint (requierePermiso). Lo que muestra u oculta el frontend es solo cosmético."
 */
export function requierePermiso(permisoRequerido: string | string[]) {
  const permisos = Array.isArray(permisoRequerido) ? permisoRequerido : [permisoRequerido];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado: Se requiere token de sesión activo.'
      });
    }

    const userRole = String(req.user.role || '').toLowerCase();
    
    // Superusuario Administrador tiene acceso irrestricto
    if (userRole === 'administrador' || userRole === 'admin') {
      return next();
    }

    const allowedPermissions = ROLE_PERMISSIONS[userRole] || [];
    const hasAnyPermission = permisos.some(p => 
      allowedPermissions.includes('*') || 
      allowedPermissions.includes(p.toLowerCase())
    );

    if (!hasAnyPermission) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado: Se requiere el permiso [${permisos.join(', ')}] para ejecutar esta operación en el servidor.`,
        requiredPermissions: permisos,
        userRole: req.user.role
      });
    }

    next();
  };
}
