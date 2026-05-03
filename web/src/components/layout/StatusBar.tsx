import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useEditor } from '@/hooks/useEditor';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useEditorStore } from '@/stores/editorStore';
import { useGitStatus } from '@/hooks/useGitStatus';
import { detectLanguage } from '@/lib/language';
import { GitBranch, WrapText } from 'lucide-react';

export function StatusBar({ workspace }: { workspace: string }) {
  const { tabs, activePath, save } = useEditor();
  const permission = useWorkspaceStore((s) => s.permission);
  const cursorPosition = useEditorStore((s) => s.cursorPosition);
  const wordWrap = useEditorStore((s) => s.wordWrap);
  const autoSaveMode = useEditorStore((s) => s.autoSaveMode);
  const autoSaveDelayMs = useEditorStore((s) => s.autoSaveDelayMs);
  const setAutoSaveMode = useEditorStore((s) => s.setAutoSaveMode);
  const setAutoSaveDelayMs = useEditorStore((s) => s.setAutoSaveDelayMs);
  const fontSize = useEditorStore((s) => s.fontSize);
  const setFontSize = useEditorStore((s) => s.setFontSize);
  const toggleWordWrap = useEditorStore((s) => s.toggleWordWrap);
  const tab = tabs.find((t) => t.path === activePath);
  const dirtyCount = tabs.filter((current) => current.dirty).length;
  const permissionLabel = permission === 'read' ? 'Somente leitura' : permission === 'write' ? 'Edição habilitada' : null;
  const visiblePath = tab?.kind === 'git-diff' ? (tab.gitDiff?.filePath ?? tab.path) : tab?.path;
  const language = tab && (tab.kind === 'file' || tab.kind === 'git-diff') ? detectLanguage(tab.name) : null;
  const { status: gitStatus } = useGitStatus(workspace);
  const [copiedTarget, setCopiedTarget] = useState<'workspace' | 'path' | null>(null);

  function copyValue(value: string, target: 'workspace' | 'path') {
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) return;

    void clipboard.writeText(value)
      .then(() => {
        setCopiedTarget(target);
        setTimeout(() => setCopiedTarget(null), 1500);
      })
      .catch(() => {
        setCopiedTarget(null);
      });
  }

  return (
    <div className="flex h-7 items-center justify-between gap-3 border-t bg-muted/40 px-3 text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => copyValue(workspace, 'workspace')}
          title="Copiar nome do workspace"
          className="shrink-0 font-mono text-foreground transition-colors hover:text-primary"
        >
          {copiedTarget === 'workspace' ? 'Copiado!' : workspace}
        </button>
        {gitStatus?.branch && (
          <span className="flex shrink-0 items-center gap-1 font-mono text-muted-foreground/70">
            <GitBranch className="h-3 w-3" />
            {gitStatus.branch}
          </span>
        )}
        {permissionLabel && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
            {permissionLabel}
          </Badge>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-3 font-mono">
        {tab && (tab.kind === 'file' || tab.kind === 'git-diff') && (
          <button
            type="button"
            onClick={toggleWordWrap}
            title={wordWrap ? 'Quebra de linha: ativada (clique para desativar)' : 'Quebra de linha: desativada (clique para ativar)'}
            className={`shrink-0 flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground ${wordWrap ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}
          >
            <WrapText className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          title={`Tamanho da fonte: ${fontSize}px (Ctrl+= aumentar, Ctrl+- reduzir, Ctrl+0 resetar)`}
          onClick={() => setFontSize(13)}
          className="shrink-0 rounded px-1 transition-colors hover:text-foreground"
        >
          {fontSize}px
        </button>
        {language && language !== 'plaintext' && <span className="shrink-0 capitalize">{language}</span>}
        <button
          type="button"
          onClick={() => {
            if (autoSaveMode === 'afterDelay') {
              setAutoSaveMode('off');
            } else {
              setAutoSaveMode('afterDelay');
              setAutoSaveDelayMs(1200);
            }
          }}
          title={autoSaveMode === 'afterDelay' ? 'Auto Save ligado — clique para desativar' : 'Auto Save desligado — clique para ativar'}
          className={`shrink-0 rounded px-1 transition-colors hover:text-foreground ${autoSaveMode === 'afterDelay' ? '' : 'text-muted-foreground/50'}`}
        >
          {autoSaveMode === 'afterDelay' ? `Auto Save ${autoSaveDelayMs >= 3000 ? '3s' : '1.2s'}` : 'Auto Save off'}
        </button>
        {cursorPosition && <span className="shrink-0">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>}
        {dirtyCount > 1 && (
          <button
            type="button"
            onClick={() => { tabs.filter((t) => t.dirty && t.kind === 'file').forEach((t) => void save(t.path)); }}
            title="Salvar todos os arquivos não salvos"
            className="shrink-0 text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
          >
            {dirtyCount} não salvos · Salvar todos
          </button>
        )}
        {dirtyCount === 1 && (
          <span className="shrink-0 text-amber-600 dark:text-amber-400">
            Não salvo · Ctrl+S
          </span>
        )}
        {tab && visiblePath ? (
          <button
            type="button"
            onClick={() => copyValue(visiblePath, 'path')}
            aria-label={visiblePath}
            title={visiblePath}
            className="min-w-0 truncate text-left transition-colors hover:text-foreground"
          >
            {copiedTarget === 'path' ? 'Caminho copiado!' : `${tab.name}${tab.dirty ? ' • Não salvo' : ''}`}
          </button>
        ) : (
          <span className="truncate text-muted-foreground/80">Nenhum arquivo ativo</span>
        )}
      </div>
    </div>
  );
}
