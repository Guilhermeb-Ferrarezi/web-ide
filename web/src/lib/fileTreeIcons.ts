import { generateManifest } from 'material-icon-theme';
import { detectLanguage } from './language';

const manifest = generateManifest();
const MATERIAL_ICON_THEME_VERSION = '5.34.0';
const MATERIAL_ICON_THEME_BASE_URL =
  `https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/v${MATERIAL_ICON_THEME_VERSION}/icons`;

const iconDefinitions = manifest.iconDefinitions ?? {};
const DEFAULT_FILE_ICON = manifest.file ?? 'file';
const DEFAULT_FOLDER_ICON = manifest.folder ?? 'folder';
const DEFAULT_FOLDER_EXPANDED_ICON = manifest.folderExpanded ?? DEFAULT_FOLDER_ICON;

function normalizeSegment(value: string): string {
  return value.trim().toLowerCase();
}

function splitPath(path: string): { name: string; parent?: string } {
  const segments = path.split('/').filter(Boolean);
  const name = segments.at(-1) ?? path;
  const parent = segments.length > 1 ? segments.at(-2) : undefined;
  return { name, parent };
}

function iconIdToUrl(iconId: string | undefined, fallbackId: string): string {
  const resolvedId = iconId ?? fallbackId;
  const iconPath = iconDefinitions[resolvedId]?.iconPath;
  const fileName = iconPath?.split('/').at(-1) ?? `${resolvedId}.svg`;
  return `${MATERIAL_ICON_THEME_BASE_URL}/${fileName}`;
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

export function resolveMaterialFileIcon(path: string): string {
  const { name, parent } = splitPath(path);
  const normalizedName = normalizeSegment(name);

  const fileNameMatch = matchAssociation(manifest.fileNames, normalizedName, parent);
  if (fileNameMatch) {
    return iconIdToUrl(fileNameMatch, DEFAULT_FILE_ICON);
  }

  for (const extension of getExtensionCandidates(normalizedName)) {
    const extensionMatch = matchAssociation(manifest.fileExtensions, extension, parent);
    if (extensionMatch) {
      return iconIdToUrl(extensionMatch, DEFAULT_FILE_ICON);
    }
  }

  const languageId = detectLanguage(normalizedName);
  const languageMatch = languageId === 'plaintext' ? undefined : manifest.languageIds?.[languageId];
  return iconIdToUrl(languageMatch, DEFAULT_FILE_ICON);
}

export function resolveMaterialFolderIcon(
  path: string,
  options?: { expanded?: boolean },
): string {
  const { name, parent } = splitPath(path);
  const normalizedName = normalizeSegment(name);

  const specificAssociation = options?.expanded
    ? matchAssociation(manifest.folderNamesExpanded, normalizedName, parent)
      ?? matchAssociation(manifest.folderNames, normalizedName, parent)
    : matchAssociation(manifest.folderNames, normalizedName, parent);

  if (specificAssociation) {
    return iconIdToUrl(
      specificAssociation,
      options?.expanded ? DEFAULT_FOLDER_EXPANDED_ICON : DEFAULT_FOLDER_ICON,
    );
  }

  return iconIdToUrl(
    options?.expanded ? DEFAULT_FOLDER_EXPANDED_ICON : DEFAULT_FOLDER_ICON,
    options?.expanded ? DEFAULT_FOLDER_EXPANDED_ICON : DEFAULT_FOLDER_ICON,
  );
}
