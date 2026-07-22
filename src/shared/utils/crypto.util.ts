import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET = process.env.AES_ENCRYPTION_SECRET || 'e8f49a12c370b58e7d2106a924fbc0e59a88c3d71052fa619b4ef31d04ab95f8';
// Derive a 32-byte key from the secret
const KEY = scryptSync(SECRET, 'scannel-salt-v1', 32);

/**
 * Encrypts plain text using AES-256-CBC.
 * Returns a string in format `iv:hexCiphertext`
 */
export function encryptPassword(text: string): string {
  if (!text) return '';
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-CBC encrypted string in `iv:hexCiphertext` format.
 * If decryption fails (or string is not AES formatted), returns null.
 */
export function decryptPassword(encryptedText: string): string | null {
  if (!encryptedText || !encryptedText.includes(':')) {
    return null;
  }

  try {
    const [ivHex, ciphertextHex] = encryptedText.split(':');
    if (!ivHex || !ciphertextHex || ivHex.length !== 32) {
      return null;
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return null;
  }
}
