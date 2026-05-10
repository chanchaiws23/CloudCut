import { create } from 'zustand';
import type { ActiveTool } from '../types';

interface UIState {
  selectedClipIds: string[];
  zoomLevel: number;
  scrollPosition: number;
  activeTool: ActiveTool;
  snapEnabled: boolean;
  snapGuideMs: number | null;
  panelSizes: { left: number; center: number; right: number; bottom: number };
  theme: 'light' | 'dark';

  selectClip: (id: string, additive?: boolean) => void;
  selectClips: (ids: string[]) => void;
  deselectAll: () => void;
  setZoom: (level: number) => void;
  setScrollPosition: (pos: number) => void;
  setActiveTool: (tool: ActiveTool) => void;
  toggleSnap: () => void;
  setSnapGuideMs: (ms: number | null) => void;
  setPanelSizes: (sizes: Partial<UIState['panelSizes']>) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const savedTheme = localStorage.getItem('cloudcut-theme') as 'light' | 'dark' | null;

export const useUIStore = create<UIState>((set) => ({
  selectedClipIds: [],
  zoomLevel: 50,
  scrollPosition: 0,
  activeTool: 'select',
  snapEnabled: true,
  snapGuideMs: null,
  panelSizes: { left: 20, center: 55, right: 25, bottom: 40 },
  theme: savedTheme || 'dark',

  selectClip: (id, additive = false) =>
    set((s) => ({
      selectedClipIds: additive
        ? s.selectedClipIds.includes(id)
          ? s.selectedClipIds.filter((i) => i !== id)
          : [...s.selectedClipIds, id]
        : [id],
    })),

  selectClips: (ids) => set({ selectedClipIds: ids }),
  deselectAll: () => set({ selectedClipIds: [] }),
  setZoom: (level) => set({ zoomLevel: Math.max(5, Math.min(500, level)) }),
  setScrollPosition: (pos) => set({ scrollPosition: Math.max(0, pos) }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  setSnapGuideMs: (ms) => set({ snapGuideMs: ms }),
  setPanelSizes: (sizes) =>
    set((s) => ({ panelSizes: { ...s.panelSizes, ...sizes } })),
  setTheme: (theme) => {
    localStorage.setItem('cloudcut-theme', theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('cloudcut-theme', next);
      return { theme: next };
    }),
}));
