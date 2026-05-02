import { spawn } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../config.ts';

export type AssistantChatRole = 'user' | 'assistant';

export type AssistantChatMessage = {
  role: AssistantChatRole;
  content: string;
};

export type AssistantChatContext = {
  workspace: string;
  workspacePath: string;
  activePath?: string | null;
  activeContent?: string | null;
};

export type AssistantChatInput = AssistantChatContext & {
  messages: AssistantChatMessage[];
};

export type AssistantChatResult = {
  message: string;
  model: string;
};

export class AssistantNotConfiguredError extends Error {
  constructor() {
    super('Assistant chat is not configured. Make sure the codex CLI is installed and available on PATH.');
    this.name = 'AssistantNotConfiguredError';
  }
}

export class AssistantTimeoutError extends Error {
  constructor() {
    super('Assistant chat timed out while waiting for Codex.');
    this.name = 'AssistantTimeoutError';
  }
}

export class AssistantAuthError extends Error {
  constructor() {
    super('Codex is not authenticated in this environment. Set CODEX_HOME or log in on the machine running the API.');
    this.name = 'AssistantAuthError';
  }
}

function trimContent(value: string | null | undefined, limit = 6000): string | null {
  if (!value) return null;
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n\n[conteúdo truncado]`;
}

function buildSystemPrompt(context: AssistantChatContext): string {
  const lines = [
    'Você é o chat lateral do web-ide.',
    'Responda em português do Brasil, com objetividade e foco prático.',
    'Quando houver contexto de arquivo, considere o conteúdo para sugerir alterações concretas.',
    'Use o workspace atual como fonte principal de contexto quando precisar inspecionar arquivos.',
    `Workspace atual: ${context.workspace}`,
    `Caminho do workspace: ${context.workspacePath}`,
  ];

  if (context.activePath) {
    lines.push(`Arquivo ativo: ${context.activePath}`);
  }

  const activeContent = trimContent(context.activeContent);
  if (activeContent) {
    lines.push('Conteúdo do arquivo ativo:');
    lines.push(activeContent);
  }

  lines.push('Se não houver informação suficiente, diga exatamente o que falta.');
  return lines.join('\n');
}

function buildConversationPrompt(messages: AssistantChatMessage[]): string {
  const lines = ['Histórico da conversa:'];

  for (const message of messages.slice(-12)) {
    const label = message.role === 'user' ? 'Usuário' : 'Assistente';
    lines.push(`${label}: ${message.content}`);
  }

  lines.push('Responda apenas à última mensagem do usuário, mantendo o contexto acima.');
  return lines.join('\n');
}

function buildCodexPrompt(input: AssistantChatInput): string {
  return [buildSystemPrompt(input), buildConversationPrompt(input.messages)].join('\n\n');
}

function collectStream(stream: NodeJS.ReadableStream | null | undefined): Promise<string> {
  if (!stream) return Promise.resolve('');

  return new Promise((resolve, reject) => {
    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });
    stream.on('end', () => resolve(output));
    stream.on('error', reject);
  });
}

function resolveCodexHome(): { home?: string; codexHome?: string } {
  const candidates = [
    config.CODEX_HOME,
    process.env.CODEX_HOME,
    '/root/.codex',
    process.env.HOME ? path.join(process.env.HOME, '.codex') : null,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const authPath = path.join(candidate, 'auth.json');
    if (fsSync.existsSync(authPath)) {
      if (path.basename(candidate) === '.codex') {
        return { home: path.dirname(candidate), codexHome: candidate };
      }
      return { home: candidate, codexHome: path.join(candidate, '.codex') };
    }
  }

  return {};
}

async function runCodex(prompt: string, cwd: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'web-ide-codex-'));
  const outputPath = path.join(tempDir, 'last-message.txt');
  const codexHome = resolveCodexHome();
  const args = [
    'exec',
    '--output-last-message',
    outputPath,
    '--cd',
    cwd,
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--ephemeral',
    '-',
  ];

  const child = spawn(config.CODEX_BIN, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...(codexHome.home ? { HOME: codexHome.home } : {}),
      ...(codexHome.codexHome ? { CODEX_HOME: codexHome.codexHome } : {}),
    },
  });

  const stdoutPromise = collectStream(child.stdout);
  const stderrPromise = collectStream(child.stderr);

  const completion = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolve({ code, signal });
    });
  });

  child.stdin.end(prompt);

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new AssistantTimeoutError());
    }, config.CODEX_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([completion, timeoutPromise]);
    const stdout = await stdoutPromise;
    const stderr = await stderrPromise;

    if (result.code !== 0) {
      const details = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
      if (/401 unauthorized|missing bearer or basic authentication|codex.*login/i.test(details)) {
        throw new AssistantAuthError();
      }
      throw new Error(
        details
          ? `Codex exited with code ${result.code}${result.signal ? ` (${result.signal})` : ''}:\n${details}`
          : `Codex exited with code ${result.code}${result.signal ? ` (${result.signal})` : ''}`,
      );
    }

    const message = (await fs.readFile(outputPath, 'utf8')).trim();
    if (!message) {
      throw new Error('Codex returned an empty response');
    }

    return message;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      throw new AssistantNotConfiguredError();
    }
    throw error;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function chatWithAssistant(input: AssistantChatInput): Promise<AssistantChatResult> {
  if (!config.CODEX_BIN) {
    throw new AssistantNotConfiguredError();
  }

  const codexHome = resolveCodexHome();
  if (!codexHome.home && !codexHome.codexHome) {
    throw new AssistantAuthError();
  }

  const messages = input.messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const prompt = buildCodexPrompt({ ...input, messages });
  const message = await runCodex(prompt, input.workspacePath);

  return {
    message,
    model: 'codex',
  };
}
