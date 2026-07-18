/**
 * Salary slip routes: /api/salary/*
 */
import { Router } from 'express';
import multer from 'multer';
import { getHistory, uploadSlip } from '../controllers/salaryController.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Files are held in memory; the service hashes + writes them to disk itself.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB (docs/security.md §4.4)
});

export const salaryRoutes = Router();

salaryRoutes.post('/upload', requireAuth, upload.single('file'), uploadSlip);
salaryRoutes.get('/history', requireAuth, getHistory);
