import { useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { EditorTab } from '@/types';
import { detectLanguage, isImage } from '@/lib/language';

type Props = {
  tab: EditorTab | null;
  readOnly?: boolean;
  onChange: (path: string, content: string) => void;
  onSave: (path: string) => void;
};

export function EditorPane({ tab, readOnly = false, onChange, onSave }: Props) {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (tab && !readOnly) onSave(tab.path);
      }
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [tab, readOnly, onSave]);

  if (!tab) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Selecione um arquivo na árvore
      </div>
    );
  }

  if (tab.encoding === 'base64') {
    if (isImage(tab.mimeType)) {
      return (
        <div className="flex h-full items-center justify-center overflow-auto bg-muted/20 p-4">
          <img
            src={`data:${tab.mimeType};base64,${tab.content}`}
            alt={tab.name}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <p>Arquivo binário ({tab.mimeType})</p>
        <p className="text-xs">Visualização não suportada</p>
      </div>
    );
  }

  return (
    <Editor
      key={tab.path}
      height="100%"
      theme="vs-dark"
      language={detectLanguage(tab.name)}
      value={tab.content}
      onChange={(v) => onChange(tab.path, v ?? '')}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        fixedOverflowWidgets: true,
        readOnly,
      }}
    />
  );
}
