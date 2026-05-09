import { useRef, useCallback, useEffect } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useUIStore } from '../../state/uiStore';
import { usePlaybackStore } from '../../state/playbackStore';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';
import { Playhead } from './Playhead';
import { SnapGuide } from './SnapGuide';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useZoom } from '../../hooks/useZoom';
import { msToPx } from '../../utils/timecode';
import { ZoomIn, ZoomOut, Magnet } from 'lucide-react';

interface TimelineProps {
  projectId: string;
}

const TRACK_HEIGHT = 56;
const HEADER_WIDTH = 120;

export function Timeline({ projectId }: TimelineProps) {
  const { tracks, clips, deleteClips } = useProjectStore();
  const { selectedClipIds, zoomLevel, scrollPosition, snapEnabled, setScrollPosition, toggleSnap, deselectAll } = useUIStore();
  const { currentTimeMs, seek } = usePlaybackStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { handleWheel } = useZoom();

  useKeyboardShortcuts();

  const totalDurationMs = clips.reduce((max, c) => Math.max(max, c.trackPositionMs + c.durationMs), 60000);
  const totalWidthPx = msToPx(totalDurationMs + 10000, zoomLevel);

  const handleScrollLeft = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  }, [setScrollPosition]);

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollPosition;
    const timeMs = (x / zoomLevel) * 1000;
    seek(timeMs);
  }, [scrollPosition, zoomLevel, seek]);

  const handleBgClick = useCallback(() => {
    deselectAll();
  }, [deselectAll]);

  const handleDelete = useCallback(() => {
    if (selectedClipIds.length > 0) deleteClips(selectedClipIds);
  }, [selectedClipIds, deleteClips]);

  const playheadPx = msToPx(currentTimeMs, zoomLevel) - scrollPosition;

  return (
    <div className="flex flex-col h-full bg-[hsl(224,71%,3%)] select-none">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card shrink-0">
        <span className="text-xs font-medium text-muted-foreground">Timeline</span>
        <div className="flex-1" />
        <button
          onClick={toggleSnap}
          title="Toggle snap"
          className={`p-1 rounded transition-colors ${snapEnabled ? 'text-yellow-400 bg-yellow-400/10' : 'text-muted-foreground hover:bg-accent'}`}
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => handleWheel({ deltaY: 100 } as any)} className="p-1 rounded text-muted-foreground hover:bg-accent">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-muted-foreground w-10 text-center">{zoomLevel}px/s</span>
        <button onClick={() => handleWheel({ deltaY: -100 } as any)} className="p-1 rounded text-muted-foreground hover:bg-accent">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col shrink-0" style={{ width: HEADER_WIDTH }}>
          <div className="h-7 border-b border-border" />
          {tracks.map((track) => (
            <div
              key={track.id}
              style={{ height: TRACK_HEIGHT, borderColor: track.color }}
              className="flex flex-col justify-center px-2 border-b border-border/50 border-l-2"
            >
              <span className="text-xs font-medium text-foreground truncate">{track.label}</span>
              <span className="text-xs text-muted-foreground capitalize">{track.type}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div
            ref={scrollRef}
            className="absolute inset-0 overflow-x-auto overflow-y-hidden"
            onScroll={handleScrollLeft}
            onWheel={handleWheel}
          >
            <div style={{ width: totalWidthPx, minWidth: '100%' }}>
              <TimelineRuler
                zoomLevel={zoomLevel}
                scrollPosition={scrollPosition}
                totalWidthPx={totalWidthPx}
                onSeek={(ms) => seek(ms)}
              />

              <div className="relative" onClick={handleBgClick}>
                {tracks.map((track) => (
                  <TimelineTrack
                    key={track.id}
                    track={track}
                    clips={clips.filter((c) => c.trackId === track.id)}
                    zoomLevel={zoomLevel}
                    selectedClipIds={selectedClipIds}
                    projectId={projectId}
                  />
                ))}

                {playheadPx >= 0 && (
                  <div
                    className="playhead"
                    style={{ left: msToPx(currentTimeMs, zoomLevel) }}
                  />
                )}

                <SnapGuide zoomLevel={zoomLevel} scrollPosition={scrollPosition} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
