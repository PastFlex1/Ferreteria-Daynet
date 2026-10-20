import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDatabase, getPgPool } from '../config/db';
import { JWT_SECRET, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAuditEvent } from './audit.controller';

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Debe ingresar usuario (Cédula/RUC) y contraseña.'
      });
    }

    const pool = getPgPool();
    const cleanUsername = String(username).trim();

    // 1. Buscar en la tabla relacional 'usuarios_sistema'
    const userRes = await pool.query(
      `SELECT * FROM usuarios_sistema WHERE username = $1 OR lower(email) = lower($1) OR id = $1 LIMIT 1;`,
      [cleanUsername]
    );

    let user = userRes.rows[0];

    // Fallback de inicialización para primer arranque si la base de datos no tiene usuarios
    if (!user && (cleanUsername === '1799999999001' || cleanUsername === 'admin')) {
      const countRes = await pool.query('SELECT count(*) FROM usuarios_sistema;');
      if (Number(countRes.rows[0].count) === 0) {
        const hashedPass = await bcrypt.hash('Admin2026@Daynet#', 10);
        await pool.query(`
          INSERT INTO usuarios_sistema (id, name, username, email, role, status, password, created_at, updated_at)
          VALUES ('USR-01', 'Administrador Principal', '1799999999001', 'admin@ferreteria.com', 'Administrador', 'Activo', $1, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [hashedPass]);

        const freshRes = await pool.query(`SELECT * FROM usuarios_sistema WHERE id = 'USR-01';`);
        user = freshRes.rows[0];
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No se encontró ningún usuario con la identificación proporcionada.'
      });
    }

    if (user.status && user.status !== 'Activo') {
      return res.status(403).json({
        success: false,
        message: 'El usuario se encuentra inactivo. Comuníquese con el administrador.'
      });
    }

    // Verificar contraseña contra hash criptográfico bcrypt o actualización transparente
    const storedPassword = user.password || '';
    let isPasswordValid = false;

    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
      isPasswordValid = await bcrypt.compare(String(password), storedPassword);
    } else if (storedPassword && storedPassword !== 'PENDIENTE' && storedPassword !== '[PROTECTED_BCRYPT]') {
      isPasswordValid = String(password) === storedPassword;
      if (isPasswordValid) {
        const upgradeHash = await bcrypt.hash(String(password), 10);
        await pool.query(`UPDATE usuarios_sistema SET password = $1 WHERE id = $2;`, [upgradeHash, user.id]);
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña incorrecta. Verifique sus credenciales.'
      });
    }

    // Generar JWT institucional
    const tokenPayload = {
      id: String(user.id),
      username: user.username,
      name: user.name,
      role: typeof user.role === 'object' ? user.role?.name || user.role?.label || 'Administrador' : user.role || 'Administrador',
      email: user.email
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: '8h' // JWT de corta duración según TdR
    });

    // Sesión con cookie httpOnly y SameSite=Strict según requerimiento del auditor
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000 // 8 horas
    });

    // Sanitizar usuario para no exponer el hash/password en la respuesta
    const { password: _, ...safeUser } = user;
    safeUser.id = String(user.id);
    if (typeof safeUser.role === 'object' && safeUser.role) {
      safeUser.role = safeUser.role.name || safeUser.role.label || 'Administrador';
    }

    // Registrar inicio de sesión en bitácora de auditoría
    const db = await getDatabase();
    await logAuditEvent(db, {
      userId: safeUser.id,
      username: safeUser.username,
      role: safeUser.role,
      action: 'INICIO_SESION',
      entity: 'usuarios_sistema',
      entityId: safeUser.id,
      ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      details: { name: safeUser.name, role: safeUser.role }
    });

    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      token,
      user: safeUser
    });
  } catch (error: any) {
    console.error('[Auth Controller Login Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al procesar el inicio de sesión.',
      error: error.message
    });
  }
}

export async function getProfile(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado.' });
    }

    const pool = getPgPool();
    const userRes = await pool.query(
      `SELECT id, name, username, email, role, status, data FROM usuarios_sistema WHERE id = $1 OR username = $1 LIMIT 1;`,
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(200).json({
        success: true,
        user: req.user
      });
    }

    const user = userRes.rows[0];
    const { password: _, ...safeUser } = user;
    safeUser.id = String(user.id);

    return res.status(200).json({
      success: true,
      user: safeUser
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfil.',
      error: error.message
    });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado.' });
    }

    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 4 caracteres.'
      });
    }

    const pool = getPgPool();
    const userRes = await pool.query(
      `SELECT * FROM usuarios_sistema WHERE id = $1 OR username = $1 LIMIT 1;`,
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const user = userRes.rows[0];
    const storedPassword = user.password || '';
    let isOldValid = false;
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
      isOldValid = await bcrypt.compare(String(oldPassword), storedPassword);
    } else {
      isOldValid = String(oldPassword) === String(storedPassword);
    }

    if (!isOldValid) {
      return res.status(400).json({ success: false, message: 'La contraseña anterior no coincide.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE usuarios_sistema SET password = $1, updated_at = NOW() WHERE id = $2;`,
      [hashedPassword, user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Contraseña actualizada correctamente con cifrado seguro.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña.',
      error: error.message
    });
  }
}

