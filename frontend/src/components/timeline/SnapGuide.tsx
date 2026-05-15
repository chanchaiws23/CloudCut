import { useUIStore } from '../../state/uiStore';
import { useProjectStore } from '../../state/projectStore';
import { usePlaybackStore } from '../../state/playbackStore';
import { msToPx } from '../../utils/timecode';

interface SnapGuideProps {
  zoomLevel: number;
  scrollPosition: number;
}

export function SnapGuide({ zoomLevel }: SnapGuideProps) {
  const { snapEnabled, snapGuideMs } = useUIStore();
  const { currentTimeMs } = usePlaybackStore();

  if (!snapEnabled) return null;

  const visibleGuide = snapGuideMs ?? currentTimeMs;

  return (
    <div
      className="snap-guide"
      style={{ left: msToPx(visibleGuide, zoomLevel), opacity: snapGuideMs === null ? 0.25 : 1 }}
    />
  );
}
