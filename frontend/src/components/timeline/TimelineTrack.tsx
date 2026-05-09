import type { Track, Clip } from '../../types';
import { TimelineClip } from './TimelineClip';

interface TimelineTrackProps {
  track: Track;
  clips: Clip[];
  zoomLevel: number;
  selectedClipIds: string[];
  projectId: string;
}

const TRACK_HEIGHT = 56;

export function TimelineTrack({ track, clips, zoomLevel, selectedClipIds, projectId }: TimelineTrackProps) {
  return (
    <div
      className="relative border-b border-border/50"
      style={{ height: TRACK_HEIGHT }}
    >
      {clips
        .filter((c) => !c.deletedAt)
        .map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            track={track}
            zoomLevel={zoomLevel}
            isSelected={selectedClipIds.includes(clip.id)}
            projectId={projectId}
          />
        ))}
    </div>
  );
}
