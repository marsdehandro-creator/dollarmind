/**
 * Settings routes: /api/settings/*
 */
import { Router } from 'express';
import { getPreferences, updatePassword, updatePreferences, updateProfile } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const settingsRoutes = Router();

settingsRoutes.post('/profile/update', requireAuth, updateProfile);
settingsRoutes.post('/password/update', requireAuth, updatePassword);
settingsRoutes.post('/preferences/update', requireAuth, updatePreferences);
settingsRoutes.get('/preferences/get', requireAuth, getPreferences);
