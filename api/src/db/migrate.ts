import { sql } from './client.ts';
import { runMigrations } from './run-migrations.ts';

await runMigrations();
await sql.end();
