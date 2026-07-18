/**
 * Seed script.
 *
 * The default tenant and RBAC roles are seeded automatically as part of
 * bootstrap (see backend/src/db/migrate.ts `ensureBootstrap`). This script
 * simply ensures the database is initialized. Extend with sample data as needed.
 *
 * Run from the backend/ directory:  npm run seed
 */
import { env } from '../backend/src/config/index.js';
import { createConfiguredDb } from '../backend/src/db/index.js';

const db = createConfiguredDb(env.DATABASE_PATH);
db.close();

// eslint-disable-next-line no-console
console.log(`[seed] bootstrap defaults ensured (tenant + roles) at ${env.DATABASE_PATH}.`);
