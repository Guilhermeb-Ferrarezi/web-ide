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

    await userEvent.type(screen.getByPlaceholderText('Buscar no código'), 'hello{Enter}');

    await waitFor(() => expect(screen.getByText('src/app.ts')).toBeInTheDocument());
    await userEvent.click(screen.getByText('const hello = "world";'));

    expect(openFile).toHaveBeenCalledWith('src/app.ts');
  });
});
