/**
 * Bank statement routes: /api/statements/*
 */
import { Router } from 'express';
import multer from 'multer';
import { getHistory, getStatementDetail, uploadStatement } from '../controllers/statementController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB (docs/security.md §4.4)
});

export const statementRoutes = Router();

statementRoutes.post('/upload', requireAuth, upload.single('file'), uploadStatement);
statementRoutes.get('/history', requireAuth, getHistory);
statementRoutes.get('/:id', requireAuth, getStatementDetail);
