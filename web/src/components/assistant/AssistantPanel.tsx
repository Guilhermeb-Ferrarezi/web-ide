import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { chatAssistant } from '@/api/assistant';
import { saveFile } from '@/api/fs';
import { Check, Copy, Loader2, Send, Sparkles, Trash2, WandSparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveDefaultFileIcon, resolveFileIcon } from '@/lib/fileTreeIcons';
import { IconWithFallback } from '@/components/shared/IconWithFallback';
import type { AssistantChatMessage } from '@/types';

type Props = {
  workspace: string;
  activePath: string | null;
  activeContent: string | null;
  canEdit?: boolean;
  onClose?: () => void;
};

const QUICK_ACTIONS = [
  {
    label: 'Criar testes para este arquivo',
    prompt: 'Crie testes para o arquivo aberto, considerando seu conteúdo atual.',
  },
  {
    label: 'Explicar este arquivo',
    prompt: 'Explique o arquivo aberto, destacando responsabilidades e possíveis riscos.',
  },
  {
    label: 'Sugerir refatoração',
    prompt: 'Sugira uma refatoração objetiva para o arquivo aberto e explique o ganho principal.',
  },
] as const;

export function getAssistantPanelStorageKey(workspace: string, bucket: 'draft' | 'messages') {
  return `assistant-panel:${workspace}:${bucket}`;
}

