/**
 * Password hashing (docs/security.md §2.3).
 *
 * Pilot uses bcryptjs (pure JS — no native build required on this machine).
 * The security spec prefers Argon2id; swapping is a localized change here plus
 * the `password_algo` column already recorded per user, enabling transparent
 * rehash-on-login later.
 */
import bcrypt from 'bcryptjs';

/** bcrypt cost factor (docs/security.md §2.3 recommends >= 12). */
const BCRYPT_ROUNDS = 12;

export const PASSWORD_ALGO = 'bcrypt';

/** Minimum password length (docs/security.md §2.7). */
export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A fixed dummy hash used to run a compare even when a user is not found, so
 * login timing does not reveal whether an email exists (docs/security.md §2.5).
 */
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-not-real', BCRYPT_ROUNDS);
