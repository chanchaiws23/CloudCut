import { useRef, useCallback } from 'react';
import type { Clip, Track } from '../../types';
import { useUIStore } from '../../state/uiStore';
import { useProjectStore } from '../../state/projectStore';
import { useSnap } from '../../hooks/useSnap';
import { msToPx } from '../../utils/timecode';
import { cn } from '../../lib/utils';
import type { PresenceUser } from '../../hooks/usePresence';

interface TimelineClipProps {
  clip: Clip;
  track: Track;
  zoomLevel: number;
  isSelected: boolean;
  projectId: string;
  remoteEditingBy?: PresenceUser[];
}

const DRAG_THRESHOLD_PX = 4;

export function TimelineClip({ clip, track, zoomLevel, isSelected, remoteEditingBy = [] }: TimelineClipProps) {
  const { selectClip, activeTool } = useUIStore();
  const { moveClip, trimClip, splitClip, assets } = useProjectStore();
  const { applySnap, clearSnap } = useSnap(zoomLevel);
  const clipRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; startPosition: number; startTrackId: string; hasDragged: boolean; latestPosition: number } | null>(null);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const trimStartRef = useRef<{ x: number; side: 'left' | 'right'; inPoint: number; outPoint: number; startLeft: number; startWidth: number; hasDragged: boolean } | null>(null);

  const left = msToPx(clip.trackPositionMs, zoomLevel);
  const width = Math.max(4, msToPx(clip.durationMs, zoomLevel));

  const asset = assets.find((a) => a.id === clip.assetId);
  const assetName = asset?.originalUrl?.split('/').pop() || clip.asset?.type || track.type;

  const bgColor = track.type === 'video' ? 'bg-blue-600' : 'bg-green-600';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (track.isLocked) return;

    if (activeTool === 'blade') {
      const rect = clipRef.current?.getBoundingClientRect();
      const clickX = rect ? e.clientX - rect.left : 0;
      const clickMs = (clickX / zoomLevel) * 1000;
      const atTimeMs = Math.max(clip.trackPositionMs, Math.min(clip.trackPositionMs + clip.durationMs, clip.trackPositionMs + clickMs));
      splitClip(clip.id, atTimeMs);
      return;
    }

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPosition: clip.trackPositionMs,
      startTrackId: clip.trackId,
      hasDragged: false,
      latestPosition: clip.trackPositionMs,
    };
    const additiveSelect = e.shiftKey;

    const handleMouseMove = (me: MouseEvent) => {
      if (!dragStartRef.current || !clipRef.current) return;
      dragPointerRef.current = { x: me.clientX, y: me.clientY };
      const dx = me.clientX - dragStartRef.current.x;
      const dy = me.clientY - dragStartRef.current.y;
      if (!dragStartRef.current.hasDragged) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        dragStartRef.current.hasDragged = true;
        selectClip(clip.id, additiveSelect);
      }
      const deltaMs = (dx / zoomLevel) * 1000;
      const newPosition = Math.max(0, dragStartRef.current.startPosition + deltaMs);
      dragStartRef.current.latestPosition = newPosition;
      const newLeft = msToPx(newPosition, zoomLevel);
      clipRef.current.style.left = `${newLeft}px`;
      clipRef.current.style.zIndex = '100';
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (dragStartRef.current && clipRef.current) {
        if (dragStartRef.current.hasDragged) {
          const finalPosition = applySnap(dragStartRef.current.latestPosition, clip.id, (event as MouseEvent | undefined)?.altKey ?? false);
          const pointer = dragPointerRef.current;
          const dropTrack = pointer
            ? (document.elementFromPoint(pointer.x, pointer.y) as HTMLElement | null)
            ?.closest('[data-track-id]')
            ?.getAttribute('data-track-id')
            : null;
          const finalTrackId = dropTrack || dragStartRef.current.startTrackId;
          const positionChanged = Math.abs(finalPosition - dragStartRef.current.startPosition) >= 1;
          const trackChanged = finalTrackId !== dragStartRef.current.startTrackId;
          if (positionChanged || trackChanged) {
            moveClip(clip.id, finalPosition, trackChanged ? finalTrackId : undefined);
          }
          clipRef.current.style.left = `${msToPx(finalPosition, zoomLevel)}px`;
          clipRef.current.style.zIndex = '';
        } else {
          selectClip(clip.id, event.shiftKey || additiveSelect);
        }
      }
      dragStartRef.current = null;
      dragPointerRef.current = null;
      clearSnap();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [clip.id, clip.trackId, clip.trackPositionMs, clip.durationMs, zoomLevel, activeTool, selectClip, moveClip, splitClip, track.isLocked, applySnap, clearSnap]);

  const handleTrimMouseDown = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    if (track.isLocked) return;
    trimStartRef.current = { x: e.clientX, side, inPoint: clip.inPointMs, outPoint: clip.outPointMs, startLeft: left, startWidth: width, hasDragged: false };

    const handleMouseMove = (me: MouseEvent) => {
      if (!trimStartRef.current || !clipRef.current) return;
      const dx = me.clientX - trimStartRef.current.x;
      if (!trimStartRef.current.hasDragged && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      trimStartRef.current.hasDragged = true;
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

    const handleMouseUp = (event: MouseEvent) => {
      if (trimStartRef.current && clipRef.current) {
        if (trimStartRef.current.hasDragged) {
          const finalLeft = parseFloat(clipRef.current.style.left || '0') || trimStartRef.current.startLeft;
          const finalWidth = parseFloat(clipRef.current.style.width || '0') || trimStartRef.current.startWidth;
          const dxLeft = finalLeft - trimStartRef.current.startLeft;
          const dxWidth = finalWidth - trimStartRef.current.startWidth;

          if (trimStartRef.current.side === 'left') {
            const deltaMs = (dxLeft / zoomLevel) * 1000;
            const newIn = Math.max(0, trimStartRef.current.inPoint + deltaMs);
            const newPos = applySnap(Math.max(0, clip.trackPositionMs + deltaMs), clip.id, (event as MouseEvent | undefined)?.altKey ?? false);
            trimClip(clip.id, newIn, clip.outPointMs, newPos);
          } else {
            const deltaMs = (dxWidth / zoomLevel) * 1000;
            const newOut = Math.max(clip.inPointMs + 100, trimStartRef.current.outPoint + deltaMs);
            trimClip(clip.id, clip.inPointMs, newOut);
          }
          clipRef.current.style.left = `${finalLeft}px`;
          clipRef.current.style.width = `${finalWidth}px`;
        }
      }
      trimStartRef.current = null;
      clearSnap();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [clip, zoomLevel, trimClip, left, width, track.isLocked, applySnap, clearSnap]);

  return (
    <div
      ref={clipRef}
      className={cn('timeline-clip', bgColor, isSelected && 'selected')}
      style={{ left, width, top: 4, height: 'calc(100% - 8px)' }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
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
      {remoteEditingBy.length > 0 && (
        <div className="absolute right-2 top-1 flex items-center gap-1 pointer-events-none">
          {remoteEditingBy.slice(0, 3).map((user) => (
            <span
              key={user.userId}
              title={`${user.name} editing`}
              className="h-2 w-2 rounded-full ring-1 ring-white/80"
              style={{ backgroundColor: user.color }}
            />
          ))}
        </div>
      )}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/20 rounded-r"
        onMouseDown={(e) => handleTrimMouseDown(e, 'right')}
      />
    </div>
  );
}
