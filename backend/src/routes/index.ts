/**
 * Route registration. Mounts feature routers under /api.
 *
 * Auth routes are public (register/login) except /me and /logout which guard
 * themselves. Feature routers guard their own routes with requireAuth.
 */
import type { Express } from 'express';
import { authRoutes } from './auth.js';
import { salaryRoutes } from './salary.js';
import { statementRoutes } from './statements.js';
import { transactionRoutes } from './transactions.js';
import { categoryRoutes } from './categories.js';
import { merchantRuleRoutes } from './merchantRules.js';
import { expenseRoutes } from './expenses.js';
import { cashRoutes } from './cash.js';
import { settingsRoutes } from './settings.js';
import { sessionRoutes } from './sessions.js';
import { goalRoutes } from './goalRoutes.js';
import { dashboardRoutes } from './dashboard.js';
import { issueRoutes } from './issueRoutes.js';
import { requireAuth } from './../middleware/requireAuth.js';

export function registerRoutes(app: Express): void {
  app.use('/api/auth', authRoutes);
  app.use('/api/salary', salaryRoutes);
  app.use('/api/statements', statementRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/merchant-rules', merchantRuleRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/cash', cashRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/goals', goalRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/issues', requireAuth, issueRoutes);
}
