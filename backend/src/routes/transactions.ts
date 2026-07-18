/**
 * Transaction routes: /api/transactions/*
 */
import { Router } from 'express';
import { filterTransactions, listTransactions } from '../controllers/transactionController.js';
import { categorize, summary, trends } from '../controllers/spendingController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const transactionRoutes = Router();

transactionRoutes.get('/list', requireAuth, listTransactions);
transactionRoutes.post('/filter', requireAuth, filterTransactions);
transactionRoutes.post('/categorize', requireAuth, categorize);
transactionRoutes.get('/summary', requireAuth, summary);
transactionRoutes.get('/trends', requireAuth, trends);
