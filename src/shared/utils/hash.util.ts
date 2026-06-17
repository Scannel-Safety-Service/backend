import { createHash } from 'crypto';

/**
 * Hashes a token string using SHA-256.
 * Used for securing refresh/reset tokens at rest in the database.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
