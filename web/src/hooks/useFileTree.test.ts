import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFileTree } from './useFileTree';
import * as fsApi from '@/api/fs';

vi.mock('@/api/fs');
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('useFileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não busca quando workspace é null', () => {
    const fetchSpy = vi.spyOn(fsApi, 'fetchTree');
    renderHook(() => useFileTree(null));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('carrega árvore no mount e expõe dados', async () => {
    vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([
      { name: 'src', path: 'src', type: 'directory', children: [] },
    ]);
    const { result } = renderHook(() => useFileTree('repo'));
    await waitFor(() => expect(result.current.tree).toHaveLength(1));
    expect(result.current.tree[0].name).toBe('src');
    expect(result.current.loading).toBe(false);
  });

  it('refresh manual refaz a busca', async () => {
    const spy = vi.spyOn(fsApi, 'fetchTree').mockResolvedValue([]);
    const { result } = renderHook(() => useFileTree('repo'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.refresh();
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('mostra toast em caso de falha', async () => {
    const { toast } = await import('sonner');
    vi.spyOn(fsApi, 'fetchTree').mockRejectedValueOnce(new Error('fail'));
    renderHook(() => useFileTree('repo'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
