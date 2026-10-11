import { Router } from 'express';
import {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  reserveSequential,
  getEmissionPoints
} from '../controllers/invoices.controller';
import { optionalToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getAllInvoices);
router.get('/emission-points', getEmissionPoints);
router.post('/reserve-sequential', reserveSequential);
router.get('/:id', getInvoiceById);
router.post('/', optionalToken, createInvoice);

export default router;
