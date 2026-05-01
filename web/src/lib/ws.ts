type LocationLike = Pick<Location, 'protocol' | 'host'>;

type BuildWorkspaceWsUrlOptions = {
  apiBaseUrl?: string;
  wsBaseUrl?: string;
  endpoint: 'terminal' | 'watcher';
  workspace: string;
  location?: LocationLike;
  dev?: boolean;
};

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function buildWorkspaceWsUrl({
  apiBaseUrl = '/api',
  wsBaseUrl,
  endpoint,
  workspace,
  location = window.location,
  dev = import.meta.env.DEV,
}: BuildWorkspaceWsUrlOptions): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const currentOrigin = `${protocol}//${location.host}`;
  const explicitWsBaseUrl = typeof wsBaseUrl === 'string' && wsBaseUrl.length > 0;
  const base = trimTrailingSlash(wsBaseUrl ?? apiBaseUrl);
  const suffix = `/${endpoint}?workspace=${encodeURIComponent(workspace)}`;

  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    return `${currentOrigin}${base}${suffix}`;
  }

  const url = new URL(base);
  const isCrossOriginDev = dev && !explicitWsBaseUrl && url.host !== location.host;
  const origin = isCrossOriginDev
    ? currentOrigin
    : `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;

  return `${origin}${trimTrailingSlash(url.pathname)}${suffix}`;
}
