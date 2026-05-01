import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppShell } from './AppShell';
import { useWorkspaceStore } from '@/stores/workspaceStore';

vi.mock('@/hooks/useEditor', () => ({
  useEditor: () => ({
    tabs: [],
    activePath: null,
    setActive: vi.fn(),
    closeTab: vi.fn(),
    updateContent: vi.fn(),
    save: vi.fn(),
  }),
}));

vi.mock('@/hooks/useGitStatus', () => ({
  useGitStatus: () => ({
    status: {
      branch: 'main',
      ahead: 0,
      behind: 0,
      staged: [{ path: 'README.md', index: 'M', workingDir: ' ' }],
      unstaged: [{ path: 'src/app.ts', index: ' ', workingDir: 'M' }],
      untracked: ['notes.txt'],
    },
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/components/file-tree/FileTree', () => ({
  FileTree: () => <div>file-tree</div>,
}));

vi.mock('@/components/editor/EditorTabs', () => ({
  EditorTabs: () => <div>editor-tabs</div>,
}));

vi.mock('@/components/editor/EditorBreadcrumbs', () => ({
  EditorBreadcrumbs: () => <div>editor-breadcrumbs</div>,
}));

vi.mock('@/components/editor/EditorPane', () => ({
  EditorPane: () => <div>editor-pane</div>,
}));

vi.mock('@/components/git/GitPanel', () => ({
  GitPanel: () => <div>git-panel</div>,
}));

vi.mock('@/components/shared/CodeSearchPanel', () => ({
  CodeSearchPanel: () => <div>code-search-panel</div>,
}));

vi.mock('@/components/terminal/TerminalPane', () => ({
  TerminalPane: () => <div>terminal-pane</div>,
}));

vi.mock('./StatusBar', () => ({
  StatusBar: () => <div>status-bar</div>,
}));

describe('<AppShell />', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'read' });
  });

  it('mostra aviso de somente leitura e desabilita o terminal quando a permissao eh read', () => {
    render(<AppShell workspace="repo" />);

    expect(screen.getByText('Modo somente leitura')).toBeInTheDocument();
    expect(screen.getByText('Você pode navegar, mas não editar arquivos, usar terminal ou executar ações de Git com escrita.')).toBeInTheDocument();
    expect(screen.getByTitle('Terminal indisponível em modo somente leitura')).toBeDisabled();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
