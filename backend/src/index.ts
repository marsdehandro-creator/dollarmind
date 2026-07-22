/**
 * Backend entry point (pilot).
 *
 * Initializes the database (migrate + bootstrap), then boots the HTTP server.
 */
import { createApp } from './app.js';
import { env } from './config/index.js';
import { initDatabase } from './db/index.js';
import { logger } from '@dollarmind/core/utils/logger.js';

initDatabase();

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`backend listening on http://localhost:${env.PORT}`);
});
