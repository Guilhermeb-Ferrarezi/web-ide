import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      userId: '1',
      login: 'octocat',
      avatarUrl: 'https://example.com/octocat.png',
      role: 'owner',
    },
    logout: vi.fn(),
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

vi.mock('@/components/extensions/ExtensionsPanel', () => ({
  ExtensionsPanel: () => <div>extensions-panel</div>,
}));

vi.mock('@/components/assistant/AssistantPanel', () => ({
  AssistantPanel: () => <div>assistant-panel</div>,
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
    expect(screen.getByRole('button', { name: 'Terminal' })).toBeDisabled();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('expõe rótulos acessíveis nos botões da barra lateral', () => {
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });

    render(<AppShell workspace="repo" />);

    expect(screen.getByRole('button', { name: 'Arquivos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar código' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Git' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Extensões' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conta e configurações' })).toBeInTheDocument();
  });

  it('expõe atalhos de teclado acessíveis nos botões da barra lateral', () => {
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });

    render(<AppShell workspace="repo" />);

    expect(screen.getByRole('button', { name: 'Arquivos' })).toHaveAttribute('aria-keyshortcuts', 'Ctrl+1');
    expect(screen.getByRole('button', { name: 'Buscar código' })).toHaveAttribute('aria-keyshortcuts', 'Ctrl+2');
    expect(screen.getByRole('button', { name: 'Git' })).toHaveAttribute('aria-keyshortcuts', 'Ctrl+3');
    expect(screen.getByRole('button', { name: 'Extensões' })).toHaveAttribute('aria-keyshortcuts', 'Ctrl+4');
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-keyshortcuts', 'Ctrl+5');
  });

  it('indica qual painel lateral está ativo ao alternar entre as seções', async () => {
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });

    render(<AppShell workspace="repo" />);

    const filesButton = screen.getByRole('button', { name: 'Arquivos' });
    const gitButton = screen.getByRole('button', { name: 'Git' });

    expect(filesButton).toHaveAttribute('aria-pressed', 'true');
    expect(gitButton).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(gitButton);

    expect(gitButton).toHaveAttribute('aria-pressed', 'true');
    expect(filesButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('git-panel')).toBeInTheDocument();
  });

  it('abre o painel de chat lateral pela barra lateral', async () => {
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });

    render(<AppShell workspace="repo" />);

    await userEvent.click(screen.getByRole('button', { name: 'Chat' }));

    expect(screen.getByText('assistant-panel')).toBeInTheDocument();
  });

  it('abre o menu de configurações pelo avatar do GitHub', async () => {
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });

    render(<AppShell workspace="repo" />);

    await userEvent.click(screen.getByRole('button', { name: 'Conta e configurações' }));

    expect(screen.getByText('octocat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Configurações' }));

    expect(screen.getByText('Configurações do editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Após 1.2s' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('mostra uma dica para fechar o painel de configurações com Escape', async () => {
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });

    render(<AppShell workspace="repo" />);

    await userEvent.click(screen.getByRole('button', { name: 'Conta e configurações' }));
    await userEvent.click(screen.getByRole('button', { name: 'Configurações' }));

    expect(screen.getByText('Configurações do editor')).toBeInTheDocument();
  });
});
