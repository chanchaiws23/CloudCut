import { describe, it, expect } from 'vitest';
import {
  msToTimecode,
  timecodeToMs,
  formatDuration,
  pxToMs,
  msToPx,
  snapToGrid,
  getTickInterval,
} from './timecode';

describe('msToTimecode', () => {
  it('formats minutes-only timecode', () => {
    expect(msToTimecode(65000, 30)).toBe('01:05:00');
  });

  it('formats timecode with hours', () => {
    expect(msToTimecode(3661000, 30)).toBe('01:01:01:00');
  });

  it('rounds frames correctly', () => {
    expect(msToTimecode(1233, 30)).toBe('00:01:07');
  });
});

describe('timecodeToMs', () => {
  it('parses mm:ss:ff format', () => {
    expect(timecodeToMs('01:05:00', 30)).toBe(65000);
  });

  it('parses hh:mm:ss:ff format', () => {
    expect(timecodeToMs('01:01:01:00', 30)).toBe(3661000);
  });

  it('returns 0 for invalid format', () => {
    expect(timecodeToMs('invalid')).toBe(0);
  });
});

describe('formatDuration', () => {
  it('returns seconds for short durations', () => {
    expect(formatDuration(45000)).toBe('45s');
  });

  it('returns minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('returns only minutes when no remainder', () => {
    expect(formatDuration(120000)).toBe('2m');
  });
});

describe('pxToMs / msToPx', () => {
  it('converts pixels to milliseconds', () => {
    expect(pxToMs(100, 50)).toBe(2000);
  });

  it('converts milliseconds to pixels', () => {
    expect(msToPx(2000, 50)).toBe(100);
  });

  it('round-trips correctly', () => {
    const ms = 5000;
    const pxPerSecond = 50;
    expect(pxToMs(msToPx(ms, pxPerSecond), pxPerSecond)).toBe(ms);
  });
});

describe('snapToGrid', () => {
  it('snaps to nearest grid point', () => {
    expect(snapToGrid(1450, 500)).toBe(1500);
    expect(snapToGrid(1200, 500)).toBe(1000);
  });
});

describe('getTickInterval', () => {
  it('returns correct intervals for zoom levels', () => {
    expect(getTickInterval(120)).toEqual({ major: 5000, minor: 1000 });
    expect(getTickInterval(50)).toEqual({ major: 10000, minor: 5000 });
    expect(getTickInterval(5)).toEqual({ major: 300000, minor: 60000 });
  });
});
