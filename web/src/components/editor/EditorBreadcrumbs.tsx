import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { resolveDefaultFileIcon, resolveDefaultFolderIcon, resolveFileIcon, resolveFolderFallbackIcon, resolveFolderIcon } from '@/lib/fileTreeIcons';
import { IconWithFallback } from '@/components/shared/IconWithFallback';

type Props = {
  path: string | null;
  dirty?: boolean;
};

export function EditorBreadcrumbs({ path, dirty = false }: Props) {
  if (!path) return null;

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const [expanded, setExpanded] = useState(false);
  const shouldCollapseMiddle = segments.length > 4 && !expanded;
  const middleSegments = segments.slice(1, -1);
  const visibleSegments = shouldCollapseMiddle
    ? [segments[0], '…', segments[segments.length - 1]]
    : segments;

  return (
    <div className="flex h-8 items-center gap-1 overflow-x-auto border-b bg-muted/10 px-3 text-xs text-muted-foreground">
      {visibleSegments.map((segment, index) => {
        const isCollapsed = segment === '…';
        const isLast = index === visibleSegments.length - 1;
        const sourceSegments = shouldCollapseMiddle
          ? index === 0
            ? [segments[0]]
            : isCollapsed
              ? middleSegments
              : [segments[segments.length - 1]]
          : segments.slice(0, index + 1);
        const segmentPath = sourceSegments.join('/');
        const iconSrc = isLast
          ? resolveFileIcon(segmentPath)
          : resolveFolderIcon(segmentPath);
        const fallbackSrc = isLast
          ? resolveDefaultFileIcon(segmentPath)
          : resolveFolderFallbackIcon({ expanded: false });

        return (
          <div key={`${segmentPath}-${index}`} className="flex shrink-0 items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
            <IconWithFallback src={iconSrc} fallbackSrc={fallbackSrc} alt="" role="presentation" className="h-4 w-4 shrink-0" />
            {isCollapsed ? (
              <button
                type="button"
                className="rounded px-1 hover:bg-accent hover:text-foreground"
                title={middleSegments.join(' / ')}
                aria-label="Mostrar pastas intermediárias"
                onClick={() => setExpanded(true)}
              >
                {segment}
              </button>
            ) : (
              <span
                className={isLast ? 'font-medium text-foreground' : undefined}
                title={isCollapsed ? middleSegments.join(' / ') : undefined}
              >
                {segment}
              </span>
            )}
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
