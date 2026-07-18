/**
 * Auth routes: /api/auth/*
 */
import { Router } from 'express';
import { login, logout, me, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRoutes = Router();

authRoutes.post('/register', register);
authRoutes.post('/login', login);
authRoutes.get('/me', requireAuth, me);
authRoutes.post('/logout', requireAuth, logout);
