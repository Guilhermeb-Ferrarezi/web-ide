import { describe, expect, it } from 'vitest';
import { buildMonacoThemeData, getMonacoThemeName } from './monacoTheme';
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

describe('buildMonacoThemeData', () => {
  it('keeps syntax rules but forces a stable dark editor background', () => {
    const theme = makeTheme({
      colors: {
        'editor.background': '#24103a',
        'editor.foreground': '#f8f8f2',
        'editor.selectionBackground': '#a277ff55',
        'sideBar.background': '#24103a',
      },
      rules: [
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'variable.other.property', foreground: 'c17ac8' },
      ],
      semanticRules: [{ token: 'class', foreground: '8be9fd' }],
    });

    const result = buildMonacoThemeData(theme);

    expect(result.base).toBe('vs-dark');
    expect(result.rules).toEqual(
      expect.arrayContaining([
        ...theme.rules,
        ...theme.semanticRules!,
      ]),
    );
    expect(result.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ token: 'identifier' }),
      ]),
    );
    expect(result.colors['editor.background']).toBe('#24103a');
    expect(result.colors['editor.foreground']).toBe('#f8f8f2');
    expect(result.colors['editor.selectionBackground']).toBe('#a277ff55');
    expect(result.colors['sideBar.background']).toBe('#24103a');
  });

  it('keeps light theme editor colors', () => {
    const theme = makeTheme({
      uiTheme: 'vs',
      colors: {
        'editor.background': '#faf7ff',
        'editor.foreground': '#251f33',
      },
    });

    const result = buildMonacoThemeData(theme);

    expect(result.colors['editor.background']).toBe('#faf7ff');
    expect(result.colors['editor.foreground']).toBe('#251f33');
  });

  it('sanitizes extension theme ids before using them in Monaco', () => {
    const theme = makeTheme({
      id: 'DaltonMenezes.aura-theme.Aura Dark (Soft Text)',
    });

    expect(getMonacoThemeName(theme)).toBe('ext-daltonmenezes-aura-theme-aura-dark-soft-text');
  });
});
