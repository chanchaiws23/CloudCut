import { useUIStore } from '../../state/uiStore';
import { useProjectStore } from '../../state/projectStore';
import { usePlaybackStore } from '../../state/playbackStore';
import { msToPx } from '../../utils/timecode';

interface SnapGuideProps {
  zoomLevel: number;
  scrollPosition: number;
}

export function SnapGuide({ zoomLevel }: SnapGuideProps) {
  const { snapEnabled } = useUIStore();
  const { clips } = useProjectStore();
  const { currentTimeMs } = usePlaybackStore();

  if (!snapEnabled) return null;

  const snapPoints = [
    currentTimeMs,
    ...clips.flatMap((c) => [c.trackPositionMs, c.trackPositionMs + c.durationMs]),
  ];

  return (
    <>
      {snapPoints.map((ms, i) => (
        <div
          key={i}
          className="snap-guide opacity-0 hover:opacity-100"
          style={{ left: msToPx(ms, zoomLevel) }}
        />
      ))}
    </>
  );
}
