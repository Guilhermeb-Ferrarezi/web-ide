import { describe, expect, it } from 'bun:test';
import { decryptSecret, encryptSecret } from '../../utils/crypto.ts';

describe('user crypto helpers', () => {
  it('round-trips encrypted access tokens', () => {
    const encrypted = encryptSecret('token-123');
    expect(encrypted).not.toBe('token-123');
    expect(decryptSecret(encrypted)).toBe('token-123');
  });
});