export async function logout(req: Request, res: Response) {
  res.clearCookie('token');
  res.clearCookie('auth_token');
  return res.status(200).json({
    success: true,
    message: 'Sesión finalizada exitosamente.'
  });
}

export async function getUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const pool = getPgPool();
    const userRes = await pool.query(
      `SELECT id, name, username, email, role, status, data FROM usuarios_sistema ORDER BY name ASC;`
    );

    const sanitizedUsers = userRes.rows.map((r: any) => {
      const { password, ...safeData } = (r.data || {});
      return {
        ...safeData,
        id: r.id,
        name: r.name,
        username: r.username,
        email: r.email,
        role: r.role,
        status: r.status,
        permissions: safeData.permissions || {},
        hasCustomPermissions: safeData.hasCustomPermissions || false
      };
    });

    return res.status(200).json({
      success: true,
      count: sanitizedUsers.length,
      data: sanitizedUsers
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al listar usuarios desde SQLite.',
      error: error.message
    });
  }
}

export async function saveUser(req: AuthenticatedRequest, res: Response) {
  try {
    const pool = getPgPool();
    const { id, name, username, email, role, status, password, permissions, hasCustomPermissions } = req.body;

    if (!username || !name) {
      return res.status(400).json({ success: false, message: 'Nombre y nombre de usuario (Cédula/RUC) son obligatorios.' });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    let userRole = typeof role === 'object' ? role?.name || 'Cajero' : role || 'Cajero';
    const userStatus = status || 'Activo';

    // 1. Asegurar existencia del rol en roles_sistema para satisfacer Foreign Key
    const existingRoleRes = await pool.query(
      'SELECT id, name FROM roles_sistema WHERE lower(name) = lower($1) OR id = $1 LIMIT 1;',
      [userRole]
    );

    if (existingRoleRes.rows.length > 0) {
      userRole = existingRoleRes.rows[0].name;
    } else {
      const generatedRoleId = `role-${String(userRole).toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
      await pool.query(`
        INSERT INTO roles_sistema (id, name, description, permissions, data)
        VALUES ($1, $2, $3, '[]', '{}')
        ON CONFLICT DO NOTHING;
      `, [generatedRoleId, userRole, `Rol ${userRole}`]);
    }

    // 2. Verificar si el usuario ya existe por ID o por Cédula/RUC (username)
    const existingUserRes = await pool.query(
      `SELECT id FROM usuarios_sistema WHERE id = $1 OR username = $2 LIMIT 1;`,
      [id || '', cleanUsername]
    );
    const userId = existingUserRes.rows.length > 0 ? existingUserRes.rows[0].id : (id || `USR-${Date.now()}`);

    let hashedPassword: string | null = null;
    if (password && typeof password === 'string' && password.trim().length > 0 && password.trim() !== '[PROTECTED_BCRYPT]') {
      if (password.startsWith('$2a$') || password.startsWith('$2b$')) {
        hashedPassword = password;
      } else {
        hashedPassword = await bcrypt.hash(password.trim(), 10);
      }
    }

    const safeData = {
      id: userId,
      name,
      username: cleanUsername,
      email: cleanEmail,
      role: userRole,
      status: userStatus,
      permissions: permissions || {},
      hasCustomPermissions: hasCustomPermissions !== undefined ? !!hasCustomPermissions : false
    };

    if (hashedPassword) {
      await pool.query(`
        INSERT INTO usuarios_sistema (id, name, username, email, role, status, password, data, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, username = EXCLUDED.username, email = EXCLUDED.email,
            role = EXCLUDED.role, status = EXCLUDED.status, password = EXCLUDED.password, data = EXCLUDED.data, updated_at = NOW();
      `, [userId, name, cleanUsername, cleanEmail, userRole, userStatus, hashedPassword, JSON.stringify(safeData)]);
    } else {
      await pool.query(`
        INSERT INTO usuarios_sistema (id, name, username, email, role, status, password, data, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE', $7, NOW())
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, username = EXCLUDED.username, email = EXCLUDED.email,
            role = EXCLUDED.role, status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW();
      `, [userId, name, cleanUsername, cleanEmail, userRole, userStatus, JSON.stringify(safeData)]);
    }

    const db = await getDatabase();
    await logAuditEvent(db, {
      userId: req.user?.id,
      username: req.user?.username || 'admin',
      action: 'GUARDAR_USUARIO',
      entity: 'usuarios_sistema',
      entityId: userId,
      details: { name, username: cleanUsername, role: userRole }
    });

    return res.status(200).json({
      success: true,
      message: 'Usuario guardado exitosamente con contraseña cifrada en SQLite.',
      user: safeData
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al guardar usuario en SQLite.',
      error: error.message
    });
  }
}
