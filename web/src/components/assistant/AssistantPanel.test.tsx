import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantPanel } from './AssistantPanel';
import * as assistantApi from '@/api/assistant';

describe('<AssistantPanel />', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});
