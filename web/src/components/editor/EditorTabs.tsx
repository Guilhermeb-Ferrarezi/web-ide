import { useEffect, useRef, useState } from 'react';
import { Blocks, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { resolveDefaultFileIcon, resolveFileIcon } from '@/lib/fileTreeIcons';
import type { EditorTab } from '@/types';
import { cn } from '@/lib/utils';
import { IconWithFallback } from '@/components/shared/IconWithFallback';

type Props = {
  tabs: EditorTab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
};

export function EditorTabs({ tabs, activePath, onSelect, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScrollState); ro.disconnect(); };
  }, [tabs]);

  useEffect(() => {
    if (!activePath || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(`[data-tab-path="${CSS.escape(activePath)}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activePath]);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  if (tabs.length === 0) return null;
  return (
    <div className="relative flex h-9 items-stretch border-b bg-muted/30">
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Rolar abas para a esquerda"
          onClick={() => scrollBy(-120)}
          className="flex shrink-0 items-center border-r px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
      <div ref={scrollRef} className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        const fileIcon = tab.iconUrl ?? resolveFileIcon(tab.path);
        const fallbackIcon = resolveDefaultFileIcon(tab.path);
        const showExtensionFallback = tab.kind === 'extension' && !tab.iconUrl;
        return (
          <div
            key={tab.path}
            role="button"
            aria-pressed={active}
            tabIndex={0}
            title={tab.path}
            data-tab-path={tab.path}
            onClick={() => onSelect(tab.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(tab.path);
              }
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const idx = tabs.findIndex((t) => t.path === tab.path);
                const next = e.key === 'ArrowRight' ? tabs[idx + 1] : tabs[idx - 1];
                if (next) {
                  onSelect(next.path);
                  const el = document.querySelector<HTMLElement>(`[data-tab-path="${CSS.escape(next.path)}"]`);
                  el?.focus();
                }
              }
            }}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onClose(tab.path); } }}
            className={cn(
              'group flex shrink-0 items-center gap-2 border-r px-3 text-sm cursor-pointer',
              active ? 'bg-background' : 'bg-muted/30 hover:bg-muted/50',
            )}
          >
            {showExtensionFallback ? (
              <span
                aria-label={tab.name}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground"
              >
                <Blocks className="h-3 w-3" />
              </span>
            ) : (
              <IconWithFallback
                src={fileIcon}
                fallbackSrc={fallbackIcon}
                alt=""
                role="presentation"
                className="h-4 w-4 shrink-0"
              />
            )}
            <span className={cn('truncate', tab.dirty && 'italic')}>{tab.name}</span>
            {tab.isLoading && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />}
            {tab.dirty && <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.path);
              }}
              aria-label={`Fechar ${tab.name}`}
              className="rounded p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      </div>
      {canScrollRight && (
        <button
          type="button"
          aria-label="Rolar abas para a direita"
          onClick={() => scrollBy(120)}
          className="flex shrink-0 items-center border-l px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
