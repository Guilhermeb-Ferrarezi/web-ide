import { describe, expect, it } from 'vitest';
import {
  resolveFileIcon,
  resolveFolderIcon,
} from './fileTreeIcons';
import { useAppearanceStore } from '@/stores/appearanceStore';

const BASE_URL =
  'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/v5.34.0/icons';

describe('fileTreeIcons', () => {
  it('prioritizes exact file name matches', () => {
    expect(resolveFileIcon('package.json')).toBe(`${BASE_URL}/nodejs.svg`);
  });

  it('supports compound extensions before generic ones', () => {
    expect(resolveFileIcon('index.d.ts')).toBe(`${BASE_URL}/typescript-def.svg`);
  });

  it('resolves specific folder icons for closed and expanded states', () => {
    expect(resolveFolderIcon('src')).toBe(`${BASE_URL}/folder-src.svg`);
    expect(resolveFolderIcon('src', { expanded: true })).toBe(`${BASE_URL}/folder-src-open.svg`);
  });

  it('falls back to default icons when there is no dedicated match', () => {
    expect(resolveFileIcon('notes.unknown')).toBe(`${BASE_URL}/file.svg`);
    expect(resolveFolderIcon('random-folder')).toBe(`${BASE_URL}/folder.svg`);
  });

  it('respects the active installed icon theme when available', () => {
    useAppearanceStore.setState({
      installedThemes: [],
      activeThemeId: 'default-dark',
      installedIconThemes: [
        {
          id: 'pkief.material-icon-theme',
          extensionId: 'PKief.material-icon-theme',
          label: 'Material Icon Theme',
          icons: {
            file: 'custom-file',
            folder: 'custom-folder',
            folderExpanded: 'custom-folder-open',
            fileNames: { 'package.json': 'custom-package' },
            fileExtensions: {},
            folderNames: {},
            folderNamesExpanded: {},
            languageIds: {},
            iconDefinitions: {
              'custom-file': 'data:image/svg+xml;base64,FILE',
              'custom-folder': 'data:image/svg+xml;base64,FOLDER',
              'custom-folder-open': 'data:image/svg+xml;base64,FOLDEROPEN',
              'custom-package': 'data:image/svg+xml;base64,PACKAGE',
            },
          },
        },
      ],
      activeIconThemeId: 'pkief.material-icon-theme',
    });

    expect(resolveFileIcon('package.json')).toBe('data:image/svg+xml;base64,PACKAGE');
    expect(resolveFolderIcon('src')).toBe('data:image/svg+xml;base64,FOLDER');
  });

  it('falls back to material defaults when the active theme is missing base icon definitions', () => {
    useAppearanceStore.setState({
      installedThemes: [],
      activeThemeId: 'default-dark',
      installedIconThemes: [
        {
          id: 'broken-theme',
          extensionId: 'broken.theme',
          label: 'Broken Theme',
          icons: {
            file: 'custom-file',
            folder: 'custom-folder',
            folderExpanded: 'custom-folder-open',
            fileNames: {},
            fileExtensions: {},
            folderNames: {},
            folderNamesExpanded: {},
            languageIds: {},
            iconDefinitions: {},
          },
        },
      ],
      activeIconThemeId: 'broken-theme',
    });

    expect(resolveFileIcon('notes.unknown')).toBe(`${BASE_URL}/file.svg`);
    expect(resolveFolderIcon('random-folder')).toBe(`${BASE_URL}/folder.svg`);
    expect(resolveFolderIcon('random-folder', { expanded: true })).toBe(`${BASE_URL}/folder-open.svg`);
  });

  it('ignores empty icon definition URLs from installed themes and still falls back', () => {
    useAppearanceStore.setState({
      installedThemes: [],
      activeThemeId: 'default-dark',
      installedIconThemes: [
        {
          id: 'partial-theme',
          extensionId: 'partial.theme',
          label: 'Partial Theme',
          icons: {
            file: 'custom-file',
            folder: 'custom-folder',
            folderExpanded: 'custom-folder-open',
            fileNames: {
              '.dockerignore': 'dockerignore-missing',
            },
            fileExtensions: {},
            folderNames: {
              docs: 'folder-docs-missing',
            },
            folderNamesExpanded: {},
            languageIds: {},
            iconDefinitions: {
              'dockerignore-missing': '',
              'folder-docs-missing': '',
              'custom-file': '',
              'custom-folder': '',
              'custom-folder-open': '',
            },
          },
        },
      ],
      activeIconThemeId: 'partial-theme',
    });

    expect(resolveFileIcon('.dockerignore')).toBe(`${BASE_URL}/file.svg`);
    expect(resolveFolderIcon('docs')).toBe(`${BASE_URL}/folder.svg`);
  });
});
