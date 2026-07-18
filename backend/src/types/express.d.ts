/**
 * Express request augmentation: `req.auth` carries the verified JWT payload,
 * set by the requireAuth middleware.
 */
import type { AuthTokenPayload } from '../services/interfaces/AuthService.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export {};
