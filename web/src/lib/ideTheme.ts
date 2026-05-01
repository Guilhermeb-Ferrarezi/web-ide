import type { InstalledTheme } from '@/types';
import { DEFAULT_EDITOR_THEME_ID } from '@/stores/appearanceStore';

export type ShellThemeMode = 'dark' | 'light';

export type ShellThemeTokens = Record<
  | 'background'
  | 'foreground'
  | 'card'
  | 'card-foreground'
  | 'popover'
  | 'popover-foreground'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'accent-foreground'
  | 'destructive'
  | 'destructive-foreground'
  | 'border'
  | 'input'
  | 'ring',
  string
>;

export const DEFAULT_SHELL_THEME: Record<ShellThemeMode, ShellThemeTokens> = {
  light: {
    background: '0 0% 100%',
    foreground: '0 0% 3.9%',
    card: '0 0% 100%',
    'card-foreground': '0 0% 3.9%',
    popover: '0 0% 100%',
    'popover-foreground': '0 0% 3.9%',
    primary: '0 0% 9%',
    'primary-foreground': '0 0% 98%',
    secondary: '0 0% 96.1%',
    'secondary-foreground': '0 0% 9%',
    muted: '0 0% 96.1%',
    'muted-foreground': '0 0% 45.1%',
    accent: '0 0% 96.1%',
    'accent-foreground': '0 0% 9%',
    destructive: '0 84.2% 60.2%',
    'destructive-foreground': '0 0% 98%',
    border: '0 0% 89.8%',
    input: '0 0% 89.8%',
    ring: '0 0% 3.9%',
  },
  dark: {
    background: '0 0% 3.9%',
    foreground: '0 0% 98%',
    card: '0 0% 3.9%',
    'card-foreground': '0 0% 98%',
    popover: '0 0% 3.9%',
    'popover-foreground': '0 0% 98%',
    primary: '0 0% 98%',
    'primary-foreground': '0 0% 9%',
    secondary: '0 0% 14.9%',
    'secondary-foreground': '0 0% 98%',
    muted: '0 0% 14.9%',
    'muted-foreground': '0 0% 63.9%',
    accent: '0 0% 14.9%',
    'accent-foreground': '0 0% 98%',
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '0 0% 98%',
    border: '0 0% 14.9%',
    input: '0 0% 14.9%',
    ring: '0 0% 83.1%',
  },
};

type RgbColor = { r: number; g: number; b: number; a?: number };

const MIN_USABLE_ALPHA = 0.5;
const MIN_TEXT_CONTRAST = 4.5;
const MIN_MUTED_TEXT_CONTRAST = 3;
const MIN_BORDER_CONTRAST = 1.35;
const MAX_SURFACE_SATURATION = 16;

export function getShellThemeMode(theme: InstalledTheme | null): ShellThemeMode {
  if (!theme) return 'dark';
  return theme.uiTheme === 'vs' ? 'light' : 'dark';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseHexColor(input: string): RgbColor | null {
  const normalized = input.trim().replace(/^#/, '');

  if (![3, 4, 6, 8].includes(normalized.length)) return null;

  const expanded = normalized.length <= 4
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const hasAlpha = expanded.length === 8;
  const value = Number.parseInt(expanded, 16);
  if (Number.isNaN(value)) return null;

  return hasAlpha
    ? {
        r: (value >> 24) & 0xff,
        g: (value >> 16) & 0xff,
        b: (value >> 8) & 0xff,
        a: (value & 0xff) / 255,
      }
    : {
        r: (value >> 16) & 0xff,
        g: (value >> 8) & 0xff,
        b: value & 0xff,
      };
}

function parseRgbString(input: string): RgbColor | null {
  const match = input.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;

  const parts = match[1].split(',').map((part) => part.trim());
  if (parts.length < 3) return null;

  const [r, g, b] = parts.slice(0, 3).map((part) => Number(part));
  if ([r, g, b].some((value) => Number.isNaN(value))) return null;

  const alpha = parts[3] ? Number(parts[3]) : undefined;
  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
    a: alpha === undefined || Number.isNaN(alpha) ? undefined : clamp(alpha, 0, 1),
  };
}

function parseColor(input: string | undefined): RgbColor | null {
  if (!input) return null;
  return parseHexColor(input) ?? parseRgbString(input);
}

function isUsableColor(color: RgbColor | null): color is RgbColor {
  return !!color && (color.a === undefined || color.a >= MIN_USABLE_ALPHA);
}

function rgbToHsl(color: RgbColor): { h: number; s: number; l: number } {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }

  h /= 6;

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

function hslToCssValue(hsl: { h: number; s: number; l: number }): string {
  return `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l * 10) / 10}%`;
}

function colorToCssValue(input: string | undefined): string | null {
  const color = parseColor(input);
  if (!isUsableColor(color)) return null;
  return hslToCssValue(rgbToHsl(color));
}

function colorLightness(input: string | undefined): number | null {
  const color = parseColor(input);
  if (!isUsableColor(color)) return null;
  return rgbToHsl(color).l;
}

function colorSaturation(input: string | undefined): number | null {
  const color = parseColor(input);
  if (!isUsableColor(color)) return null;
  return rgbToHsl(color).s;
}

function shiftLightness(input: string | undefined, amount: number, fallback: string): string {
  const color = parseColor(input);
  if (!isUsableColor(color)) return fallback;
  const hsl = rgbToHsl(color);
  return hslToCssValue({ ...hsl, l: clamp(hsl.l + amount, 0, 100) });
}

function pickColor(colors: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = colors[key];
    if (value) return value;
  }
  return undefined;
}

