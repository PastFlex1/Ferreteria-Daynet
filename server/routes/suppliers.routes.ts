import { Router } from 'express';
import {
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier
} from '../controllers/suppliers.controller';
import { optionalToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getAllSuppliers);
router.post('/', optionalToken, createSupplier);
router.put('/:id', optionalToken, updateSupplier);
router.delete('/:id', optionalToken, deleteSupplier);

export default router;
