import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CodeSearchPanel } from './CodeSearchPanel';
import * as fsApi from '@/api/fs';

const openFile = vi.fn();

vi.mock('@/hooks/useEditor', () => ({
  useEditor: () => ({
    openFile,
  }),
}));

describe('<CodeSearchPanel />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('busca no código e abre o arquivo ao clicar no resultado', async () => {
    vi.spyOn(fsApi, 'searchFiles').mockResolvedValue([
      {
        path: 'src/app.ts',
        matches: [{ line: 3, column: 7, length: 5, previewOffset: 6, preview: 'const hello = "world";' }],
      },
    ]);

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'hello{Enter}');

    await waitFor(() => expect(screen.getByText('app.ts')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('Linha 3, coluna 7'));

    expect(openFile).toHaveBeenCalledWith('src/app.ts', { line: 3, column: 7 });
  });

  it('limpa a busca ao clicar no botão de limpar', async () => {
    render(<CodeSearchPanel workspace="repo" />);

    const input = screen.getByPlaceholderText('Buscar');
    await userEvent.type(input, 'hello');
    expect(input).toHaveValue('hello');

    await userEvent.click(screen.getByRole('button', { name: 'Limpar busca (Esc)' }));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('mostra o diretório ao lado do arquivo no cabeçalho do resultado', async () => {
    vi.spyOn(fsApi, 'searchFiles').mockResolvedValue([
      {
        path: 'src/components/app.ts',
        matches: [{ line: 3, column: 7, length: 5, previewOffset: 6, preview: 'const hello = "world";' }],
      },
    ]);

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'hello{Enter}');

    await screen.findByText('app.ts');
    expect(screen.getByText('src/components')).toBeInTheDocument();
  });

  it('mostra orientações antes da primeira busca', () => {
    render(<CodeSearchPanel workspace="repo" />);

    expect(screen.getByText('Digite um trecho e pressione Enter para procurar no workspace.')).toBeInTheDocument();
    expect(screen.getByText('Use Esc para limpar a busca atual sem sair do painel.')).toBeInTheDocument();
  });

  it('mostra mensagem contextual quando não há resultados', async () => {
    vi.spyOn(fsApi, 'searchFiles').mockResolvedValue([]);

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'missing{Enter}');

    expect(await screen.findByText('Nenhum resultado para “missing”.')).toBeInTheDocument();
    expect(screen.getByText('Tente ajustar Aa, palavra inteira ou regex para ampliar a busca.')).toBeInTheDocument();
  });

  it('mostra erro de regex inválida sem chamar a busca', async () => {
    const searchSpy = vi.spyOn(fsApi, 'searchFiles').mockResolvedValue([]);

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.click(screen.getByRole('button', { name: 'Expressão regular' }));
    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'a(');
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByText(/invalid regular expression|unterminated group/i)).toBeInTheDocument();
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('mantém o estado visual ativo nas opções de precisão', async () => {
    render(<CodeSearchPanel workspace="repo" />);

    const caseSensitive = screen.getByRole('button', { name: 'Diferenciar maiúsculas (Aa)' });
    await userEvent.click(caseSensitive);

    expect(caseSensitive).toHaveAttribute('aria-pressed', 'true');
  });

  it('limpa a busca com Escape quando o campo está focado', async () => {
    render(<CodeSearchPanel workspace="repo" />);

    const input = screen.getByPlaceholderText('Buscar');
    await userEvent.type(input, 'hello');
    await userEvent.keyboard('{Escape}');

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('preserva o foco no input ao limpar a busca', async () => {
    render(<CodeSearchPanel workspace="repo" />);

    const input = screen.getByPlaceholderText('Buscar');
    await userEvent.type(input, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Limpar busca (Esc)' }));

    expect(input).toHaveFocus();
  });

  it('mostra o spinner durante a busca', async () => {
    let resolveSearch!: (value: any[]) => void;
    vi.spyOn(fsApi, 'searchFiles').mockReturnValue(new Promise<any[]>((resolve) => {
      resolveSearch = resolve;
    }));

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'hello{Enter}');
    expect(screen.getByText('Buscando…')).toBeInTheDocument();

    resolveSearch([]);
    await screen.findByText('Nenhum resultado para “hello”.');
  });

  it('mostra contador de resultados por arquivo', async () => {
    vi.spyOn(fsApi, 'searchFiles').mockResolvedValue([
      {
        path: 'src/app.ts',
        matches: [
          { line: 3, column: 7, length: 5, previewOffset: 6, preview: 'const hello = "world";' },
          { line: 5, column: 2, length: 5, previewOffset: 1, preview: 'hello again' },
        ],
      },
    ]);

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'hello{Enter}');

    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('colapsa e expande resultados por arquivo', async () => {
    vi.spyOn(fsApi, 'searchFiles').mockResolvedValue([
      {
        path: 'src/app.ts',
        matches: [{ line: 3, column: 7, length: 5, previewOffset: 6, preview: 'const hello = "world";' }],
      },
    ]);

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'hello{Enter}');

    const header = await screen.findByRole('button', { name: /app.ts/i });
    expect(screen.getByTitle('Linha 3, coluna 7')).toBeInTheDocument();

    await userEvent.click(header);
    expect(screen.queryByTitle('Linha 3, coluna 7')).not.toBeInTheDocument();

    await userEvent.click(header);
    expect(screen.getByTitle('Linha 3, coluna 7')).toBeInTheDocument();
  });

  it('mostra resumo agregado de resultados', async () => {
    vi.spyOn(fsApi, 'searchFiles').mockResolvedValue([
      {
        path: 'src/app.ts',
        matches: [{ line: 3, column: 7, length: 5, previewOffset: 6, preview: 'const hello = "world";' }],
      },
      {
        path: 'src/other.ts',
        matches: [{ line: 1, column: 1, length: 5, previewOffset: 0, preview: 'hello' }],
      },
    ]);

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'hello{Enter}');

    expect(await screen.findByText('2 resultados em 2 arquivos')).toBeInTheDocument();
  });

  it('mostra prévia destacada do trecho encontrado', async () => {
    vi.spyOn(fsApi, 'searchFiles').mockResolvedValue([
      {
        path: 'src/app.ts',
        matches: [{ line: 3, column: 7, length: 5, previewOffset: 6, preview: 'const hello = "world";' }],
      },
    ]);

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'hello{Enter}');

    expect(await screen.findByText('hello')).toBeInTheDocument();
  });

  it('mantém os toggles acessíveis com título e aria-pressed', () => {
    render(<CodeSearchPanel workspace="repo" />);

    expect(screen.getByRole('button', { name: 'Diferenciar maiúsculas (Aa)' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Palavra inteira' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Expressão regular' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('mostra o diretório ao lado do arquivo no cabeçalho do resultado', async () => {
    vi.spyOn(fsApi, 'searchFiles').mockResolvedValue([
      {
        path: 'src/components/app.ts',
        matches: [{ line: 3, column: 7, length: 5, previewOffset: 6, preview: 'const hello = "world";' }],
      },
    ]);

    render(<CodeSearchPanel workspace="repo" />);

    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'hello{Enter}');

    await screen.findByText('app.ts');
    expect(screen.getByText('src/components')).toBeInTheDocument();
  });

  it('limpa a busca com Escape quando o campo está focado', async () => {
    render(<CodeSearchPanel workspace="repo" />);

    const input = screen.getByPlaceholderText('Buscar');
    await userEvent.type(input, 'hello');
    await userEvent.keyboard('{Escape}');

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('limpa a busca com Escape quando o campo está focado', async () => {
    render(<CodeSearchPanel workspace="repo" />);

    const input = screen.getByPlaceholderText('Buscar');
    await userEvent.type(input, 'hello');
    await userEvent.keyboard('{Escape}');

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });
});
