import path from 'node:path';
import { unzipSync } from 'fflate';

type OpenVsxSearchResponse = {
  extensions?: Array<{
    name: string;
    namespace: string;
    version: string;
    timestamp?: string;
    displayName?: string;
    description?: string;
    downloadCount?: number;
    averageRating?: number;
    verified?: boolean;
    files?: {
      download?: string;
      icon?: string;
    };
  }>;
};

type OpenVsxExtensionVersionResponse = {
  files?: {
    download?: string;
    manifest?: string;
    readme?: string;
    changelog?: string;
    icon?: string;
  };
  version?: string;
  timestamp?: string;
  verified?: boolean;
  downloadCount?: number;
  displayName?: string;
  description?: string;
  categories?: string[];
  homepage?: string;
  repository?: string | { url?: string };
  bugs?: string | { url?: string };
  namespace?: string;
  name?: string;
  namespaceDisplayName?: string;
  publishedBy?: {
    loginName?: string;
    fullName?: string;
    avatarUrl?: string;
    homepage?: string;
    provider?: string;
  };
};

type MarketplaceExtension = {
  id: string;
  name: string;
  namespace: string;
  displayName: string;
  description: string | null;
  version: string;
  iconUrl: string | null;
  downloadCount: number;
  averageRating?: number;
  verified?: boolean;
  timestamp?: string;
};

type InstalledTheme = {
  id: string;
  extensionId: string;
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  colors: Record<string, string>;
  rules: Array<{
    token: string;
    foreground?: string;
    background?: string;
    fontStyle?: string;
  }>;
};

type InstalledIconTheme = {
  id: string;
  extensionId: string;
  label: string;
  icons: {
    file: string;
    folder: string;
    folderExpanded: string;
    fileNames: Record<string, string>;
    fileExtensions: Record<string, string>;
    folderNames: Record<string, string>;
    folderNamesExpanded: Record<string, string>;
    languageIds: Record<string, string>;
    iconDefinitions: Record<string, string>;
  };
};

export type InstalledExtensionPayload = {
  extensionId: string;
  displayName: string;
  themes: InstalledTheme[];
  iconThemes: InstalledIconTheme[];
};

export type ExtensionDetailPayload = {
  extension: MarketplaceExtension;
  readme: string | null;
  resources: Array<{ label: string; url: string }>;
  categories: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  installSupport: {
    supported: boolean;
    kinds: Array<'theme' | 'iconTheme'>;
    reason: string | null;
  };
};

type ExtensionManifest = {
  contributes?: {
    themes?: unknown[];
    iconThemes?: unknown[];
    productIconThemes?: unknown[];
  };
};

type ArchiveEntries = Record<string, Uint8Array>;

function stripJsonComments(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
}

function parseJsonc<T>(input: string): T {
  return JSON.parse(stripJsonComments(input)) as T;
}

function mapUiTheme(theme: string | undefined): 'vs' | 'vs-dark' | 'hc-black' {
  if (!theme) return 'vs-dark';
  if (theme.includes('light')) return 'vs';
  if (theme.includes('hc')) return 'hc-black';
  return 'vs-dark';
}

function normalizeHex(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^#/, '');
}

function convertTokenColors(tokenColors: unknown): InstalledTheme['rules'] {
  if (!Array.isArray(tokenColors)) return [];

  return tokenColors.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const scope = (entry as { scope?: string | string[] }).scope;
    const settings = (entry as { settings?: Record<string, string> }).settings ?? {};
    const scopes = Array.isArray(scope) ? scope : typeof scope === 'string' ? scope.split(',') : [];

    return scopes.map((token) => ({
      token: token.trim(),
      foreground: normalizeHex(settings.foreground),
      background: normalizeHex(settings.background),
      fontStyle: settings.fontStyle,
    }));
  });
}

function mimeFromPath(filePath: string): string {
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': 'web-ide' } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': 'web-ide' } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return await response.text();
}

function getInstallSupport(manifest: ExtensionManifest | null): ExtensionDetailPayload['installSupport'] {
  const contributes = manifest?.contributes ?? {};
  const hasThemes = Array.isArray(contributes.themes) && contributes.themes.length > 0;
  const hasIconThemes = Array.isArray(contributes.iconThemes) && contributes.iconThemes.length > 0;
  const hasProductIconThemes = Array.isArray(contributes.productIconThemes) && contributes.productIconThemes.length > 0;

  if (hasThemes || hasIconThemes) {
    return {
      supported: true,
      kinds: [
        ...(hasThemes ? ['theme' as const] : []),
        ...(hasIconThemes ? ['iconTheme' as const] : []),
      ],
      reason: null,
    };
  }

  if (hasProductIconThemes) {
    return {
      supported: false,
      kinds: [],
      reason: 'Esta extensão só fornece product icons, que ainda não são suportados.',
    };
  }

  return {
    supported: false,
    kinds: [],
    reason: 'Esta extensão não expõe temas de cor nem ícones de arquivo instaláveis.',
  };
}

