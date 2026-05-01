import { X } from 'lucide-react';
import { resolveFileIcon } from '@/lib/fileTreeIcons';
import type { EditorTab } from '@/types';
import { cn } from '@/lib/utils';

type Props = {
  tabs: EditorTab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
};

export function EditorTabs({ tabs, activePath, onSelect, onClose }: Props) {
  if (tabs.length === 0) return null;
  return (
    <div className="flex h-9 items-stretch overflow-x-auto border-b bg-muted/30">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        const fileIcon = resolveFileIcon(tab.path);
        return (
          <div
            key={tab.path}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(tab.path)}
            className={cn(
              'group flex shrink-0 items-center gap-2 border-r px-3 text-sm cursor-pointer',
              active ? 'bg-background' : 'bg-muted/30 hover:bg-muted/50',
            )}
          >
            <img src={fileIcon} alt="" role="presentation" className="h-4 w-4 shrink-0" />
            <span className={cn('truncate', tab.dirty && 'italic')}>{tab.name}</span>
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
  );
}
