import { api } from './client';
import type { InstalledExtensionPayload, MarketplaceExtension } from '@/types';

type SearchExtensionsResponse = {
  items: MarketplaceExtension[];
};

export async function searchExtensions(query: string): Promise<MarketplaceExtension[]> {
  const response = await api.get<SearchExtensionsResponse>('/extensions/search', {
    params: { q: query },
  });
  return response.data.items;
}

export async function installExtension(extensionId: string): Promise<InstalledExtensionPayload> {
  const response = await api.post<InstalledExtensionPayload>('/extensions/install', {
    extensionId,
  });
  return response.data;
}
