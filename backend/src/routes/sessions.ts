/**
 * Session routes: /api/sessions/*
 */
import { Router } from 'express';
import { listSessions, logoutAll, logoutSession, refresh } from '../controllers/sessionController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const sessionRoutes = Router();

sessionRoutes.get('/list', requireAuth, listSessions);
sessionRoutes.post('/logout', requireAuth, logoutSession);
sessionRoutes.post('/logout-all', requireAuth, logoutAll);
// Refresh is public: the refresh token itself is the credential.
sessionRoutes.post('/refresh', refresh);
