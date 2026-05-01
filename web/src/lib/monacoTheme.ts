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
    colors: safeColors,
  };
}
