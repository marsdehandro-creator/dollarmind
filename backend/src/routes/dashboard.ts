/**
 * Dashboard routes: /api/dashboard/*
 */
import { Router } from 'express';
import { alerts, cashflow, categories, overview, unified } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const dashboardRoutes = Router();

// Unified, range-driven payload (Phase 18).
dashboardRoutes.get('/', requireAuth, unified);
dashboardRoutes.get('/overview', requireAuth, overview);
dashboardRoutes.get('/categories', requireAuth, categories);
dashboardRoutes.get('/cashflow', requireAuth, cashflow);
dashboardRoutes.get('/alerts', requireAuth, alerts);