async function findExtension(extensionId: string): Promise<(MarketplaceExtension & { downloadUrl: string }) | null> {
  const data = await fetchJson<OpenVsxSearchResponse>(
    `https://open-vsx.org/api/-/search?query=${encodeURIComponent(extensionId)}&size=20`,
  );

  const match = data.extensions?.find((extension) => `${extension.namespace}.${extension.name}` === extensionId);
  if (!match?.files?.download) return null;

  return {
    id: `${match.namespace}.${match.name}`,
    name: match.name,
    namespace: match.namespace,
    displayName: match.displayName ?? match.name,
    description: match.description ?? null,
    version: match.version,
    iconUrl: match.files.icon ?? null,
    downloadCount: match.downloadCount ?? 0,
    averageRating: match.averageRating,
    verified: match.verified,
    timestamp: match.timestamp,
    downloadUrl: match.files.download,
  };
}

async function getExtensionVersion(extensionId: string): Promise<OpenVsxExtensionVersionResponse | null> {
  const [namespace, name] = extensionId.split('.');
  if (!namespace || !name) return null;

  const response = await fetch(`https://open-vsx.org/api/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/latest`, {
    headers: { 'User-Agent': 'web-ide' },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch extension metadata: ${response.status}`);
  return (await response.json()) as OpenVsxExtensionVersionResponse;
}

function listArchiveEntries(entries: ArchiveEntries): string[] {
  return Object.keys(entries);
}

function readArchiveBinary(entries: ArchiveEntries, internalPath: string): Buffer {
  const content = entries[internalPath];
  if (!content) throw new Error(`Arquivo da extensão não encontrado: ${internalPath}`);
  return Buffer.from(content);
}

function readArchiveFile(entries: ArchiveEntries, internalPath: string, encoding: BufferEncoding = 'utf-8'): string {
  return readArchiveBinary(entries, internalPath).toString(encoding);
}

function resolveArchivePath(rootPath: string, relativePath: string): string {
  const normalized = relativePath.replace(/^\.?\//, '');
  return path.posix.join(path.posix.dirname(rootPath), normalized);
}

export async function searchExtensions(query: string): Promise<MarketplaceExtension[]> {
  const finalQuery = query.trim() || 'theme';
  const data = await fetchJson<OpenVsxSearchResponse>(
    `https://open-vsx.org/api/-/search?query=${encodeURIComponent(finalQuery)}&size=24`,
  );

  return (data.extensions ?? []).map((extension) => ({
    id: `${extension.namespace}.${extension.name}`,
    name: extension.name,
    namespace: extension.namespace,
    displayName: extension.displayName ?? extension.name,
    description: extension.description ?? null,
    version: extension.version,
    iconUrl: extension.files?.icon ?? null,
    downloadCount: extension.downloadCount ?? 0,
    averageRating: extension.averageRating,
    verified: extension.verified,
    timestamp: extension.timestamp,
  }));
}

export async function getExtensionDetail(extensionId: string): Promise<ExtensionDetailPayload> {
  const [extension, versionData] = await Promise.all([
    findExtension(extensionId),
    getExtensionVersion(extensionId),
  ]);
  if (!extension || !versionData) throw new Error('Extensão não encontrada');

  const [readme, manifest] = await Promise.all([
    versionData.files?.readme ? fetchText(versionData.files.readme) : Promise.resolve(null),
    versionData.files?.manifest
      ? fetchText(versionData.files.manifest).then((content) => parseJsonc<ExtensionManifest>(content))
      : Promise.resolve<ExtensionManifest | null>(null),
  ]);
  const installSupport = getInstallSupport(manifest);
  const repositoryUrl =
    typeof versionData.repository === 'string'
      ? versionData.repository
      : typeof versionData.repository?.url === 'string'
        ? versionData.repository.url
        : null;
  const issuesUrl =
    typeof versionData.bugs === 'string'
      ? versionData.bugs
      : typeof versionData.bugs?.url === 'string'
        ? versionData.bugs.url
        : null;
  const homepageUrl = typeof versionData.homepage === 'string' ? versionData.homepage : null;
  const publisherHomepage = versionData.publishedBy?.homepage ?? null;

  const resources = [
    repositoryUrl ? { label: 'Repository', url: repositoryUrl } : null,
    issuesUrl ? { label: 'Issues', url: issuesUrl } : null,
    homepageUrl ? { label: extension.namespace, url: homepageUrl } : null,
    publisherHomepage ? { label: versionData.publishedBy?.fullName ?? extension.namespace, url: publisherHomepage } : null,
    { label: 'Marketplace', url: `https://open-vsx.org/extension/${extension.namespace}/${extension.name}` },
  ].filter(Boolean) as Array<{ label: string; url: string }>;

  return {
    extension: {
      ...extension,
      displayName: versionData.displayName ?? extension.displayName,
      description: versionData.description ?? extension.description,
      version: versionData.version ?? extension.version,
      iconUrl: versionData.files?.icon ?? extension.iconUrl,
      downloadCount: versionData.downloadCount ?? extension.downloadCount,
      verified: versionData.verified ?? extension.verified,
      timestamp: versionData.timestamp ?? extension.timestamp,
    },
    readme,
    resources,
    categories: Array.isArray(versionData.categories) ? versionData.categories : [],
    publishedAt: versionData.timestamp ?? extension.timestamp ?? null,
    updatedAt: versionData.timestamp ?? extension.timestamp ?? null,
    installSupport,
  };
}

export async function installExtension(extensionId: string): Promise<InstalledExtensionPayload> {
  const extension = await findExtension(extensionId);
  if (!extension) throw new Error('Extensão não encontrada');

  const response = await fetch(extension.downloadUrl, { headers: { 'User-Agent': 'web-ide' } });
  if (!response.ok) throw new Error('Falha ao baixar extensão');

  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const entries = listArchiveEntries(archive);
  const packageJsonPath = entries.find((entry) => entry.endsWith('extension/package.json'));
  if (!packageJsonPath) throw new Error('Manifesto da extensão não encontrado');

  const manifest = JSON.parse(readArchiveFile(archive, packageJsonPath));
  const contributes = manifest.contributes ?? {};
  const themes = Array.isArray(contributes.themes) ? contributes.themes : [];
  const iconThemes = Array.isArray(contributes.iconThemes) ? contributes.iconThemes : [];

  const installedThemes = themes.map((theme: { id?: string; label?: string; path: string; uiTheme?: string }) => {
    const themePath = resolveArchivePath(packageJsonPath, theme.path);
    const rawTheme = parseJsonc<Record<string, unknown>>(readArchiveFile(archive, themePath));
    return {
      id: `${extension.id}.${theme.id ?? theme.label ?? path.basename(theme.path, path.extname(theme.path))}`,
      extensionId: extension.id,
      label: theme.label ?? theme.id ?? extension.displayName,
      uiTheme: mapUiTheme(theme.uiTheme),
      colors: (rawTheme.colors as Record<string, string> | undefined) ?? {},
      rules: convertTokenColors(rawTheme.tokenColors),
    } satisfies InstalledTheme;
  });

  const installedIconThemes = iconThemes.map((theme: { id?: string; label?: string; path: string }) => {
    const iconThemePath = resolveArchivePath(packageJsonPath, theme.path);
    const rawTheme = parseJsonc<Record<string, unknown>>(readArchiveFile(archive, iconThemePath));
    const rawDefinitions = (rawTheme.iconDefinitions as Record<string, { iconPath?: string }> | undefined) ?? {};

    const iconDefinitions = Object.fromEntries(
      Object.entries(rawDefinitions).map(([id, definition]) => {
        const iconPath = definition.iconPath;
        if (!iconPath) return [id, ''] as const;
        const archiveIconPath = resolveArchivePath(iconThemePath, iconPath);
        const iconBuffer = readArchiveBinary(archive, archiveIconPath);
        const dataUrl = `data:${mimeFromPath(iconPath)};base64,${iconBuffer.toString('base64')}`;
        return [id, dataUrl] as const;
      }),
    );

    return {
      id: `${extension.id}.${theme.id ?? theme.label ?? path.basename(theme.path, path.extname(theme.path))}`,
      extensionId: extension.id,
      label: theme.label ?? theme.id ?? extension.displayName,
      icons: {
        file: (rawTheme.file as string | undefined) ?? 'file',
        folder: (rawTheme.folder as string | undefined) ?? 'folder',
        folderExpanded: (rawTheme.folderExpanded as string | undefined) ?? ((rawTheme.folder as string | undefined) ?? 'folder'),
        fileNames: (rawTheme.fileNames as Record<string, string> | undefined) ?? {},
        fileExtensions: (rawTheme.fileExtensions as Record<string, string> | undefined) ?? {},
        folderNames: (rawTheme.folderNames as Record<string, string> | undefined) ?? {},
        folderNamesExpanded: (rawTheme.folderNamesExpanded as Record<string, string> | undefined) ?? {},
        languageIds: (rawTheme.languageIds as Record<string, string> | undefined) ?? {},
        iconDefinitions,
      },
    } satisfies InstalledIconTheme;
  });

  if (installedThemes.length === 0 && installedIconThemes.length === 0) {
    throw new Error('A extensão não contém temas instaláveis');
  }

  return {
    extensionId: extension.id,
    displayName: extension.displayName,
    themes: installedThemes,
    iconThemes: installedIconThemes,
  };
}
