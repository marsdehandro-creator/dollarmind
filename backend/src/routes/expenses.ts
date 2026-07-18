/**
 * Manual expense routes: /api/expenses/*
 */
import { Router } from 'express';
import { createExpense, deleteExpense, listExpenses, updateExpense } from '../controllers/expenseController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const expenseRoutes = Router();

expenseRoutes.post('/create', requireAuth, createExpense);
expenseRoutes.post('/update', requireAuth, updateExpense);
expenseRoutes.post('/delete', requireAuth, deleteExpense);
expenseRoutes.get('/list', requireAuth, listExpenses);
