import { describe, expect, it } from 'vitest';
import { buildMonacoThemeData } from './monacoTheme';
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
      rules: [{ token: 'keyword', foreground: 'ff79c6' }],
    });

    const result = buildMonacoThemeData(theme);

    expect(result.base).toBe('vs-dark');
    expect(result.rules).toEqual(theme.rules);
    expect(result.colors['editor.background']).toBe('#0f1115');
    expect(result.colors['editor.foreground']).toBe('#e5e7eb');
    expect(result.colors['editor.selectionBackground']).toBe('#a277ff55');
    expect(result.colors['sideBar.background']).toBeUndefined();
  });

  it('uses a stable light background for light themes', () => {
    const theme = makeTheme({
      uiTheme: 'vs',
      colors: {
        'editor.background': '#faf7ff',
        'editor.foreground': '#251f33',
      },
    });

    const result = buildMonacoThemeData(theme);

    expect(result.colors['editor.background']).toBe('#ffffff');
    expect(result.colors['editor.foreground']).toBe('#111827');
  });
});
