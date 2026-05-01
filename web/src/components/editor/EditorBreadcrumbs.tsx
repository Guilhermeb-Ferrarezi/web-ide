import { ChevronRight } from 'lucide-react';
import { resolveMaterialFileIcon, resolveMaterialFolderIcon } from '@/lib/fileTreeIcons';

type Props = {
  path: string | null;
  dirty?: boolean;
};

export function EditorBreadcrumbs({ path, dirty = false }: Props) {
  if (!path) return null;

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <div className="flex h-8 items-center gap-1 overflow-x-auto border-b bg-muted/10 px-3 text-xs text-muted-foreground">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const segmentPath = segments.slice(0, index + 1).join('/');
        const iconSrc = isLast
          ? resolveMaterialFileIcon(segmentPath)
          : resolveMaterialFolderIcon(segmentPath);

        return (
          <div key={segmentPath} className="flex shrink-0 items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
            <img src={iconSrc} alt="" role="presentation" className="h-4 w-4 shrink-0" />
            <span className={isLast ? 'font-medium text-foreground' : undefined}>{segment}</span>
            {isLast && dirty && (
              <span
                aria-label="Arquivo com alteracoes nao salvas"
                className="ml-1 h-1.5 w-1.5 rounded-full bg-foreground/70"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
