import { useRef, useCallback, useEffect } from 'react';
import { useProjectStore } from '../state/projectStore';
import { CommandManager } from '../state/commands/CommandManager';

type TrimHandle = 'left' | 'right';

interface TrimState {
  clipId: string;
  handle: TrimHandle;
  startX: number;
  startInPointMs: number;
  startOutPointMs: number;
  startTrackPositionMs: number;
}

interface ActiveListeners {
  onMouseMove: (e: MouseEvent) => void;
  onMouseUp: () => void;
}

export function useTrimClip(commandManager: CommandManager, zoomLevel: number) {
  const trimState = useRef<TrimState | null>(null);
  const activeListeners = useRef<ActiveListeners | null>(null);
  const { clips, trimClip } = useProjectStore();

  useEffect(() => {
    return () => {
      if (activeListeners.current) {
        window.removeEventListener('mousemove', activeListeners.current.onMouseMove);
        window.removeEventListener('mouseup', activeListeners.current.onMouseUp);
        activeListeners.current = null;
      }
      trimState.current = null;
    };
  }, []);

  const onTrimStart = useCallback((
    e: React.MouseEvent,
    clipId: string,
    handle: TrimHandle,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    trimState.current = {
      clipId,
      handle,
      startX: e.clientX,
      startInPointMs: clip.inPointMs,
      startOutPointMs: clip.outPointMs,
      startTrackPositionMs: clip.trackPositionMs,
    };

    const prevIn = clip.inPointMs;
    const prevOut = clip.outPointMs;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!trimState.current) return;
      const dx = moveEvent.clientX - trimState.current.startX;
      const deltaMs = (dx / zoomLevel) * 1000;

      if (trimState.current.handle === 'left') {
        const newInPoint = Math.max(0, trimState.current.startInPointMs + deltaMs);
        const newTrackPosition = trimState.current.startTrackPositionMs + deltaMs;
        if (newInPoint < trimState.current.startOutPointMs - 100) {
          trimClip(clipId, newInPoint, trimState.current.startOutPointMs, newTrackPosition);
        }
      } else {
        const newOutPoint = Math.max(
          trimState.current.startInPointMs + 100,
          trimState.current.startOutPointMs + deltaMs,
        );
        trimClip(clipId, trimState.current.startInPointMs, newOutPoint, trimState.current.startTrackPositionMs);
      }
    };

    const onMouseUp = () => {
      if (trimState.current) {
        const clip = clips.find((c) => c.id === trimState.current!.clipId);
        if (clip && (clip.inPointMs !== prevIn || clip.outPointMs !== prevOut)) {
          const newIn = clip.inPointMs;
          const newOut = clip.outPointMs;
          const newTrackPos = clip.trackPositionMs;
          const prevTrackPos = trimState.current.startTrackPositionMs;
          commandManager.execute({
            id: crypto.randomUUID(),
            type: 'trim-clip',
            description: `Trim clip ${handle} handle`,
            timestamp: Date.now(),
            execute: () => trimClip(clipId, newIn, newOut, newTrackPos),
            undo: () => trimClip(clipId, prevIn, prevOut, prevTrackPos),
          });
        }
      }
      trimState.current = null;
      activeListeners.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    activeListeners.current = { onMouseMove, onMouseUp };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [clips, trimClip, zoomLevel, commandManager]);

  return { onTrimStart };
}
