import crypto from 'node:crypto';
import { config } from '../config.ts';

function getKey() {
  return crypto.createHash('sha256').update(config.SESSION_SECRET).digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [iv64, tag64, data64] = payload.split(':');
  if (!iv64 || !tag64 || !data64) {
    throw new Error('Invalid encrypted payload');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv64, 'base64'));
  decipher.setAuthTag(Buffer.from(tag64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(data64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
