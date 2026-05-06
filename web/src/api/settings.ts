import { api } from './client';
import type { AppearanceSettings, AssistantSettings, CodeSearchOptions, EditorSettings, LayoutSettings, UserSettingsPayload } from '@/types';

export async function getUserSettings(): Promise<UserSettingsPayload> {
  const response = await api.get<UserSettingsPayload>('/settings');
  return response.data;
}

export async function saveAppearanceSettings(value: AppearanceSettings): Promise<void> {
  await api.put('/settings/appearance', value);
}

export async function saveEditorSettings(value: EditorSettings): Promise<void> {
  await api.put('/settings/editor', value);
}

export async function saveLayoutSettings(value: LayoutSettings): Promise<void> {
  await api.put('/settings/layout', value);
}

export async function saveSearchSettings(value: CodeSearchOptions): Promise<void> {
  await api.put('/settings/search', value);
}

export async function saveAssistantSettings(value: AssistantSettings): Promise<void> {
  await api.put('/settings/assistant', value);
}
