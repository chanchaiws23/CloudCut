import { useEffect, useState } from 'react';
import { TopBar } from '../topbar/TopBar';
import { AssetBrowser } from '../assets/AssetBrowser';
import { VideoPlayer } from '../player/VideoPlayer';
import { InspectorPanel } from '../inspector/InspectorPanel';
import { Timeline } from '../timeline/Timeline';
import { CollaboratorList } from '../collaboration/CollaboratorList';
import { UndoHistoryPanel } from '../undo/UndoHistoryPanel';
import { ProjectActionsPanel } from '../inspector/ProjectActionsPanel';
import { useProjectStore } from '../../state/projectStore';
import { api } from '../../services/api';
import { useOperationSync } from '../../hooks/useOperationSync';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import { Button } from '../ui/button';

interface EditorLayoutProps {
  user: { id: string; name: string; email: string; avatarUrl?: string | null; workspaces?: Array<{ id: string; name: string; plan: string; role: string }> };
  onLogout: () => void;
}

export function EditorLayout({ user, onLogout }: EditorLayoutProps) {
  const { loadProject, loadAssets, project, isLoading, error } = useProjectStore();
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);

  useOperationSync(currentProjectId || '', user.id);

  const addProjectToSelector = (created: { id: string; name: string }) => {
    setProjects((items) => [created, ...items.filter((item) => item.id !== created.id)]);
    setCurrentProjectId(created.id);
  };

  useEffect(() => {
    let cancelled = false;

    async function initializeProject() {
      setInitializing(true);
      setStartupError(null);

      try {
        const workspaceResponse: any = await api.workspaces.list();
        const workspaces = workspaceResponse.data || workspaceResponse;
        const workspace = workspaces[0] || user.workspaces?.[0];
        if (!workspace) throw new Error('No workspace found for this account.');

        const res = await api.projects.list(workspace.id);
        let availableProjects = res.data || [];

        if (availableProjects.length === 0) {
          const created = await api.projects.create({
            workspaceId: workspace.id,
            name: 'Untitled Project',
            settings: { resolution: '1920x1080', fps: 30, aspectRatio: '16:9' },
          });
          availableProjects = [created];
        }

        if (!cancelled) {
          setProjects(availableProjects);
          setCurrentProjectId(availableProjects[0].id);
        }
      } catch (e: unknown) {
        if (!cancelled) setStartupError(e instanceof Error ? e.message : 'Failed to load workspace.');
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    initializeProject();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    if (!currentProjectId) return;
    loadProject(currentProjectId);
    loadAssets(currentProjectId);
  }, [currentProjectId, loadAssets, loadProject]);

  if (initializing || (currentProjectId && isLoading && !project)) {
    return (
      <div className="h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading project...
      </div>
    );
  }

  if (startupError || error || !currentProjectId) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-3 text-sm">
        <p className="text-destructive">{startupError || error || 'No project available.'}</p>
        <Button onClick={onLogout}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <TopBar user={user} project={project} projects={projects} onProjectChange={setCurrentProjectId} onLogout={onLogout} />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={60} minSize={30}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={20} minSize={12}>
                <AssetBrowser projectId={currentProjectId} />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={55} minSize={30}>
                <VideoPlayer />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={25} minSize={15}>
                <div className="flex flex-col h-full">
                  <InspectorPanel projectId={currentProjectId} />
                  <div className="border-t border-border flex-1 min-h-0 overflow-y-auto">
                    <ProjectActionsPanel projectId={currentProjectId} onProjectCreated={addProjectToSelector} />
                  </div>
                  <div className="border-t border-border flex-1 min-h-0">
                    <UndoHistoryPanel />
                  </div>
                  <div className="border-t border-border">
                    <CollaboratorList projectId={currentProjectId} />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={40} minSize={20}>
            <Timeline projectId={currentProjectId} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
