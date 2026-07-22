/**
 * JWT signing/verification (docs/security.md §2.4).
 *
 * NOTE: JWTs are stateless — revocation is not instant. The AuthService port is
 * shaped so a refresh-token + denylist model can be layered on later to recover
 * server-side revocation for sensitive actions.
 */
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './errors.js';
import type { AuthTokenPayload } from '../services/interfaces/AuthService.js';

export function signToken(payload: AuthTokenPayload, secret: string, expiresInSeconds: number): string {
  return jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
}

export function verifyJwt(token: string, secret: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string') throw new UnauthorizedError('Invalid token');
    return decoded as AuthTokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
