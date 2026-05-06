import { create } from 'zustand';
import type { AssistantChatMessage, CodeSearchOptions, SidePanel, UserSettingsPayload } from '@/types';
import { queueUserSettingPersist } from '@/lib/userSettingsPersistence';
import { saveAssistantSettings, saveLayoutSettings, saveSearchSettings } from '@/api/settings';

type UserSettingsState = {
  sidePanel: SidePanel;
  searchOptions: CodeSearchOptions;
  assistantDraft: string;
  assistantMessages: AssistantChatMessage[];
  hydrate: (payload: UserSettingsPayload) => void;
  reset: () => void;
  setSidePanel: (sidePanel: SidePanel) => void;
  setSearchOptions: (searchOptions: CodeSearchOptions) => void;
  setAssistantDraft: (draft: string) => void;
  setAssistantMessages: (messages: AssistantChatMessage[] | ((current: AssistantChatMessage[]) => AssistantChatMessage[])) => void;
};

const defaults = {
  sidePanel: 'files' as SidePanel,
  searchOptions: {} as CodeSearchOptions,
  assistantDraft: '',
  assistantMessages: [] as AssistantChatMessage[],
};

export const useUserSettingsStore = create<UserSettingsState>((set) => ({
  ...defaults,
  hydrate: (payload) =>
    set({
      sidePanel: payload.layout?.sidePanel ?? defaults.sidePanel,
      searchOptions: payload.search ?? defaults.searchOptions,
      assistantDraft: payload.assistant?.draft ?? defaults.assistantDraft,
      assistantMessages: payload.assistant?.messages ?? defaults.assistantMessages,
    }),
  reset: () => set(defaults),
  setSidePanel: (sidePanel) =>
    set(() => {
      queueUserSettingPersist('layout', { sidePanel }, saveLayoutSettings);
      return { sidePanel };
    }),
  setSearchOptions: (searchOptions) =>
    set(() => {
      queueUserSettingPersist('search', searchOptions, saveSearchSettings);
      return { searchOptions };
    }),
  setAssistantDraft: (assistantDraft) =>
    set((state) => {
      queueUserSettingPersist(
        'assistant',
        { draft: assistantDraft, messages: state.assistantMessages },
        saveAssistantSettings,
      );
      return { assistantDraft };
    }),
  setAssistantMessages: (assistantMessagesOrUpdater) =>
    set((state) => {
      const assistantMessages =
        typeof assistantMessagesOrUpdater === 'function'
          ? assistantMessagesOrUpdater(state.assistantMessages)
          : assistantMessagesOrUpdater;
      queueUserSettingPersist(
        'assistant',
        { draft: state.assistantDraft, messages: assistantMessages },
        saveAssistantSettings,
      );
      return { assistantMessages };
    }),
}));
