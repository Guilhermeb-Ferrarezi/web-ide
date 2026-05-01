import { useEffect, useRef, useState } from 'react';
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import axios from 'axios';
import type { EditorProjectFile, EditorTab } from '@/types';
import { fetchProjectFiles, fetchTypes } from '@/api/fs';
import { useEditor } from '@/hooks/useEditor';
import { ExtensionDetailView, type InstalledExtensionAction } from '@/components/extensions/ExtensionDetailView';
import { installExtension } from '@/api/extensions';
import { detectLanguage, isImage } from '@/lib/language';
import { buildMonacoThemeData, getMonacoThemeName } from '@/lib/monacoTheme';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editorStore';
import { DEFAULT_EDITOR_THEME_ID, useAppearanceStore } from '@/stores/appearanceStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type Props = {
  tab: EditorTab | null;
  readOnly?: boolean;
  onChange: (path: string, content: string) => void;
  onSave: (path: string) => void;
};

type TsConfigLike = {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
    jsx?: 'react-jsx' | 'react-jsxdev' | 'react' | 'preserve';
    jsxImportSource?: string;
    allowImportingTsExtensions?: boolean;
    resolveJsonModule?: boolean;
    verbatimModuleSyntax?: boolean;
    types?: string[];
  };
};

const FALLBACK_REACT_TYPE_LIBS = [
  {
    virtualPath: 'node_modules/@types/react/index.d.ts',
    content: `
declare namespace React {
  type ReactNode = unknown;
  interface Attributes {
    key?: string | number;
  }
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react' {
  export = React;
}
`,
  },
  {
    virtualPath: 'node_modules/@types/react/jsx-runtime.d.ts',
    content: `
declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }

  export const Fragment: unique symbol;
  export function jsx(type: any, props: any, key?: string): JSX.Element;
  export function jsxs(type: any, props: any, key?: string): JSX.Element;
}
`,
  },
  {
    virtualPath: 'node_modules/@types/react/jsx-dev-runtime.d.ts',
    content: `
declare module 'react/jsx-dev-runtime' {
  export namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }

  export const Fragment: unique symbol;
  export function jsxDEV(type: any, props: any, key: string | undefined, isStaticChildren: boolean, source: any, self: any): JSX.Element;
}
`,
  },
] as const;

