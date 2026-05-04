import { api } from './client';
import type { AssistantChatRequest, AssistantChatResponse, AssistantImageUploadResponse } from '@/types';

export async function chatAssistant(payload: AssistantChatRequest): Promise<AssistantChatResponse> {
  const { data } = await api.post<AssistantChatResponse>('/assistant/chat', payload);
  return data;
}

export async function uploadAssistantImage(workspace: string, file: File): Promise<AssistantImageUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<AssistantImageUploadResponse>('/assistant/image-upload', form, {
    params: { workspace },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
