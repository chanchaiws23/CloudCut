import { useEffect, useState } from 'react';
import { Grid2X2, List, Search, Upload, Video, Music, Image, Loader2, Trash2, Eye } from 'lucide-react';
import { useProjectStore } from '../../state/projectStore';
import { api } from '../../services/api';
import type { Asset } from '../../types';
import { formatDuration } from '../../utils/timecode';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';

interface AssetBrowserProps {
  projectId: string;
}

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const toMediaUrl = (url: string) => url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

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
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [gridView, setGridView] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const { notify } = useToast();

  const filtered = (filter === 'all' ? assets : assets.filter((a) => a.type === filter))
    .filter((a) => a.originalUrl.toLowerCase().includes(query.toLowerCase()));
  const storageUsed = assets.reduce((sum, asset) => sum + Number((asset.metadata as any)?.file_size_bytes || (asset.metadata as any)?.fileSizeBytes || 0), 0);
  const storageLimit = 1024 * 1024 * 1024;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const type: 'video' | 'audio' | 'image' = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
      const uploadTarget = await api.assets.getPresignedUrl({ projectId, fileName: file.name, type, contentType: file.type });
      if (uploadTarget.uploadMode === 'presigned') {
        await api.assets.uploadToPresignedUrl(uploadTarget.url, file, uploadTarget.headers);
        await api.assets.confirmUpload({ projectId, assetId: uploadTarget.assetId });
      } else {
        const formData = new FormData();
        formData.append('file', file);
        await api.assets.upload(uploadTarget.assetId, formData);
      }
      await loadAssets(projectId);
      notify({
        title: 'Upload started',
        description: `${file.name} was uploaded and queued for processing.`,
        variant: 'success',
      });
    } catch (err: unknown) {
      notify({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('assetId', asset.id);
    e.dataTransfer.setData('assetType', asset.type);
  };

  const handleInspect = async (asset: Asset) => {
    setSelectedAssetId(asset.id);
    await api.assets.get(asset.id).catch(console.error);
  };

  const handleDelete = async (e: React.MouseEvent, asset: Asset) => {
    e.stopPropagation();
    if (!confirm(`Delete ${asset.originalUrl.split('/').pop()}?`)) return;
    await api.assets.delete(asset.id);
    await loadAssets(projectId);
  };

  const TABS = ['all', 'video', 'audio', 'image'] as const;

  useEffect(() => {
    loadAssets(projectId, filter).catch(console.error);
  }, [projectId, filter, loadAssets]);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assets</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setGridView((value) => !value)} className="h-7 w-7 text-muted-foreground" title="Toggle view">
            {gridView ? <List className="w-3.5 h-3.5" /> : <Grid2X2 className="w-3.5 h-3.5" />}
          </Button>
          <label className={cn('cursor-pointer p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors', uploading && 'opacity-50')}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <input type="file" accept="video/*,audio/*,image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="px-2 py-2 border-b border-border space-y-2">
        <div className="flex items-center gap-1 rounded border border-border bg-input px-2">
          <Search className="w-3 h-3 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="space-y-1">
          <div className="h-1 rounded bg-muted overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (storageUsed / storageLimit) * 100)}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground">{(storageUsed / 1024 / 1024).toFixed(1)} MB / 1024 MB</p>
        </div>
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

      <div className={cn('flex-1 overflow-y-auto p-2', gridView ? 'grid grid-cols-2 gap-2 content-start' : 'space-y-1')}>
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
              onClick={() => handleInspect(asset)}
              onDragStart={(e) => handleDragStart(e, asset)}
              className={cn(
                'flex items-center gap-2 p-2 rounded border border-border/50 cursor-grab active:cursor-grabbing transition-colors',
                asset.status === 'ready' ? 'hover:bg-accent' : 'opacity-60 cursor-not-allowed',
                selectedAssetId === asset.id && 'border-blue-500 bg-blue-500/10',
              )}
            >
              <div className={cn('shrink-0', statusColor)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{asset.originalUrl.split('/').pop()}</p>
                <p className={cn('text-[10px]', statusColor)}>
                  {asset.status}
                  {durationMs ? ` - ${formatDuration(durationMs)}` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewAsset(asset);
                }}
                className="h-6 w-6 text-muted-foreground"
                title="Preview asset"
              >
                <Eye className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDelete(e, asset)}
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                title="Delete asset"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setPreviewAsset(null)}>
          <div className="w-full max-w-2xl rounded border border-border bg-card p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="truncate text-xs text-foreground">{previewAsset.originalUrl.split('/').pop()}</p>
              <Button variant="ghost" size="sm" onClick={() => setPreviewAsset(null)}>Close</Button>
            </div>
            {previewAsset.type === 'video' ? (
              <video src={toMediaUrl(previewAsset.originalUrl)} controls className="max-h-[70vh] w-full bg-black" />
            ) : previewAsset.type === 'audio' ? (
              <audio src={toMediaUrl(previewAsset.originalUrl)} controls className="w-full" />
            ) : (
              <img src={toMediaUrl(previewAsset.originalUrl)} className="max-h-[70vh] w-full object-contain" alt="" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
