import { describe, expect, it } from 'vitest';
import {
  resolveMaterialFileIcon,
  resolveMaterialFolderIcon,
} from './fileTreeIcons';

const BASE_URL =
  'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/v5.34.0/icons';

describe('fileTreeIcons', () => {
  it('prioritizes exact file name matches', () => {
    expect(resolveMaterialFileIcon('package.json')).toBe(`${BASE_URL}/nodejs.svg`);
  });

  it('supports compound extensions before generic ones', () => {
    expect(resolveMaterialFileIcon('index.d.ts')).toBe(`${BASE_URL}/typescript-def.svg`);
  });

  it('resolves specific folder icons for closed and expanded states', () => {
    expect(resolveMaterialFolderIcon('src')).toBe(`${BASE_URL}/folder-src.svg`);
    expect(resolveMaterialFolderIcon('src', { expanded: true })).toBe(`${BASE_URL}/folder-src-open.svg`);
  });

  it('falls back to default icons when there is no dedicated match', () => {
    expect(resolveMaterialFileIcon('notes.unknown')).toBe(`${BASE_URL}/file.svg`);
    expect(resolveMaterialFolderIcon('random-folder')).toBe(`${BASE_URL}/folder.svg`);
  });
});
