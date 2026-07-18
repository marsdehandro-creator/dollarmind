import { Router } from 'express';
import { listIssues, resolveIssue } from '../controllers/issueController.js';

export const issueRoutes = Router();
issueRoutes.get('/', listIssues);
issueRoutes.patch('/:id/resolve', resolveIssue);
