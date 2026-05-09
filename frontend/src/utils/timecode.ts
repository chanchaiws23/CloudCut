export function msToTimecode(ms: number, fps = 30): string {
  const totalSeconds = Math.floor(ms / 1000);
  const frames = Math.floor((ms % 1000) / (1000 / fps));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

export function timecodeToMs(timecode: string, fps = 30): number {
  const parts = timecode.split(':').map(Number);
  if (parts.length === 3) {
    const [mm, ss, ff] = parts;
    return mm * 60000 + ss * 1000 + Math.round(ff * (1000 / fps));
  }
  if (parts.length === 4) {
    const [hh, mm, ss, ff] = parts;
    return hh * 3600000 + mm * 60000 + ss * 1000 + Math.round(ff * (1000 / fps));
  }
  return 0;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remaining = s % 60;
  return remaining > 0 ? `${m}m ${remaining}s` : `${m}m`;
}

export function pxToMs(px: number, pxPerSecond: number): number {
  return (px / pxPerSecond) * 1000;
}

export function msToPx(ms: number, pxPerSecond: number): number {
  return (ms / 1000) * pxPerSecond;
}

export function snapToGrid(ms: number, gridMs: number): number {
  return Math.round(ms / gridMs) * gridMs;
}

export function getTickInterval(pxPerSecond: number): { major: number; minor: number } {
  if (pxPerSecond >= 100) return { major: 5000, minor: 1000 };
  if (pxPerSecond >= 50) return { major: 10000, minor: 5000 };
  if (pxPerSecond >= 20) return { major: 30000, minor: 10000 };
  if (pxPerSecond >= 10) return { major: 60000, minor: 30000 };
  return { major: 300000, minor: 60000 };
}
