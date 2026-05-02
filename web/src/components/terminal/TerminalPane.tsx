import { useRef } from 'react';
import { useTerminal } from '@/hooks/useTerminal';

export function TerminalPane({ workspace }: { workspace: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useTerminal(ref, workspace);

  return (
    <div className="relative h-full w-full bg-[#0a0a0a] p-2">
      <div className="pointer-events-none absolute left-3 top-2 z-10 rounded-md border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white/70">
        Terminal · {workspace}
      </div>
      <div className="pointer-events-none absolute right-3 top-2 z-10 rounded-md border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white/70">
        Ctrl+` para focar o terminal
      </div>
      <div
        ref={ref}
        role="region"
        aria-label={`Terminal do workspace ${workspace}`}
        className="h-full w-full"
      />
    </div>
  );
}
