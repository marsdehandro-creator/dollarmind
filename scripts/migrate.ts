/**
 * Migration runner entry point.
 *
 * Applies all pending migrations from db/migrations to the pilot SQLite
 * database (env.DATABASE_PATH) and seeds bootstrap data (default tenant +
 * RBAC roles). Idempotent — safe to run repeatedly.
 *
 * Run from the backend/ directory:  npm run migrate
 */
import { env } from '../backend/src/config/index.js';
import { createConfiguredDb } from '../backend/src/db/index.js';

const db = createConfiguredDb(env.DATABASE_PATH);
db.close();

// eslint-disable-next-line no-console
console.log(`[migrate] database ready at ${env.DATABASE_PATH} (migrations applied + bootstrap seeded).`);
