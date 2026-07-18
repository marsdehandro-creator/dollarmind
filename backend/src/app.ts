/**
 * Express application factory.
 *
 * Wires middleware and routes. Returns the app without listening, so tests can
 * exercise it in-process.
 */
import express, { type Express } from 'express';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  // Liveness probe.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  registerRoutes(app);

  // Error handler must be registered last.
  app.use(errorHandler);

  return app;
}
