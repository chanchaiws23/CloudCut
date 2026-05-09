import { useRef, useCallback } from 'react';
import type { Clip, Track } from '../../types';
import { useUIStore } from '../../state/uiStore';
import { useProjectStore } from '../../state/projectStore';
import { msToPx } from '../../utils/timecode';
import { cn } from '../../lib/utils';

interface TimelineClipProps {
  clip: Clip;
  track: Track;
  zoomLevel: number;
  isSelected: boolean;
  projectId: string;
}

export function TimelineClip({ clip, track, zoomLevel, isSelected }: TimelineClipProps) {
  const { selectClip } = useUIStore();
  const { moveClip, trimClip } = useProjectStore();
  const dragStartRef = useRef<{ x: number; startPosition: number } | null>(null);
  const trimStartRef = useRef<{ x: number; side: 'left' | 'right'; inPoint: number; outPoint: number } | null>(null);

  const left = msToPx(clip.trackPositionMs, zoomLevel);
  const width = Math.max(4, msToPx(clip.durationMs, zoomLevel));

  const bgColor = track.type === 'video' ? 'bg-blue-600' : 'bg-green-600';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id, e.shiftKey);
    dragStartRef.current = { x: e.clientX, startPosition: clip.trackPositionMs };

    const handleMouseMove = (me: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = me.clientX - dragStartRef.current.x;
      const deltaMs = (dx / zoomLevel) * 1000;
      const newPosition = Math.max(0, dragStartRef.current.startPosition + deltaMs);
      moveClip(clip.id, newPosition);
    };

    const handleMouseUp = () => {
      dragStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [clip.id, clip.trackPositionMs, zoomLevel, selectClip, moveClip]);

  const handleTrimMouseDown = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    trimStartRef.current = { x: e.clientX, side, inPoint: clip.inPointMs, outPoint: clip.outPointMs };

    const handleMouseMove = (me: MouseEvent) => {
      if (!trimStartRef.current) return;
      const dx = me.clientX - trimStartRef.current.x;
      const deltaMs = (dx / zoomLevel) * 1000;

      if (side === 'left') {
        const newIn = Math.max(0, trimStartRef.current.inPoint + deltaMs);
        if (newIn < clip.outPointMs - 100) trimClip(clip.id, newIn, clip.outPointMs);
      } else {
        const newOut = Math.max(clip.inPointMs + 100, trimStartRef.current.outPoint + deltaMs);
        trimClip(clip.id, clip.inPointMs, newOut);
      }
    };

    const handleMouseUp = () => {
      trimStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [clip, zoomLevel, trimClip]);

  return (
    <div
      className={cn('timeline-clip', bgColor, isSelected && 'selected')}
      style={{ left, width, top: 4, height: 'calc(100% - 8px)' }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/20 rounded-l"
        onMouseDown={(e) => handleTrimMouseDown(e, 'left')}
      />
      <div className="px-2 py-1 overflow-hidden h-full flex flex-col justify-center pointer-events-none">
        <span className="text-xs font-medium text-white truncate leading-tight">
          {clip.asset?.type || track.type}
        </span>
        <span className="text-[10px] text-white/70 truncate">
          {Math.round(clip.durationMs / 1000)}s
        </span>
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/20 rounded-r"
        onMouseDown={(e) => handleTrimMouseDown(e, 'right')}
      />
    </div>
  );
}
