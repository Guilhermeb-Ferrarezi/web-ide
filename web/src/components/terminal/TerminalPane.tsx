import { useRef } from 'react';
import { useTerminal } from '@/hooks/useTerminal';

export function TerminalPane({ workspace }: { workspace: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useTerminal(ref, workspace);
  return <div ref={ref} className="h-full w-full bg-[#0a0a0a] p-2" />;
}
