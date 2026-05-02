import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { resolveDefaultFileIcon, resolveFileIcon } from '@/lib/fileTreeIcons';
import { IconWithFallback } from '@/components/shared/IconWithFallback';

type Item = { path: string; tag: string };

type Props = {
  title: string;
  items: Item[];
  selected: Set<string>;
  onToggle: (path: string) => void;
  onToggleAll: () => void;
  emptyText: string;
  variant?: 'default' | 'destructive';
  onOpenFile?: (path: string) => void;
  activePath?: string | null;
};

export function GitFileList({
  title,
  items,
  selected,
  onToggle,
  onToggleAll,
  emptyText,
  variant,
  onOpenFile,
  activePath,
}: Props) {
  if (items.length === 0) return null;
  const selectedCount = items.filter((item) => selected.has(item.path)).length;
  const allSelected = selectedCount === items.length;
  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <button
          type="button"
          onClick={onToggleAll}
          className="flex-1 text-left hover:text-foreground"
        >
          <span>{title} ({items.length})</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] normal-case tracking-normal">
            {selectedCount > 0 ? `${selectedCount} de ${items.length} selecionados` : 'Marque para selecionar tudo'}
          </span>
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleAll}
            aria-label={`Selecionar todos em ${title}`}
          />
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={item.path}
              className={cn(
                'flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent',
                activePath === item.path && 'bg-accent/80',
              )}
            >
              <Checkbox
                checked={selected.has(item.path)}
                onCheckedChange={() => onToggle(item.path)}
                aria-label={`Selecionar ${item.path}`}
              />
              {onOpenFile ? (
                <button
                  type="button"
                  onClick={() => onOpenFile(item.path)}
                  title={`Abrir ${item.path}`}
                  className={cn(
                    'flex flex-1 items-center gap-2 truncate text-left font-mono text-xs hover:underline',
                    variant === 'destructive' && 'text-destructive',
                  )}
                >
                  <IconWithFallback
                    src={resolveFileIcon(item.path)}
                    fallbackSrc={resolveDefaultFileIcon(item.path)}
                    alt=""
                    ariaHidden
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="truncate">{item.path}</span>
                </button>
              ) : (
                <span
                  className={cn('flex flex-1 items-center gap-2 truncate font-mono text-xs', variant === 'destructive' && 'text-destructive')}
                >
                  <IconWithFallback
                    src={resolveFileIcon(item.path)}
                    fallbackSrc={resolveDefaultFileIcon(item.path)}
                    alt=""
                    ariaHidden
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="truncate">{item.path}</span>
                </span>
              )}
              <Badge variant="outline" className="font-mono text-[10px]">{item.tag}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
