import { describe, expect, it } from 'vitest';
import { coverage, inShadow, magnification, maskExtent, projectToWall, shadowExtent, wallToObject, type Mask, type Rig } from './shadow';
import { DUCK_FRONT, DUCK_SIDE, rasterize } from './shapes';
import { evaluate, isShot, level02 } from '../game/level02';

const rig = (lampD: number, objX = 0): Rig => ({ lampX: 0, lampH: 2, lampD, objX, objD: 40 });

/** A solid 10 cm × 10 cm card. */
const card: Mask = { w: 10, h: 10, alpha: new Uint8Array(100).fill(255), widthCm: 10, heightCm: 10 };

describe('shadow projection', () => {
  it('follows similar triangles', () => {
    expect(magnification(rig(80))).toBeCloseTo(2);
    expect(magnification(rig(120))).toBeCloseTo(1.5);
    expect(magnification(rig(60))).toBeCloseTo(3);
  });

  it('makes a bigger shadow as the lamp moves closer to the object', () => {
    let last = 0;
    for (let d = 120; d >= 56; d -= 4) {
      const top = shadowExtent(rig(d), card)!.top;
      expect(top).toBeGreaterThan(last);
      last = top;
    }
  });

  it('keeps the shadow the same shape, only scaled', () => {
    const e = shadowExtent(rig(80), card)!;
    expect((e.right - e.left) / (e.top - e.bottom)).toBeCloseTo(1);
    expect(e.right - e.left).toBeCloseTo(20);
  });

  it('sends light in straight lines: lamp, cutout point and wall point are collinear', () => {
    const r = rig(70, 3);
    const obj = { x: 6, y: 9 };
    const wall = projectToWall(r, obj.x, obj.y);
    // Slopes measured along depth must match on both segments.
    expect((obj.x - r.lampX) / (r.lampD - r.objD)).toBeCloseTo((wall.x - r.lampX) / r.lampD);
    expect((obj.y - r.lampH) / (r.lampD - r.objD)).toBeCloseTo((wall.y - r.lampH) / r.lampD);
    const back = wallToObject(r, wall.x, wall.y);
    expect(back.x).toBeCloseTo(obj.x);
    expect(back.y).toBeCloseTo(obj.y);
  });

  it('moves the shadow further than the object moves', () => {
    const a = shadowExtent(rig(60, 0), card)!, b = shadowExtent(rig(60, 1), card)!;
    expect(b.left - a.left).toBeCloseTo(3);
  });

  it('lets light through holes and past edges', () => {
    const holed: Mask = { ...card, alpha: new Uint8Array(100).fill(255) };
    holed.alpha[5 * 10 + 5] = 0;
    const r = rig(80);
    const hole = projectToWall(r, 0.5, 4.5);
    expect(inShadow(r, holed, hole.x, hole.y)).toBe(false);
    expect(inShadow(r, card, hole.x, hole.y)).toBe(true);
    expect(inShadow(r, card, 30, 10)).toBe(false);
  });

  it('rejects a lamp between the object and the wall', () => {
    expect(() => magnification(rig(40))).toThrow();
  });
});

describe('scene 02 is playable', () => {
  const side = rasterize(DUCK_SIDE), front = rasterize(DUCK_FRONT);
  const L = level02, [A, B] = L.shots;
  const lamps: number[] = [], ducks: number[] = [];
  for (let d = L.lamp.min; d <= L.lamp.max; d += 0.5) lamps.push(d);
  for (let x = L.duck.min; x <= L.duck.max; x += 0.25) ducks.push(x);

  it('has a duck whose beak is its right-most point', () => {
    const e = maskExtent(side)!;
    expect(e.tip.x).toBeGreaterThan(9);
    expect(e.tip.y).toBeGreaterThan(10);
    expect(e.top).toBeGreaterThan(15);
  });

  it('shot A: the starting set fails, pushing the lamp in succeeds', () => {
    expect(isShot(A, evaluate(L, L.lamp.start, L.duck.start, side, false))).toBe(false);
    const wins = lamps.filter(d => isShot(A, evaluate(L, d, L.duck.start, side, false)));
    console.log(`shot A wins for lamp ${Math.min(...wins)}–${Math.max(...wins)} cm from the wall (${wins.length * 0.5} cm of travel)`);
    expect(wins.length * 0.5).toBeGreaterThanOrEqual(5);
    // The storyboard position must not already be the answer.
    expect(isShot(A, evaluate(L, A.prediction.to!, L.duck.start, side, false))).toBe(false);
  });

  it('shot B: every shot-A solution upsets the cat, so the duck has to move', () => {
    for (const d of lamps) {
      const s = evaluate(L, d, L.duck.start, side, true);
      if (s.covered.every(Boolean)) expect(s.catBlocked).toBe(true);
    }
  });

  it('shot B: is solvable with room for a finger, and not by wiggling at random', () => {
    let wins = 0, bestRun = 0;
    for (const d of lamps) {
      let run = 0;
      for (const x of ducks) {
        if (isShot(B, evaluate(L, d, x, side, true))) { wins++; run++; bestRun = Math.max(bestRun, run); } else run = 0;
      }
    }
    const share = wins / (lamps.length * ducks.length);
    console.log(`shot B win region: ${(share * 100).toFixed(1)}% of the set, widest duck window ${bestRun * 0.25} cm`);
    expect(bestRun * 0.25).toBeGreaterThanOrEqual(2);
    expect(share).toBeLessThan(0.08);
    expect(share).toBeGreaterThan(0.01);
  });

  it('shot B: the wide front-facing cutout can also get the shot', () => {
    let wins = 0;
    for (const d of lamps) for (const x of ducks) if (isShot(B, evaluate(L, d, x, front, true))) wins++;
    console.log(`front cutout win cells: ${wins}`);
    expect(wins).toBeGreaterThan(0);
  });

  it('cat zone and paw zone do not overlap the target column', () => {
    const r = rig(60, -20);
    expect(coverage(r, side, L.cat)).toBe(0);
  });
});
