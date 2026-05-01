import { api } from './client';
import type { ExtensionDetail, InstalledExtensionPayload, MarketplaceExtension } from '@/types';

type SearchExtensionsResponse = {
  extensions: MarketplaceExtension[];
};

export async function searchExtensions(query: string): Promise<MarketplaceExtension[]> {
  const response = await api.get<SearchExtensionsResponse>('/extensions/search', {
    params: { query },
  });
  return response.data.extensions;
}

export async function installExtension(extensionId: string): Promise<InstalledExtensionPayload> {
  const response = await api.post<InstalledExtensionPayload>('/extensions/install', {
    extensionId,
  });
  return response.data;
}

export async function getExtensionDetail(extensionId: string): Promise<ExtensionDetail> {
  const response = await api.get<ExtensionDetail>(`/extensions/${encodeURIComponent(extensionId)}`);
  return response.data;
}
