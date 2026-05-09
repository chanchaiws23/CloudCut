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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
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
      request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<any>('/auth/me'),
    refresh: (refreshToken: string) =>
      request<any>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  },

  workspaces: {
    create: (data: any) => request<any>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
    list: () => request<any>('/workspaces'),
    get: (id: string) => request<any>(`/workspaces/${id}`),
    invite: (id: string, data: any) =>
      request<any>(`/workspaces/${id}/invite`, { method: 'POST', body: JSON.stringify(data) }),
  },

  projects: {
    create: (data: any) => request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    list: (workspaceId: string, cursor?: string) =>
      request<any>(`/projects?workspaceId=${workspaceId}${cursor ? `&cursor=${cursor}` : ''}`),
    get: (id: string) => request<any>(`/projects/${id}`),
    update: (id: string, data: any) =>
      request<any>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/projects/${id}`, { method: 'DELETE' }),
    duplicate: (id: string) => request<any>(`/projects/${id}/duplicate`, { method: 'POST' }),
  },

  assets: {
    getPresignedUrl: (data: any) =>
      request<any>('/assets/presigned-url', { method: 'POST', body: JSON.stringify(data) }),
    confirmUpload: (data: any) =>
      request<any>('/assets/confirm-upload', { method: 'POST', body: JSON.stringify(data) }),
    list: (projectId: string, type?: string) =>
      request<any>(`/assets?projectId=${projectId}${type ? `&type=${type}` : ''}`),
    get: (id: string) => request<any>(`/assets/${id}`),
    delete: (id: string) => request<any>(`/assets/${id}`, { method: 'DELETE' }),
  },

  timeline: {
    createTrack: (projectId: string, data: any) =>
      request<any>(`/projects/${projectId}/tracks`, { method: 'POST', body: JSON.stringify(data) }),
    updateTrack: (projectId: string, trackId: string, data: any) =>
      request<any>(`/projects/${projectId}/tracks/${trackId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTrack: (projectId: string, trackId: string) =>
      request<any>(`/projects/${projectId}/tracks/${trackId}`, { method: 'DELETE' }),

    createClip: (projectId: string, data: any) =>
      request<any>(`/projects/${projectId}/clips`, { method: 'POST', body: JSON.stringify(data) }),
    updateClip: (projectId: string, clipId: string, data: any) =>
      request<any>(`/projects/${projectId}/clips/${clipId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteClip: (projectId: string, clipId: string) =>
      request<any>(`/projects/${projectId}/clips/${clipId}`, { method: 'DELETE' }),
    splitClip: (projectId: string, clipId: string, atTimeMs: number) =>
      request<any>(`/projects/${projectId}/clips/${clipId}/split`, {
        method: 'POST', body: JSON.stringify({ atTimeMs }),
      }),

    addEffect: (projectId: string, clipId: string, data: any) =>
      request<any>(`/projects/${projectId}/clips/${clipId}/effects`, { method: 'POST', body: JSON.stringify(data) }),
    updateEffect: (projectId: string, clipId: string, effectId: string, data: any) =>
      request<any>(`/projects/${projectId}/clips/${clipId}/effects/${effectId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteEffect: (projectId: string, clipId: string, effectId: string) =>
      request<any>(`/projects/${projectId}/clips/${clipId}/effects/${effectId}`, { method: 'DELETE' }),

    createTransition: (projectId: string, data: any) =>
      request<any>(`/projects/${projectId}/transitions`, { method: 'POST', body: JSON.stringify(data) }),
    deleteTransition: (projectId: string, transitionId: string) =>
      request<any>(`/projects/${projectId}/transitions/${transitionId}`, { method: 'DELETE' }),

    createTextOverlay: (projectId: string, data: any) =>
      request<any>(`/projects/${projectId}/text-overlays`, { method: 'POST', body: JSON.stringify(data) }),
    updateTextOverlay: (projectId: string, overlayId: string, data: any) =>
      request<any>(`/projects/${projectId}/text-overlays/${overlayId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTextOverlay: (projectId: string, overlayId: string) =>
      request<any>(`/projects/${projectId}/text-overlays/${overlayId}`, { method: 'DELETE' }),
  },

  exports: {
    create: (projectId: string, data: any) =>
      request<any>(`/projects/${projectId}/exports`, { method: 'POST', body: JSON.stringify(data) }),
    list: (projectId: string) => request<any>(`/projects/${projectId}/exports`),
    get: (id: string) => request<any>(`/exports/${id}`),
    cancel: (id: string) => request<any>(`/exports/${id}`, { method: 'DELETE' }),
  },

  collaboration: {
    getOperations: (projectId: string, sinceSeq: number) =>
      request<any>(`/collaboration/projects/${projectId}/operations?sinceSeq=${sinceSeq}`),
    getPresence: (projectId: string) =>
      request<any>(`/collaboration/projects/${projectId}/presence`),
  },
};
