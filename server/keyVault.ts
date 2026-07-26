/**
 * AES-256-GCM key vault.
 *
 * The encryption key is derived from KEY_ENCRYPTION_SECRET with scrypt and a
 * fixed application salt (the secret itself is the high-entropy input; the
 * salt only namespaces the derivation). Stored format: "ivHex:tagHex:ctHex".
 *
 * Key material must never be logged and never appear in any HTTP response.
 */
import crypto from 'node:crypto';

const SCRYPT_SALT = '2048-simulator-key-vault-v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function deriveVaultKey(secret: string): Buffer {
  return crypto.scryptSync(secret, SCRYPT_SALT, 32);
}

export function encryptSecret(vaultKey: Buffer, plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, vaultKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptSecret(vaultKey: Buffer, stored: string): string {
  const [ivHex, tagHex, ctHex] = stored.split(':');
  if (!ivHex || !tagHex || !ctHex) {
    throw new Error('Stored key has an invalid format');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, vaultKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
