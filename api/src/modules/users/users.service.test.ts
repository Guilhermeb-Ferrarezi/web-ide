import { describe, expect, it } from 'bun:test';
import { decryptSecret, encryptSecret } from '../../utils/crypto.ts';
import { resolveAppRole } from './users.service.ts';

describe('user crypto helpers', () => {
  it('round-trips encrypted access tokens', () => {
    const encrypted = encryptSecret('token-123');
    expect(encrypted).not.toBe('token-123');
    expect(decryptSecret(encrypted)).toBe('token-123');
  });
});

describe('resolveAppRole', () => {
  it('upgrades matching login from env to terminal_superuser', () => {
    const role = resolveAppRole('user', {
      userId: 'local-1',
      githubUserId: '42',
      login: 'octocat',
      terminalSuperusers: ['octocat'],
    });

    expect(role).toBe('terminal_superuser');
  });

  it('keeps stored role when user is not in env list', () => {
    const role = resolveAppRole('admin', {
      userId: 'local-1',
      githubUserId: '42',
      login: 'octocat',
      terminalSuperusers: ['someone-else'],
    });

    expect(role).toBe('admin');
  });
});
