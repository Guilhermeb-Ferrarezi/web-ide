import { eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { userSettings } from '../../db/schema.ts';

export type UserSettingsKey = 'appearance' | 'editor' | 'layout' | 'search' | 'assistant';

export type UserSettingsPayload = Partial<Record<UserSettingsKey, unknown>>;

export async function getUserSettings(userId: string): Promise<UserSettingsPayload> {
  const rows = await db.query.userSettings.findMany({
    where: eq(userSettings.userId, userId),
  });

  const payload: UserSettingsPayload = {};
  for (const row of rows) {
    try {
      payload[row.settingKey as UserSettingsKey] = JSON.parse(row.valueJson);
    } catch {
      // ignore malformed persisted values
    }
  }

  return payload;
}

export async function saveUserSetting(userId: string, settingKey: UserSettingsKey, value: unknown) {
  await db
    .insert(userSettings)
    .values({
      userId,
      settingKey,
      valueJson: JSON.stringify(value),
    })
    .onConflictDoUpdate({
      target: [userSettings.userId, userSettings.settingKey],
      set: {
        valueJson: JSON.stringify(value),
        updatedAt: new Date(),
      },
    });
}
