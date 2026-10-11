import { Router } from 'express';
import { login, logout, getProfile, changePassword, getUsers, saveUser } from '../controllers/auth.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/login', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Endpoint de autenticación institucional activo. Para iniciar sesión envíe una petición POST con { username, password }.',
    example: { username: '1799999999001', password: 'admin' }
  });
});
router.get('/me', verifyToken, getProfile);
router.post('/change-password', verifyToken, changePassword);

// Gestión segura de usuarios (contraseñas nunca viajan al cliente, acceso solo administrador)
router.get('/users', verifyToken, requireRole(['administrador']), getUsers);
router.post('/users', verifyToken, requireRole(['administrador']), saveUser);

export default router;
