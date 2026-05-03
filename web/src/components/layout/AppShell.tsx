import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Blocks, Check, Clock3, Files, GitFork, Github, LogOut, MessageSquare, Search, Settings2, TerminalSquare, User, WrapText, X } from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { FileTree } from '@/components/file-tree/FileTree';
import { EditorBreadcrumbs } from '@/components/editor/EditorBreadcrumbs';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { EditorPane } from '@/components/editor/EditorPane';
import { GitPanel } from '@/components/git/GitPanel';
import { ExtensionsPanel } from '@/components/extensions/ExtensionsPanel';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import { CodeSearchPanel } from '@/components/shared/CodeSearchPanel';
import { TerminalPane } from '@/components/terminal/TerminalPane';
import { StatusBar } from './StatusBar';
import { useAuth } from '@/hooks/useAuth';
import { useEditor } from '@/hooks/useEditor';
import { useGitStatus } from '@/hooks/useGitStatus';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type SidePanel = 'files' | 'search' | 'git' | 'extensions';

function readSidePanelPreference(): SidePanel {
  try {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return 'files';
    const saved = storage.getItem('ide:side-panel');
    return saved === 'search' || saved === 'git' || saved === 'extensions' ? saved : 'files';
  } catch {
    return 'files';
  }
}

function persistSidePanelPreference(panel: SidePanel) {
  try {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.setItem !== 'function') return;
    storage.setItem('ide:side-panel', panel);
  } catch {
    // ignore persistence failures
  }
}

