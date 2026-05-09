import { useCallback } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useUIStore } from '../state/uiStore';
import { snapToNearest } from '../utils/geometry';

const SNAP_THRESHOLD_PX = 8;

export function useSnap(zoomLevel: number) {
  const { clips } = useProjectStore();
  const { snapEnabled, setSnapGuideMs } = useUIStore();

  const getSnapPoints = useCallback((excludeClipId?: string): number[] => {
    return clips
      .filter((c) => c.id !== excludeClipId)
      .flatMap((c) => [c.trackPositionMs, c.trackPositionMs + c.durationMs]);
  }, [clips]);

  const applySnap = useCallback((
    positionMs: number,
    excludeClipId?: string,
    altKeyHeld = false,
  ): number => {
    if (!snapEnabled || altKeyHeld) {
      setSnapGuideMs(null);
      return positionMs;
    }

    const thresholdMs = (SNAP_THRESHOLD_PX / zoomLevel) * 1000;
    const snapPoints = getSnapPoints(excludeClipId);
    const snapped = snapToNearest(positionMs, snapPoints, thresholdMs);

    if (snapped !== null) {
      setSnapGuideMs(snapped);
      return snapped;
    }

    setSnapGuideMs(null);
    return positionMs;
  }, [snapEnabled, zoomLevel, getSnapPoints, setSnapGuideMs]);

  const clearSnap = useCallback(() => {
    setSnapGuideMs(null);
  }, [setSnapGuideMs]);

  return { applySnap, clearSnap, getSnapPoints };
}
