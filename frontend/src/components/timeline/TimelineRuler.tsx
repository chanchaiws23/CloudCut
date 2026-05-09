import { useMemo } from 'react';
import { msToTimecode, getTickInterval, msToPx } from '../../utils/timecode';

interface TimelineRulerProps {
  zoomLevel: number;
  scrollPosition: number;
  totalWidthPx: number;
  onSeek: (ms: number) => void;
}

export function TimelineRuler({ zoomLevel, totalWidthPx, onSeek }: TimelineRulerProps) {
  const { major, minor } = getTickInterval(zoomLevel);

  const ticks = useMemo(() => {
    const result: Array<{ ms: number; isMajor: boolean }> = [];
    const totalMs = (totalWidthPx / zoomLevel) * 1000;
    for (let ms = 0; ms <= totalMs; ms += minor) {
      result.push({ ms, isMajor: ms % major === 0 });
    }
    return result;
  }, [zoomLevel, totalWidthPx, major, minor]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ms = (x / zoomLevel) * 1000;
    onSeek(ms);
  };

  return (
    <div
      className="h-7 relative border-b border-border bg-card cursor-pointer"
      style={{ width: totalWidthPx }}
      onClick={handleClick}
    >
      {ticks.map(({ ms, isMajor }) => {
        const x = msToPx(ms, zoomLevel);
        return (
          <div key={ms} className="absolute top-0 flex flex-col items-start" style={{ left: x }}>
            <div
              className={`${isMajor ? 'h-3 bg-muted-foreground' : 'h-1.5 bg-muted-foreground/40'} w-px`}
            />
            {isMajor && (
              <span className="text-[10px] text-muted-foreground ml-1 whitespace-nowrap">
                {msToTimecode(ms)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
