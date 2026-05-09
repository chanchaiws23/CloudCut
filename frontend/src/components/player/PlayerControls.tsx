import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { usePlaybackStore } from '../../state/playbackStore';
import { msToTimecode } from '../../utils/timecode';

const SPEEDS = [0.5, 1, 1.5, 2];

export function PlayerControls() {
  const { currentTimeMs, isPlaying, volume, isMuted, durationMs, playbackSpeed, togglePlay, seek, setVolume, toggleMute, setSpeed } = usePlaybackStore();

  const progress = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div className="shrink-0 border-t border-border bg-card px-4 py-2 space-y-2">
      <div
        className="w-full h-1.5 bg-muted rounded-full cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          seek(ratio * durationMs);
        }}
      >
        <div className="h-full bg-blue-500 rounded-full group-hover:bg-blue-400 transition-colors" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => seek(0)} className="text-muted-foreground hover:text-foreground transition-colors">
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <button onClick={() => seek(durationMs)} className="text-muted-foreground hover:text-foreground transition-colors">
          <SkipForward className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono text-muted-foreground ml-1">
          {msToTimecode(currentTimeMs)} / {msToTimecode(durationMs)}
        </span>

        <div className="flex-1" />

        <select
          value={playbackSpeed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="bg-input border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>{s}x</option>
          ))}
        </select>

        <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground transition-colors">
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 accent-blue-500"
        />
      </div>
    </div>
  );
}
