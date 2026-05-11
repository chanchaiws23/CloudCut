import { useState } from 'react';
import { Film, Download, Undo2, Redo2, Scissors, Hand, MousePointer2, LogOut, Sun, Moon } from 'lucide-react';
import { commandManager } from '../../state/commands/CommandManager';
import { useUIStore } from '../../state/uiStore';
import { api } from '../../services/api';

interface TopBarProps {
  user: { id: string; name: string; email: string; avatarUrl?: string; workspaces?: any[] };
  project: any;
  projects: any[];
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
  const plan = getUserPlan(user);
  const isPro = plan === 'pro' || plan === 'team';

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);
    try {
      const resolution = isPro ? '1080p' : '720p';
      await api.exports.create(project.id, { format: 'mp4', resolution, quality: 'standard' });
      alert('Export started! Check the console for progress.');
    } catch (e: any) {
      alert(`Export failed: ${e.response?.data?.message || e.message}`);
    } finally {
      setExporting(false);
    }
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
        <select
          value={project.id}
          onChange={(e) => onProjectChange(e.target.value)}
          className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
        >
          {projects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          {!projects.find((p: any) => p.id === project.id) && (
            <option value={project.id}>{project.name}</option>
          )}
        </select>
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
        {exporting ? 'Exporting...' : 'Export'}
      </button>

      <button
        onClick={toggleTheme}
        title="Toggle theme"
        className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="flex items-center gap-2">
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
        <button onClick={onLogout} title="Sign out" className="p-1 text-muted-foreground hover:text-foreground">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
