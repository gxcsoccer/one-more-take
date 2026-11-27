import { describe, expect, it } from 'vitest';
import { AdaptiveResolution } from './quality';

const run = (q: AdaptiveResolution, fps: number, frames: number) => {
  const changes: number[] = [];
  for (let i = 0; i < frames; i++) { const r = q.step(1 / fps); if (r !== null) changes.push(r); }
  return changes;
};

describe('adaptive resolution', () => {
  it('leaves a fast machine alone', () => {
    const q = new AdaptiveResolution(2);
    expect(run(q, 60, 3000)).toEqual([]);
    expect(q.ratio).toBe(2);
  });

  it('steps down to 1x on a slow machine, one half-step per window, and stops there', () => {
    const q = new AdaptiveResolution(2);
    expect(run(q, 30, 104)).toEqual([]);
    expect(run(q, 30, 1)).toEqual([1.5]);
    expect(run(q, 30, 105)).toEqual([1]);
    expect(run(q, 30, 3000)).toEqual([]);
    expect(q.ratio).toBe(1);
  });

  it('never goes back up when frames get fast again', () => {
    const q = new AdaptiveResolution(2);
    run(q, 30, 105);
    expect(run(q, 120, 3000)).toEqual([]);
    expect(q.ratio).toBe(1.5);
  });

  it('ignores the slow frames right after start-up', () => {
    const q = new AdaptiveResolution(2);
    // 45 very slow frames while things load, then smooth.
    expect([...run(q, 5, 45), ...run(q, 60, 2000)]).toEqual([]);
  });

  it('keeps sampling back to back, so recurring slow stretches are not skipped as warm-up', () => {
    const q = new AdaptiveResolution(2);
    expect(run(q, 60, 105)).toEqual([]);
    // 45 slow frames then 60 fast ones, repeated: about 36 fps overall.
    const changes: number[] = [];
    for (let i = 0; i < 6; i++) changes.push(...run(q, 24, 45), ...run(q, 60, 60));
    expect(changes[0]).toBe(1.5);
  });

  it('holds at a middle ratio once that is fast enough', () => {
    const q = new AdaptiveResolution(2);
    run(q, 30, 105);
    expect(run(q, 50, 2000)).toEqual([]);
    expect(q.ratio).toBe(1.5);
  });
});
