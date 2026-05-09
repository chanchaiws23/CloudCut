import type { Clip } from '../../types';
import { msToTimecode, formatDuration } from '../../utils/timecode';

interface ClipInfoProps {
  clip: Clip;
}

export function ClipInfo({ clip }: ClipInfoProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-foreground">Clip Info</h4>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Duration</span>
          <span className="text-foreground font-mono">{formatDuration(clip.durationMs)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Position</span>
          <span className="text-foreground font-mono">{msToTimecode(clip.trackPositionMs)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">In Point</span>
          <span className="text-foreground font-mono">{msToTimecode(clip.inPointMs)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Out Point</span>
          <span className="text-foreground font-mono">{msToTimecode(clip.outPointMs)}</span>
        </div>
      </div>
    </div>
  );
}