function normalizeProjectPath(input: string): string {
  return input.replace(/^\.?\//, '').replace(/\\/g, '/');
}

function dirnamePosix(filePath: string): string {
  const normalized = normalizeProjectPath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.slice(0, idx);
}

function resolveProjectPath(baseDir: string, relativePath: string): string {
  const normalizedBase = normalizeProjectPath(baseDir);
  const normalizedRelative = normalizeProjectPath(relativePath);
  const input = normalizedBase ? `${normalizedBase}/${normalizedRelative}` : normalizedRelative;
  const parts = input.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  return resolved.join('/');
}

function stripJsonComments(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
}

function deriveCompilerOptionsFromProjectFiles(
  projectFiles: EditorProjectFile[],
  activePath: string | undefined,
) {
  const tsconfigEntries = projectFiles
    .filter((file) => file.path.endsWith('tsconfig.json'))
    .sort((a, b) => b.path.length - a.path.length);

  const matchingConfig = tsconfigEntries.find((entry) => {
    const rootDir = dirnamePosix(entry.path);
    return activePath ? activePath.startsWith(rootDir ? `${rootDir}/` : '') : rootDir === '';
  }) ?? tsconfigEntries[0];

  if (!matchingConfig) {
    return {
      baseUrl: 'file:///',
      paths: { '@/*': ['src/*'] },
      jsx: 'react-jsx' as const,
      jsxImportSource: 'react',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      verbatimModuleSyntax: false,
      types: ['react', 'react-dom'],
    };
  }

  try {
    const parsed = JSON.parse(stripJsonComments(matchingConfig.content)) as TsConfigLike;
    const compilerOptions = parsed.compilerOptions ?? {};
    const configRoot = dirnamePosix(matchingConfig.path);
    const resolvedBaseUrl = resolveProjectPath(configRoot, compilerOptions.baseUrl ?? '.');
    const resolvedPaths = Object.fromEntries(
      Object.entries(compilerOptions.paths ?? {}).map(([key, values]) => [
        key,
        values.map((value) => resolveProjectPath(configRoot, value)),
      ]),
    );

    return {
      baseUrl: `file:///${resolvedBaseUrl}`,
      paths: Object.keys(resolvedPaths).length > 0 ? resolvedPaths : { '@/*': ['src/*'] },
      jsx: compilerOptions.jsx ?? ('react-jsx' as const),
      jsxImportSource: compilerOptions.jsxImportSource ?? 'react',
      allowImportingTsExtensions: compilerOptions.allowImportingTsExtensions ?? true,
      resolveJsonModule: compilerOptions.resolveJsonModule ?? true,
      verbatimModuleSyntax: compilerOptions.verbatimModuleSyntax ?? false,
      types: compilerOptions.types ?? [],
    };
  } catch {
    return {
      baseUrl: 'file:///',
      paths: { '@/*': ['src/*'] },
      jsx: 'react-jsx' as const,
      jsxImportSource: 'react',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      verbatimModuleSyntax: false,
      types: ['react', 'react-dom'],
    };
  }
}

export function EditorPane({ tab, readOnly = false, onChange, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [resolvedThemeId, setResolvedThemeId] = useState<'vs' | 'vs-dark' | 'hc-black' | string>('vs-dark');
  const [preparingEditor, setPreparingEditor] = useState(true);
  const [hoverLoading, setHoverLoading] = useState<{ top: number; left: number; label: string } | null>(null);
  const pendingJump = useEditorStore((s) => s.pendingJump);
  const setPendingJump = useEditorStore((s) => s.setPendingJump);
  const monaco = useMonaco();
  const workspace = useWorkspaceStore((s) => s.workspace);
  const { openFile } = useEditor();
  const installedThemes = useAppearanceStore((s) => s.installedThemes);
  const installedIconThemes = useAppearanceStore((s) => s.installedIconThemes);
  const activeThemeId = useAppearanceStore((s) => s.activeThemeId);
  const activeIconThemeId = useAppearanceStore((s) => s.activeIconThemeId);
  const installThemeStore = useAppearanceStore((s) => s.installTheme);
  const installIconThemeStore = useAppearanceStore((s) => s.installIconTheme);
  const setActiveTheme = useAppearanceStore((s) => s.setActiveTheme);
  const setActiveIconTheme = useAppearanceStore((s) => s.setActiveIconTheme);
  const activeTheme = activeThemeId === DEFAULT_EDITOR_THEME_ID
    ? null
    : installedThemes.find((theme) => theme.id === activeThemeId) ?? null;

  useEffect(() => {
    if (!workspace) {
      setPreparingEditor(true);
      return;
    }

    if (!monaco) {
      setPreparingEditor(true);
      return;
    }

    setPreparingEditor(true);

    let cancelled = false;
    void Promise.all([fetchTypes(workspace), fetchProjectFiles(workspace)]).then(([types, projectFiles]) => {
      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ts = monaco.languages.typescript as any;
      const projectCompilerOptions = deriveCompilerOptionsFromProjectFiles(projectFiles, tab?.path);
      const jsxMode = projectCompilerOptions.jsx === 'react'
        ? ts.JsxEmit.React
        : projectCompilerOptions.jsx === 'preserve'
          ? ts.JsxEmit.Preserve
          : ts.JsxEmit.ReactJSX;
      const opts: Parameters<typeof ts.typescriptDefaults.setCompilerOptions>[0] = {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler ?? ts.ModuleResolutionKind.NodeJs,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        jsx: jsxMode,
        jsxImportSource: projectCompilerOptions.jsxImportSource,
        strict: false,
        noEmit: true,
        skipLibCheck: true,
        allowNonTsExtensions: true,
        allowImportingTsExtensions: projectCompilerOptions.allowImportingTsExtensions,
        allowJs: true,
        resolveJsonModule: projectCompilerOptions.resolveJsonModule,
        verbatimModuleSyntax: projectCompilerOptions.verbatimModuleSyntax,
        target: ts.ScriptTarget.ES2022,
        baseUrl: projectCompilerOptions.baseUrl,
        types: Array.from(new Set([
          ...projectCompilerOptions.types,
          'react',
          'react-dom',
        ])),
        paths: {
          ...projectCompilerOptions.paths,
          react: ['node_modules/@types/react/index.d.ts', 'web/node_modules/@types/react/index.d.ts'],
          'react/jsx-runtime': ['node_modules/@types/react/jsx-runtime.d.ts', 'web/node_modules/@types/react/jsx-runtime.d.ts'],
          'react/jsx-dev-runtime': ['node_modules/@types/react/jsx-dev-runtime.d.ts', 'web/node_modules/@types/react/jsx-dev-runtime.d.ts'],
          'react-dom': ['node_modules/@types/react-dom/index.d.ts', 'web/node_modules/@types/react-dom/index.d.ts'],
        },
      };
      ts.typescriptDefaults.setCompilerOptions(opts);
      ts.javascriptDefaults.setCompilerOptions(opts);
      ts.typescriptDefaults.setEagerModelSync(true);
      ts.javascriptDefaults.setEagerModelSync(true);

      const hasReactJsxRuntime = types.some((entry) => entry.virtualPath.includes('@types/react/jsx-runtime.d.ts'));
      const typeLibs = hasReactJsxRuntime ? types : [...types, ...FALLBACK_REACT_TYPE_LIBS];

      for (const { virtualPath, content } of typeLibs) {
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
      setPreparingEditor(false);
    }).catch(() => {
      if (!cancelled) setPreparingEditor(false);
    });

    return () => {
      cancelled = true;
    };
  }, [monaco, workspace, tab?.path]);

  useEffect(() => {
    if (!activeTheme) {
      setResolvedThemeId('vs-dark');
      return;
    }

    if (!monaco) {
      setResolvedThemeId(activeTheme.uiTheme);
      return;
    }

    const monacoThemeName = getMonacoThemeName(activeTheme);
    monaco.editor.defineTheme(monacoThemeName, buildMonacoThemeData(activeTheme));
    setResolvedThemeId(monacoThemeName);
  }, [activeTheme, monaco]);

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (tab?.kind !== 'extension' && tab && !readOnly) onSave(tab.path);
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
    const hoverTimer = { current: null as ReturnType<typeof setTimeout> | null };
    let hoverRequestId = 0;

    function clearHoverLoading() {
      if (hoverTimer.current !== null) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
      setHoverLoading(null);
    }

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
    ed.onMouseLeave(() => {
      clearHoverLoading();
    });
    ed.onDidBlurEditorText(() => {
      clearHoverLoading();
    });
    ed.onMouseMove((event) => {
      clearHoverLoading();
      if (!event.target.position || !containerRef.current) return;
      if (!monaco || tab?.kind === 'extension') return;
      if (event.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT) return;
      const model = ed.getModel();
      if (!model) return;
      const word = model.getWordAtPosition(event.target.position);
      if (!word || word.word.trim().length < 2) return;
      const language = detectLanguage(tab?.name ?? '');
      if (language !== 'typescript' && language !== 'javascript') return;

      const rect = containerRef.current.getBoundingClientRect();
      const requestId = ++hoverRequestId;
      const clientX = event.event.browserEvent.clientX;
      const clientY = event.event.browserEvent.clientY;

      hoverTimer.current = setTimeout(() => {
        if (requestId !== hoverRequestId) return;
        setHoverLoading({
          left: clientX - rect.left + 12,
          top: clientY - rect.top + 18,
          label: 'Loading symbol info...',
        });
      }, 350);

      void (async () => {
        try {
          // Monaco exposes the TS worker at runtime, but the bundled typings lag behind here.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tsApi = monaco.languages.typescript as any;
          const workerFactory = await tsApi.getTypeScriptWorker();
          const worker = await workerFactory(model.uri);
          const offset = model.getOffsetAt(event.target.position!);
          await worker.getQuickInfoAtPosition(model.uri.toString(), offset);
        } catch {
          // ignore hover worker failures
        } finally {
          if (requestId !== hoverRequestId) return;
          clearHoverLoading();
        }
      })();
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

  if (tab.kind === 'extension' && tab.extensionDetail) {
    const extensionId = tab.extensionDetail.extension.id;
    const installedTheme = installedThemes.find((theme) => theme.extensionId === extensionId) ?? null;
    const installedIconTheme = installedIconThemes.find((theme) => theme.extensionId === extensionId) ?? null;
    let installedAction: InstalledExtensionAction | null = null;

    if (installedTheme) {
      installedAction = {
        applyLabel: 'Set Color Theme',
        active: activeThemeId === installedTheme.id,
        onApply: () => setActiveTheme(installedTheme.id),
      };
    } else if (installedIconTheme) {
      installedAction = {
        applyLabel: 'Set File Icon Theme',
        active: activeIconThemeId === installedIconTheme.id,
        onApply: () => setActiveIconTheme(installedIconTheme.id),
      };
    }

    const canInstall = !installedTheme && !installedIconTheme && tab.extensionDetail.installSupport.supported;

    async function handleInstall() {
      setInstallingId(extensionId);
      try {
        const payload = await installExtension(extensionId);
        for (const theme of payload.themes) installThemeStore(theme);
        for (const iconTheme of payload.iconThemes) installIconThemeStore(iconTheme);
        toast.success(`${payload.displayName} instalada`);
      } catch (error) {
        const message = axios.isAxiosError<{ message?: string }>(error)
          ? error.response?.data?.message
          : null;
        toast.error(message ?? 'Falha ao instalar extensão');
      } finally {
        setInstallingId(null);
      }
    }

    return (
      <ExtensionDetailView
        detail={tab.extensionDetail}
        installing={installingId === extensionId}
        canInstall={canInstall}
        installedAction={installedAction}
        onInstall={() => void handleInstall()}
      />
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

  if (tab.isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex-1 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span>{tab.loadingLabel ?? 'Carregando...'}</span>
          </div>
          <Skeleton className="mb-3 h-4 w-72" />
          <Skeleton className="mb-3 h-4 w-64" />
          <Skeleton className="mb-3 h-4 w-80" />
          <Skeleton className="mb-3 h-4 w-56" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full">
      <Editor
        key={tab.path}
        height="100%"
        path={`file:///${tab.path}`}
        theme={resolvedThemeId}
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
      {preparingEditor && tab.kind !== 'extension' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/92 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card/95 p-4 shadow-lg">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Preparing editor
            </div>
            <Skeleton className="mb-2 h-4 w-56" />
            <Skeleton className="mb-2 h-4 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      )}
      {hoverLoading && (
        <div
          className={cn(
            'pointer-events-none absolute z-30 rounded-md border bg-popover/95 px-2 py-1 text-xs text-popover-foreground shadow-lg',
          )}
          style={{ top: hoverLoading.top, left: hoverLoading.left }}
        >
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span>{hoverLoading.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
