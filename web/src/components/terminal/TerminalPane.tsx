import { useEffect, useRef } from 'react';
import { useTerminal } from '@/hooks/useTerminal';

export function TerminalPane({ workspace }: { workspace: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useTerminal(ref, workspace);

  useEffect(() => {
    console.info('[terminal-pane] mount', { workspace });
    return () => {
      console.info('[terminal-pane] unmount', { workspace });
    };
  }, [workspace]);

  console.info('[terminal-pane] render', { workspace });

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="rounded-md border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white/70">
          Terminal · {workspace}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/70">
          <div className="rounded-md border border-white/10 bg-black/50 px-2 py-1">
            Ctrl+` foco
          </div>
          <div className="rounded-md border border-white/10 bg-black/50 px-2 py-1">
            Ctrl+Alt+C copiar
          </div>
          <div className="rounded-md border border-white/10 bg-black/50 px-2 py-1">
            Ctrl+Shift+V colar
          </div>
        </div>
      </div>
      <div
        ref={ref}
        role="region"
        aria-label={`Terminal do workspace ${workspace}`}
        className="min-h-0 flex-1 px-2 py-2"
      />
    </div>
  );
}
