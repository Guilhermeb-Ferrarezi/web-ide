import { beforeEach, describe, expect, it } from 'bun:test';
import { createSessionStore } from './session-store.ts';

const memory = new Map<string, { data: string; expiresAt: Date }>();

describe('session store', () => {
  beforeEach(() => {
    memory.clear();
  });

  it('persists and reloads a session payload', async () => {
    const store = createSessionStore({
      insert: () => ({
        values: (value: any) => ({
          onConflictDoUpdate: async ({ set }: any) => {
            memory.set(value.id, { data: set.data, expiresAt: set.expiresAt });
          },
        }),
      }),
      query: {
        sessions: {
          findFirst: async () => {
            const [id, row] = [...memory.entries()][0] ?? [];
            return id && row ? { id, data: row.data, expiresAt: row.expiresAt } : undefined;
          },
        },
      },
      delete: () => ({
        where: async (where: any) => {
          const id = where?.right?.value;
          if (id) memory.delete(id);
        },
      }),
    } as any);

    await new Promise<void>((resolve, reject) => {
      store.set('sid-1', { cookie: { maxAge: 1000 }, user: { userId: 'u1' } } as any, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const loaded = await new Promise<any>((resolve, reject) => {
      store.get('sid-1', (err, session) => {
        if (err) reject(err);
        else resolve(session);
      });
    });

    expect(loaded?.user?.userId).toBe('u1');
  });
});
