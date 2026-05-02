import 'dotenv/config';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';

export const appConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  WORKSPACES_ROOT: z.string().default('/data/workspaces'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TERMINAL_SUPERUSERS: z.string().default(''),
  CODEX_BIN: z.string().min(1).default('codex'),
  CODEX_HOME: z.string().default(''),
  CODEX_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
});

const parsed = appConfigSchema.parse(process.env);

const workspacesRoot = path.isAbsolute(parsed.WORKSPACES_ROOT)
  ? parsed.WORKSPACES_ROOT
  : path.resolve(process.cwd(), parsed.WORKSPACES_ROOT);

fs.mkdirSync(workspacesRoot, { recursive: true });

export const config = {
  ...parsed,
  WORKSPACES_ROOT: workspacesRoot,
  TERMINAL_SUPERUSERS_LIST: parsed.TERMINAL_SUPERUSERS
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
};

export type Config = typeof config;
