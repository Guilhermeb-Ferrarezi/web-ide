import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';

type SpawnArgs = {
  command: string;
  args: string[];
  options: { cwd?: string; stdio?: ['pipe', 'pipe', 'pipe']; env?: NodeJS.ProcessEnv };
};

let lastSpawn: SpawnArgs | null = null;
let lastChild: EventEmitter & {
  stdin: { end: ReturnType<typeof mock> };
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof mock>;
} | null = null;
let spawnModes: Array<'success' | 'namespace-error' | 'sandbox-message'> = [];

const spawnMock = mock((command: string, args: string[], options: { cwd?: string }) => {
  lastSpawn = { command, args, options };
  const outputPath = args[2];
  const mode = spawnModes.shift() ?? 'success';
  const child = new EventEmitter() as EventEmitter & {
    stdin: { end: ReturnType<typeof mock> };
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof mock>;
  };
  lastChild = child;

  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = mock(() => true);
  child.stdin = {
    end: mock(() => {
      queueMicrotask(async () => {
        if (mode === 'namespace-error') {
          child.stderr.emit('data', 'bwrap: No permissions to create a new namespace\n');
          child.stdout.emit('end');
          child.stderr.emit('end');
          child.emit('close', 1, null);
          return;
        }

        if (mode === 'sandbox-message') {
          await fs.writeFile(
            outputPath,
            'Não consegui alterar arquivo no workspace.\nMotivo objetivo:\n- O comando de inspeção (rg --files) falhou com erro de sandbox/kernel: No permissions to create a new namespace (bwrap).\n- A tentativa de escrita direta com patch também falhou.',
            'utf8',
          );
          child.stdout.emit('end');
          child.stderr.emit('end');
          child.emit('close', 0, null);
          return;
        }

        await fs.writeFile(outputPath, 'Resposta do assistente', 'utf8');
        child.stdout.emit('end');
        child.stderr.emit('end');
        child.emit('close', 0, null);
      });
    }),
  };

  return child;
});

mock.restore();

mock.module('../../config.ts', () => ({
  config: {
    CODEX_BIN: 'codex',
    CODEX_HOME: '/root/.codex',
    CODEX_TIMEOUT_MS: 45_000,
  },
}));

mock.module('node:fs', () => ({
  existsSync: (filePath: string) => String(filePath).includes('/root/.codex/auth.json'),
}));

mock.module('node:child_process', () => ({
  spawn: spawnMock,
}));

const { chatWithAssistant, AssistantNotConfiguredError } = await import('./assistant.service.ts');

describe('chatWithAssistant', () => {
  beforeEach(() => {
    spawnMock.mockClear();
    lastSpawn = null;
    lastChild = null;
    spawnModes = [];
  });

  it('executa o codex com o contexto e retorna a resposta final', async () => {
    const result = await chatWithAssistant({
      workspace: 'repo',
      workspacePath: '/workspaces/alice/repo',
      activePath: 'src/app.ts',
      activeContent: 'const value = 1;',
      messages: [{ role: 'user', content: 'Explique o arquivo' }],
    });

    expect(result.message).toBe('Resposta do assistente');
    expect(result.model).toBe('codex');
    expect(spawnMock).toHaveBeenCalledTimes(1);

    expect(lastSpawn).not.toBeNull();
    expect(lastSpawn?.command).toBe('codex');
    expect(lastSpawn?.options.stdio).toEqual(['pipe', 'pipe', 'pipe']);
    expect(lastSpawn?.options.env?.HOME).toBe('/home/guilherme');
    const args = lastSpawn?.args ?? [];
    expect(args[0]).toBe('exec');
    expect(args[1]).toBe('--output-last-message');
    expect(args[2]).toMatch(/last-message\.txt$/);
    expect(args[3]).toBe('--cd');
    expect(args[4]).toBe('/workspaces/alice/repo');
    expect(args[5]).toBe('--skip-git-repo-check');
    expect(args[6]).toBe('--sandbox');
    expect(args[7]).toBe('workspace-write');
    expect(args[8]).toBe('--ephemeral');
    expect(args[9]).toBe('-');
    const prompt = lastChild?.stdin.end.mock.calls[0]?.[0] as string;
    expect(prompt).toContain('Workspace atual: repo');
    expect(prompt).toContain('Caminho do workspace: /workspaces/alice/repo');
    expect(prompt).toContain('Arquivo ativo: src/app.ts');
    expect(prompt).toContain('const value = 1;');
    expect(prompt).toContain('Usuário: Explique o arquivo');
    expect(prompt).toContain('Quando o usuário pedir uma mudança, você pode alterar arquivos diretamente no workspace e deve mencionar o que mudou.');
    expect(prompt).toContain('Quando houver alteração de código, prefira responder com um resumo curto seguido de um único bloco ```diff em formato unified diff.');
    expect(prompt).toContain('No diff, use caminhos relativos ao workspace e headers padrão com --- e +++.');
    expect(prompt).toContain('Só devolva arquivo final completo em bloco de código normal quando o usuário pedir explicitamente o arquivo inteiro.');
  });

  it('refaz a chamada sem sandbox quando o ambiente bloqueia namespace', async () => {
    spawnModes = ['namespace-error', 'success'];

    const result = await chatWithAssistant({
      workspace: 'repo',
      workspacePath: '/workspaces/alice/repo',
      messages: [{ role: 'user', content: 'Faça uma alteração' }],
    });

    expect(result.message).toBe('Resposta do assistente');
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(lastSpawn?.args).toContain('--dangerously-bypass-approvals-and-sandbox');
  });

  it('refaz a chamada sem sandbox quando a resposta final ainda reporta bloqueio', async () => {
    spawnModes = ['sandbox-message', 'success'];

    const result = await chatWithAssistant({
      workspace: 'repo',
      workspacePath: '/workspaces/alice/repo',
      messages: [{ role: 'user', content: 'Faça uma alteração' }],
    });

    expect(result.message).toBe('Resposta do assistente');
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(lastSpawn?.args).toContain('--dangerously-bypass-approvals-and-sandbox');
  });
});

describe('AssistantNotConfiguredError', () => {
  it('expõe um erro claro quando o codex nao existe', () => {
    expect(new AssistantNotConfiguredError().message).toContain('codex CLI');
  });
});
