/**
 * Cash entry routes: /api/cash/*
 */
import { Router } from 'express';
import { createCashEntry, listCashEntries } from '../controllers/cashController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const cashRoutes = Router();

cashRoutes.post('/create', requireAuth, createCashEntry);
cashRoutes.get('/list', requireAuth, listCashEntries);
