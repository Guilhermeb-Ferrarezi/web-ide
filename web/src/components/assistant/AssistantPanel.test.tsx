import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantPanel, getAssistantPanelStorageKey } from './AssistantPanel';
import * as assistantApi from '@/api/assistant';

const DRAFT_KEY = 'assistant-panel:repo:draft';
const MESSAGES_KEY = 'assistant-panel:repo:messages';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  clear: vi.fn(() => {
    storage.clear();
  }),
};

describe('<AssistantPanel />', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('envia uma mensagem e mostra a resposta no painel', async () => {
    vi.spyOn(assistantApi, 'chatAssistant').mockResolvedValue({
      message: 'Você pode extrair isso para um helper.',
      model: 'test-model',
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const input = screen.getByPlaceholderText('Pergunte algo sobre o workspace...');
    await userEvent.type(input, 'como melhorar isso?');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(assistantApi.chatAssistant).toHaveBeenCalledTimes(1));
    expect(screen.getByText('como melhorar isso?')).toBeInTheDocument();
    expect(await screen.findByText('Você pode extrair isso para um helper.')).toBeInTheDocument();
  });

  it('permite copiar a resposta do assistente', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    vi.spyOn(assistantApi, 'chatAssistant').mockResolvedValue({
      message: 'Você pode extrair isso para um helper.',
      model: 'test-model',
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const input = screen.getByPlaceholderText('Pergunte algo sobre o workspace...');
    await userEvent.type(input, 'como melhorar isso?');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    const copyButtons = await screen.findAllByRole('button', { name: 'Copiar' });
    await userEvent.click(copyButtons.at(-1)!);

    expect(writeText).toHaveBeenCalledWith('Você pode extrair isso para um helper.');
  });

  it('mostra uma mensagem amigavel quando o backend devolve timeout', async () => {
    vi.spyOn(assistantApi, 'chatAssistant').mockRejectedValue({
      response: { status: 504 },
      message: 'Request failed with status code 504',
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const input = screen.getByPlaceholderText('Pergunte algo sobre o workspace...');
    await userEvent.type(input, 'faça uma alteração');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('O Codex demorou demais para responder. Tente uma pergunta menor ou repita a ação.')).toBeInTheDocument();
  });

  it('restaura o rascunho salvo ao reabrir o painel', () => {
    window.localStorage.setItem(DRAFT_KEY, 'continuar depois');

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    expect(screen.getByPlaceholderText('Pergunte algo sobre o workspace...')).toHaveValue('continuar depois');
  });

  it('restaura o histórico salvo ao reabrir o painel', () => {
    window.localStorage.setItem(
      MESSAGES_KEY,
      JSON.stringify([
        { role: 'user', content: 'revise este arquivo' },
        { role: 'assistant', content: 'Encontrei um helper duplicado.' },
      ]),
    );

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    expect(screen.getByText('revise este arquivo')).toBeInTheDocument();
    expect(screen.getByText('Encontrei um helper duplicado.')).toBeInTheDocument();
  });

  it('oferece ações rápidas no estado vazio para acelerar o primeiro envio', async () => {
    vi.spyOn(assistantApi, 'chatAssistant').mockResolvedValue({
      message: 'Posso começar pelos testes deste arquivo.',
      model: 'test-model',
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Criar testes para este arquivo' }));

    await waitFor(() =>
      expect(assistantApi.chatAssistant).toHaveBeenCalledWith({
        workspace: 'repo',
        activePath: 'src/app.ts',
        activeContent: 'const value = 1;',
        imageUrls: [],
        messages: [{ role: 'user', content: 'Crie testes para o arquivo aberto, considerando seu conteúdo atual.' }],
      }),
    );
  });

  it('não vaza rascunho ao trocar de workspace', async () => {
    window.localStorage.setItem(getAssistantPanelStorageKey('repo', 'draft'), 'rascunho do repo');
    window.localStorage.setItem(getAssistantPanelStorageKey('repo-2', 'draft'), 'rascunho do repo 2');

    const { rerender } = render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    expect(screen.getByPlaceholderText('Pergunte algo sobre o workspace...')).toHaveValue('rascunho do repo');

    rerender(
      <AssistantPanel
        workspace="repo-2"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    expect(screen.getByPlaceholderText('Pergunte algo sobre o workspace...')).toHaveValue('rascunho do repo 2');
    expect(window.localStorage.getItem(getAssistantPanelStorageKey('repo-2', 'draft'))).toBe('rascunho do repo 2');
  });

  it('remove o rascunho salvo depois de enviar', async () => {
    vi.spyOn(assistantApi, 'chatAssistant').mockResolvedValue({
      message: 'ok',
      model: 'test-model',
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const input = screen.getByPlaceholderText('Pergunte algo sobre o workspace...');
    await userEvent.type(input, 'mensagem temporária');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(assistantApi.chatAssistant).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('remove o histórico salvo ao limpar a conversa', async () => {
    vi.spyOn(assistantApi, 'chatAssistant').mockResolvedValue({
      message: 'resposta persistida',
      model: 'test-model',
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const input = screen.getByPlaceholderText('Pergunte algo sobre o workspace...');
    await userEvent.type(input, 'limpar depois');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('resposta persistida');

    await userEvent.click(screen.getByTitle('Limpar conversa'));

    expect(window.localStorage.getItem(MESSAGES_KEY)).toBeNull();
    expect(screen.queryByText('resposta persistida')).not.toBeInTheDocument();
  });

  it('permite reutilizar o último prompt enviado com seta para cima', async () => {
    vi.spyOn(assistantApi, 'chatAssistant').mockResolvedValue({
      message: 'ok',
      model: 'test-model',
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const input = screen.getByPlaceholderText('Pergunte algo sobre o workspace...');
    await userEvent.type(input, 'refatore isso');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('ok');

    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}');

    expect(input).toHaveValue('refatore isso');
    expect(screen.queryByRole('button', { name: 'Reutilizar último prompt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar rascunho' })).not.toBeInTheDocument();
  });

  it('transforma arquivos adicionados em chips com ícone e remoção', async () => {
    vi.spyOn(assistantApi, 'chatAssistant').mockResolvedValue({
      message: 'ok',
      model: 'test-model',
    });

    const { rerender } = render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const fileButton = screen.getByRole('button', { name: 'Adicionar src/app.ts ao prompt' });
    const fileIcon = fileButton.querySelector('img');

    expect(fileIcon).toHaveAttribute('src', expect.stringContaining('/typescript.svg'));
    await userEvent.click(fileButton);

    expect(screen.getByRole('button', { name: 'Remover src/app.ts do prompt' })).toHaveTextContent('app.ts');
    expect(screen.getByPlaceholderText('Pergunte algo sobre o workspace...')).toHaveValue('');

    rerender(
      <AssistantPanel
        workspace="repo"
        activePath="Dockerfile"
        activeContent="FROM node:22"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar Dockerfile ao prompt' }));

    expect(screen.getByRole('button', { name: 'Remover src/app.ts do prompt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Dockerfile do prompt' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remover src/app.ts do prompt' }));

    expect(screen.queryByRole('button', { name: 'Remover src/app.ts do prompt' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Dockerfile do prompt' })).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Pergunte algo sobre o workspace...'), 'revise isso');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(assistantApi.chatAssistant).toHaveBeenCalledTimes(1));
    expect(assistantApi.chatAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: 'user',
            content: 'Arquivos anexados ao prompt:\n- Dockerfile\n\nrevise isso',
          },
        ],
      }),
    );
  });
});
