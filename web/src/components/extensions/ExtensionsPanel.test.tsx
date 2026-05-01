import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionsPanel } from './ExtensionsPanel';
import * as extensionsApi from '@/api/extensions';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useEditorStore } from '@/stores/editorStore';

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
    useEditorStore.getState().reset();
  });

  it('abre o detalhe da extensao como aba virtual do editor', async () => {
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
        averageRating: 5,
        verified: true,
      },
    ]);
    vi.spyOn(extensionsApi, 'getExtensionDetail').mockResolvedValue({
      extension: {
        id: 'GitHub.github-vscode-theme',
        name: 'github-vscode-theme',
        namespace: 'GitHub',
        displayName: 'GitHub Theme',
        description: 'GitHub theme for VS Code',
        version: '6.3.5',
        iconUrl: 'https://example.com/icon.png',
        downloadCount: 100,
        averageRating: 5,
        verified: true,
      },
      readme: '# GitHub Theme\n\nA beautiful dark theme for Visual Studio Code',
      resources: [
        { label: 'Repository', url: 'https://github.com/github/github-vscode-theme' },
      ],
      categories: ['Themes'],
      publishedAt: '2024-10-04T03:33:27.439016Z',
      updatedAt: '2024-10-04T03:33:27.439016Z',
    });
    render(<ExtensionsPanel />);

    expect(await screen.findByText('Popular')).toBeInTheDocument();
    expect((await screen.findAllByText('GitHub Theme')).length).toBeGreaterThan(0);
    await userEvent.click((await screen.findAllByText('GitHub Theme'))[0]);

    await userEvent.clear(screen.getByPlaceholderText('Search Extensions in Marketplace'));
    await userEvent.type(screen.getByPlaceholderText('Search Extensions in Marketplace'), 'github theme');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar extensões' }));

    await waitFor(() =>
      expect(useEditorStore.getState().tabs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'Extensions/GitHub Theme',
            name: 'Extension: GitHub Theme',
            kind: 'extension',
          }),
        ]),
      ),
    );
    expect(useEditorStore.getState().activePath).toBe('Extensions/GitHub Theme');
  });
});
