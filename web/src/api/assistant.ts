import { api } from './client';
import type { AssistantChatRequest, AssistantChatResponse } from '@/types';

export async function chatAssistant(payload: AssistantChatRequest): Promise<AssistantChatResponse> {
  const { data } = await api.post<AssistantChatResponse>('/assistant/chat', payload);
  return data;
}
