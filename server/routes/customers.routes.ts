import { Router } from 'express';
import {
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer
} from '../controllers/customers.controller';
import { optionalToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getAllCustomers);
router.post('/', optionalToken, createCustomer);
router.put('/:id', optionalToken, updateCustomer);
router.delete('/:id', optionalToken, deleteCustomer);

export default router;
