import { generateManifest } from 'material-icon-theme';
import { useAppearanceStore, DEFAULT_ICON_THEME_ID } from '@/stores/appearanceStore';
import { detectLanguage } from './language';
import type { InstalledIconTheme } from '@/types';

const manifest = generateManifest();
const MATERIAL_ICON_THEME_VERSION = '5.34.0';
const MATERIAL_ICON_THEME_BASE_URL =
  `https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/v${MATERIAL_ICON_THEME_VERSION}/icons`;

type ResolvedIconTheme = InstalledIconTheme['icons'];

const defaultIconTheme: ResolvedIconTheme = {
  file: manifest.file ?? 'file',
  folder: manifest.folder ?? 'folder',
  folderExpanded: manifest.folderExpanded ?? manifest.folder ?? 'folder',
  fileNames: manifest.fileNames ?? {},
  fileExtensions: manifest.fileExtensions ?? {},
  folderNames: manifest.folderNames ?? {},
  folderNamesExpanded: manifest.folderNamesExpanded ?? {},
  languageIds: manifest.languageIds ?? {},
  iconDefinitions: Object.fromEntries(
    Object.entries(manifest.iconDefinitions ?? {}).map(([id, definition]) => {
      const fileName = definition.iconPath?.split('/').at(-1) ?? `${id}.svg`;
      return [id, `${MATERIAL_ICON_THEME_BASE_URL}/${fileName}`];
    }),
  ),
};

function getDefaultIconUrl(iconId: string): string | undefined {
  return defaultIconTheme.iconDefinitions[iconId];
}

function pickDefinedIconUrl(...candidates: Array<string | undefined>): string | undefined {
  return candidates.find((candidate) => Boolean(candidate));
}

function getActiveIconTheme(): ResolvedIconTheme {
  const { activeIconThemeId, installedIconThemes } = useAppearanceStore.getState();
  if (activeIconThemeId === DEFAULT_ICON_THEME_ID) return defaultIconTheme;
  return installedIconThemes.find((theme) => theme.id === activeIconThemeId)?.icons ?? defaultIconTheme;
}

function normalizeSegment(value: string): string {
  return value.trim().toLowerCase();
}

function splitPath(path: string): { name: string; parent?: string } {
  const segments = path.split('/').filter(Boolean);
  const name = segments.at(-1) ?? path;
  const parent = segments.length > 1 ? segments.at(-2) : undefined;
  return { name, parent };
}

function iconIdToUrl(
  iconTheme: ResolvedIconTheme,
  iconId: string | undefined,
  fallbackId: string,
  defaultFallbackId = fallbackId,
): string {
  const resolvedId = iconId ?? fallbackId;
  return pickDefinedIconUrl(
    iconTheme.iconDefinitions[resolvedId],
    iconTheme.iconDefinitions[fallbackId],
    getDefaultIconUrl(resolvedId),
    getDefaultIconUrl(fallbackId),
    getDefaultIconUrl(defaultFallbackId),
  ) ?? '';
}

function matchAssociation(
  associations: Record<string, string> | undefined,
  name: string,
  parent?: string,
): string | undefined {
  if (!associations) return undefined;

  const normalizedName = normalizeSegment(name);
  const normalizedParent = parent ? normalizeSegment(parent) : undefined;

  if (normalizedParent) {
    const parentMatch = associations[`${normalizedParent}/${normalizedName}`];
    if (parentMatch) return parentMatch;
  }

  return associations[normalizedName];
}

function getExtensionCandidates(name: string): string[] {
  const parts = name.split('.').filter(Boolean);
  if (parts.length <= 1) return [];

  const candidates: string[] = [];
  for (let index = 1; index < parts.length; index += 1) {
    candidates.push(parts.slice(index).join('.'));
  }

  return candidates;
}

export function resolveFileIcon(path: string): string {
  const iconTheme = getActiveIconTheme();
  const { name, parent } = splitPath(path);
  const normalizedName = normalizeSegment(name);

  const fileNameMatch = matchAssociation(iconTheme.fileNames, normalizedName, parent);
  if (fileNameMatch) {
    return iconIdToUrl(iconTheme, fileNameMatch, iconTheme.file, defaultIconTheme.file);
  }

  for (const extension of getExtensionCandidates(normalizedName)) {
    const extensionMatch = matchAssociation(iconTheme.fileExtensions, extension, parent);
    if (extensionMatch) {
      return iconIdToUrl(iconTheme, extensionMatch, iconTheme.file, defaultIconTheme.file);
    }
  }

  const languageId = detectLanguage(normalizedName);
  const languageMatch = languageId === 'plaintext' ? undefined : iconTheme.languageIds[languageId];
  return iconIdToUrl(iconTheme, languageMatch, iconTheme.file, defaultIconTheme.file);
}

export function resolveFolderIcon(path: string, options?: { expanded?: boolean }): string {
  const iconTheme = getActiveIconTheme();
  const { name, parent } = splitPath(path);
  const normalizedName = normalizeSegment(name);

  const specificAssociation = options?.expanded
    ? matchAssociation(iconTheme.folderNamesExpanded, normalizedName, parent)
      ?? matchAssociation(iconTheme.folderNames, normalizedName, parent)
    : matchAssociation(iconTheme.folderNames, normalizedName, parent);

  if (specificAssociation) {
    return iconIdToUrl(
      iconTheme,
      specificAssociation,
      options?.expanded ? iconTheme.folderExpanded : iconTheme.folder,
      options?.expanded ? defaultIconTheme.folderExpanded : defaultIconTheme.folder,
    );
  }

  return iconIdToUrl(
    iconTheme,
    options?.expanded ? iconTheme.folderExpanded : iconTheme.folder,
    options?.expanded ? iconTheme.folderExpanded : iconTheme.folder,
    options?.expanded ? defaultIconTheme.folderExpanded : defaultIconTheme.folder,
  );
}

export const resolveMaterialFileIcon = resolveFileIcon;
export const resolveMaterialFolderIcon = resolveFolderIcon;
