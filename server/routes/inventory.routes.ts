import { Router } from 'express';
import { getKardexMovements, createAdjustment } from '../controllers/inventory.controller';
import { optionalToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/kardex', getKardexMovements);
router.post('/adjustment', optionalToken, createAdjustment);

export default router;
