import { useCallback } from 'react';
import { usePlaybackStore } from '../../state/playbackStore';
import { useUIStore } from '../../state/uiStore';
import { msToPx, pxToMs } from '../../utils/timecode';

interface PlayheadProps {
  zoomLevel: number;
  scrollPosition: number;
}

export function Playhead({ zoomLevel, scrollPosition }: PlayheadProps) {
  const { currentTimeMs, seek } = usePlaybackStore();

  const leftPx = msToPx(currentTimeMs, zoomLevel);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    const handleMouseMove = (me: MouseEvent) => {
      const containerEl = document.querySelector('.timeline-scroll-container');
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      const x = me.clientX - rect.left + scrollPosition;
      const timeMs = Math.max(0, pxToMs(x, zoomLevel));
      seek(timeMs);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [zoomLevel, scrollPosition, seek]);

  return (
    <div
      className="absolute top-0 bottom-0 z-20 cursor-col-resize"
      style={{ left: leftPx, width: 1 }}
      onMouseDown={handleMouseDown}
    >
      <div className="w-3 h-3 bg-red-500 rounded-sm -translate-x-1/2 -translate-y-1/2 top-0 absolute" />
      <div className="absolute top-0 bottom-0 w-px bg-red-500" />
    </div>
  );
}
