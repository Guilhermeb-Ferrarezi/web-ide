import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { chatAssistant } from '@/api/assistant';
import { saveFile } from '@/api/fs';
import { Check, Copy, Loader2, Send, Sparkles, Trash2, WandSparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AssistantChatMessage } from '@/types';

type Props = {
  workspace: string;
  activePath: string | null;
  activeContent: string | null;
  canEdit?: boolean;
  onClose?: () => void;
};

type PromptPreset = {
  label: string;
  prompt: string;
};

const FILE_PROMPTS: PromptPreset[] = [
  { label: 'Explicar', prompt: 'Explique o arquivo aberto.' },
  { label: 'Melhorar', prompt: 'Sugira melhorias nesse código.' },
  { label: 'Testes', prompt: 'Crie ou melhore testes para o arquivo aberto.' },
  { label: 'Bugs', prompt: 'Encontre bugs óbvios no arquivo aberto.' },
  { label: 'Resumir', prompt: 'Resuma o arquivo aberto em 3 pontos.' },
];

const WORKSPACE_PROMPTS: PromptPreset[] = [
  { label: 'Analisar', prompt: 'Explique como este workspace está organizado.' },
  { label: 'Riscos', prompt: 'Aponte riscos e problemas óbvios neste workspace.' },
  { label: 'Próximos passos', prompt: 'Sugira próximos passos práticos para este workspace.' },
];

export function AssistantPanel({ workspace, activePath, activeContent, canEdit = true, onClose }: Props) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const promptPresets = activePath ? FILE_PROMPTS : WORKSPACE_PROMPTS;

  const contextLabel = useMemo(() => {
    if (activePath) return activePath;
    return 'nenhum arquivo aberto';
  }, [activePath]);

  const statusLabel = useMemo(() => {
    if (sending) return 'Gerando';
    if (error) return 'Erro';
    if (messages.length > 0) return 'Ativo';
    return 'Pronto';
  }, [error, messages.length, sending]);

  const statusTone: BadgeProps['variant'] = error ? 'destructive' : sending ? 'secondary' : 'outline';

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

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
    const raw =
      cause instanceof Error && cause.message
        ? cause.message
        : 'Não consegui responder agora. Verifique se o Codex está instalado e disponível na máquina.';

    if (/bwrap|namespace|sandbox/i.test(raw)) {
      return 'O ambiente bloqueou a edição agora. Tente novamente ou peça uma sugestão sem aplicar alterações.';
    }

    if (/unauthorized|login/i.test(raw)) {
      return 'O Codex precisa estar autenticado nesta máquina.';
    }

    return raw;
  }

  async function sendMessage(rawValue?: string) {
    const nextInput = (rawValue ?? input).trim();
    if (!nextInput || sending) return;

    const nextMessages: AssistantChatMessage[] = [...messages, { role: 'user', content: nextInput }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError(null);
    setLastPrompt(nextInput);

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

  return (
    <div className="flex h-full flex-col bg-[#121019] text-[#ece8f7]">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-violet-300" />
              Codex
              <Badge variant={statusTone} className="ml-1 h-5 px-2 text-[10px] uppercase tracking-wide">
                {statusLabel}
              </Badge>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">
                {canEdit ? 'Escrita' : 'Leitura'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-[#a59fba]">
              Pergunte sobre o workspace, o arquivo aberto ou peça uma alteração. Respostas com código vêm em blocos copiáveis.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-[#b9b3cb]">
                Contexto: <span className="text-white">{contextLabel}</span>
              </div>
              {activePath && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-[#b9b3cb]">
                  Arquivo ativo: <span className="text-white">{activePath}</span>
                </div>
              )}
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-[#b9b3cb]">
                Histórico persistido pelo Codex
              </div>
            </div>
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
                Posso revisar o arquivo aberto, sugerir refatorações, criar testes ou gerar um patch menor para aplicar.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {promptPresets.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => void sendMessage(prompt.prompt)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#ece8f7] transition-colors hover:bg-white/10"
                  >
                    {prompt.label}
                  </button>
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
        <div className="mb-2 flex flex-wrap gap-2">
          {promptPresets.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => void sendMessage(prompt.prompt)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#ece8f7] transition-colors hover:bg-white/10"
            >
              {prompt.label}
            </button>
          ))}
        </div>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Pergunte algo sobre o workspace..."
          className="min-h-20 resize-none border-white/10 bg-black/30 text-sm text-[#f1edf8] placeholder:text-[#7f7895] overflow-hidden"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#7f7895]">
            Enter envia • Shift+Enter quebra linha • {input.length} caractere(s)
          </p>
          <Button
            type="button"
            onClick={() => void sendMessage()}
            disabled={sending || !input.trim()}
            className={cn('gap-2 bg-violet-500 text-white hover:bg-violet-400', sending && 'cursor-wait')}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </Button>
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
  const codeBlock = useMemo(() => extractFirstCodeBlock(message.content), [message.content]);
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
      <div className="relative max-w-[92%]">
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
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0c0b12]">
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
      <pre className="overflow-x-auto px-3 py-3 text-[13px] leading-6 text-[#ede9ff]">
        <code className="whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

function flattenNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenNodeText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return flattenNodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

function extractFirstCodeBlock(content: string): string | null {
  const match = content.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
  if (!match) return null;
  return match[1].replace(/\n$/, '');
}

function isPatchLike(content: string) {
  return /(^|\n)(---|\+\+\+|\*\*\* Begin Patch)/.test(content);
}
