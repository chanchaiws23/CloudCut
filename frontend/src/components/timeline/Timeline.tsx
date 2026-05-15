import { useRef, useCallback, useEffect } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useUIStore } from '../../state/uiStore';
import { usePlaybackStore } from '../../state/playbackStore';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';
import { Playhead } from './Playhead';
import { SnapGuide } from './SnapGuide';
import { RemoteCursors } from '../collaboration/RemoteCursors';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useZoom } from '../../hooks/useZoom';
import { usePresence } from '../../hooks/usePresence';
import { msToPx } from '../../utils/timecode';
import { ZoomIn, ZoomOut, Magnet } from 'lucide-react';
import { Lock, Unlock, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { api } from '../../services/api';

interface TimelineProps {
  projectId: string;
}

const TRACK_HEIGHT = 56;
const HEADER_WIDTH = 120;
const EMPTY_TIMELINE_MS = 10000;
const END_PADDING_MS = 5000;

export function Timeline({ projectId }: TimelineProps) {
  const { tracks, clips, deleteClips, updateTrack } = useProjectStore();
  const { selectedClipIds, zoomLevel, scrollPosition, snapEnabled, hiddenTrackIds, setScrollPosition, toggleSnap, toggleTrackVisibility, deselectAll } = useUIStore();
  const { currentTimeMs, seek } = usePlaybackStore();
  const { onlineUsers } = usePresence(projectId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { handleWheel } = useZoom();

  useKeyboardShortcuts();

  const contentDurationMs = clips.reduce((max, c) => Math.max(max, c.trackPositionMs + c.durationMs), 0);
  const timelineDurationMs = Math.max(contentDurationMs + END_PADDING_MS, EMPTY_TIMELINE_MS);
  const totalWidthPx = msToPx(timelineDurationMs, zoomLevel);

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
  const patchTrack = (trackId: string, changes: Partial<(typeof tracks)[number]>) => {
    updateTrack(trackId, changes);
    api.timeline.updateTrack(projectId, trackId, changes).catch(console.error);
  };

  return (
    <div data-testid="timeline" className="flex flex-col h-full bg-background select-none">
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
        <div className="flex flex-col shrink-0 bg-card" style={{ width: HEADER_WIDTH }}>
          <div className="h-7 border-b border-border bg-muted/30" />
          {tracks.map((track) => (
            <div
              key={track.id}
              style={{ height: TRACK_HEIGHT, borderColor: track.color }}
              className="flex flex-col justify-center px-2 border-b border-border/50 border-l-2 bg-card"
            >
              <span className="text-xs font-medium text-foreground truncate">{track.label}</span>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-xs text-muted-foreground capitalize flex-1">{track.type}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" title={track.isLocked ? 'Unlock track' : 'Lock track'} onClick={() => patchTrack(track.id, { isLocked: !track.isLocked })}>
                  {track.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" title={track.isMuted ? 'Unmute track' : 'Mute track'} onClick={() => patchTrack(track.id, { isMuted: !track.isMuted })}>
                  {track.isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" title={hiddenTrackIds.includes(track.id) ? 'Show track' : 'Hide track'} onClick={() => toggleTrackVisibility(track.id)}>
                  {hiddenTrackIds.includes(track.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden relative bg-background">
          <div
            ref={scrollRef}
            className="timeline-scroll-container absolute inset-0 overflow-x-auto overflow-y-hidden"
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
                    remoteUsers={onlineUsers}
                  />
                ))}

                {playheadPx >= 0 && <Playhead zoomLevel={zoomLevel} scrollPosition={scrollPosition} />}

                <SnapGuide zoomLevel={zoomLevel} scrollPosition={scrollPosition} />
                <RemoteCursors users={onlineUsers} zoomLevel={zoomLevel} scrollPosition={scrollPosition} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
