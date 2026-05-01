import type { SessionStore } from '@fastify/session';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { sessions } from '../db/schema.ts';

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function getExpiry(session: Record<string, any>) {
  const maxAge = typeof session?.cookie?.maxAge === 'number' ? session.cookie.maxAge : DEFAULT_TTL_MS;
  return new Date(Date.now() + maxAge);
}

type SessionDb = typeof db;

export function createSessionStore(storeDb: SessionDb = db): SessionStore {
  return {
    async set(sessionId, session, callback) {
      try {
        await storeDb
          .insert(sessions)
          .values({
            id: sessionId,
            data: JSON.stringify(session),
            expiresAt: getExpiry(session as Record<string, any>),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: sessions.id,
            set: {
              data: JSON.stringify(session),
              expiresAt: getExpiry(session as Record<string, any>),
              updatedAt: new Date(),
            },
          });
        callback();
      } catch (err) {
        callback(err as Error);
      }
    },
    async get(sessionId, callback) {
      try {
        const row = await storeDb.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });
        if (!row || row.expiresAt.getTime() <= Date.now()) {
          callback(null);
          return;
        }
        callback(null, JSON.parse(row.data));
      } catch (err) {
        callback(err as Error);
      }
    },
    async destroy(sessionId, callback) {
      try {
        await storeDb.delete(sessions).where(eq(sessions.id, sessionId));
        callback();
      } catch (err) {
        callback(err as Error);
      }
    },
  };
}
