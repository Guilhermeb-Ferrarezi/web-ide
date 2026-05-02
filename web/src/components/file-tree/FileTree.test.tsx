import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTree } from './FileTree';
import * as fsApi from '@/api/fs';
import { useWorkspaceStore } from '@/stores/workspaceStore';

vi.mock('@/api/fs');
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const openFile = vi.fn();
let activePath: string | null = null;

vi.mock('@/hooks/useEditor', () => ({
  useEditor: () => ({
    openFile,
    activePath,
  }),
}));

describe('<FileTree />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activePath = null;
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });
  });

  it('renderiza estado vazio', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([]);
    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('Workspace vazio')).toBeInTheDocument());
  });

  it('renderiza árvore com diretórios e arquivos', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [{ name: 'index.ts', path: 'src/index.ts', type: 'file' }],
      },
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]);
    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('src')).toBeInTheDocument());
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('clique no botão refresh refaz a busca', async () => {
    const spy = vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([]);
    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const btn = screen.getByTitle('Recarregar');
    await userEvent.click(btn);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it('cria arquivo pela barra superior', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([]);
    const saveSpy = vi.spyOn(fsApi, 'saveFile').mockResolvedValue();

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('Workspace vazio')).toBeInTheDocument());

    await userEvent.click(screen.getByTitle('Novo arquivo'));
    const input = screen.getByLabelText('Nome do arquivo');
    await userEvent.type(input, 'notes.txt');
    await userEvent.keyboard('{Enter}');

    expect(saveSpy).toHaveBeenCalledWith('repo', 'notes.txt', '', 'utf-8');
  });

  it('renomeia arquivo inline no lugar do nome atual', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      { name: '.env', path: '.env', type: 'file' },
    ]);
    const renameSpy = vi.spyOn(fsApi, 'renamePath').mockResolvedValue();

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('.env')).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByText('.env'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renomear' }));

    const input = screen.getByDisplayValue('.env');
    await userEvent.clear(input);
    await userEvent.type(input, '.env.local');
    await userEvent.keyboard('{Enter}');

    expect(renameSpy).toHaveBeenCalledWith('repo', '.env', '.env.local');
  });

  it('abre menu de contexto em arquivo com a ação abrir', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]);

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByText('README.md'));

    await userEvent.click(screen.getByRole('menuitem', { name: 'Abrir arquivo' }));
    expect(openFile).toHaveBeenCalledWith('README.md');
  });

  it('mostra um resumo do arquivo ativo com dica de ações', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]);
    activePath = 'README.md';

    render(<FileTree workspace="repo" />);

    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument());
    expect(screen.getByText('Arquivo ativo: README.md')).toBeInTheDocument();
    expect(screen.getByText('Clique direito para ações')).toBeInTheDocument();
  });

  it('mostra dica de atalho ao renomear inline', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      { name: '.env', path: '.env', type: 'file' },
    ]);

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('.env')).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByText('.env'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renomear' }));

    expect(screen.getByText('Enter para confirmar • Esc para cancelar')).toBeInTheDocument();
  });
});
