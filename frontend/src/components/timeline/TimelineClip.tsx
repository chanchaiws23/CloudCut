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
  const { selectClip, activeTool } = useUIStore();
  const { moveClip, trimClip, splitClip, assets } = useProjectStore();
  const clipRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; startPosition: number } | null>(null);
  const trimStartRef = useRef<{ x: number; side: 'left' | 'right'; inPoint: number; outPoint: number; startLeft: number; startWidth: number } | null>(null);

  const left = msToPx(clip.trackPositionMs, zoomLevel);
  const width = Math.max(4, msToPx(clip.durationMs, zoomLevel));

  const asset = assets.find((a) => a.id === clip.assetId);
  const assetName = asset?.originalUrl?.split('/').pop() || clip.asset?.type || track.type;

  const bgColor = track.type === 'video' ? 'bg-blue-600' : 'bg-green-600';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    if (activeTool === 'blade') {
      const rect = clipRef.current?.getBoundingClientRect();
      const clickX = rect ? e.clientX - rect.left : 0;
      const clickMs = (clickX / zoomLevel) * 1000;
      const atTimeMs = Math.max(clip.trackPositionMs, Math.min(clip.trackPositionMs + clip.durationMs, clip.trackPositionMs + clickMs));
      splitClip(clip.id, atTimeMs);
      return;
    }

    selectClip(clip.id, e.shiftKey);
    dragStartRef.current = { x: e.clientX, startPosition: clip.trackPositionMs };

    const handleMouseMove = (me: MouseEvent) => {
      if (!dragStartRef.current || !clipRef.current) return;
      const dx = me.clientX - dragStartRef.current.x;
      const deltaMs = (dx / zoomLevel) * 1000;
      const newPosition = Math.max(0, dragStartRef.current.startPosition + deltaMs);
      const newLeft = msToPx(newPosition, zoomLevel);
      clipRef.current.style.left = `${newLeft}px`;
      clipRef.current.style.zIndex = '100';
    };

    const handleMouseUp = () => {
      if (dragStartRef.current && clipRef.current) {
        const dx = (clipRef.current.style.left ? parseFloat(clipRef.current.style.left) : left) - left;
        const deltaMs = (dx / zoomLevel) * 1000;
        const finalPosition = Math.max(0, dragStartRef.current.startPosition + deltaMs);
        moveClip(clip.id, finalPosition);
        clipRef.current.style.left = '';
        clipRef.current.style.zIndex = '';
      }
      dragStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [clip.id, clip.trackPositionMs, zoomLevel, activeTool, selectClip, moveClip, splitClip, left]);

  const handleTrimMouseDown = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    trimStartRef.current = { x: e.clientX, side, inPoint: clip.inPointMs, outPoint: clip.outPointMs, startLeft: left, startWidth: width };

    const handleMouseMove = (me: MouseEvent) => {
      if (!trimStartRef.current || !clipRef.current) return;
      const dx = me.clientX - trimStartRef.current.x;
      const deltaMs = (dx / zoomLevel) * 1000;

      if (side === 'left') {
        const newIn = Math.max(0, trimStartRef.current.inPoint + deltaMs);
        if (newIn < clip.outPointMs - 100) {
          const newLeft = trimStartRef.current.startLeft + dx;
          const newWidth = trimStartRef.current.startWidth - dx;
          clipRef.current.style.left = `${newLeft}px`;
          clipRef.current.style.width = `${Math.max(4, newWidth)}px`;
        }
      } else {
        const newOut = Math.max(clip.inPointMs + 100, trimStartRef.current.outPoint + deltaMs);
        const newWidth = trimStartRef.current.startWidth + dx;
        clipRef.current.style.width = `${Math.max(4, newWidth)}px`;
      }
    };

    const handleMouseUp = () => {
      if (trimStartRef.current && clipRef.current) {
        const finalLeft = parseFloat(clipRef.current.style.left || '0') || trimStartRef.current.startLeft;
        const finalWidth = parseFloat(clipRef.current.style.width || '0') || trimStartRef.current.startWidth;
        const dxLeft = finalLeft - trimStartRef.current.startLeft;
        const dxWidth = finalWidth - trimStartRef.current.startWidth;

        if (trimStartRef.current.side === 'left') {
          const deltaMs = (dxLeft / zoomLevel) * 1000;
          const newIn = Math.max(0, trimStartRef.current.inPoint + deltaMs);
          const newPos = Math.max(0, clip.trackPositionMs + deltaMs);
          trimClip(clip.id, newIn, clip.outPointMs, newPos);
        } else {
          const deltaMs = (dxWidth / zoomLevel) * 1000;
          const newOut = Math.max(clip.inPointMs + 100, trimStartRef.current.outPoint + deltaMs);
          trimClip(clip.id, clip.inPointMs, newOut);
        }

        clipRef.current.style.left = '';
        clipRef.current.style.width = '';
      }
      trimStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [clip, zoomLevel, trimClip, left, width]);

  return (
    <div
      ref={clipRef}
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
          {assetName}
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
