import { create } from 'zustand';

interface PlaybackState {
  currentTimeMs: number;
  isPlaying: boolean;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
  durationMs: number;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (timeMs: number) => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setDuration: (ms: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  currentTimeMs: 0,
  isPlaying: false,
  playbackSpeed: 1,
  volume: 1,
  isMuted: false,
  durationMs: 0,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  seek: (timeMs) => set((s) => ({ currentTimeMs: Math.max(0, Math.min(timeMs, s.durationMs)) })),
  setSpeed: (speed) => set({ playbackSpeed: speed }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setDuration: (ms) => set({ durationMs: ms }),
}));
