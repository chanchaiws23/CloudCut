import { useCallback } from 'react';
import { useUIStore } from '../state/uiStore';

export function useZoom() {
  const { zoomLevel, setZoom } = useUIStore();

  const handleWheel = useCallback((e: React.WheelEvent | WheelEvent) => {
    if ((e as React.WheelEvent).ctrlKey || (e as WheelEvent).ctrlKey) {
      (e as any).preventDefault?.();
      const delta = (e as WheelEvent).deltaY > 0 ? -5 : 5;
      setZoom(zoomLevel + delta);
    }
  }, [zoomLevel, setZoom]);

  return { handleWheel, zoomLevel };
}