function resolvePrimaryForeground(primary: string, fallback: string): string {
  const lightness = colorLightness(primary);
  if (lightness === null) return fallback;
  return lightness > 52 ? DEFAULT_SHELL_THEME.light.foreground : DEFAULT_SHELL_THEME.dark.foreground;
}

function luminanceChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getContrastRatio(foreground: string | undefined, background: string | undefined): number | null {
  const fg = parseColor(foreground);
  const bg = parseColor(background);

  if (!isUsableColor(fg) || !isUsableColor(bg)) return null;

  const fgLuminance = 0.2126 * luminanceChannel(fg.r)
    + 0.7152 * luminanceChannel(fg.g)
    + 0.0722 * luminanceChannel(fg.b);
  const bgLuminance = 0.2126 * luminanceChannel(bg.r)
    + 0.7152 * luminanceChannel(bg.g)
    + 0.0722 * luminanceChannel(bg.b);
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function colorToSurfaceCssValue(input: string | undefined): string | null {
  const saturation = colorSaturation(input);
  if (saturation === null || saturation > MAX_SURFACE_SATURATION) return null;
  return colorToCssValue(input);
}

export function resolveShellTheme(theme: InstalledTheme | null): { mode: ShellThemeMode; tokens: ShellThemeTokens } {
  const mode = getShellThemeMode(theme);
  const defaults = DEFAULT_SHELL_THEME[mode];

  if (!theme || theme.id === DEFAULT_EDITOR_THEME_ID) {
    return { mode, tokens: defaults };
  }

  const colors = theme.colors;
  const baseBackground = pickColor(colors, ['sideBar.background', 'editor.background', 'panel.background']);
  const baseForeground = pickColor(colors, ['sideBar.foreground', 'editor.foreground', 'foreground']);
  const borderColor = pickColor(colors, ['panel.border', 'sideBar.border', 'contrastBorder', 'editorGroup.border']);
  const primaryColor = pickColor(colors, ['button.background', 'list.activeSelectionBackground', 'focusBorder']);
  const accentColor = pickColor(colors, ['list.hoverBackground', 'list.activeSelectionBackground', 'button.background']);
  const mutedColor = pickColor(colors, ['list.inactiveSelectionBackground', 'panel.background', 'sideBarSectionHeader.background']);
  const mutedForegroundColor = pickColor(colors, ['descriptionForeground', 'list.inactiveSelectionForeground', 'editorLineNumber.foreground']);
  const popoverColor = pickColor(colors, ['editorWidget.background', 'panel.background', 'editor.background']);

  const fallbackBackgroundHex = mode === 'dark' ? '#0a0a0a' : '#ffffff';
  const background = colorToSurfaceCssValue(baseBackground) ?? defaults.background;
  const resolvedForeground = colorToCssValue(baseForeground);
  const foregroundContrast = getContrastRatio(baseForeground, baseBackground ?? fallbackBackgroundHex);
  const foreground = resolvedForeground && (foregroundContrast === null || foregroundContrast >= MIN_TEXT_CONTRAST)
    ? resolvedForeground
    : defaults.foreground;
  const resolvedBorder = colorToCssValue(borderColor);
  const borderContrast = getContrastRatio(borderColor, baseBackground ?? fallbackBackgroundHex);
  const border = resolvedBorder && (borderContrast === null || borderContrast >= MIN_BORDER_CONTRAST)
    ? resolvedBorder
    : defaults.border;
  const primary = colorToCssValue(primaryColor) ?? shiftLightness(baseBackground, mode === 'dark' ? 22 : -18, defaults.primary);
  const accent = colorToCssValue(accentColor) ?? shiftLightness(baseBackground, mode === 'dark' ? 12 : -10, defaults.accent);
  const muted = colorToSurfaceCssValue(mutedColor)
    ?? shiftLightness(baseBackground, mode === 'dark' ? 8 : -6, defaults.muted);
  const secondary = colorToSurfaceCssValue(baseBackground)
    ? shiftLightness(baseBackground, mode === 'dark' ? 10 : -8, defaults.secondary)
    : defaults.secondary;
  const card = colorToSurfaceCssValue(baseBackground)
    ? shiftLightness(baseBackground, mode === 'dark' ? 2 : -2, defaults.card)
    : defaults.card;
  const popover = colorToSurfaceCssValue(popoverColor) ?? card;
  const ring = colorToCssValue(pickColor(colors, ['focusBorder', 'button.background'])) ?? primary;
  const primaryForeground = resolvePrimaryForeground(primaryColor ?? '', defaults['primary-foreground']);
  const resolvedMutedForeground = colorToCssValue(mutedForegroundColor);
  const mutedForegroundContrast = getContrastRatio(
    mutedForegroundColor,
    mutedColor ?? baseBackground ?? fallbackBackgroundHex,
  );
  const mutedForeground = resolvedMutedForeground
    && (mutedForegroundContrast === null || mutedForegroundContrast >= MIN_MUTED_TEXT_CONTRAST)
    ? resolvedMutedForeground
    : defaults['muted-foreground'];

  return {
    mode,
    tokens: {
      background,
      foreground,
      card,
      'card-foreground': foreground,
      popover,
      'popover-foreground': foreground,
      primary,
      'primary-foreground': primaryForeground,
      secondary,
      'secondary-foreground': foreground,
      muted,
      'muted-foreground': mutedForeground,
      accent,
      'accent-foreground': foreground,
      destructive: defaults.destructive,
      'destructive-foreground': defaults['destructive-foreground'],
      border,
      input: border,
      ring,
    },
  };
}

export function applyShellTheme(theme: InstalledTheme | null): ShellThemeMode {
  const root = document.documentElement;
  const { mode, tokens } = resolveShellTheme(theme);

  root.classList.toggle('dark', mode === 'dark');

  for (const [token, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${token}`, value);
  }

  return mode;
}
