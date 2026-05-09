import { describe, it, expect } from 'vitest';
import { snapToNearest } from '../src/utils/geometry';
import { snapToGrid } from '../src/utils/timecode';

describe('snapToNearest', () => {
  it('snaps to nearest point within threshold', () => {
    expect(snapToNearest(1050, [0, 1000, 2000], 100)).toBe(1000);
  });
  it('snaps to closest when multiple points are within threshold', () => {
    expect(snapToNearest(1060, [1000, 1100], 200)).toBe(1000);
  });
  it('returns original value when no snap point is within threshold', () => {
    expect(snapToNearest(1500, [0, 1000, 2000], 100)).toBe(1500);
  });
  it('snaps exactly on a point', () => {
    expect(snapToNearest(2000, [0, 1000, 2000], 50)).toBe(2000);
  });
});

describe('snapToGrid', () => {
  it('snaps below midpoint down', () => {
    expect(snapToGrid(400, 1000)).toBe(0);
  });
  it('snaps at midpoint up', () => {
    expect(snapToGrid(500, 1000)).toBe(1000);
  });
  it('snaps above midpoint up', () => {
    expect(snapToGrid(600, 1000)).toBe(1000);
  });
  it('works with 5000ms grid', () => {
    expect(snapToGrid(6000, 5000)).toBe(5000);
    expect(snapToGrid(7500, 5000)).toBe(10000);
  });
});
