import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './client.ts';

export async function runMigrations() {
  await migrate(db, { migrationsFolder: 'drizzle' });
}
