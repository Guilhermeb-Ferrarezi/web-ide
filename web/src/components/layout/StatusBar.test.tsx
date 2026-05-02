import { render, screen } from '@testing-library/react';
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
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });
    useEditorStore.setState({ cursorPosition: { line: 12, column: 8 } });
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

    expect(screen.getByText('2 não salvos · Ctrl+S para salvar')).toBeInTheDocument();
    expect(screen.getByText('StatusBar.tsx • Não salvo')).toHaveAttribute(
      'title',
      'src/components/layout/StatusBar.tsx',
    );
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
});
