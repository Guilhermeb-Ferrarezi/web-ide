import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IDEPage from './IDEPage';

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ workspace }: { workspace: string }) => <div>AppShell {workspace}</div>,
}));

vi.mock('@/hooks/useWatcher', () => ({
  useWatcher: vi.fn(),
}));

vi.mock('@/lib/watcherBus', () => ({
  watcherBus: {
    emit: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('@/api/fs', () => ({
  fetchFile: vi.fn(),
}));

vi.mock('@/api/repos', () => ({
  listLocalRepos: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@/api/extensions', () => ({
  getInstalledExtensions: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@/api/settings', () => ({
  getUserSettings: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@/stores/workspaceStore', async () => {
  const { create } = await import('zustand');
  const useWorkspaceStore = create(() => ({
    permission: 'write' as const,
    setWorkspace: vi.fn(),
    setPermission: vi.fn(),
  }));
  return { useWorkspaceStore };
});

vi.mock('@/stores/editorStore', async () => {
  const { create } = await import('zustand');
  const useEditorStore = create(() => ({
    reset: vi.fn(),
    hydratePreferences: vi.fn(),
  }));
  return { useEditorStore, default: {} };
});

vi.mock('@/stores/appearanceStore', async () => {
  const { create } = await import('zustand');
  const useAppearanceStore = create(() => ({
    replaceInstalled: vi.fn(),
    resetInstalled: vi.fn(),
    hydratePreferences: vi.fn(),
  }));
  return { useAppearanceStore };
});

vi.mock('@/stores/userSettingsStore', () => ({
  useUserSettingsStore: {
    getState: () => ({
      reset: vi.fn(),
      hydrate: vi.fn(),
    }),
  },
}));

describe('<IDEPage />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra o workspace no cabeçalho durante o skeleton inicial', () => {
    render(
      <MemoryRouter initialEntries={['/ide/repo']}>
        <Routes>
          <Route path="/ide/:workspace" element={<IDEPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('repo')).toBeInTheDocument();
  });

  it('mostra mensagem contextual no skeleton inicial', () => {
    render(
      <MemoryRouter initialEntries={['/ide/repo']}>
        <Routes>
          <Route path="/ide/:workspace" element={<IDEPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Preparando permissões, extensões e editor...')).toBeInTheDocument();
    expect(screen.getByText('Aguarde enquanto o workspace repo é carregado.')).toBeInTheDocument();
  });
});
