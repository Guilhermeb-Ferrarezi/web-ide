import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useEditor } from '@/hooks/useEditor';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useEditorStore } from '@/stores/editorStore';
import { detectLanguage } from '@/lib/language';
import { WrapText } from 'lucide-react';

export function StatusBar({ workspace }: { workspace: string }) {
  const { tabs, activePath } = useEditor();
  const permission = useWorkspaceStore((s) => s.permission);
  const cursorPosition = useEditorStore((s) => s.cursorPosition);
  const wordWrap = useEditorStore((s) => s.wordWrap);
  const toggleWordWrap = useEditorStore((s) => s.toggleWordWrap);
  const tab = tabs.find((t) => t.path === activePath);
  const dirtyCount = tabs.filter((current) => current.dirty).length;
  const permissionLabel = permission === 'read' ? 'Somente leitura' : permission === 'write' ? 'Edição habilitada' : null;
  const language = tab && tab.kind === 'file' ? detectLanguage(tab.name) : null;
  const [copied, setCopied] = useState(false);

  function copyWorkspace() {
    void navigator.clipboard.writeText(workspace).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex h-7 items-center justify-between gap-3 border-t bg-muted/40 px-3 text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={copyWorkspace}
          title="Copiar nome do workspace"
          className="shrink-0 font-mono text-foreground hover:text-primary transition-colors"
        >
          {copied ? 'Copiado!' : workspace}
        </button>
        {permissionLabel && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
            {permissionLabel}
          </Badge>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-3 font-mono">
        {tab && tab.kind === 'file' && (
          <button
            type="button"
            onClick={toggleWordWrap}
            title={wordWrap ? 'Quebra de linha: ativada (clique para desativar)' : 'Quebra de linha: desativada (clique para ativar)'}
            className={`shrink-0 flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground ${wordWrap ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}
          >
            <WrapText className="h-3.5 w-3.5" />
          </button>
        )}
        {language && language !== 'plaintext' && <span className="shrink-0 capitalize">{language}</span>}
        {cursorPosition && <span className="shrink-0">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>}
        {dirtyCount > 0 && (
          <span className="shrink-0 text-amber-600 dark:text-amber-400">
            {dirtyCount} não salvos · Ctrl+S para salvar
          </span>
        )}
        {tab ? (
          <span className="truncate" title={tab.path}>
            {tab.name}
            {tab.dirty ? ' • Não salvo' : ''}
          </span>
        ) : (
          <span className="truncate text-muted-foreground/80">Nenhum arquivo ativo</span>
        )}
      </div>
    </div>
  );
}
