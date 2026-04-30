import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';

const envSchema = z.object({
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  WORKSPACES_ROOT: z.string().default('./.workspaces'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.parse(process.env);

const workspacesRoot = path.isAbsolute(parsed.WORKSPACES_ROOT)
  ? parsed.WORKSPACES_ROOT
  : path.resolve(process.cwd(), parsed.WORKSPACES_ROOT);

fs.mkdirSync(workspacesRoot, { recursive: true });

export const config = {
  ...parsed,
  WORKSPACES_ROOT: workspacesRoot,
};

export type Config = typeof config;
