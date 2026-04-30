import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Item = { path: string; tag: string };

type Props = {
  title: string;
  items: Item[];
  selected: Set<string>;
  onToggle: (path: string) => void;
  onToggleAll: () => void;
  emptyText: string;
  variant?: 'default' | 'destructive';
};

export function GitFileList({ title, items, selected, onToggle, onToggleAll, emptyText, variant }: Props) {
  if (items.length === 0) return null;
  const allSelected = items.every((i) => selected.has(i.path));
  return (
    <div>
      <button
        type="button"
        onClick={onToggleAll}
        className="flex w-full items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent"
      >
        <span>{title} ({items.length})</span>
        <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
      </button>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={item.path}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={selected.has(item.path)}
                onCheckedChange={() => onToggle(item.path)}
              />
              <span className={cn('flex-1 truncate font-mono text-xs', variant === 'destructive' && 'text-destructive')}>
                {item.path}
              </span>
              <Badge variant="outline" className="font-mono text-[10px]">{item.tag}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
