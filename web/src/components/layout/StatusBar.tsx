import { useEditor } from '@/hooks/useEditor';

export function StatusBar({ workspace }: { workspace: string }) {
  const { tabs, activePath } = useEditor();
  const tab = tabs.find((t) => t.path === activePath);
  return (
    <div className="flex h-6 items-center justify-between border-t bg-muted/40 px-3 text-xs text-muted-foreground">
      <span className="font-mono">{workspace}</span>
      {tab && (
        <span className="font-mono">
          {tab.path}
          {tab.dirty && ' •'}
        </span>
      )}
    </div>
  );
}
