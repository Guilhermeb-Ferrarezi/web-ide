import { describe, expect, it, beforeEach } from 'vitest';
import { DEFAULT_EDITOR_THEME_ID } from '@/stores/appearanceStore';
import { applyShellTheme, DEFAULT_SHELL_THEME, resolveShellTheme } from './ideTheme';
import type { InstalledTheme } from '@/types';

function makeTheme(input: Partial<InstalledTheme>): InstalledTheme {
  return {
    id: 'test.theme',
    extensionId: 'test.theme',
    label: 'Test Theme',
    uiTheme: 'vs-dark',
    colors: {},
    rules: [],
    ...input,
  };
}

describe('ideTheme', () => {
  beforeEach(() => {
    document.documentElement.className = 'dark';
    document.documentElement.removeAttribute('style');
  });

  it('resolves dark shell tokens from known VS Code colors', () => {
    const theme = makeTheme({
      colors: {
        'sideBar.background': '#15121c',
        'sideBar.foreground': '#f6f0ff',
        'panel.border': '#332c40',
        'button.background': '#a277ff',
        'descriptionForeground': '#b8adc9',
      },
    });

    const resolved = resolveShellTheme(theme);

    expect(resolved.mode).toBe('dark');
    expect(resolved.tokens.background).toBe(DEFAULT_SHELL_THEME.dark.background);
    expect(resolved.tokens.foreground).not.toBe(DEFAULT_SHELL_THEME.dark.foreground);
    expect(resolved.tokens.border).not.toBe(DEFAULT_SHELL_THEME.dark.border);
    expect(resolved.tokens.primary).not.toBe(DEFAULT_SHELL_THEME.dark.primary);
  });

  it('resolves light shell tokens when the VS Code theme is light', () => {
    const theme = makeTheme({
      uiTheme: 'vs',
      colors: {
        'editor.background': '#faf7ff',
        'editor.foreground': '#251f33',
        'focusBorder': '#7c3aed',
      },
    });

    const resolved = resolveShellTheme(theme);

    expect(resolved.mode).toBe('light');
    expect(resolved.tokens.background).toBe(DEFAULT_SHELL_THEME.light.background);
    expect(resolved.tokens.foreground).not.toBe(DEFAULT_SHELL_THEME.light.foreground);
    expect(resolved.tokens.ring).not.toBe(DEFAULT_SHELL_THEME.light.ring);
  });

  it('falls back to built-in defaults for the default editor theme', () => {
    const resolved = resolveShellTheme(
      makeTheme({
        id: DEFAULT_EDITOR_THEME_ID,
      }),
    );

    expect(resolved.mode).toBe('dark');
    expect(resolved.tokens).toEqual(DEFAULT_SHELL_THEME.dark);
  });

  it('ignores transparent shell colors from installed themes', () => {
    const resolved = resolveShellTheme(
      makeTheme({
        colors: {
          'sideBar.background': '#15121c00',
          'sideBar.foreground': '#f6f0ff00',
          'panel.border': '#332c4000',
        },
      }),
    );

    expect(resolved.tokens.background).toBe(DEFAULT_SHELL_THEME.dark.background);
    expect(resolved.tokens.foreground).toBe(DEFAULT_SHELL_THEME.dark.foreground);
    expect(resolved.tokens.border).toBe(DEFAULT_SHELL_THEME.dark.border);
  });

  it('falls back when foreground contrast against the background is too low', () => {
    const resolved = resolveShellTheme(
      makeTheme({
        colors: {
          'sideBar.background': '#15121c',
          'sideBar.foreground': '#1a1720',
          'descriptionForeground': '#1d1924',
        },
      }),
    );

    expect(resolved.tokens.background).toBe(DEFAULT_SHELL_THEME.dark.background);
    expect(resolved.tokens.foreground).toBe(DEFAULT_SHELL_THEME.dark.foreground);
    expect(resolved.tokens['muted-foreground']).toBe(DEFAULT_SHELL_THEME.dark['muted-foreground']);
  });

  it('keeps saturated theme backgrounds out of the shell surfaces', () => {
    const resolved = resolveShellTheme(
      makeTheme({
        colors: {
          'sideBar.background': '#24103a',
          'panel.background': '#2b1245',
          'button.background': '#a277ff',
        },
      }),
    );

    expect(resolved.tokens.background).toBe(DEFAULT_SHELL_THEME.dark.background);
    expect(resolved.tokens.card).toBe(DEFAULT_SHELL_THEME.dark.card);
    expect(resolved.tokens.secondary).toBe(DEFAULT_SHELL_THEME.dark.secondary);
    expect(resolved.tokens.primary).not.toBe(DEFAULT_SHELL_THEME.dark.primary);
  });

  it('applies shell tokens and toggles the root mode class', () => {
    const mode = applyShellTheme(
      makeTheme({
        uiTheme: 'vs',
        colors: {
          'editor.background': '#faf7ff',
          'editor.foreground': '#251f33',
        },
      }),
    );

    expect(mode).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--background')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--foreground')).not.toBe('');
  });
});
