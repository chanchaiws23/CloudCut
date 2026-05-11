import { useEffect, useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { TopBar } from '../topbar/TopBar';
import { AssetBrowser } from '../assets/AssetBrowser';
import { VideoPlayer } from '../player/VideoPlayer';
import { InspectorPanel } from '../inspector/InspectorPanel';
import { Timeline } from '../timeline/Timeline';
import { CollaboratorList } from '../collaboration/CollaboratorList';
import { UndoHistoryPanel } from '../undo/UndoHistoryPanel';
import { useProjectStore } from '../../state/projectStore';
import { api } from '../../services/api';

const DEMO_PROJECT_ID = '00000000-0000-0000-0000-000000000020';

interface EditorLayoutProps {
  user: { id: string; name: string; email: string; avatarUrl?: string };
  onLogout: () => void;
}

export function EditorLayout({ user, onLogout }: EditorLayoutProps) {
  const { loadProject, loadAssets, project } = useProjectStore();
  const [projects, setProjects] = useState<any[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>(DEMO_PROJECT_ID);

  useEffect(() => {
    loadProject(currentProjectId);
    loadAssets(currentProjectId);
  }, [currentProjectId]);

  useEffect(() => {
    api.workspaces.list().then((ws: any[]) => {
      if (ws.length > 0) {
        api.projects.list(ws[0].id).then((res: any) => setProjects(res.data || []));
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <TopBar user={user} project={project} projects={projects} onProjectChange={setCurrentProjectId} onLogout={onLogout} />
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical">
          <Panel defaultSize={60} minSize={30}>
            <PanelGroup direction="horizontal">
              <Panel defaultSize={20} minSize={12}>
                <AssetBrowser projectId={currentProjectId} />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
              <Panel defaultSize={55} minSize={30}>
                <VideoPlayer />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
              <Panel defaultSize={25} minSize={15}>
                <div className="flex flex-col h-full">
                  <InspectorPanel projectId={currentProjectId} />
                  <div className="border-t border-border flex-1 min-h-0">
                    <UndoHistoryPanel />
                  </div>
                  <div className="border-t border-border">
                    <CollaboratorList projectId={currentProjectId} />
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
          <PanelResizeHandle className="h-1 bg-border hover:bg-primary/30 transition-colors" />
          <Panel defaultSize={40} minSize={20}>
            <Timeline projectId={currentProjectId} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
