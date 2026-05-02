import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusBar } from './StatusBar';
import { useEditorStore } from '@/stores/editorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const mockUseEditor = vi.fn();

vi.mock('@/hooks/useEditor', () => ({
  useEditor: () => mockUseEditor(),
}));

describe('<StatusBar />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
      },
    });
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });
    useEditorStore.setState({ cursorPosition: { line: 12, column: 8 }, fontSize: 13 });
  });

  it('mostra badge de permissão legível e posição do cursor', () => {
    mockUseEditor.mockReturnValue({
      tabs: [],
      activePath: null,
    });

    render(<StatusBar workspace="repo" />);

    expect(screen.getByText('repo')).toBeInTheDocument();
    expect(screen.getByText('Edição habilitada')).toBeInTheDocument();
    expect(screen.getByText('Ln 12, Col 8')).toBeInTheDocument();
  });

  it('resume arquivos não salvos e mostra o arquivo ativo com caminho completo no tooltip', () => {
    mockUseEditor.mockReturnValue({
      tabs: [
        {
          path: 'src/components/layout/StatusBar.tsx',
          name: 'StatusBar.tsx',
          content: 'a',
          originalContent: 'b',
          encoding: 'utf-8',
          mimeType: 'text/typescript',
          dirty: true,
        },
        {
          path: 'src/pages/ReposPage.tsx',
          name: 'ReposPage.tsx',
          content: 'a',
          originalContent: 'b',
          encoding: 'utf-8',
          mimeType: 'text/typescript',
          dirty: true,
        },
      ],
      activePath: 'src/components/layout/StatusBar.tsx',
    });

    render(<StatusBar workspace="repo" />);

    expect(screen.getByText('2 não salvos · Salvar todos')).toBeInTheDocument();
    expect(screen.getByText('StatusBar.tsx • Não salvo')).toHaveAttribute(
      'title',
      'src/components/layout/StatusBar.tsx',
    );
  });

  it('mostra e reinicia o tamanho da fonte atual', async () => {
    useEditorStore.setState({ fontSize: 18 });
    mockUseEditor.mockReturnValue({
      tabs: [
        {
          path: 'src/main.tsx',
          name: 'main.tsx',
          content: 'a',
          originalContent: 'a',
          encoding: 'utf-8',
          mimeType: 'text/typescript',
          dirty: false,
        },
      ],
      activePath: 'src/main.tsx',
    });

    render(<StatusBar workspace="repo" />);

    await userEvent.click(screen.getByRole('button', { name: '18px' }));

    expect(useEditorStore.getState().fontSize).toBe(13);
  });

  it('mostra badge de somente leitura quando a workspace não permite edição', () => {
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'read' });
    mockUseEditor.mockReturnValue({
      tabs: [],
      activePath: null,
    });

    render(<StatusBar workspace="repo" />);

    expect(screen.getByText('Somente leitura')).toBeInTheDocument();
    expect(screen.queryByText('Edição habilitada')).not.toBeInTheDocument();
  });

  it('mostra um estado ocioso quando nenhum arquivo está aberto', () => {
    mockUseEditor.mockReturnValue({
      tabs: [],
      activePath: null,
    });
    useEditorStore.setState({ cursorPosition: null });

    render(<StatusBar workspace="repo" />);

    expect(screen.getByText('Nenhum arquivo ativo')).toBeInTheDocument();
  });

  it('permite copiar o caminho do arquivo ativo pela barra de status', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    mockUseEditor.mockReturnValue({
      tabs: [
        {
          path: 'src/main.tsx',
          name: 'main.tsx',
          content: 'a',
          originalContent: 'a',
          encoding: 'utf-8',
          mimeType: 'text/typescript',
          dirty: false,
        },
      ],
      activePath: 'src/main.tsx',
    });

    render(<StatusBar workspace="repo" />);

    await userEvent.click(screen.getByRole('button', { name: 'src/main.tsx' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('src/main.tsx'));
    expect(screen.getByText('Caminho copiado!')).toBeInTheDocument();
  });

  it('mantém o texto atual quando copiar falha', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    mockUseEditor.mockReturnValue({
      tabs: [
        {
          path: 'src/main.tsx',
          name: 'main.tsx',
          content: 'a',
          originalContent: 'a',
          encoding: 'utf-8',
          mimeType: 'text/typescript',
          dirty: false,
        },
      ],
      activePath: 'src/main.tsx',
    });

    render(<StatusBar workspace="repo" />);

    await userEvent.click(screen.getByRole('button', { name: 'src/main.tsx' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('src/main.tsx'));
    expect(screen.getByRole('button', { name: 'src/main.tsx' })).toHaveTextContent('main.tsx');
    expect(screen.queryByText('Caminho copiado!')).not.toBeInTheDocument();
  });

  it('não quebra quando a Clipboard API não existe', async () => {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    mockUseEditor.mockReturnValue({
      tabs: [
        {
          path: 'src/main.tsx',
          name: 'main.tsx',
          content: 'a',
          originalContent: 'a',
          encoding: 'utf-8',
          mimeType: 'text/typescript',
          dirty: false,
        },
      ],
      activePath: 'src/main.tsx',
    });

    render(<StatusBar workspace="repo" />);

    await userEvent.click(screen.getByRole('button', { name: 'src/main.tsx' }));

    expect(screen.getByRole('button', { name: 'src/main.tsx' })).toHaveTextContent('main.tsx');
    expect(screen.queryByText('Caminho copiado!')).not.toBeInTheDocument();
  });
});
