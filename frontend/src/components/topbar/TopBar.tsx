import { useState } from 'react';
import { Film, Download, Undo2, Redo2, Scissors, Hand, MousePointer2, LogOut, Sun, Moon, RefreshCw, ChevronDown, UserCircle, Mail, Briefcase } from 'lucide-react';
import { commandManager } from '../../state/commands/CommandManager';
import { useUIStore } from '../../state/uiStore';
import { api, setTokens } from '../../services/api';
import { useToast } from '../ui/toast';

interface TopBarProps {
  user: { id: string; name: string; email: string; avatarUrl?: string | null; workspaces?: Array<{ id: string; name: string; plan: string; role: string }> };
  project: { id: string; name: string } | null;
  projects: Array<{ id: string; name: string }>;
  onProjectChange: (id: string) => void;
  onLogout: () => void;
}

function getUserPlan(user: TopBarProps['user']): string {
  const ws = user.workspaces?.[0];
  return ws?.plan || 'free';
}

export function TopBar({ user, project, projects, onProjectChange, onLogout }: TopBarProps) {
  const { activeTool, setActiveTool, theme, toggleTheme } = useUIStore();
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { notify } = useToast();
  const plan = getUserPlan(user);
  const isPro = plan === 'pro' || plan === 'team';
  const currentWorkspace = user.workspaces?.[0];

  const resolveDownloadUrl = (outputUrl?: string | null) => {
    if (!outputUrl) return '';
    if (/^https?:\/\//i.test(outputUrl)) return outputUrl;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return `${baseUrl}/${outputUrl.replace(/^\/+/, '')}`;
  };

  const waitForExport = async (exportId: string) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const job = await api.exports.get(exportId);
      setExportProgress(job.progressPercent ?? 0);
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return api.exports.get(exportId);
  };

  const downloadExportFile = async (downloadUrl: string, exportId: string) => {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `cloudcut-export-${exportId}.mp4`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const resolution = isPro ? '1080p' : '720p';
      const exportJob = await api.exports.create(project.id, {
        format: 'mp4',
        resolution,
        quality: 'standard',
        idempotencyKey: `ui-export-${project.id}-${resolution}-standard-${Date.now()}`,
      });
      const completedJob = await waitForExport(exportJob.id);
      if (completedJob.status === 'completed') {
        const downloadUrl = resolveDownloadUrl(completedJob.outputUrl);
        if (downloadUrl) {
          await downloadExportFile(downloadUrl, completedJob.id);
          notify({
            title: 'Export completed',
            description: `Download started: cloudcut-export-${completedJob.id}.mp4`,
            variant: 'success',
          });
        } else {
          notify({
            title: 'Export completed',
            description: 'No download URL was returned by the API.',
            variant: 'info',
          });
        }
        return;
      }
      if (completedJob.status === 'failed') {
        throw new Error(completedJob.errorMessage || 'Export job failed');
      }
      if (completedJob.status === 'cancelled') {
        throw new Error('Export job was cancelled');
      }
      notify({
        title: 'Export is still processing',
        description: `${completedJob.progressPercent ?? 0}% complete. Check the exports panel again in a moment.`,
        variant: 'info',
      });
    } catch (e: unknown) {
      notify({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleRefreshSession = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;
    const tokens = await api.auth.refresh(refreshToken);
    setTokens(tokens.accessToken, tokens.refreshToken);
  };

  const tools = [
    { id: 'select' as const, icon: MousePointer2, title: 'Select (V)' },
    { id: 'blade' as const, icon: Scissors, title: 'Blade (B)' },
    { id: 'hand' as const, icon: Hand, title: 'Hand (H)' },
  ];

  return (
    <div className="h-12 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <Film className="w-5 h-5 text-blue-400" />
        <span className="font-bold text-sm text-foreground">CloudCut</span>
      </div>

      <div className="w-px h-6 bg-border" />

      {project && (
        <div className="flex items-center gap-2 min-w-0">
          <span data-testid="project-title" className="text-xs font-medium text-foreground truncate max-w-40">{project.name}</span>
          <select
            aria-label="Project"
            value={project.id}
            onChange={(e) => onProjectChange(e.target.value)}
            className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {!projects.find((p) => p.id === project.id) && (
              <option value={project.id}>{project.name}</option>
            )}
          </select>
        </div>
      )}

      <div className="w-px h-6 bg-border" />

      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={tool.title}
            className={`p-1.5 rounded transition-colors ${
              activeTool === tool.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <tool.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border" />

      <div className="flex items-center gap-1">
        <button
          onClick={() => commandManager.undo()}
          disabled={!commandManager.canUndo()}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => commandManager.redo()}
          disabled={!commandManager.canRedo()}
          title="Redo (Ctrl+Shift+Z)"
          className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1" />

      <button
        onClick={handleExport}
        disabled={exporting || !project}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        {exporting ? `Exporting ${exportProgress ?? 0}%` : 'Export'}
      </button>

      <div className="flex items-center rounded border border-border bg-background p-0.5">
        <button
          onClick={() => theme !== 'light' && toggleTheme()}
          title="Light mode"
          className={`p-1.5 rounded transition-colors ${theme === 'light' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Sun className="w-4 h-4" />
        </button>
        <button
          onClick={() => theme !== 'dark' && toggleTheme()}
          title="Dark mode"
          className={`p-1.5 rounded transition-colors ${theme === 'dark' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Moon className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={handleRefreshSession}
        title="Refresh session"
        className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setProfileOpen((open) => !open)}
          className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-accent transition-colors"
          aria-expanded={profileOpen}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-bold">
              {user.name[0]}
            </div>
          )}
          <div className="flex flex-col items-start hidden sm:flex">
            <span className="text-xs text-muted-foreground leading-tight">{user.name}</span>
            <span className={`text-[10px] px-1 rounded leading-tight ${isPro ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
              {plan.toUpperCase()}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-11 z-50 w-64 rounded-md border border-border bg-card p-3 shadow-xl">
            <div className="mb-3 flex items-center gap-3">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-10 w-10 rounded-full" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-sm text-white font-bold">
                  {user.name[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="space-y-2 rounded bg-muted/40 p-2 text-xs">
              <div className="flex items-center gap-2">
                <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">User ID</span>
                <span className="ml-auto max-w-[100px] truncate font-mono text-foreground">{user.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Email</span>
                <span className="ml-auto max-w-[130px] truncate text-foreground">{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Workspace</span>
                <span className="ml-auto max-w-[110px] truncate text-foreground">{currentWorkspace?.name || 'None'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Role</span>
                <span className="ml-auto text-foreground">{currentWorkspace?.role || 'member'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Plan</span>
                <span className={`ml-auto rounded px-1.5 py-0.5 ${isPro ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {plan.toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground hover:opacity-90"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
