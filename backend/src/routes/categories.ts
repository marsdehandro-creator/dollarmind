/**
 * Category routes: /api/categories/*
 */
import { Router } from 'express';
import { listCategories, updateCategory } from '../controllers/categoryController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const categoryRoutes = Router();

categoryRoutes.get('/list', requireAuth, listCategories);
categoryRoutes.post('/update', requireAuth, updateCategory);
