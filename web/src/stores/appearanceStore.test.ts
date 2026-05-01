import { beforeEach, describe, expect, it } from 'vitest';
import { useAppearanceStore } from './appearanceStore';

describe('useAppearanceStore', () => {
  beforeEach(() => {
    useAppearanceStore.setState({
      installedThemes: [],
      installedIconThemes: [],
      activeThemeId: 'default-dark',
      activeIconThemeId: 'material-default',
    });
  });

  it('instala e ativa um tema de editor', () => {
    useAppearanceStore.getState().installTheme({
      id: 'github.github-vscode-theme-dark',
      extensionId: 'GitHub.github-vscode-theme',
      label: 'GitHub Dark',
      uiTheme: 'vs-dark',
      colors: { 'editor.background': '#0d1117' },
      rules: [],
    });

    useAppearanceStore.getState().setActiveTheme('github.github-vscode-theme-dark');

    expect(useAppearanceStore.getState().installedThemes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'github.github-vscode-theme-dark', label: 'GitHub Dark' }),
      ]),
    );
    expect(useAppearanceStore.getState().activeThemeId).toBe('github.github-vscode-theme-dark');
  });
});
