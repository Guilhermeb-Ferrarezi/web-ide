import { useEffect, useRef } from 'react';
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import type { EditorTab } from '@/types';
import { fetchProjectFiles, fetchTypes } from '@/api/fs';
import { useEditor } from '@/hooks/useEditor';
import { detectLanguage, isImage } from '@/lib/language';
import { useEditorStore } from '@/stores/editorStore';
import { DEFAULT_EDITOR_THEME_ID, useAppearanceStore } from '@/stores/appearanceStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Props = {
  tab: EditorTab | null;
  readOnly?: boolean;
  onChange: (path: string, content: string) => void;
  onSave: (path: string) => void;
};

export function EditorPane({ tab, readOnly = false, onChange, onSave }: Props) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const pendingJump = useEditorStore((s) => s.pendingJump);
  const setPendingJump = useEditorStore((s) => s.setPendingJump);
  const monaco = useMonaco();
  const workspace = useWorkspaceStore((s) => s.workspace);
  const { openFile } = useEditor();
  const installedThemes = useAppearanceStore((s) => s.installedThemes);
  const activeThemeId = useAppearanceStore((s) => s.activeThemeId);
  const activeTheme = activeThemeId === DEFAULT_EDITOR_THEME_ID
    ? null
    : installedThemes.find((theme) => theme.id === activeThemeId) ?? null;

  useEffect(() => {
    if (!monaco || !workspace) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = monaco.languages.typescript as any;
    const opts: Parameters<typeof ts.typescriptDefaults.setCompilerOptions>[0] = {
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      strict: false,
      noEmit: true,
      skipLibCheck: true,
      allowNonTsExtensions: true,
      allowJs: true,
      target: ts.ScriptTarget.ES2022,
      baseUrl: 'file:///',
      paths: {
        '@/*': ['src/*'],
      },
    };
    ts.typescriptDefaults.setCompilerOptions(opts);
    ts.javascriptDefaults.setCompilerOptions(opts);
    ts.typescriptDefaults.setEagerModelSync(true);
    ts.javascriptDefaults.setEagerModelSync(true);

    let cancelled = false;
    void Promise.all([fetchTypes(workspace), fetchProjectFiles(workspace)]).then(([types, projectFiles]) => {
      if (cancelled) return;

      for (const { virtualPath, content } of types) {
        const uri = monaco.Uri.parse(`file:///${virtualPath}`);
        ts.typescriptDefaults.addExtraLib(content, uri.toString());
        ts.javascriptDefaults.addExtraLib(content, uri.toString());
      }

      for (const file of projectFiles) {
        const language = detectLanguage(file.path);
        if (language === 'plaintext') continue;

        const uri = monaco.Uri.parse(`file:///${file.path}`);
        if (!monaco.editor.getModel(uri)) {
          monaco.editor.createModel(file.content, language, uri);
        }
      }
    });

    return () => { cancelled = true; };
  }, [monaco, workspace]);

  useEffect(() => {
    if (!monaco || !activeTheme) return;
    monaco.editor.defineTheme(activeTheme.id, {
      base: activeTheme.uiTheme,
      inherit: true,
      rules: activeTheme.rules,
      colors: activeTheme.colors,
    });
  }, [activeTheme, monaco]);

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

  useEffect(() => {
    if (!pendingJump || !editorRef.current) return;
    const ed = editorRef.current;
    ed.revealLineInCenter(pendingJump.line);
    ed.setPosition({ lineNumber: pendingJump.line, column: pendingJump.column });
    ed.focus();
    setPendingJump(null);
  }, [pendingJump, setPendingJump]);

  const handleMount: OnMount = (ed) => {
    editorRef.current = ed;

    async function openDefinition() {
      if (!monaco) return;
      const model = ed.getModel();
      const position = ed.getPosition();
      if (!model || !position) return;

      // Monaco exposes the TS worker at runtime, but the bundled typings lag behind here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tsApi = monaco.languages.typescript as any;
      const workerFactory = await tsApi.getTypeScriptWorker();
      const worker = await workerFactory(model.uri);
      const offset = model.getOffsetAt(position);
      const definitions = await worker.getDefinitionAtPosition(model.uri.toString(), offset);
      const target = definitions?.[0];
      if (!target) return;

      const targetPath = target.fileName.replace(/^file:\/\//, '').replace(/^\/+/, '');
      const targetUri = monaco.Uri.parse(`file:///${targetPath}`);
      const targetModel = monaco.editor.getModel(targetUri);

      if (targetModel) {
        const nextPosition = targetModel.getPositionAt(target.textSpan.start);
        await openFile(targetPath, {
          line: nextPosition.lineNumber,
          column: nextPosition.column,
        });
        return;
      }

      await openFile(targetPath);
    }

    ed.addCommand(monaco?.KeyCode.F12 ?? 68, () => {
      void openDefinition();
    });
    ed.onMouseDown((event) => {
      if (!event.target.position) return;
      if (!event.event.ctrlKey && !event.event.metaKey) return;
      ed.setPosition(event.target.position);
      void openDefinition();
    });

    const jump = useEditorStore.getState().pendingJump;
    if (jump) {
      ed.revealLineInCenter(jump.line);
      ed.setPosition({ lineNumber: jump.line, column: jump.column });
      ed.focus();
      setPendingJump(null);
    }
  };

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
      path={`file:///${tab.path}`}
      theme={activeTheme?.id ?? 'vs-dark'}
      language={detectLanguage(tab.name)}
      value={tab.content}
      onChange={(v) => onChange(tab.path, v ?? '')}
      onMount={handleMount}
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
