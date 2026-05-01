# IDE Shell Theme Design

## Goal

Apply the active VS Code color theme to both Monaco and the surrounding IDE shell using the existing global CSS tokens, while preserving readable fallbacks for incomplete or extreme themes.

## Scope

- Use the currently selected `InstalledTheme` as the single source of truth.
- Keep using the existing app-wide tokens from `web/src/index.css`.
- Allow the shell to switch between dark and light modes based on the selected VS Code theme.
- Apply theme changes immediately when the user chooses `Set Color Theme`.

## Non-Goals

- Redesign the top bar or overall shell layout.
- Support every VS Code color token 1:1.
- Persist theme preference outside the current in-memory store.

## Architecture

### Theme Resolution

Create a small resolver that receives an `InstalledTheme` and returns:

- `mode`: `dark` or `light`
- resolved CSS variables for the IDE shell

The resolver should map only a conservative subset of VS Code colors to app tokens:

- base surfaces from `editor.background`, `sideBar.background`, `panel.background`
- foregrounds from `editor.foreground`, `foreground`, `sideBar.foreground`
- borders from `panel.border`, `sideBar.border`, `contrastBorder`
- interactive accents from `button.background`, `focusBorder`, `list.activeSelectionBackground`
- muted text from `descriptionForeground`

Missing colors must fall back to the current default light/dark token values.

### Theme Application

Add a browser-side applicator that writes resolved CSS variables to `document.documentElement.style` and toggles the `dark` class on the root element based on the resolved mode.

Default behavior:

- `DEFAULT_EDITOR_THEME_ID` resets the shell to current built-in dark defaults
- custom themes apply both Monaco theme colors and shell tokens

### UI Flow

- Installing a theme only stores it in the appearance store.
- Clicking `Set Color Theme` changes `activeThemeId`.
- A global effect reacts to `activeThemeId` and applies shell variables immediately.

## Files

- `web/src/stores/appearanceStore.ts`
  - keep selected theme state as-is
- `web/src/index.css`
  - remain the source of default tokens
- `web/src/main.tsx`
  - mount a global theme sync component near the app root
- `web/src/components/editor/EditorPane.tsx`
  - keep Monaco theme activation behavior
- new theme utilities/hooks under `web/src/lib` or `web/src/components/theme`
  - resolve shell tokens
  - apply/remove CSS variables

## Safety Rules

- Never copy arbitrary theme keys directly into the shell.
- Only map known keys.
- Always provide defaults for every shell token.
- Keep contrast-safe fallbacks when the extension theme is sparse.

## Testing

- unit test the resolver for dark and light themes
- verify fallback behavior when colors are missing
- verify shell reset when returning to default theme
- keep existing editor theme tests passing
