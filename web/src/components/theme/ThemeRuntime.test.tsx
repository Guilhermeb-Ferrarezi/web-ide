import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeRuntime } from './ThemeRuntime';
import { DEFAULT_EDITOR_THEME_ID, useAppearanceStore } from '@/stores/appearanceStore';

describe('<ThemeRuntime />', () => {
  beforeEach(() => {
    useAppearanceStore.setState({
      installedThemes: [],
      activeThemeId: DEFAULT_EDITOR_THEME_ID,
    });
    document.documentElement.className = 'dark';
    document.documentElement.removeAttribute('style');
  });

  it('applies the active installed theme to shell variables', async () => {
    useAppearanceStore.setState({
      installedThemes: [
        {
          id: 'github.dark',
          extensionId: 'github.theme',
          label: 'GitHub Dark',
          uiTheme: 'vs-dark',
          colors: {
            'editor.background': '#161b22',
            'editor.foreground': '#e6edf3',
            'activityBar.background': '#0d1117',
            'editorWidget.background': '#1f2630',
            'focusBorder': '#2f81f7',
          },
          rules: [],
        },
      ],
      activeThemeId: 'github.dark',
    });

    render(<ThemeRuntime />);

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--background')).not.toBe('');
      expect(document.documentElement.style.getPropertyValue('--background')).not.toBe('0 0% 3.9%');
    });
  });
});
