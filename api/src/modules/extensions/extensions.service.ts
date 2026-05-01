import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
};

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

async function listArchiveEntries(archivePath: string): Promise<string[]> {
  const { stdout } = await execFileAsync('unzip', ['-Z1', archivePath]);
  return stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function readArchiveFile(archivePath: string, internalPath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
  const { stdout } = await execFileAsync('unzip', ['-p', archivePath, internalPath], { encoding });
  return stdout;
}

async function readArchiveBinary(archivePath: string, internalPath: string): Promise<Buffer> {
  const { stdout } = await execFileAsync('unzip', ['-p', archivePath, internalPath], { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 });
  return stdout as Buffer;
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
  const extension = await findExtension(extensionId);
  if (!extension) throw new Error('Extensão não encontrada');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'web-ide-ext-detail-'));
  const archivePath = path.join(tempDir, `${extensionId}.vsix`);

  try {
    const response = await fetch(extension.downloadUrl, { headers: { 'User-Agent': 'web-ide' } });
    if (!response.ok) throw new Error('Falha ao baixar extensão');
    await fs.writeFile(archivePath, Buffer.from(await response.arrayBuffer()));

    const entries = await listArchiveEntries(archivePath);
    const packageJsonPath = entries.find((entry) => entry.endsWith('extension/package.json'));
    if (!packageJsonPath) throw new Error('Manifesto da extensão não encontrado');

    const manifest = JSON.parse(await readArchiveFile(archivePath, packageJsonPath));
    const readmePath = entries.find((entry) => /extension\/readme\.md$/i.test(entry)) ?? null;
    const readme = readmePath ? await readArchiveFile(archivePath, readmePath) : null;

    const repositoryUrl =
      typeof manifest.repository === 'string'
        ? manifest.repository
        : typeof manifest.repository?.url === 'string'
          ? manifest.repository.url
          : null;
    const issuesUrl =
      typeof manifest.bugs === 'string'
        ? manifest.bugs
        : typeof manifest.bugs?.url === 'string'
          ? manifest.bugs.url
          : null;
    const homepageUrl = typeof manifest.homepage === 'string' ? manifest.homepage : null;

    const resources = [
      repositoryUrl ? { label: 'Repository', url: repositoryUrl } : null,
      issuesUrl ? { label: 'Issues', url: issuesUrl } : null,
      homepageUrl ? { label: extension.namespace, url: homepageUrl } : null,
      { label: 'Marketplace', url: `https://open-vsx.org/extension/${extension.namespace}/${extension.name}` },
    ].filter(Boolean) as Array<{ label: string; url: string }>;

    return {
      extension,
      readme,
      resources,
      categories: Array.isArray(manifest.categories) ? manifest.categories : [],
      publishedAt: extension.timestamp ?? null,
      updatedAt: extension.timestamp ?? null,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function installExtension(extensionId: string): Promise<InstalledExtensionPayload> {
  const extension = await findExtension(extensionId);
  if (!extension) throw new Error('Extensão não encontrada');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'web-ide-ext-'));
  const archivePath = path.join(tempDir, `${extensionId}.vsix`);

  try {
    const response = await fetch(extension.downloadUrl, { headers: { 'User-Agent': 'web-ide' } });
    if (!response.ok) throw new Error('Falha ao baixar extensão');
    await fs.writeFile(archivePath, Buffer.from(await response.arrayBuffer()));

    const entries = await listArchiveEntries(archivePath);
    const packageJsonPath = entries.find((entry) => entry.endsWith('extension/package.json'));
    if (!packageJsonPath) throw new Error('Manifesto da extensão não encontrado');

    const manifest = JSON.parse(await readArchiveFile(archivePath, packageJsonPath));
    const contributes = manifest.contributes ?? {};
    const themes = Array.isArray(contributes.themes) ? contributes.themes : [];
    const iconThemes = Array.isArray(contributes.iconThemes) ? contributes.iconThemes : [];

    const installedThemes = await Promise.all(
      themes.map(async (theme: { id?: string; label?: string; path: string; uiTheme?: string }) => {
        const themePath = resolveArchivePath(packageJsonPath, theme.path);
        const rawTheme = parseJsonc<Record<string, unknown>>(await readArchiveFile(archivePath, themePath));
        return {
          id: `${extension.id}.${theme.id ?? theme.label ?? path.basename(theme.path, path.extname(theme.path))}`,
          extensionId: extension.id,
          label: theme.label ?? theme.id ?? extension.displayName,
          uiTheme: mapUiTheme(theme.uiTheme),
          colors: (rawTheme.colors as Record<string, string> | undefined) ?? {},
          rules: convertTokenColors(rawTheme.tokenColors),
        } satisfies InstalledTheme;
      }),
    );

    const installedIconThemes = await Promise.all(
      iconThemes.map(async (theme: { id?: string; label?: string; path: string }) => {
        const iconThemePath = resolveArchivePath(packageJsonPath, theme.path);
        const rawTheme = parseJsonc<Record<string, unknown>>(await readArchiveFile(archivePath, iconThemePath));
        const rawDefinitions = (rawTheme.iconDefinitions as Record<string, { iconPath?: string }> | undefined) ?? {};

        const iconDefinitions = Object.fromEntries(
          await Promise.all(
            Object.entries(rawDefinitions).map(async ([id, definition]) => {
              const iconPath = definition.iconPath;
              if (!iconPath) return [id, ''] as const;
              const archiveIconPath = resolveArchivePath(iconThemePath, iconPath);
              const iconBuffer = await readArchiveBinary(archivePath, archiveIconPath);
              const dataUrl = `data:${mimeFromPath(iconPath)};base64,${iconBuffer.toString('base64')}`;
              return [id, dataUrl] as const;
            }),
          ),
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
      }),
    );

    if (installedThemes.length === 0 && installedIconThemes.length === 0) {
      throw new Error('A extensão não contém temas instaláveis');
    }

    return {
      extensionId: extension.id,
      displayName: extension.displayName,
      themes: installedThemes,
      iconThemes: installedIconThemes,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
