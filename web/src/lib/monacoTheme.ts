import type { InstalledTheme } from '@/types';

const SAFE_MONACO_COLOR_KEYS = [
  'editorCursor.foreground',
  'editorLineNumber.foreground',
  'editorLineNumber.activeForeground',
  'editor.lineHighlightBackground',
  'editor.selectionBackground',
  'editor.inactiveSelectionBackground',
  'editor.selectionHighlightBackground',
  'editor.wordHighlightBackground',
  'editor.wordHighlightStrongBackground',
  'editor.findMatchBackground',
  'editor.findMatchHighlightBackground',
  'editorIndentGuide.background1',
  'editorIndentGuide.activeBackground1',
  'editorWhitespace.foreground',
  'editorBracketMatch.background',
  'editorBracketMatch.border',
] as const;

function getStableEditorColors(uiTheme: InstalledTheme['uiTheme']): Record<string, string> {
  if (uiTheme === 'vs') {
    return {
      'editor.background': '#ffffff',
      'editor.foreground': '#1f2937',
      'editorGutter.background': '#ffffff',
    };
  }

  return {
    'editor.background': '#161b22',
    'editor.foreground': '#c9d1d9',
    'editorGutter.background': '#161b22',
  };
}

export function buildMonacoThemeData(theme: InstalledTheme) {
  const safeColors = Object.fromEntries(
    SAFE_MONACO_COLOR_KEYS.flatMap((key) => {
      const value = theme.colors[key];
      return value ? [[key, value] as const] : [];
    }),
  );

  return {
    base: theme.uiTheme,
    inherit: true,
    rules: theme.rules,
    colors: {
      ...getStableEditorColors(theme.uiTheme),
      ...safeColors,
    },
  };
}
