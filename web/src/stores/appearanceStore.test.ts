import { beforeEach, describe, expect, it } from 'vitest';
import { useAppearanceStore } from './appearanceStore';

describe('useAppearanceStore', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });
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

  it('substitui extensoes instaladas ao hidratar uma workspace', () => {
    useAppearanceStore.getState().replaceInstalled({
      themes: [
        {
          id: 'aura.dark',
          extensionId: 'DaltonMenezes.aura-theme',
          label: 'Aura Dark',
          uiTheme: 'vs-dark',
          colors: {},
          rules: [],
        },
      ],
      iconThemes: [],
    }, 'repo-a');

    expect(useAppearanceStore.getState().installedThemes).toEqual([
      expect.objectContaining({ id: 'aura.dark' }),
    ]);
  });

  it('persiste o tema ativo por workspace', () => {
    useAppearanceStore.getState().replaceInstalled({
      themes: [
        {
          id: 'aura.dark',
          extensionId: 'DaltonMenezes.aura-theme',
          label: 'Aura Dark',
          uiTheme: 'vs-dark',
          colors: {},
          rules: [],
        },
      ],
      iconThemes: [],
    }, 'repo-a');

    useAppearanceStore.getState().setActiveTheme('aura.dark', 'repo-a');
    useAppearanceStore.setState({
      installedThemes: [],
      installedIconThemes: [],
      activeThemeId: 'default-dark',
      activeIconThemeId: 'material-default',
    });

    useAppearanceStore.getState().replaceInstalled({
      themes: [
        {
          id: 'aura.dark',
          extensionId: 'DaltonMenezes.aura-theme',
          label: 'Aura Dark',
          uiTheme: 'vs-dark',
          colors: {},
          rules: [],
        },
      ],
      iconThemes: [],
    }, 'repo-a');

    expect(useAppearanceStore.getState().activeThemeId).toBe('aura.dark');
  });

  it('reseta extensoes instaladas e volta para os temas padrao', () => {
    useAppearanceStore.setState({
      installedThemes: [
        {
          id: 'aura.dark',
          extensionId: 'DaltonMenezes.aura-theme',
          label: 'Aura Dark',
          uiTheme: 'vs-dark',
          colors: {},
          rules: [],
        },
      ],
      installedIconThemes: [
        {
          id: 'icons.dark',
          extensionId: 'vscode-icons-team.vscode-icons',
          label: 'VSCode Icons',
          icons: {
            file: 'file',
            folder: 'folder',
            folderExpanded: 'folder-open',
            fileNames: {},
            fileExtensions: {},
            folderNames: {},
            folderNamesExpanded: {},
            languageIds: {},
            iconDefinitions: {},
          },
        },
      ],
      activeThemeId: 'aura.dark',
      activeIconThemeId: 'icons.dark',
    });

    useAppearanceStore.getState().resetInstalled();

    expect(useAppearanceStore.getState().installedThemes).toEqual([]);
    expect(useAppearanceStore.getState().installedIconThemes).toEqual([]);
    expect(useAppearanceStore.getState().activeThemeId).toBe('default-dark');
    expect(useAppearanceStore.getState().activeIconThemeId).toBe('material-default');
  });
});
