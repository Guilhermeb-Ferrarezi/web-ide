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

  it('usa F2 para renomear o item selecionado', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]);
    const renameSpy = vi.spyOn(fsApi, 'renamePath').mockResolvedValue();

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument());

    await userEvent.click(screen.getByText('README.md'));
    fireEvent.keyDown(window, { key: 'F2' });

    const input = screen.getByDisplayValue('README.md');
    await userEvent.clear(input);
    await userEvent.type(input, 'DOCS.md');
    await userEvent.keyboard('{Enter}');

    expect(renameSpy).toHaveBeenCalledWith('repo', 'README.md', 'DOCS.md');
  });

  it('usa Delete para excluir o item selecionado', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]);
    vi.spyOn(fsApi, 'fetchFile').mockResolvedValue({
      encoding: 'utf-8',
      content: '# Hello',
      size: 7,
      mimeType: 'text/plain',
    });
    const deleteSpy = vi.spyOn(fsApi, 'deleteFile').mockResolvedValue();

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument());

    await userEvent.click(screen.getByText('README.md'));
    fireEvent.keyDown(window, { key: 'Delete' });

    expect(screen.getByText('Excluir arquivo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(deleteSpy).toHaveBeenCalledWith('repo', 'README.md');
  });

  it('usa Ctrl+Z para desfazer o último rename', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]);
    const renameSpy = vi.spyOn(fsApi, 'renamePath').mockResolvedValue();

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument());

    await userEvent.click(screen.getByText('README.md'));
    fireEvent.keyDown(window, { key: 'F2' });

    const input = screen.getByDisplayValue('README.md');
    await userEvent.clear(input);
    await userEvent.type(input, 'DOCS.md');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(renameSpy).toHaveBeenCalledWith('repo', 'README.md', 'DOCS.md'));
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    await waitFor(() => expect(renameSpy).toHaveBeenNthCalledWith(2, 'repo', 'DOCS.md', 'README.md'));
  });

  it('usa Ctrl+Z para desfazer a última exclusão de arquivo', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]);
    vi.spyOn(fsApi, 'fetchFile').mockResolvedValue({
      encoding: 'utf-8',
      content: '# Hello',
      size: 7,
      mimeType: 'text/plain',
    });
    const deleteSpy = vi.spyOn(fsApi, 'deleteFile').mockResolvedValue();
    const saveSpy = vi.spyOn(fsApi, 'saveFile').mockResolvedValue();

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('README.md')).toBeInTheDocument());

    await userEvent.click(screen.getByText('README.md'));
    fireEvent.keyDown(window, { key: 'Delete' });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('repo', 'README.md'));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('repo', 'README.md', '# Hello', 'utf-8'));
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
    expect(screen.getByText('README.md').closest('button')).toHaveClass('bg-accent');
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

  it('mostra feedback contextual enquanto o filtro de arquivos está ativo', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          { name: 'app.tsx', path: 'src/app.tsx', type: 'file' },
          { name: 'app.test.tsx', path: 'src/app.test.tsx', type: 'file' },
          { name: 'main.tsx', path: 'src/main.tsx', type: 'file' },
        ],
      },
    ]);

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('src')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('Filtrar arquivos');
    await userEvent.type(input, 'app');

    expect(screen.getByText('2 arquivos encontrados')).toBeInTheDocument();
    expect(screen.getByText('Use Esc para limpar o filtro atual.')).toBeInTheDocument();
    expect(screen.getByText('app.tsx')).toBeInTheDocument();
    expect(screen.getByText('app.test.tsx')).toBeInTheDocument();
    expect(screen.queryByText('main.tsx')).not.toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, 'sem-match');

    expect(screen.getByText('Nenhum arquivo corresponde a “sem-match”.')).toBeInTheDocument();
    expect(screen.getByText('Use Esc ou o botão limpar para tentar outro filtro.')).toBeInTheDocument();
  });

  it('move um arquivo arrastado para dentro de uma pasta', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [],
      },
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]);
    const renameSpy = vi.spyOn(fsApi, 'renamePath').mockResolvedValue();

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('src')).toBeInTheDocument());

    const fileButton = screen.getByText('README.md').closest('button');
    const folderButton = screen.getByText('src').closest('button');
    expect(fileButton).toBeTruthy();
    expect(folderButton).toBeTruthy();

    fireEvent.dragStart(fileButton!);
    fireEvent.dragOver(folderButton!);
    fireEvent.drop(folderButton!);

    await waitFor(() => expect(renameSpy).toHaveBeenCalledWith('repo', 'README.md', 'src/README.md'));
  });

  it('destaca a pasta alvo com mais força durante o drag', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [{ name: 'nested', path: 'src/nested', type: 'directory', children: [] }],
      },
      { name: 'README.md', path: 'README.md', type: 'file' },
    ]);

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('nested')).toBeInTheDocument());

    const fileButton = screen.getByText('README.md').closest('button');
    const folderButton = screen.getByText('src').closest('button');
    expect(fileButton).toBeTruthy();
    expect(folderButton).toBeTruthy();

    fireEvent.dragStart(fileButton!);
    fireEvent.dragOver(folderButton!);

    expect(folderButton).toHaveAttribute('data-drop-target', 'true');
    expect(folderButton).toHaveClass('ring-2');
  });

  it('envia arquivo externo solto na raiz do projeto', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([]);
    const uploadSpy = vi.spyOn(fsApi, 'uploadFile').mockResolvedValue();

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('Workspace vazio')).toBeInTheDocument());

    const rootDropZone = screen.getByTestId('file-tree-drop-root');
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    fireEvent.dragOver(rootDropZone, {
      dataTransfer: { files: [file] },
    });
    fireEvent.drop(rootDropZone, {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => expect(uploadSpy).toHaveBeenCalledWith('repo', 'notes.txt', file));
  });

  it('envia arquivo externo para a pasta selecionada quando solto na raiz', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [],
      },
    ]);
    const uploadSpy = vi.spyOn(fsApi, 'uploadFile').mockResolvedValue();

    render(<FileTree workspace="repo" />);
    await waitFor(() => expect(screen.getByText('src')).toBeInTheDocument());

    await userEvent.click(screen.getByText('src'));
    const rootDropZone = screen.getByTestId('file-tree-drop-root');
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    fireEvent.dragOver(rootDropZone, {
      dataTransfer: { files: [file] },
    });
    fireEvent.drop(rootDropZone, {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => expect(uploadSpy).toHaveBeenCalledWith('repo', 'src/notes.txt', file));
  });
});
