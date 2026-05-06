import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantPanel } from './AssistantPanel';
import * as assistantApi from '@/api/assistant';
import { useUserSettingsStore } from '@/stores/userSettingsStore';

describe('<AssistantPanel />', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    useUserSettingsStore.getState().reset();
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
    useUserSettingsStore.setState({ assistantDraft: 'continuar depois' });

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
    useUserSettingsStore.setState({
      assistantMessages: [
        { role: 'user', content: 'revise este arquivo' },
        { role: 'assistant', content: 'Encontrei um helper duplicado.' },
      ],
    });

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

  it('mantem o rascunho global ao trocar de workspace', async () => {
    useUserSettingsStore.setState({ assistantDraft: 'rascunho global' });

    const { rerender } = render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    expect(screen.getByPlaceholderText('Pergunte algo sobre o workspace...')).toHaveValue('rascunho global');

    rerender(
      <AssistantPanel
        workspace="repo-2"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    expect(screen.getByPlaceholderText('Pergunte algo sobre o workspace...')).toHaveValue('rascunho global');
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
    expect(useUserSettingsStore.getState().assistantDraft).toBe('');
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

    expect(useUserSettingsStore.getState().assistantMessages).toEqual([]);
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

  it('aceita imagem colada no textarea como anexo', async () => {
    vi.spyOn(assistantApi, 'uploadAssistantImage').mockResolvedValue({
      ok: true,
      url: 'https://cdn.example.com/codex/image.png',
      key: 'codex/image.png',
      mimeType: 'image/png',
      size: 2048,
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const input = screen.getByPlaceholderText('Pergunte algo sobre o workspace...');
    const file = new File(['img'], 'clipboard.png', { type: 'image/png' });

    fireEvent.paste(input, { clipboardData: { files: [file] } });

    expect(await screen.findByAltText('clipboard.png')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(assistantApi.uploadAssistantImage).toHaveBeenCalledWith('repo', file);
  });

  it('aceita arrastar e soltar imagens no painel', async () => {
    vi.spyOn(assistantApi, 'uploadAssistantImage').mockResolvedValue({
      ok: true,
      url: 'https://cdn.example.com/codex/drop.png',
      key: 'codex/drop.png',
      mimeType: 'image/png',
      size: 1536,
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const dropFile = new File(['img'], 'drop.png', { type: 'image/png' });
    fireEvent.drop(screen.getByText('Codex').closest('div')!.parentElement!.parentElement!, {
      dataTransfer: { files: [dropFile] },
    });

    expect(await screen.findByAltText('drop.png')).toBeInTheDocument();
    expect(screen.getByText('1.5 KB')).toBeInTheDocument();
    expect(assistantApi.uploadAssistantImage).toHaveBeenCalledWith('repo', dropFile);
  });

  it('aceita colar varias imagens de uma vez', async () => {
    vi.spyOn(assistantApi, 'uploadAssistantImage').mockResolvedValue({
      ok: true,
      url: 'https://cdn.example.com/codex/multi.png',
      key: 'codex/multi.png',
      mimeType: 'image/png',
      size: 512,
    });

    render(
      <AssistantPanel
        workspace="repo"
        activePath="src/app.ts"
        activeContent="const value = 1;"
      />,
    );

    const input = screen.getByPlaceholderText('Pergunte algo sobre o workspace...');
    const fileA = new File(['a'], 'a.png', { type: 'image/png' });
    const fileB = new File(['b'], 'b.png', { type: 'image/png' });

    fireEvent.paste(input, { clipboardData: { files: [fileA, fileB] } });

    expect(await screen.findByAltText('a.png')).toBeInTheDocument();
    expect(await screen.findByAltText('b.png')).toBeInTheDocument();
    expect(screen.getAllByText('512 B')).toHaveLength(2);
    expect(assistantApi.uploadAssistantImage).toHaveBeenCalledTimes(2);
  });
});
