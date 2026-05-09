import { create } from 'zustand';
import type { Project, Track, Clip, ClipEffect, Transition, TextOverlay, Asset } from '../types';
import { api } from '../services/api';
import { commandManager } from './commands/CommandManager';
import { v4 as uuidv4 } from 'uuid';

interface ProjectState {
  project: Project | null;
  tracks: Track[];
  clips: Clip[];
  effects: Record<string, ClipEffect[]>;
  transitions: Transition[];
  textOverlays: TextOverlay[];
  assets: Asset[];
  isLoading: boolean;
  error: string | null;

  loadProject: (id: string) => Promise<void>;
  loadAssets: (projectId: string) => Promise<void>;

  addTrack: (track: Track) => void;
  updateTrack: (trackId: string, changes: Partial<Track>) => void;
  removeTrack: (trackId: string) => void;

  addClip: (clip: Clip) => void;
  moveClip: (clipId: string, trackPositionMs: number, trackId?: string) => void;
  trimClip: (clipId: string, inPointMs: number, outPointMs: number) => void;
  splitClip: (clipId: string, atTimeMs: number) => void;
  deleteClips: (clipIds: string[]) => void;
  applyRemoteClipUpdate: (clipId: string, changes: Partial<Clip>) => void;

  addEffect: (clipId: string, effect: ClipEffect) => void;
  updateEffect: (clipId: string, effectId: string, params: Record<string, any>) => void;
  removeEffect: (clipId: string, effectId: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  tracks: [],
  clips: [],
  effects: {},
  transitions: [],
  textOverlays: [],
  assets: [],
  isLoading: false,
  error: null,

  loadProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const project = await api.projects.get(id);
      const effects: Record<string, ClipEffect[]> = {};
      (project.clips || []).forEach((clip: Clip) => {
        if (clip.effects) effects[clip.id] = clip.effects;
      });
      set({
        project,
        tracks: project.tracks || [],
        clips: (project.clips || []).map((c: Clip) => ({ ...c, effects: undefined })),
        effects,
        transitions: project.transitions || [],
        textOverlays: project.textOverlays || [],
        isLoading: false,
      });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  loadAssets: async (projectId) => {
    const assets = await api.assets.list(projectId);
    set({ assets });
  },

  addTrack: (track) => set((s) => ({ tracks: [...s.tracks, track] })),

  updateTrack: (trackId, changes) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, ...changes } : t)) })),

  removeTrack: (trackId) =>
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== trackId),
      clips: s.clips.filter((c) => c.trackId !== trackId),
    })),

  addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),

  moveClip: (clipId, trackPositionMs, trackId) => {
    const { clips, project } = get();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip || !project) return;

    const prevPosition = clip.trackPositionMs;
    const prevTrackId = clip.trackId;

    commandManager.execute({
      id: uuidv4(),
      type: 'clip.move',
      description: `Move Clip to ${Math.round(trackPositionMs / 1000)}s`,
      timestamp: Date.now(),
      execute: () => {
        set((s) => ({
          clips: s.clips.map((c) =>
            c.id === clipId ? { ...c, trackPositionMs, ...(trackId ? { trackId } : {}) } : c,
          ),
        }));
        api.timeline.updateClip(project.id, clipId, { trackPositionMs, ...(trackId ? { trackId } : {}) }).catch(console.error);
      },
      undo: () => {
        set((s) => ({
          clips: s.clips.map((c) =>
            c.id === clipId ? { ...c, trackPositionMs: prevPosition, trackId: prevTrackId } : c,
          ),
        }));
        api.timeline.updateClip(project.id, clipId, { trackPositionMs: prevPosition, trackId: prevTrackId }).catch(console.error);
      },
    });
  },

  trimClip: (clipId, inPointMs, outPointMs) => {
    const { clips, project } = get();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip || !project) return;

    const prevIn = clip.inPointMs;
    const prevOut = clip.outPointMs;

    commandManager.execute({
      id: uuidv4(),
      type: 'clip.trim',
      description: `Trim Clip`,
      timestamp: Date.now(),
      execute: () => {
        set((s) => ({
          clips: s.clips.map((c) =>
            c.id === clipId ? { ...c, inPointMs, outPointMs, durationMs: outPointMs - inPointMs } : c,
          ),
        }));
        api.timeline.updateClip(project.id, clipId, { inPointMs, outPointMs }).catch(console.error);
      },
      undo: () => {
        set((s) => ({
          clips: s.clips.map((c) =>
            c.id === clipId ? { ...c, inPointMs: prevIn, outPointMs: prevOut, durationMs: prevOut - prevIn } : c,
          ),
        }));
        api.timeline.updateClip(project.id, clipId, { inPointMs: prevIn, outPointMs: prevOut }).catch(console.error);
      },
    });
  },

  splitClip: (clipId, atTimeMs) => {
    const { project } = get();
    if (!project) return;
    commandManager.execute({
      id: uuidv4(),
      type: 'clip.split',
      description: `Split Clip at ${Math.round(atTimeMs / 1000)}s`,
      timestamp: Date.now(),
      execute: async () => {
        const result = await api.timeline.splitClip(project.id, clipId, atTimeMs);
        set((s) => ({
          clips: s.clips
            .map((c) => (c.id === clipId ? result.original : c))
            .concat(result.new),
        }));
      },
      undo: () => {
        get().loadProject(project.id);
      },
    });
  },

  deleteClips: (clipIds) => {
    const { clips, project } = get();
    if (!project) return;
    const deletedClips = clips.filter((c) => clipIds.includes(c.id));

    commandManager.execute({
      id: uuidv4(),
      type: 'clip.delete',
      description: `Delete ${clipIds.length} clip(s)`,
      timestamp: Date.now(),
      execute: () => {
        set((s) => ({ clips: s.clips.filter((c) => !clipIds.includes(c.id)) }));
        clipIds.forEach((id) => api.timeline.deleteClip(project.id, id).catch(console.error));
      },
      undo: () => {
        set((s) => ({ clips: [...s.clips, ...deletedClips] }));
        deletedClips.forEach((c) =>
          api.timeline.createClip(project.id, c).catch(console.error),
        );
      },
    });
  },

  applyRemoteClipUpdate: (clipId, changes) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, ...changes } : c,
      ),
    })),

  addEffect: (clipId, effect) => {
    const { project } = get();
    if (!project) return;
    commandManager.execute({
      id: uuidv4(),
      type: 'effect.add',
      description: `Add ${effect.type} effect`,
      timestamp: Date.now(),
      execute: () => {
        set((s) => ({
          effects: { ...s.effects, [clipId]: [...(s.effects[clipId] || []), effect] },
        }));
      },
      undo: () => {
        set((s) => ({
          effects: {
            ...s.effects,
            [clipId]: (s.effects[clipId] || []).filter((e) => e.id !== effect.id),
          },
        }));
      },
    });
  },

  updateEffect: (clipId, effectId, params) => {
    const { effects, project } = get();
    if (!project) return;
    const prevParams = effects[clipId]?.find((e) => e.id === effectId)?.params;

    commandManager.execute({
      id: uuidv4(),
      type: 'effect.update',
      description: `Update effect`,
      timestamp: Date.now(),
      execute: () => {
        set((s) => ({
          effects: {
            ...s.effects,
            [clipId]: (s.effects[clipId] || []).map((e) =>
              e.id === effectId ? { ...e, params } : e,
            ),
          },
        }));
        api.timeline.updateEffect(project.id, clipId, effectId, { params }).catch(console.error);
      },
      undo: () => {
        if (!prevParams) return;
        set((s) => ({
          effects: {
            ...s.effects,
            [clipId]: (s.effects[clipId] || []).map((e) =>
              e.id === effectId ? { ...e, params: prevParams } : e,
            ),
          },
        }));
        api.timeline.updateEffect(project.id, clipId, effectId, { params: prevParams }).catch(console.error);
      },
    });
  },

  removeEffect: (clipId, effectId) => {
    const { effects, project } = get();
    if (!project) return;
    const effect = effects[clipId]?.find((e) => e.id === effectId);

    commandManager.execute({
      id: uuidv4(),
      type: 'effect.remove',
      description: `Remove effect`,
      timestamp: Date.now(),
      execute: () => {
        set((s) => ({
          effects: {
            ...s.effects,
            [clipId]: (s.effects[clipId] || []).filter((e) => e.id !== effectId),
          },
        }));
        api.timeline.deleteEffect(project.id, clipId, effectId).catch(console.error);
      },
      undo: () => {
        if (!effect) return;
        set((s) => ({
          effects: { ...s.effects, [clipId]: [...(s.effects[clipId] || []), effect] },
        }));
      },
    });
  },
}));
