import { useRef, useCallback } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useUIStore } from '../state/uiStore';
import { CommandManager } from '../state/commands/CommandManager';
import { snapToNearest } from '../utils/geometry';

interface DragState {
  clipId: string;
  startX: number;
  startTrackPositionMs: number;
  startTrackId: string;
  isDragging: boolean;
}

export function useDragClip(commandManager: CommandManager, zoomLevel: number, snapEnabled: boolean) {
  const dragState = useRef<DragState | null>(null);
  const { clips, moveClip } = useProjectStore();
  const { setSnapGuideMs } = useUIStore();

  const onDragStart = useCallback((
    e: React.MouseEvent,
    clipId: string,
    trackId: string,
  ) => {
    e.preventDefault();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    dragState.current = {
      clipId,
      startX: e.clientX,
      startTrackPositionMs: clip.trackPositionMs,
      startTrackId: trackId,
      isDragging: false,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragState.current) return;
      const dx = moveEvent.clientX - dragState.current.startX;
      const deltaMs = (dx / zoomLevel) * 1000;
      let newPositionMs = Math.max(0, dragState.current.startTrackPositionMs + deltaMs);

      dragState.current.isDragging = true;

      if (snapEnabled && !(moveEvent.altKey)) {
        const snapPoints = clips
          .filter((c) => c.id !== clipId)
          .flatMap((c) => [c.trackPositionMs, c.trackPositionMs + c.durationMs]);
        const clip = clips.find((c) => c.id === dragState.current!.clipId);
        if (clip) {
          snapPoints.push(...clips.filter(c => c.id !== clipId).flatMap(c => [c.trackPositionMs, c.trackPositionMs + c.durationMs]));
        }
        const snapped = snapToNearest(newPositionMs, snapPoints, (50 / zoomLevel) * 1000);
        if (snapped !== null) {
          setSnapGuideMs(snapped);
          newPositionMs = snapped;
        } else {
          setSnapGuideMs(null);
        }
      }

      moveClip(clipId, newPositionMs);
    };

    const onMouseUp = () => {
      if (dragState.current?.isDragging) {
        const clip = clips.find((c) => c.id === dragState.current!.clipId);
        if (clip) {
          const prevPosition = dragState.current.startTrackPositionMs;
          const newPosition = clip.trackPositionMs;
          if (prevPosition !== newPosition) {
            commandManager.execute({
              id: crypto.randomUUID(),
              type: 'move-clip',
              description: `Move clip to ${Math.round(newPosition / 1000)}s`,
              timestamp: Date.now(),
              execute: () => moveClip(clipId, newPosition),
              undo: () => moveClip(clipId, prevPosition),
            });
          }
        }
        setSnapGuideMs(null);
      }
      dragState.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [clips, moveClip, zoomLevel, snapEnabled, commandManager, setSnapGuideMs]);

  return { onDragStart };
}
