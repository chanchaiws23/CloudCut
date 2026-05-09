import { describe, it, expect } from 'vitest';
import { msToTimecode, timecodeToMs, pxToMs, msToPx, snapToGrid, getTickInterval } from '../src/utils/timecode';

describe('msToTimecode', () => {
  it('converts 0ms to 00:00:00', () => {
    expect(msToTimecode(0)).toBe('00:00:00');
  });
  it('converts 1500ms to 00:01:15', () => {
    expect(msToTimecode(1500)).toBe('00:01:15');
  });
  it('converts 60000ms to 01:00:00', () => {
    expect(msToTimecode(60000)).toBe('01:00:00');
  });
  it('converts 90500ms to 01:30:15', () => {
    expect(msToTimecode(90500)).toBe('01:30:15');
  });
});

describe('timecodeToMs', () => {
  it('converts 00:00:00 to 0ms', () => {
    expect(timecodeToMs('00:00:00')).toBe(0);
  });
  it('converts 01:30:00 to 90000ms', () => {
    expect(timecodeToMs('01:30:00')).toBe(90000);
  });
});

describe('pxToMs / msToPx', () => {
  it('converts 100px at 50px/s to 2000ms', () => {
    expect(pxToMs(100, 50)).toBe(2000);
  });
  it('converts 2000ms at 50px/s to 100px', () => {
    expect(msToPx(2000, 50)).toBe(100);
  });
  it('roundtrips correctly', () => {
    const ms = 5000;
    const zoom = 75;
    expect(pxToMs(msToPx(ms, zoom), zoom)).toBe(ms);
  });
});

describe('snapToGrid', () => {
  it('snaps 1300ms to 1000ms grid', () => {
    expect(snapToGrid(1300, 1000)).toBe(1000);
  });
  it('snaps 1600ms to 2000ms grid', () => {
    expect(snapToGrid(1600, 1000)).toBe(2000);
  });
});

describe('getTickInterval', () => {
  it('returns fine ticks at high zoom', () => {
    const { minor } = getTickInterval(100);
    expect(minor).toBe(1000);
  });
  it('returns coarse ticks at low zoom', () => {
    const { minor } = getTickInterval(5);
    expect(minor).toBe(60000);
  });
});
