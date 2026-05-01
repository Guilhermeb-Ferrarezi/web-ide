import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.ts';
import * as schema from './schema.ts';

export const sql = postgres(config.DATABASE_URL, {
  max: config.NODE_ENV === 'test' ? 1 : 10,
});

export const db = drizzle(sql, { schema });
