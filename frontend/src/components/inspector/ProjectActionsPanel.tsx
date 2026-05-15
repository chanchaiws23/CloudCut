import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { usePlaybackStore } from '../../state/playbackStore';
import { useProjectStore } from '../../state/projectStore';
import { useUIStore } from '../../state/uiStore';
import type { ExportJob, Track } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface ProjectActionsPanelProps {
  projectId: string;
  onProjectCreated?: (project: { id: string; name: string }) => void;
}

const roleOptions = ['viewer', 'editor', 'admin'] as const;

export function ProjectActionsPanel({ projectId, onProjectCreated }: ProjectActionsPanelProps) {
  const { project, tracks, clips, transitions, textOverlays, loadProject } = useProjectStore();
  const { selectedClipIds } = useUIStore();
  const { currentTimeMs } = usePlaybackStore();
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [exportDetail, setExportDetail] = useState<ExportJob | null>(null);
  const [versions, setVersions] = useState<Array<{ id: string; payload: Record<string, unknown>; createdAt: string }>>([]);
  const [workspace, setWorkspace] = useState<{ id: string; members?: Array<{ userId: string; role: string; user?: { name?: string; email?: string } }> } | null>(null);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [presenceCount, setPresenceCount] = useState(0);
  const [operationCount, setOperationCount] = useState(0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [newProjectName, setNewProjectName] = useState('Untitled Project');
  const [newWorkspaceName, setNewWorkspaceName] = useState('New Workspace');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProjectName(project?.name || '');
  }, [project?.id, project?.name]);

  const refresh = async () => {
    if (!project) return;
    const [exportJobs, versionRows, workspaceDetails] = await Promise.all([
      api.exports.list(projectId).catch(() => []),
      api.projects.versions(projectId).catch(() => []),
      api.workspaces.get(project.workspaceId).catch(() => null),
    ]);
    const exportList = ((exportJobs as any).data || exportJobs) as ExportJob[];
    setExports(exportList);
    setVersions(versionRows);
    setWorkspace(workspaceDetails);
    const [workspaces, presence, operations, latestExport] = await Promise.all([
      api.workspaces.list().catch(() => []),
      api.collaboration.getPresence(projectId).catch(() => []),
      api.collaboration.getOperations(projectId, 0).catch(() => []),
      exportList[0] ? api.exports.get(exportList[0].id).catch(() => null) : Promise.resolve(null),
    ]);
    setWorkspaceCount(((workspaces as any).data || workspaces).length || 0);
    setPresenceCount(presence.length || 0);
    setOperationCount(operations.length || 0);
    setExportDetail(latestExport);
  };

  useEffect(() => {
    refresh();
  }, [projectId, project?.workspaceId]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await Promise.all([loadProject(projectId), refresh()]);
    } finally {
      setBusy(false);
    }
  };

  const addTrack = (type: 'video' | 'audio') => run(async () => {
    const orderIndex = tracks.length;
    await api.timeline.createTrack(projectId, {
      type,
      label: `${type === 'video' ? 'V' : 'A'}${tracks.filter((t) => t.type === type).length + 1}`,
      orderIndex,
      color: type === 'video' ? '#3b82f6' : '#22c55e',
    });
  });

  const toggleTrackMute = (track: Track) => run(async () => {
    await api.timeline.updateTrack(projectId, track.id, { isMuted: !track.isMuted });
  });

  const deleteTrack = (track: Track) => run(async () => {
    await api.timeline.deleteTrack(projectId, track.id);
  });

  const addTextOverlay = () => run(async () => {
    await api.timeline.createTextOverlay(projectId, {
      trackPositionMs: Math.round(currentTimeMs),
      durationMs: 5000,
      content: 'New title',
      fontFamily: 'Inter',
      fontSize: 42,
      fontColor: '#ffffff',
      alignment: 'center',
      animation: 'fade_in',
    });
  });

  const addTransition = () => run(async () => {
    if (selectedClipIds.length < 2) return;
    await api.timeline.createTransition(projectId, {
      fromClipId: selectedClipIds[0],
      toClipId: selectedClipIds[1],
      type: 'dissolve',
      durationMs: 500,
      params: {},
    });
  });

  const invite = () => run(async () => {
    if (!project || !inviteEmail.trim()) return;
    await api.workspaces.invite(project.workspaceId, { email: inviteEmail.trim(), role: 'editor' });
    setInviteEmail('');
  });

  const saveProject = () => run(async () => {
    if (!project || !projectName.trim()) return;
    await api.projects.update(projectId, { name: projectName.trim(), settings: project.settings });
  });

  const createProject = () => run(async () => {
    if (!project || !newProjectName.trim()) return;
    const created = await api.projects.create({
      workspaceId: project.workspaceId,
      name: newProjectName.trim(),
      settings: project.settings,
    });
    onProjectCreated?.(created);
  });

  const duplicateProject = () => run(async () => {
    const duplicated = await api.projects.duplicate(projectId);
    onProjectCreated?.(duplicated);
  });

  const createWorkspaceWithProject = () => run(async () => {
    if (!newWorkspaceName.trim()) return;
    const slug = `${newWorkspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
    const workspace = await api.workspaces.create({ name: newWorkspaceName.trim(), slug, plan: 'free' });
    const created = await api.projects.create({
      workspaceId: workspace.id,
      name: `${newWorkspaceName.trim()} Project`,
      settings: { resolution: '1920x1080', fps: 30, aspectRatio: '16:9' },
    });
    onProjectCreated?.(created);
  });

  const deleteProject = () => run(async () => {
    if (!confirm('Delete this project?')) return;
    await api.projects.delete(projectId);
  });

  const updateTextOverlay = (overlayId: string, content: string) => run(async () => {
    await api.timeline.updateTextOverlay(projectId, overlayId, { content });
  });

  const deleteTextOverlay = (overlayId: string) => run(async () => {
    await api.timeline.deleteTextOverlay(projectId, overlayId);
  });

  const deleteTransition = (transitionId: string) => run(async () => {
    await api.timeline.deleteTransition(projectId, transitionId);
  });

  const extendTransition = (transitionId: string, durationMs: number) => run(async () => {
    await api.timeline.updateTransition(projectId, transitionId, { durationMs: durationMs + 100 });
  });

  const batchMoveSelected = () => run(async () => {
    const selectedClips = clips.filter((clip) => selectedClipIds.includes(clip.id));
    if (selectedClips.length === 0) return;
    await api.timeline.batchClips(projectId, selectedClips.map((clip) => ({
      clipId: clip.id,
      action: 'move',
      data: { trackPositionMs: clip.trackPositionMs + 1000 },
    })));
  });

  const toDownloadUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return `${base}/${url.replace(/^\/+/, '')}`;
  };

  return (
    <div className="p-3 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Project tools</h3>
          <p className="text-[11px] text-muted-foreground">API-backed project controls</p>
        </div>
        <Button variant="ghost" size="icon" onClick={refresh} disabled={busy} title="Refresh project tools">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <section className="space-y-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Current Project</h4>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <Button variant="secondary" size="sm" onClick={saveProject} disabled={!projectName.trim()}>
            Save
          </Button>
          <Button variant="ghost" size="icon" onClick={deleteProject} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Create</h4>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={createProject}>
            Create Project
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={createWorkspaceWithProject}>
            Create Workspace
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tracks</h4>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => addTrack('video')} className="flex-1">
            + Video Track
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addTrack('audio')} className="flex-1">
            + Audio Track
          </Button>
        </div>
        <div className="space-y-1">
          {tracks.map((track) => (
            <div key={track.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
              <span className="flex-1">{track.label}</span>
              <button onClick={() => toggleTrackMute(track)} className="text-muted-foreground hover:text-foreground">
                {track.isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={() => deleteTrack(track)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => run(async () => { await api.projects.createVersion(projectId); })}>
          <Save className="inline w-3 h-3 mr-1" /> Snapshot
        </Button>
        <Button variant="outline" size="sm" onClick={addTextOverlay}>
          <Plus className="inline w-3 h-3 mr-1" /> Text
        </Button>
        <Button variant="outline" size="sm" onClick={addTransition} disabled={selectedClipIds.length < 2}>
          Dissolve
        </Button>
        <Button variant="outline" size="sm" onClick={duplicateProject}>
          Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={batchMoveSelected} disabled={selectedClipIds.length === 0}>
          Batch +1s
        </Button>
      </section>

      <section className="space-y-1">
        <h4 className="text-muted-foreground">Project State</h4>
        <div className="grid grid-cols-3 gap-1 text-muted-foreground">
          <span>{versions.length} versions</span>
          <span>{exports.length} exports</span>
          <span>{textOverlays.length + transitions.length} edits</span>
          <span>{workspaceCount} workspaces</span>
          <span>{operationCount} ops</span>
          <span>{presenceCount} online</span>
        </div>
        {exports.slice(0, 3).map((job) => (
          <div key={job.id} className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1">
            <span className="flex-1 truncate">{job.status} {job.progressPercent}%</span>
            {job.status === 'completed' && job.outputUrl && (
              <a href={toDownloadUrl(job.outputUrl)} className="text-muted-foreground hover:text-foreground" download>
                Download
              </a>
            )}
            {!['completed', 'failed', 'cancelled'].includes(job.status) && (
              <button onClick={() => run(async () => { await api.exports.cancel(job.id); })} className="text-muted-foreground hover:text-destructive">
                Cancel
              </button>
            )}
          </div>
        ))}
        {exportDetail && (
          <div className="rounded bg-muted/30 px-2 py-1 text-muted-foreground">
            Latest export: {exportDetail.resolution} {exportDetail.quality} {exportDetail.status}
          </div>
        )}
      </section>

      <section className="space-y-1">
        <h4 className="text-muted-foreground">Timeline Objects</h4>
        {transitions.map((transition) => (
          <div key={transition.id} className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1">
            <span className="flex-1 truncate">{transition.type} {transition.durationMs}ms</span>
            <button onClick={() => extendTransition(transition.id, transition.durationMs)} className="text-muted-foreground hover:text-foreground">
              +100ms
            </button>
            <button onClick={() => deleteTransition(transition.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {textOverlays.map((overlay) => (
          <div key={overlay.id} className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1">
            <input
              value={overlay.content}
              onChange={(e) => updateTextOverlay(overlay.id, e.target.value)}
              className="min-w-0 flex-1 rounded bg-input px-2 py-0.5 text-foreground outline-none"
            />
            <button onClick={() => deleteTextOverlay(overlay.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h4 className="text-muted-foreground">Workspace</h4>
        <div className="flex gap-2">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email invite"
            className="min-w-0 flex-1 rounded bg-input px-2 py-1 text-foreground outline-none"
          />
          <button onClick={invite} className="rounded bg-primary px-2 py-1 text-primary-foreground">Invite</button>
        </div>
        <div className="space-y-1">
          {(workspace?.members || []).slice(0, 4).map((member) => (
            <div key={member.userId} className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1">
              <span className="flex-1 truncate">{member.user?.name || member.user?.email}</span>
              <select
                value={member.role}
                disabled={member.role === 'owner'}
                onChange={(e) => run(async () => {
                  await api.workspaces.updateMemberRole(project!.workspaceId, member.userId, { role: e.target.value });
                })}
                className="rounded bg-input px-1 py-0.5"
              >
                {member.role === 'owner' && <option value="owner">owner</option>}
                {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              {member.role !== 'owner' && (
                <button onClick={() => run(async () => {
                  await api.workspaces.removeMember(project!.workspaceId, member.userId);
                })} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