export function AppShell({ workspace }: { workspace: string }) {
  const { tabs, activePath, openFile, setActive, closeTab: closeTabRaw, updateContent, save } = useEditor();
  const { user, logout } = useAuth();
  const permission = useWorkspaceStore((s) => s.permission);
  const wordWrap = useEditorStore((s) => s.wordWrap);
  const toggleWordWrap = useEditorStore((s) => s.toggleWordWrap);
  const autoSaveMode = useEditorStore((s) => s.autoSaveMode);
  const autoSaveDelayMs = useEditorStore((s) => s.autoSaveDelayMs);
  const setAutoSaveMode = useEditorStore((s) => s.setAutoSaveMode);
  const setAutoSaveDelayMs = useEditorStore((s) => s.setAutoSaveDelayMs);
  const setFontSize = useEditorStore((s) => s.setFontSize);

  const closeTab = useCallback(
    (path: string) => {
      const tab = tabs.find((t) => t.path === path);
      if (tab?.dirty && !window.confirm(`"${tab.name}" tem alterações não salvas. Fechar mesmo assim?`)) return;
      closeTabRaw(path);
    },
    [tabs, closeTabRaw],
  );

  const closeOtherTabs = useCallback(
    (keepPath: string) => {
      const others = tabs.filter((t) => t.path !== keepPath);
      const dirty = others.filter((t) => t.dirty);
      if (dirty.length > 0 && !window.confirm(`${dirty.length} arquivo(s) com alterações não salvas serão fechados. Continuar?`)) return;
      others.forEach((t) => closeTabRaw(t.path));
    },
    [tabs, closeTabRaw],
  );

  const closeAllTabs = useCallback(
    () => {
      const dirty = tabs.filter((t) => t.dirty);
      if (dirty.length > 0 && !window.confirm(`${dirty.length} arquivo(s) com alterações não salvas serão fechados. Continuar?`)) return;
      tabs.forEach((t) => closeTabRaw(t.path));
    },
    [tabs, closeTabRaw],
  );
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const [comparisonPath, setComparisonPath] = useState<string | null>(null);
  const { status: gitStatus } = useGitStatus(workspace);
  const initialSide = readSidePanelPreference();
  const [side, setSideRaw] = useState<SidePanel>(() => {
    return initialSide;
  });
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMounted, setAssistantMounted] = useState(false);
  const setSide = (panel: SidePanel) => {
    setSideRaw(panel);
    persistSidePanelPreference(panel);
  };
  const [showTerminal, setShowTerminal] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'editor' | 'account' | 'terminal'>('editor');
  const fileFilterRef = useRef<HTMLInputElement>(null) as RefObject<HTMLInputElement>;
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const autoSaveTimersRef = useRef<Map<string, number>>(new Map());
  const lastWorkspaceRef = useRef(workspace);
  const gitChangedCount = gitStatus
    ? new Set([
        ...gitStatus.staged.map((file) => file.path),
        ...gitStatus.unstaged.map((file) => file.path),
        ...gitStatus.untracked,
      ]).size
    : 0;
  const resolvedAutoSaveLabel = useMemo(() => {
    if (autoSaveMode !== 'afterDelay') return 'Auto Save desativado';
    return `Auto Save em ${autoSaveDelayMs >= 3000 ? '3s' : '1.2s'}`;
  }, [autoSaveDelayMs, autoSaveMode]);
  const sidebarIconClass = '!h-7 !w-7 stroke-[1.75]';

  useEffect(() => {
    if (permission !== 'write') setShowTerminal(false);
  }, [permission]);

  useEffect(() => {
    if (lastWorkspaceRef.current !== workspace) {
      lastWorkspaceRef.current = workspace;
      setShowTerminal(false);
      setComparisonPath(null);
    }
  }, [workspace]);

  useEffect(() => {
    if (permission !== 'write') setAssistantOpen(false);
  }, [permission]);

  useEffect(() => {
    if (comparisonPath && comparisonPath !== activePath) {
      setComparisonPath(null);
    }
  }, [activePath, comparisonPath]);

  useEffect(() => {
    if (assistantOpen) {
      setAssistantMounted(true);
      return;
    }

    if (!assistantMounted) return;

    const timer = window.setTimeout(() => setAssistantMounted(false), 260);
    return () => window.clearTimeout(timer);
  }, [assistantMounted, assistantOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!settingsMenuRef.current?.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSettingsMenuOpen(false);
        setSettingsDialogOpen(false);
      }
    }

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    const dirtyCount = tabs.filter((t) => t.dirty).length;
    const base = workspace;
    document.title = dirtyCount > 0 ? `● ${base}` : base;
    return () => { document.title = base; };
  }, [tabs, workspace]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '1') { e.preventDefault(); setSide('files'); }
      else if (e.key === '2') { e.preventDefault(); setSide('search'); }
      else if (e.key === '3') { e.preventDefault(); setSide('git'); }
      else if (e.key === '4') { e.preventDefault(); setSide('extensions'); }
      else if (e.key === '5') {
        e.preventDefault();
        if (permission === 'write') setAssistantOpen((current) => !current);
      }
      else if (e.key === 'p') {
        e.preventDefault();
        setSide('files');
        setTimeout(() => fileFilterRef.current?.focus(), 50);
      } else if (e.key === 'w') {
        e.preventDefault();
        const path = activePath;
        if (path) closeTab(path);
      } else if (e.key === '`') {
        e.preventDefault();
        if (permission === 'write') setShowTerminal((v) => !v);
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setFontSize(useEditorStore.getState().fontSize + 1);
      } else if (e.key === '-') {
        e.preventDefault();
        setFontSize(useEditorStore.getState().fontSize - 1);
      } else if (e.key === '0') {
        e.preventDefault();
        setFontSize(13);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const { tabs: allTabs, activePath: ap } = useEditorStore.getState();
        if (allTabs.length < 2) return;
        const idx = allTabs.findIndex((t) => t.path === ap);
        const next = e.shiftKey
          ? allTabs[(idx - 1 + allTabs.length) % allTabs.length]
          : allTabs[(idx + 1) % allTabs.length];
        if (next) useEditorStore.getState().setActive(next.path);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePath, closeTab, setFontSize]);

  useEffect(() => {
    const timers = autoSaveTimersRef.current;

    for (const [path, timer] of timers.entries()) {
      const tab = tabs.find((entry) => entry.path === path);
      const shouldKeep =
        permission === 'write' &&
        autoSaveMode === 'afterDelay' &&
        tab &&
        tab.kind !== 'extension' &&
        tab.dirty;

      if (!shouldKeep) {
        window.clearTimeout(timer);
        timers.delete(path);
      }
    }

    if (permission !== 'write' || autoSaveMode !== 'afterDelay') return;

    for (const tab of tabs) {
      if (tab.kind === 'extension' || !tab.dirty || timers.has(tab.path)) continue;
      const timer = window.setTimeout(() => {
        timers.delete(tab.path);
        void save(tab.path);
      }, autoSaveDelayMs);
      timers.set(tab.path, timer);
    }

    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, [tabs, permission, autoSaveMode, autoSaveDelayMs, save]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="min-w-0 flex-1">
          <TooltipProvider delayDuration={600}>
            <div className="flex h-full w-14 shrink-0 flex-col items-center gap-2 border-r bg-[#191721] py-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Arquivos"
                    aria-keyshortcuts="Ctrl+1"
                    aria-pressed={side === 'files'}
                    className={cn(
                      'h-12 w-12 rounded-xl text-[#d7d4e4] hover:bg-white/6 hover:text-white',
                      side === 'files' && 'bg-white/8 text-[#f5f3ff]',
                    )}
                    onClick={() => setSide('files')}
                  >
                    <Files className={sidebarIconClass} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Arquivos <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+1</kbd> · Filtrar{' '}
                  <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+P</kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Buscar código"
                    aria-keyshortcuts="Ctrl+2"
                    aria-pressed={side === 'search'}
                    className={cn(
                      'h-12 w-12 rounded-xl text-[#d7d4e4] hover:bg-white/6 hover:text-white',
                      side === 'search' && 'bg-white/8 text-[#f5f3ff]',
                    )}
                    onClick={() => setSide('search')}
                  >
                    <Search className={sidebarIconClass} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Buscar código <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+2</kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Git"
                    aria-keyshortcuts="Ctrl+3"
                    aria-pressed={side === 'git'}
                    className={cn(
                      'relative h-12 w-12 rounded-xl text-[#d7d4e4] hover:bg-white/6 hover:text-white',
                      side === 'git' && 'bg-white/8 text-[#f5f3ff]',
                    )}
                    onClick={() => setSide('git')}
                  >
                    <GitFork className={sidebarIconClass} />
                    {gitChangedCount > 0 && (
                      <span className="absolute bottom-1 right-1 min-w-4 rounded-full bg-[#8b5cf6] px-1 text-[10px] font-semibold leading-4 text-white shadow-sm">
                        {gitChangedCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Git <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+3</kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Extensões"
                    aria-keyshortcuts="Ctrl+4"
                    aria-pressed={side === 'extensions'}
                    className={cn(
                      'relative h-12 w-12 rounded-xl text-[#d7d4e4] hover:bg-white/6 hover:text-white',
                      side === 'extensions' && 'bg-white/8 text-[#f5f3ff]',
                    )}
                    onClick={() => setSide('extensions')}
                  >
                    <Blocks className={sidebarIconClass} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Extensões <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+4</kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Chat"
                    aria-keyshortcuts="Ctrl+5"
                    aria-pressed={assistantOpen}
                    disabled={permission !== 'write'}
                    className={cn(
                      'h-12 w-12 rounded-xl text-[#d7d4e4] hover:bg-white/6 hover:text-white',
                      assistantOpen && 'bg-white/8 text-[#f5f3ff]',
                    )}
                    onClick={() => {
                      if (permission === 'write') setAssistantOpen((current) => !current);
                    }}
                  >
                    <MessageSquare className={sidebarIconClass} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {permission === 'write' ? (
                    <>
                      Codex <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+5</kbd>
                    </>
                  ) : (
                    'Codex exige edição habilitada'
                  )}
                </TooltipContent>
              </Tooltip>
              <div className="flex-1" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Terminal"
                    className={cn(
                      'h-12 w-12 rounded-xl text-[#d7d4e4] hover:bg-white/6 hover:text-white',
                      showTerminal && 'bg-white/8 text-[#f5f3ff]',
                    )}
                    onClick={() => setShowTerminal((v) => !v)}
                    disabled={permission !== 'write'}
                  >
                    <TerminalSquare className={sidebarIconClass} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {permission === 'write' ? (
                    <>
                      Terminal <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+`</kbd>
                    </>
                  ) : (
                    'Terminal indisponível em modo somente leitura'
                  )}
                </TooltipContent>
              </Tooltip>
              <div ref={settingsMenuRef} className="relative mt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Conta e configurações"
                      aria-haspopup="menu"
                      aria-expanded={settingsMenuOpen}
                      aria-pressed={settingsMenuOpen}
                      className={cn(
                        'h-12 w-12 rounded-xl text-[#d7d4e4] hover:bg-white/6 hover:text-white',
                        settingsMenuOpen && 'bg-white/8 text-[#f5f3ff]',
                      )}
                      onClick={() => setSettingsMenuOpen((current) => !current)}
                    >
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.login} className="h-8 w-8 rounded-full border border-white/10 object-cover" />
                      ) : (
                        <Github className={sidebarIconClass} />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Conta e configurações</TooltipContent>
                </Tooltip>
                {settingsMenuOpen && !settingsDialogOpen && (
                  <div className="absolute bottom-0 left-full z-50 ml-3 w-64 rounded-xl border border-white/10 bg-[#16151d] p-3 text-sm text-[#e8e4f4] shadow-2xl">
                    <div className="flex items-center gap-3">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.login} className="h-10 w-10 rounded-full border border-white/10 object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
                          <Github className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user?.login ?? 'GitHub'}</p>
                        <p className="truncate text-xs text-[#a59fba]">{resolvedAutoSaveLabel}</p>
                      </div>
                    </div>
                    <Separator className="my-3 bg-white/10" />
                    <div className="space-y-2">
                      <button
                        type="button"
                        aria-label="Configurações"
                        onClick={() => {
                          setSettingsSection('editor');
                          setSettingsDialogOpen(true);
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/8"
                      >
                        <span className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4 text-[#a59fba]" />
                          Configurações
                        </span>
                        <span className="text-xs text-[#a59fba]">Abrir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (autoSaveMode === 'afterDelay') setAutoSaveMode('off');
                          else {
                            setAutoSaveMode('afterDelay');
                            setAutoSaveDelayMs(1200);
                          }
                          setSettingsMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/8"
                      >
                        <span className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-[#a59fba]" />
                          Auto Save
                        </span>
                        <span className="text-xs text-[#a59fba]">{autoSaveMode === 'afterDelay' ? 'Ligado' : 'Off'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          toggleWordWrap();
                          setSettingsMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/8"
                      >
                        <span className="flex items-center gap-2">
                          <WrapText className="h-4 w-4 text-[#a59fba]" />
                          Quebra de linha
                        </span>
                        {wordWrap && <Check className="h-4 w-4 text-[#8b5cf6]" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsMenuOpen(false);
                          void logout();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-rose-200 hover:bg-rose-500/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TooltipProvider>

          <ResizablePanel defaultSize={22} minSize={14} maxSize={45} className="border-r">
            {side === 'files' ? <FileTree workspace={workspace} filterInputRef={fileFilterRef} /> : null}
            {side === 'search' ? <CodeSearchPanel workspace={workspace} /> : null}
            {side === 'git' ? (
              <GitPanel
                workspace={workspace}
                readOnly={permission !== 'write'}
                onOpenFile={(path) => {
                  setComparisonPath(path);
                  void openFile(path);
                }}
              />
            ) : null}
            {side === 'extensions' ? <ExtensionsPanel /> : null}
          </ResizablePanel>
          <ResizableHandle />

          <ResizablePanel defaultSize={78}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={showTerminal ? 65 : 100}>
                <div className="flex h-full flex-col">
                  {permission !== 'write' && (
                    <div className="flex items-center justify-between gap-3 border-b bg-amber-500/10 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-foreground">Modo somente leitura</p>
                        <p className="text-xs text-muted-foreground">
                          Você pode navegar, mas não editar arquivos, usar terminal ou executar ações de Git com escrita.
                        </p>
                      </div>
                      <Badge variant="outline">read</Badge>
                    </div>
                  )}
                  <EditorTabs tabs={tabs} activePath={activePath} onSelect={setActive} onClose={closeTab} onCloseOthers={closeOtherTabs} onCloseAll={closeAllTabs} />
                  <EditorBreadcrumbs path={activeTab?.path ?? null} dirty={activeTab?.dirty} />
                  <div className="flex-1 overflow-hidden">
                    <EditorPane
                      tab={activeTab}
                      readOnly={permission !== 'write'}
                      compareMode={comparisonPath === activeTab?.path}
                      onChange={updateContent}
                      onSave={save}
                    />
                  </div>
                </div>
              </ResizablePanel>
              {showTerminal && permission === 'write' && (
                <>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={35} minSize={15}>
                    <TerminalPane workspace={workspace} />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
        {assistantMounted && (
          <aside
            className={cn(
              'relative z-30 h-full shrink-0 overflow-hidden border-l border-white/10 bg-[#121019] shadow-2xl',
              'transform-gpu transition-[width] duration-300 ease-out',
              assistantOpen ? 'w-[420px]' : 'w-0',
            )}
          >
            <AssistantPanel
              workspace={workspace}
              activePath={activeTab?.path ?? null}
              activeContent={activeTab?.content ?? null}
              canEdit={permission === 'write'}
              onClose={() => setAssistantOpen(false)}
            />
          </aside>
        )}
      </div>
      {settingsDialogOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm">
          <div className="flex h-[78vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[#111015] text-[#ece8f7] shadow-2xl">
            <div className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-[#0d0c12]">
              <div className="flex items-center gap-3 px-5 py-5">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.login} className="h-12 w-12 rounded-full border border-white/10 object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Github className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{user?.login ?? 'GitHub'}</p>
                  <p className="truncate text-xs text-[#9c96ae]">Configurações da conta</p>
                </div>
              </div>
              <div className="px-3">
                {[
                  { id: 'editor', label: 'Editor', icon: Settings2 },
                  { id: 'account', label: 'Minha conta', icon: User },
                  { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = settingsSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSettingsSection(item.id as 'editor' | 'account' | 'terminal')}
                      className={cn(
                        'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                        active ? 'bg-white/10 text-white' : 'text-[#c6c0d8] hover:bg-white/6',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-auto px-3 pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsDialogOpen(false);
                    setSettingsMenuOpen(false);
                    void logout();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-rose-200 transition-colors hover:bg-rose-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div>
                  <h2 className="text-lg font-medium">
                    {settingsSection === 'editor' ? 'Configurações do editor' : settingsSection === 'account' ? 'Minha conta' : 'Terminal'}
                  </h2>
                  <p className="text-sm text-[#9c96ae]">
                    {settingsSection === 'editor'
                      ? 'Ajuste comportamento de edição e salvamento.'
                      : settingsSection === 'account'
                        ? 'Ações da sua conta conectada ao GitHub.'
                        : 'Atalhos e comportamento do terminal integrado.'}
                  </p>
                  <p className="mt-1 text-xs text-[#7f7895]">Pressione Esc para fechar</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsDialogOpen(false)}
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-[#c6c0d8] hover:bg-white/8 hover:text-white"
                  aria-label="Fechar configurações"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {settingsSection === 'editor' && (
                  <div className="max-w-3xl space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-[#0d0c12] p-5">
                      <div className="mb-4">
                        <p className="text-base font-medium">Auto Save</p>
                        <p className="text-sm text-[#9c96ae]">Escolha quando o editor deve salvar alterações automaticamente.</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Desativado', mode: 'off' as const, delay: autoSaveDelayMs },
                          { label: 'Após 1.2s', mode: 'afterDelay' as const, delay: 1200 },
                          { label: 'Após 3s', mode: 'afterDelay' as const, delay: 3000 },
                        ].map((option) => {
                          const active = autoSaveMode === option.mode && (option.mode === 'off' || autoSaveDelayMs === option.delay);
                          return (
                            <button
                              key={option.label}
                              type="button"
                              aria-label={option.label}
                              onClick={() => {
                                setAutoSaveMode(option.mode);
                                if (option.mode === 'afterDelay') setAutoSaveDelayMs(option.delay);
                              }}
                              className={cn(
                                'rounded-xl border px-4 py-4 text-left transition-colors',
                                active
                                  ? 'border-[#8b5cf6] bg-[#8b5cf6]/15 text-white'
                                  : 'border-white/10 bg-white/5 text-[#d7d4e4] hover:bg-white/8',
                              )}
                            >
                              <p className="font-medium">{option.label}</p>
                              <p className="mt-1 text-xs text-[#9c96ae]">
                                {option.mode === 'off' ? 'Salvamento manual com Ctrl+S.' : 'Salva arquivos alterados automaticamente.'}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#0d0c12] p-5">
                      <div className="mb-4">
                        <p className="text-base font-medium">Layout de edição</p>
                        <p className="text-sm text-[#9c96ae]">Preferências rápidas para leitura e navegação.</p>
                      </div>
                      <button
                        type="button"
                        onClick={toggleWordWrap}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/8"
                      >
                        <span className="flex items-center gap-3">
                          <WrapText className="h-4 w-4 text-[#a59fba]" />
                          Quebra de linha
                        </span>
                        {wordWrap && <Check className="h-4 w-4 text-[#8b5cf6]" />}
                      </button>
                    </div>
                  </div>
                )}
                {settingsSection === 'account' && (
                  <div className="max-w-3xl space-y-6">
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0c12]">
                      <div className="h-28 bg-gradient-to-r from-[#6d4aff] to-[#7c52f8]" />
                      <div className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="flex items-center gap-4">
                          {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.login} className="-mt-12 h-20 w-20 rounded-full border-4 border-[#0d0c12] object-cover shadow-lg" />
                          ) : (
                            <div className="-mt-12 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#0d0c12] bg-white/10 shadow-lg">
                              <Github className="h-8 w-8" />
                            </div>
                          )}
                          <div>
                            <p className="text-xl font-semibold">{user?.login ?? 'GitHub'}</p>
                            <p className="text-sm text-[#9c96ae]">Conta conectada para repositórios, permissões e autenticação.</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="border-white/10 bg-white/5 text-[#ece8f7] hover:bg-white/8"
                          onClick={() => {
                            setSettingsDialogOpen(false);
                            setSettingsMenuOpen(false);
                            void logout();
                          }}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Sair
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {settingsSection === 'terminal' && (
                  <div className="max-w-3xl space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-[#0d0c12] p-5">
                      <p className="mb-4 text-base font-medium">Atalhos do terminal</p>
                      <div className="space-y-3 text-sm text-[#d7d4e4]">
                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <span>Mostrar/ocultar terminal</span>
                          <kbd className="rounded border border-white/10 px-2 py-1 text-xs">Ctrl+`</kbd>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <span>Copiar seleção</span>
                          <kbd className="rounded border border-white/10 px-2 py-1 text-xs">Ctrl+Alt+C</kbd>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <span>Selecionar texto horizontalmente</span>
                          <kbd className="rounded border border-white/10 px-2 py-1 text-xs">Shift + ←/→</kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <StatusBar workspace={workspace} />
    </div>
  );
}
