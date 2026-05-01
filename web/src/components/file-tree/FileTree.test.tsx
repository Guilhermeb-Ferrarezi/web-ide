import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTree } from './FileTree';
import * as fsApi from '@/api/fs';

vi.mock('@/api/fs');
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('@/hooks/useEditor', () => ({
  useEditor: () => ({
    openFile: vi.fn(),
    activePath: null,
  }),
}));

describe('<FileTree />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
