import { describe, expect, it } from 'bun:test';
import { appConfigSchema } from '../config.ts';
import { globalRoles, installedExtensions, repoPermissions, repos, sessions, users } from './schema.ts';

describe('database config', () => {
  it('requires DATABASE_URL', () => {
    const result = appConfigSchema.safeParse({
      GITHUB_CLIENT_ID: 'x',
      GITHUB_CLIENT_SECRET: 'y',
      GITHUB_CALLBACK_URL: 'http://localhost:3000/api/auth/github/callback',
      SESSION_SECRET: '12345678901234567890123456789012',
      FRONTEND_URL: 'http://localhost:5173',
    });

    expect(result.success).toBe(false);
  });

  it('declares shared repo tables', () => {
    expect(users.githubUserId.name).toBe('github_user_id');
    expect(repos.githubFullName.name).toBe('github_full_name');
    expect(repoPermissions.permission.name).toBe('permission');
    expect(globalRoles.role.name).toBe('role');
    expect(sessions.id.name).toBe('id');
    expect(installedExtensions.extensionId.name).toBe('extension_id');
  });

  it('accepts terminal superuser env config', () => {
    const result = appConfigSchema.safeParse({
      DATABASE_URL: 'https://db.example.com',
      GITHUB_CLIENT_ID: 'x',
      GITHUB_CLIENT_SECRET: 'y',
      GITHUB_CALLBACK_URL: 'http://localhost:3000/api/auth/github/callback',
      SESSION_SECRET: '12345678901234567890123456789012',
      FRONTEND_URL: 'http://localhost:5173',
      TERMINAL_SUPERUSERS: 'octocat,42',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TERMINAL_SUPERUSERS).toBe('octocat,42');
    }
  });
});
