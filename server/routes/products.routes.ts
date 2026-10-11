import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/products.controller';
import { optionalToken, verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/', optionalToken, createProduct);
router.put('/:id', optionalToken, updateProduct);
router.delete('/:id', verifyToken, deleteProduct);

export default router;
