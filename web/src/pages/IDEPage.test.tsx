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

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: (selector: any) => selector({
    permission: 'write',
    setWorkspace: vi.fn(),
    setPermission: vi.fn(),
  }),
}));

vi.mock('@/stores/editorStore', () => ({
  useEditorStore: (selector: any) => selector({ reset: vi.fn() }),
  default: {},
}));

vi.mock('@/stores/appearanceStore', () => ({
  useAppearanceStore: (selector: any) => selector({
    replaceInstalled: vi.fn(),
    resetInstalled: vi.fn(),
  }),
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
