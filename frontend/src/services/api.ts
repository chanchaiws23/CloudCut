import type {
  AuthResponse, TokenResponse, UserWithWorkspaces,
  Workspace, Project, PaginatedResponse,
  Asset, PresignedUrlResponse, SplitClipResponse,
  Track, Clip, ClipEffect, Transition, TextOverlay,
  ExportJob,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function getAccessToken() {
  return accessToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && refreshToken) {
    const refreshed = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshed.ok) {
      const { accessToken: newAccess, refreshToken: newRefresh } = await refreshed.json();
      setTokens(newAccess, newRefresh);
      headers['Authorization'] = `Bearer ${newAccess}`;
      const retry = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      if (!retry.ok) throw new Error(`Request failed: ${retry.status}`);
      return retry.json();
    } else {
      clearTokens();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    register: (data: { email: string; name: string; password: string }) =>
      request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<UserWithWorkspaces>('/auth/me'),
    refresh: (refreshToken: string) =>
      request<TokenResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  },

  workspaces: {
    create: (data: { name: string; slug: string; plan?: string }) =>
      request<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
    list: () => request<Workspace[]>('/workspaces'),
    get: (id: string) => request<Workspace>(`/workspaces/${id}`),
    invite: (id: string, data: { email: string; role?: string }) =>
      request<{ id: string; token: string }>(`/workspaces/${id}/invite`, { method: 'POST', body: JSON.stringify(data) }),
    updateMemberRole: (id: string, userId: string, data: { role: string }) =>
      request<{ id: string; role: string }>(`/workspaces/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    removeMember: (id: string, userId: string) =>
      request<void>(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),
  },

  projects: {
    create: (data: { workspaceId: string; name: string; description?: string; settings?: Record<string, unknown> }) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    list: (workspaceId: string, cursor?: string) =>
      request<PaginatedResponse<Project>>(`/projects?workspaceId=${workspaceId}${cursor ? `&cursor=${cursor}` : ''}`),
    get: (id: string) => request<Project>(`/projects/${id}`),
    update: (id: string, data: { name?: string; description?: string; settings?: Record<string, unknown> }) =>
      request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<Project>(`/projects/${id}`, { method: 'DELETE' }),
    duplicate: (id: string) => request<Project>(`/projects/${id}/duplicate`, { method: 'POST' }),
    versions: (id: string) => request<Array<{ id: string; payload: Record<string, unknown>; createdAt: string }>>(`/projects/${id}/versions`),
    createVersion: (id: string) => request<{ id: string }>(`/projects/${id}/versions`, { method: 'POST' }),
  },

  assets: {
    getPresignedUrl: (data: { projectId: string; fileName: string; type: string; contentType?: string }) =>
      request<PresignedUrlResponse>('/assets/presigned-url', { method: 'POST', body: JSON.stringify(data) }),
    upload: (assetId: string, formData: FormData) =>
      request<Asset>(`/assets/upload/${assetId}`, { method: 'POST', body: formData }),
    uploadToPresignedUrl: async (url: string, file: File, headers?: Record<string, string>) => {
      const res = await fetch(url, { method: 'PUT', headers: headers || { 'Content-Type': file.type }, body: file });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    },
    confirmUpload: (data: { assetId: string; projectId?: string; idempotencyKey?: string }) =>
      request<Asset>('/assets/confirm-upload', { method: 'POST', body: JSON.stringify(data) }),
    list: (projectId: string, type?: string) =>
      request<Asset[]>(`/assets?projectId=${projectId}${type ? `&type=${type}` : ''}`),
    get: (id: string) => request<Asset>(`/assets/${id}`),
    delete: (id: string) => request<Asset>(`/assets/${id}`, { method: 'DELETE' }),
  },

  timeline: {
    createTrack: (projectId: string, data: { type: string; label: string; orderIndex: number; color?: string }) =>
      request<Track>(`/projects/${projectId}/tracks`, { method: 'POST', body: JSON.stringify(data) }),
    updateTrack: (projectId: string, trackId: string, data: Partial<Track>) =>
      request<Track>(`/projects/${projectId}/tracks/${trackId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTrack: (projectId: string, trackId: string) =>
      request<{ deleted: boolean }>(`/projects/${projectId}/tracks/${trackId}`, { method: 'DELETE' }),

    createClip: (projectId: string, data: Partial<Clip> & { trackId: string; trackPositionMs: number; inPointMs: number; outPointMs: number }) =>
      request<Clip>(`/projects/${projectId}/clips`, { method: 'POST', body: JSON.stringify(data) }),
    updateClip: (projectId: string, clipId: string, data: Partial<Clip>) =>
      request<Clip>(`/projects/${projectId}/clips/${clipId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteClip: (projectId: string, clipId: string) =>
      request<{ deleted: boolean }>(`/projects/${projectId}/clips/${clipId}`, { method: 'DELETE' }),
    splitClip: (projectId: string, clipId: string, atTimeMs: number) =>
      request<SplitClipResponse>(`/projects/${projectId}/clips/${clipId}/split`, {
        method: 'POST', body: JSON.stringify({ atTimeMs }),
      }),
    batchClips: (projectId: string, operations: Array<{ clipId: string; action: string; data?: Record<string, unknown> }>) =>
      request<{ results: Clip[] }>(`/projects/${projectId}/clips/batch`, {
        method: 'POST', body: JSON.stringify({ operations }),
      }),

    addEffect: (projectId: string, clipId: string, data: { type: string; params?: Record<string, unknown>; enabled?: boolean }) =>
      request<ClipEffect>(`/projects/${projectId}/clips/${clipId}/effects`, { method: 'POST', body: JSON.stringify(data) }),
    updateEffect: (projectId: string, clipId: string, effectId: string, data: { params?: Record<string, unknown>; enabled?: boolean }) =>
      request<ClipEffect>(`/projects/${projectId}/clips/${clipId}/effects/${effectId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteEffect: (projectId: string, clipId: string, effectId: string) =>
      request<{ deleted: boolean }>(`/projects/${projectId}/clips/${clipId}/effects/${effectId}`, { method: 'DELETE' }),
    reorderEffects: (projectId: string, clipId: string, effectIds: string[]) =>
      request<{ reordered: boolean }>(`/projects/${projectId}/clips/${clipId}/effects/reorder`, {
        method: 'PATCH', body: JSON.stringify({ effectIds }),
      }),

    createTransition: (projectId: string, data: { fromClipId: string; toClipId: string; type: string; durationMs: number; params?: Record<string, unknown> }) =>
      request<Transition>(`/projects/${projectId}/transitions`, { method: 'POST', body: JSON.stringify(data) }),
    updateTransition: (projectId: string, transitionId: string, data: Partial<Transition>) =>
      request<Transition>(`/projects/${projectId}/transitions/${transitionId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTransition: (projectId: string, transitionId: string) =>
      request<{ deleted: boolean }>(`/projects/${projectId}/transitions/${transitionId}`, { method: 'DELETE' }),

    createTextOverlay: (projectId: string, data: Partial<TextOverlay> & { trackPositionMs: number; durationMs: number; content: string }) =>
      request<TextOverlay>(`/projects/${projectId}/text-overlays`, { method: 'POST', body: JSON.stringify(data) }),
    updateTextOverlay: (projectId: string, overlayId: string, data: Partial<TextOverlay>) =>
      request<TextOverlay>(`/projects/${projectId}/text-overlays/${overlayId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTextOverlay: (projectId: string, overlayId: string) =>
      request<{ deleted: boolean }>(`/projects/${projectId}/text-overlays/${overlayId}`, { method: 'DELETE' }),
  },

  exports: {
    create: (projectId: string, data: { format?: string; resolution?: string; quality?: string; idempotencyKey?: string }) =>
      request<ExportJob>(`/projects/${projectId}/exports`, { method: 'POST', body: JSON.stringify(data) }),
    list: (projectId: string) =>
      request<PaginatedResponse<ExportJob>>(`/projects/${projectId}/exports`).then((page) => page.data),
    get: (id: string) => request<ExportJob>(`/exports/${id}`),
    cancel: (id: string) => request<ExportJob>(`/exports/${id}`, { method: 'DELETE' }),
  },

  collaboration: {
    authenticatePusher: (data: { socket_id: string; channel_name: string }) =>
      request<Record<string, unknown>>('/collaboration/pusher/auth', { method: 'POST', body: JSON.stringify(data) }),
    getOperations: (projectId: string, sinceSeq: number) =>
      request<Array<{ id: string; operationType: string; payload: Record<string, unknown>; userId: string; clientSeq: number }>>(`/collaboration/projects/${projectId}/operations?sinceSeq=${sinceSeq}`),
    getPresence: (projectId: string) =>
      request<Array<{ userId: string; name?: string }>>(`/collaboration/projects/${projectId}/presence`),
  },
};
