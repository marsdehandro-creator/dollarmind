/**
 * Goal routes: /api/goals/*
 */
import { Router } from 'express';
import { createGoal, deleteGoal, listGoals, updateGoal } from '../controllers/goalController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const goalRoutes = Router();

goalRoutes.get('/', requireAuth, listGoals);
goalRoutes.post('/', requireAuth, createGoal);
goalRoutes.put('/:id', requireAuth, updateGoal);
goalRoutes.delete('/:id', requireAuth, deleteGoal);
