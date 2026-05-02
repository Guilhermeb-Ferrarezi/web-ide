import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { chatAssistant } from '@/api/assistant';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { AssistantChatMessage } from '@/types';

type Props = {
  workspace: string;
  activePath: string | null;
  activeContent: string | null;
};

const QUICK_PROMPTS = [
  'Explique o arquivo aberto.',
  'Sugira melhorias nesse código.',
  'Encontre bugs óbvios.',
];

export function AssistantPanel({ workspace, activePath, activeContent }: Props) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, sending, error]);

  const contextLabel = useMemo(() => {
    if (activePath) return activePath;
    return 'nenhum arquivo aberto';
  }, [activePath]);

  async function sendMessage(rawValue?: string) {
    const nextInput = (rawValue ?? input).trim();
    if (!nextInput || sending) return;

    const nextMessages: AssistantChatMessage[] = [...messages, { role: 'user', content: nextInput }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const response = await chatAssistant({
        workspace,
        activePath,
        activeContent,
        messages: nextMessages,
      });

      setMessages((current) => [...current, { role: 'assistant', content: response.message }]);
    } catch (cause) {
      const message =
        cause instanceof Error && cause.message
          ? cause.message
          : 'Não consegui responder agora. Verifique se o Codex está instalado e disponível na máquina.';
      setError(message);
      toast.error('Falha ao enviar para o codex');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#121019] text-[#ece8f7]">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-violet-300" />
          Codex
        </div>
        <p className="mt-1 text-xs text-[#a59fba]">
          Pergunte sobre o workspace, o arquivo aberto ou peça sugestões de código.
        </p>
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-[#b9b3cb]">
          Contexto: <span className="text-white">{contextLabel}</span>
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
                Posso revisar o arquivo aberto, sugerir refatorações ou explicar trechos específicos.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#ece8f7] transition-colors hover:bg-white/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}-${message.content.slice(0, 12)}`} message={message} />
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
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-white/10 p-3">
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
          className="min-h-24 resize-none border-white/10 bg-black/30 text-sm text-[#f1edf8] placeholder:text-[#7f7895]"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#7f7895]">Enter envia • Shift+Enter quebra linha</p>
          <Button
            type="button"
            onClick={() => void sendMessage()}
            disabled={sending || !input.trim()}
            className={cn(
              'gap-2 bg-violet-500 text-white hover:bg-violet-400',
              sending && 'cursor-wait',
            )}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AssistantChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm',
          isUser
            ? 'border-violet-400/30 bg-violet-500/15 text-white'
            : 'border-white/10 bg-white/5 text-[#ece8f7]',
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
