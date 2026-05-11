import { useState } from 'react';
import { Upload, Video, Music, Image, Loader2 } from 'lucide-react';
import { useProjectStore } from '../../state/projectStore';
import { api } from '../../services/api';
import type { Asset } from '../../types';
import { formatDuration } from '../../utils/timecode';
import { cn } from '../../lib/utils';

interface AssetBrowserProps {
  projectId: string;
}

const STATUS_COLORS: Record<string, string> = {
  uploading: 'text-yellow-400',
  processing: 'text-blue-400',
  ready: 'text-green-400',
  failed: 'text-red-400',
};

const TYPE_ICON = { video: Video, audio: Music, image: Image } as const;

export function AssetBrowser({ projectId }: AssetBrowserProps) {
  const { assets, loadAssets } = useProjectStore();
  const [filter, setFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [uploading, setUploading] = useState(false);

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.type === filter);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const type: 'video' | 'audio' | 'image' = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
      const { assetId, url } = await api.assets.getPresignedUrl({ projectId, fileName: file.name, type });
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
      const token = localStorage.getItem('cloudcut_token') || '';
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      await loadAssets(projectId);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('assetId', asset.id);
    e.dataTransfer.setData('assetType', asset.type);
  };

  const TABS = ['all', 'video', 'audio', 'image'] as const;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assets</span>
        <label className={cn('cursor-pointer p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors', uploading && 'opacity-50')}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <input type="file" accept="video/*,audio/*,image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              'flex-1 py-1 text-[10px] uppercase tracking-wide transition-colors',
              filter === tab ? 'text-foreground border-b-2 border-blue-500' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs gap-2">
            <Upload className="w-6 h-6 opacity-50" />
            <span>No {filter === 'all' ? '' : filter} assets</span>
          </div>
        )}
        {filtered.map((asset) => {
          const Icon = TYPE_ICON[asset.type as keyof typeof TYPE_ICON] || Video;
          const statusColor = STATUS_COLORS[asset.status] || 'text-muted-foreground';
          const durationMs = (asset.metadata as any)?.duration_ms;

          return (
            <div
              key={asset.id}
              draggable={asset.status === 'ready'}
              onDragStart={(e) => handleDragStart(e, asset)}
              className={cn(
                'flex items-center gap-2 p-2 rounded border border-border/50 cursor-grab active:cursor-grabbing transition-colors',
                asset.status === 'ready' ? 'hover:bg-accent' : 'opacity-60 cursor-not-allowed',
              )}
            >
              <div className={cn('shrink-0', statusColor)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{asset.originalUrl.split('/').pop()}</p>
                <p className={cn('text-[10px]', statusColor)}>
                  {asset.status}
                  {durationMs ? ` · ${formatDuration(durationMs)}` : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
