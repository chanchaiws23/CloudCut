import type { DragEvent } from 'react';
import type { Track, Clip } from '../../types';
import { TimelineClip } from './TimelineClip';
import { useProjectStore } from '../../state/projectStore';
import { useUIStore } from '../../state/uiStore';
import { api } from '../../services/api';
import type { PresenceUser } from '../../hooks/usePresence';

interface TimelineTrackProps {
  track: Track;
  clips: Clip[];
  zoomLevel: number;
  selectedClipIds: string[];
  projectId: string;
  remoteUsers: PresenceUser[];
}

const TRACK_HEIGHT = 56;

export function TimelineTrack({ track, clips, zoomLevel, selectedClipIds, projectId, remoteUsers }: TimelineTrackProps) {
  const { assets, addClipUndoable } = useProjectStore();
  const { hiddenTrackIds } = useUIStore();
  const isHidden = hiddenTrackIds.includes(track.id);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    const transferTypes = Array.from(e.dataTransfer.types).map((type) => type.toLowerCase());
    if (!track.isLocked && transferTypes.includes('assetid')) e.preventDefault();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (track.isLocked) return;

    const assetId = e.dataTransfer.getData('assetId');
    const assetType = e.dataTransfer.getData('assetType');
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;

    const isCompatible =
      (track.type === 'video' && (assetType === 'video' || assetType === 'image')) ||
      (track.type === 'audio' && assetType === 'audio');
    if (!isCompatible) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const trackPositionMs = Math.max(0, Math.round(((e.clientX - rect.left) / zoomLevel) * 1000));
    const durationMs = asset.metadata?.duration_ms || (asset.type === 'image' ? 5000 : 10000);

    try {
      const clip = await api.timeline.createClip(projectId, {
        trackId: track.id,
        assetId,
        trackPositionMs,
        inPointMs: 0,
        outPointMs: durationMs,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      });
      addClipUndoable(clip);
    } catch (error) {
      console.error('Failed to create clip:', error);
    }
  };

  return (
    <div
      data-track-id={track.id}
      data-testid="timeline-track"
      className="relative border-b border-border/50 bg-background"
      style={{ height: TRACK_HEIGHT }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!isHidden && clips
        .filter((c) => !c.deletedAt)
        .map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            track={track}
            zoomLevel={zoomLevel}
            isSelected={selectedClipIds.includes(clip.id)}
            projectId={projectId}
            remoteEditingBy={remoteUsers.filter((user) => !user.isSelf && user.activeClipId === clip.id)}
          />
        ))}
    </div>
  );
}
