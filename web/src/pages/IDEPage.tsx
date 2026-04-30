import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useEditorStore } from '@/stores/editorStore';

export default function IDEPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const navigate = useNavigate();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const resetEditor = useEditorStore((s) => s.reset);

  useEffect(() => {
    setWorkspace(workspace ?? null);
    resetEditor();
    return () => {
      setWorkspace(null);
      resetEditor();
    };
  }, [workspace, setWorkspace, resetEditor]);

  if (!workspace) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/repos')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Repositórios
        </Button>
        <span className="text-sm font-medium">{workspace}</span>
      </header>
      <div className="flex-1 overflow-hidden">
        <AppShell workspace={workspace} />
      </div>
    </div>
  );
}
