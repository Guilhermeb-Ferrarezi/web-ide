import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionsPanel } from './ExtensionsPanel';
import * as extensionsApi from '@/api/extensions';
import { useAppearanceStore } from '@/stores/appearanceStore';

vi.mock('@/api/extensions');
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('<ExtensionsPanel />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppearanceStore.setState({
      installedThemes: [],
      installedIconThemes: [],
      activeThemeId: 'default-dark',
      activeIconThemeId: 'material-default',
    });
  });

  it('busca e instala um tema do marketplace', async () => {
    vi.spyOn(extensionsApi, 'searchExtensions').mockResolvedValue([
      {
        id: 'GitHub.github-vscode-theme',
        name: 'github-vscode-theme',
        namespace: 'GitHub',
        displayName: 'GitHub Theme',
        description: 'GitHub theme for VS Code',
        version: '6.3.5',
        iconUrl: 'https://example.com/icon.png',
        downloadCount: 100,
      },
    ]);
    vi.spyOn(extensionsApi, 'installExtension').mockResolvedValue({
      extensionId: 'GitHub.github-vscode-theme',
      displayName: 'GitHub Theme',
      themes: [
        {
          id: 'github.github-vscode-theme-dark',
          extensionId: 'GitHub.github-vscode-theme',
          label: 'GitHub Dark',
          uiTheme: 'vs-dark',
          colors: { 'editor.background': '#0d1117' },
          rules: [],
        },
      ],
      iconThemes: [],
    });

    render(<ExtensionsPanel />);

    await userEvent.type(screen.getByPlaceholderText('Buscar temas e icon themes...'), 'github theme');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('GitHub Theme')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Instalar' }));

    await waitFor(() =>
      expect(useAppearanceStore.getState().installedThemes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'github.github-vscode-theme-dark' }),
        ]),
      ),
    );
    expect(screen.getByRole('button', { name: 'Aplicar GitHub Dark' })).toBeInTheDocument();
  });
});