export function AssistantPanel({ workspace, activePath, activeContent, canEdit = true, onClose }: Props) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => readStoredMessages(workspace));
  const [input, setInput] = useState(() => readStoredDraft(workspace));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const firstWorkspaceRenderRef = useRef(true);
  const skipDraftPersistRef = useRef(true);
  const skipMessagesPersistRef = useRef(true);
  const activeFileName = activePath ? getFileName(activePath) : null;
  const activeFileIcon = activePath ? resolveFileIcon(activePath) : null;
  const activeFileFallbackIcon = activePath ? resolveDefaultFileIcon(activePath) : null;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (firstWorkspaceRenderRef.current) {
      firstWorkspaceRenderRef.current = false;
      return;
    }

    skipDraftPersistRef.current = true;
    skipMessagesPersistRef.current = true;
    setInput(readStoredDraft(workspace));
    setMessages(readStoredMessages(workspace));
    setError(null);
    setLastPrompt(null);
    setAttachedFiles([]);
  }, [workspace]);

  useEffect(() => {
    if (skipDraftPersistRef.current) {
      skipDraftPersistRef.current = false;
      return;
    }

    const handle = window.setTimeout(() => {
      persistDraft(workspace, input);
    }, 180);

    return () => window.clearTimeout(handle);
  }, [workspace, input]);

  useEffect(() => {
    if (skipMessagesPersistRef.current) {
      skipMessagesPersistRef.current = false;
      return;
    }

    persistMessages(workspace, messages);
  }, [workspace, messages]);

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, sending, error]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const nextHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${nextHeight}px`;
  }, [input, sending]);

  function formatError(cause: unknown) {
    const responseStatus = typeof cause === 'object' && cause !== null && 'response' in cause
      ? (cause as { response?: { status?: number } }).response?.status
      : undefined;

    if (responseStatus === 504) {
      return 'O Codex demorou demais para responder. Tente uma pergunta menor ou repita a ação.';
    }

    const raw =
      cause instanceof Error && cause.message
        ? cause.message
        : 'Não consegui responder agora. Verifique se o Codex está instalado e disponível na máquina.';

    if (/bwrap|namespace|sandbox/i.test(raw)) {
      return 'Não consegui aplicar a mudança nesta sessão. Tente novamente ou peça só uma sugestão.';
    }

    if (/unauthorized|login/i.test(raw)) {
      return 'O Codex precisa estar autenticado nesta máquina.';
    }

    return raw;
  }

  async function sendMessage(rawValue?: string) {
    const nextInput = (rawValue ?? input).trim();
    const nextContent = buildPromptContent(nextInput, attachedFiles);
    if (!nextContent || sending) return;

    const nextMessages: AssistantChatMessage[] = [...messages, { role: 'user', content: nextContent }];
    setMessages(nextMessages);
    setInput('');
    setAttachedFiles([]);
    setSending(true);
    setError(null);
    setLastPrompt(nextInput || nextContent);

    try {
      const response = await chatAssistant({
        workspace,
        activePath,
        activeContent,
        messages: nextMessages,
      });

      setMessages((current) => [...current, { role: 'assistant', content: response.message }]);
    } catch (cause) {
      setError(formatError(cause));
      toast.error('Falha ao enviar para o Codex');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  async function applyCodeBlock(message: string) {
    const codeBlock = extractFirstCodeBlock(message);
    if (!codeBlock || !activePath || !canEdit) return;

    if (isPatchLike(codeBlock)) {
      toast.info('Este bloco parece um patch. Copie e aplique manualmente.');
      return;
    }

    const ok = window.confirm(`Substituir o conteúdo de "${activePath}" pelo código sugerido?`);
    if (!ok) return;

    try {
      await saveFile(workspace, activePath, codeBlock, 'utf-8');
      toast.success(`Arquivo atualizado: ${activePath}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não consegui aplicar a alteração.');
    }
  }

  function insertActivePath() {
    if (!activePath) return;
    setAttachedFiles((current) => (current.includes(activePath) ? current : [...current, activePath]));
    textareaRef.current?.focus();
  }

  function removeAttachedFile(path: string) {
    setAttachedFiles((current) => current.filter((item) => item !== path));
    textareaRef.current?.focus();
  }

  return (
    <div className="flex h-full flex-col bg-[#121019] text-[#ece8f7]">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-violet-300" />
              Codex
            </div>
            <p className="mt-1 text-xs text-[#a59fba]">
              Pergunte sobre o workspace, o arquivo aberto ou peça uma alteração.
            </p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                title="Limpar conversa"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                  setLastPrompt(null);
                }}
                className="rounded p-1 text-[#7f7895] transition-colors hover:bg-white/8 hover:text-[#ece8f7]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                title="Fechar Codex"
                onClick={onClose}
                className="rounded p-1 text-[#7f7895] transition-colors hover:bg-white/8 hover:text-[#ece8f7]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 px-3 py-3">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-[#c7c1da]">
              <div className="flex items-center gap-2 text-white">
                <WandSparkles className="h-4 w-4 text-violet-300" />
                Pronto para ajudar
              </div>
              <p className="mt-2 text-sm leading-6 text-[#a59fba]">
                Posso revisar o arquivo aberto, sugerir refatorações, criar testes ou devolver uma alteração pronta para aplicar.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void sendMessage(action.prompt)}
                    className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 text-xs font-medium text-violet-100 hover:bg-violet-500/20 hover:text-violet-50"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <MessageBubble
                key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
                message={message}
                canEdit={canEdit}
                activePath={activePath}
                workspace={workspace}
                onApplyCode={applyCodeBlock}
              />
            ))
          )}
          {sending && (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#d8d3e8]">
              <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
              Pensando...
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">Não consegui concluir essa etapa</p>
                  <p className="mt-1 text-sm leading-6">{error}</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-rose-300/20 bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-50 hover:bg-rose-500/30"
                  onClick={() => {
                    if (lastPrompt) void sendMessage(lastPrompt);
                  }}
                  disabled={!lastPrompt || sending}
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-white/10 p-3">
        {(attachedFiles.length > 0 || (activePath && activeFileName && activeFileIcon && activeFileFallbackIcon)) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {activePath && activeFileName && activeFileIcon && activeFileFallbackIcon && !attachedFiles.includes(activePath) && (
              <button
                type="button"
                aria-label={`Adicionar ${activePath} ao prompt`}
                onClick={insertActivePath}
                disabled={sending}
                className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-[#cfc7e5] transition-colors hover:border-violet-300/30 hover:bg-violet-500/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="shrink-0 text-[#8b83a4]">+ </span>
                <IconWithFallback
                  src={activeFileIcon}
                  fallbackSrc={activeFileFallbackIcon}
                  alt=""
                  ariaHidden
                  className="h-3.5 w-3.5 shrink-0"
                />
                <span className="truncate">{activeFileName}</span>
              </button>
            )}
            {attachedFiles.map((path) => (
              <AttachedFileChip key={path} path={path} onRemove={removeAttachedFile} />
            ))}
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' && !input.trim() && lastPrompt && !sending) {
              event.preventDefault();
              setInput(lastPrompt);
              return;
            }

            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Pergunte algo sobre o workspace..."
          className="min-h-20 resize-none border-white/10 bg-black/30 text-sm text-[#f1edf8] placeholder:text-[#7f7895] overflow-hidden"
        />
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-[#7f7895]">
              Enter envia • Shift+Enter quebra linha • ↑ reutiliza último prompt • {input.length} caractere(s)
            </p>
            <Button
              type="button"
              onClick={() => void sendMessage()}
              disabled={sending || (!input.trim() && attachedFiles.length === 0)}
              className={cn('gap-2 bg-violet-500 text-white hover:bg-violet-400', sending && 'cursor-wait')}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  canEdit,
  activePath,
  workspace,
  onApplyCode,
}: {
  message: AssistantChatMessage;
  canEdit: boolean;
  activePath: string | null;
  workspace: string;
  onApplyCode: (content: string) => void;
}) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const codeBlock = extractFirstCodeBlock(message.content);
  const hasCodeBlock = !isUser && Boolean(codeBlock);
  const applyAvailable = Boolean(!isUser && canEdit && activePath && codeBlock && !isPatchLike(codeBlock));

  function copyContent() {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={cn('group flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('relative', isUser ? 'max-w-[92%]' : hasCodeBlock ? 'w-full max-w-full' : 'max-w-[92%]')}>
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm',
            isUser ? 'border-violet-400/30 bg-violet-500/15 text-white' : 'border-white/10 bg-white/5 text-[#ece8f7]',
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.24em] text-[#7f7895]">
            <span>{isUser ? 'Você' : 'Codex'}</span>
            {!isUser && canEdit && codeBlock && <span className="text-violet-300">Aplicável</span>}
          </div>
          <MarkdownBody content={message.content} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 px-1">
          <button
            type="button"
            onClick={copyContent}
            title="Copiar mensagem"
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#1a1825] px-2.5 py-1 text-[11px] text-[#d7d0ea] transition-colors hover:bg-white/10',
              copied && 'border-green-500/30 text-green-200',
            )}
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-[#a59fba]" />}
            Copiar
          </button>
          {applyAvailable && (
            <button
              type="button"
              onClick={() => {
                if (codeBlock) onApplyCode(codeBlock);
              }}
              title={`Aplicar ao arquivo aberto${workspace ? ` em ${workspace}` : ''}`}
              className="inline-flex items-center gap-1 rounded-md border border-violet-400/20 bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-100 transition-colors hover:bg-violet-500/25"
            >
              Aplicar ao arquivo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachedFileChip({ path, onRemove }: { path: string; onRemove: (path: string) => void }) {
  const fileName = getFileName(path);
  const fileIcon = resolveFileIcon(path);
  const fallbackFileIcon = resolveDefaultFileIcon(path);

  return (
    <button
      type="button"
      aria-label={`Remover ${path} do prompt`}
      onClick={() => onRemove(path)}
      className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-white/10 bg-[#1a1724] px-2 text-xs text-[#d7d0ea] transition-colors hover:border-rose-300/30 hover:bg-rose-500/10 hover:text-white"
    >
      <X className="h-3.5 w-3.5 shrink-0 text-[#8b83a4]" />
      <IconWithFallback
        src={fileIcon}
        fallbackSrc={fallbackFileIcon}
        alt=""
        ariaHidden
        className="h-3.5 w-3.5 shrink-0"
      />
      <span className="truncate">{fileName}</span>
    </button>
  );
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="whitespace-pre-wrap leading-6 text-inherit">{children}</p>,
        ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1 text-inherit">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1 text-inherit">{children}</ol>,
        li: ({ children }) => <li className="text-inherit">{children}</li>,
        h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold text-white">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold text-white">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-white">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-violet-400/40 pl-3 text-[#cfc9e5]">{children}</blockquote>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-violet-300 underline decoration-violet-300/40">
            {children}
          </a>
        ),
        code: ({ className, children }) => {
          const raw = flattenNodeText(children);
          const language = className?.match(/language-([a-z0-9_-]+)/i)?.[1];
          if (!language && !raw.includes('\n')) {
            return <code className="rounded bg-black/35 px-1.5 py-0.5 text-[0.9em] text-violet-200">{children}</code>;
          }
          return <CodeBlock code={raw} language={language} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="-mx-2 my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0c0b12] sm:-mx-1">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] text-[#8a84a3]">
        <span>{language ? language.toUpperCase() : 'CÓDIGO'}</span>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-[#e8e4f4] transition-colors hover:bg-white/10"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-[13px] leading-6 text-[#ede9ff] [tab-size:2]">
        <code className="block min-w-full w-max whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

function readStoredDraft(workspace: string): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(getAssistantPanelStorageKey(workspace, 'draft')) ?? '';
}

function persistDraft(workspace: string, value: string) {
  if (typeof window === 'undefined') return;
  const key = getAssistantPanelStorageKey(workspace, 'draft');
  if (!value.trim()) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
}

function readStoredMessages(workspace: string): AssistantChatMessage[] {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(getAssistantPanelStorageKey(workspace, 'messages'));
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is AssistantChatMessage =>
        typeof item === 'object' &&
        item !== null &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string',
    );
  } catch {
    return [];
  }
}

function persistMessages(workspace: string, messages: AssistantChatMessage[]) {
  if (typeof window === 'undefined') return;
  const key = getAssistantPanelStorageKey(workspace, 'messages');
  if (messages.length === 0) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(messages));
}

function flattenNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenNodeText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return flattenNodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

function getFileName(path: string) {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

function buildPromptContent(input: string, attachedFiles: string[]) {
  if (attachedFiles.length === 0) return input;

  const fileList = attachedFiles.map((path) => `- ${path}`).join('\n');
  const context = `Arquivos anexados ao prompt:\n${fileList}`;
  return input ? `${context}\n\n${input}` : context;
}

function extractFirstCodeBlock(content: string): string | null {
  const match = content.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
  if (!match) return null;
  return match[1].replace(/\n$/, '');
}

function isPatchLike(content: string) {
  return /(^|\n)(---|\+\+\+|\*\*\* Begin Patch)/.test(content);
}
