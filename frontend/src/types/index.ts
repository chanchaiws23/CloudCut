export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'team';
  ownerId: string;
  role?: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  settings: { resolution: string; fps: number; aspectRatio: string };
  createdById: string;
  createdAt: string;
  updatedAt: string;
  tracks?: Track[];
  clips?: Clip[];
  transitions?: Transition[];
  textOverlays?: TextOverlay[];
}

export interface Asset {
  id: string;
  projectId: string;
  uploadedById: string;
  type: 'video' | 'audio' | 'image';
  originalUrl: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  metadata?: {
    duration_ms?: number;
    width?: number;
    height?: number;
    codec?: string;
    file_size_bytes?: number;
  };
  variants?: AssetVariant[];
}

export interface AssetVariant {
  id: string;
  assetId: string;
  type: 'proxy' | 'thumbnail_strip' | 'waveform_data';
  url: string;
  metadata?: Record<string, any>;
}

export interface Track {
  id: string;
  projectId: string;
  type: 'video' | 'audio';
  label: string;
  orderIndex: number;
  isLocked: boolean;
  isMuted: boolean;
  color: string;
}

export interface Clip {
  id: string;
  trackId: string;
  projectId: string;
  assetId?: string;
  trackPositionMs: number;
  inPointMs: number;
  outPointMs: number;
  durationMs: number;
  transform: { x: number; y: number; scale: number; rotation: number; opacity: number };
  deletedAt?: string | null;
  effects?: ClipEffect[];
  asset?: Asset;
}

export interface ClipEffect {
  id: string;
  clipId: string;
  type: string;
  orderIndex: number;
  params: Record<string, any>;
  enabled: boolean;
}

export interface Transition {
  id: string;
  projectId: string;
  fromClipId: string;
  toClipId: string;
  type: 'dissolve' | 'wipe_left' | 'wipe_right' | 'fade';
  durationMs: number;
  params: Record<string, any>;
}

export interface TextOverlay {
  id: string;
  projectId: string;
  trackPositionMs: number;
  durationMs: number;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  positionX: number;
  positionY: number;
  alignment: string;
  animation: string;
}

export interface ExportJob {
  id: string;
  projectId: string;
  format: 'mp4' | 'webm';
  resolution: '720p' | '1080p' | '4k';
  quality: 'draft' | 'standard' | 'high';
  status: 'queued' | 'processing' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progressPercent: number;
  outputUrl?: string;
  errorMessage?: string;
  createdAt: string;
}

export type ActiveTool = 'select' | 'blade' | 'hand';
