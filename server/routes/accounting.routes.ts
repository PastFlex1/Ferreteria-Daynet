import { Router } from 'express';
import {
  getJournalEntries,
  createJournalEntry,
  getFiscalPeriods,
  closeFiscalPeriod
} from '../controllers/accounting.controller';
import { verifyToken, optionalToken } from '../middleware/auth.middleware';

const router = Router();

// Consultar asientos del Libro Diario
router.get('/entries', optionalToken, getJournalEntries);

// Registrar asiento contable (con validación de partida doble y períodos cerrados)
router.post('/entries', verifyToken, createJournalEntry);

// Períodos fiscales
router.get('/periods', optionalToken, getFiscalPeriods);

// Cierre formal de período fiscal
router.post('/periods/close', verifyToken, closeFiscalPeriod);

export default router;
