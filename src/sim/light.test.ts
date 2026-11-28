import { describe, expect, it } from 'vitest';
import { DUCK, inShadow, maskArea, maskTop, overlap, segmentHits, shadowMask, type Ellipsoid } from './light';
import { catInShadow, catPoints, catShade, duckAt, GRID, judge, lampAt, maskOf, scene02 as S } from '../game/scene02';

const ball: Ellipsoid[] = [{ c: { x: 0, y: 10, z: 0 }, r: { x: 5, y: 5, z: 5 } }];
const at = (z: number) => ({ x: 0, y: 10, z });
const pose = { x: 0, z: 40, yaw: 0 };

describe('straight-line light', () => {
  it('a segment through a ball hits it, one beside it does not', () => {
    expect(segmentHits({ x: -10, y: 10, z: 0 }, { x: 10, y: 10, z: 0 }, ball[0])).toBe(true);
    expect(segmentHits({ x: -10, y: 16, z: 0 }, { x: 10, y: 16, z: 0 }, ball[0])).toBe(false);
    // The ball is beyond the end of the segment: no hit.
    expect(segmentHits({ x: -30, y: 10, z: 0 }, { x: -10, y: 10, z: 0 }, ball[0])).toBe(false);
  });

  it('shadow of a ball is a disc whose size follows similar triangles', () => {
    // Lamp level with the ball's centre: edge rays are tangent, radius on the wall = D·r/√(L²−r²)
    for (const z of [120, 80, 60]) {
      const fine = { ...GRID, cell: 0.5, cols: GRID.cols * 2, rows: GRID.rows * 2 };
      const L = z - 40, R = (z * 5) / Math.sqrt(L * L - 25);
      expect(maskTop(shadowMask(at(z), ball, pose, fine), fine) - 10).toBeCloseTo(R, 0);
    }
  });

  it('the shadow grows as the lamp comes closer', () => {
    let last = 0;
    for (let z = S.lamp.max; z >= S.lamp.min; z -= 6) {
      const area = maskArea(maskOf({ lampZ: z, markX: 0 }), GRID);
      expect(area).toBeGreaterThan(last);
      last = area;
    }
  });

  it('the shadow moves further than the object does', () => {
    const tip = (markX: number) => { const m = maskOf({ lampZ: 60, markX }); let right = -1; for (let i = 0; i < m.length; i++) if (m[i]) right = Math.max(right, i % GRID.cols); return right; };
    expect(tip(2) - tip(0)).toBeGreaterThanOrEqual(5);
  });

  it('turning the object changes the shape of its shadow', () => {
    const lamp = lampAt({ lampZ: 70, markX: 0 });
    const side = shadowMask(lamp, DUCK, duckAt(0), GRID), front = shadowMask(lamp, DUCK, { ...duckAt(0), yaw: Math.PI / 2 }, GRID);
    expect(overlap(side, front)).toBeLessThan(0.8);
  });

  it('nothing is in shadow where no part of the object is in the way', () => {
    expect(inShadow(at(80), 40, 40, ball, pose)).toBe(false);
    expect(inShadow(at(80), 0, 10, ball, pose)).toBe(true);
  });
});

describe('scene 02 is playable', () => {
  const lamps: number[] = [], marks: number[] = [];
  for (let z = S.lamp.min; z <= S.lamp.max; z += 1) lamps.push(z);
  for (let x = S.duck.min; x <= S.duck.max; x += 0.5) marks.push(x);
  const [play, dark, cat] = S.beats;

  it('every storyboard outline fits on the wall with the cat outside it', () => {
    for (const b of S.beats) {
      const m = maskOf(b.target);
      expect(maskTop(m, GRID)).toBeLessThan(S.wall.height - 2);
      for (let j = 0; j < GRID.rows; j++) { expect(m[j * GRID.cols]).toBe(0); expect(m[j * GRID.cols + GRID.cols - 1]).toBe(0); }
      if (b.cat) expect(catInShadow(b.target)).toBe(false);
      expect(judge(b, b.target).keeper).toBe(true);
    }
  });

  it('lamp-only beats: the opening set-up fails and there is finger room around the answer', () => {
    for (const b of [play, dark]) {
      expect(judge(b, { lampZ: b.start!.lampZ!, markX: b.target.markX }).keeper).toBe(false);
      const wins = lamps.filter(z => judge(b, { lampZ: z, markX: b.target.markX }).keeper);
      console.log(`beat ${b.id}: keeper for lamp ${Math.min(...wins)}–${Math.max(...wins)} cm`);
      expect(wins.length).toBeGreaterThanOrEqual(5);
      expect(wins.length).toBeLessThanOrEqual(20);
      // A keeper must look like one: the shadow's height is within 2 cm of the outline's.
      const want = maskTop(maskOf(b.target), GRID);
      for (const z of wins) if (b.rehearsalLight) expect(Math.abs(maskTop(maskOf({ lampZ: z, markX: b.target.markX }), GRID) - want)).toBeLessThanOrEqual(2);
    }
  });

  it('the dark beat cannot be passed with the answer from the lit beat', () => {
    expect(judge(dark, play.target).keeper).toBe(false);
  });

  it('cat beat: the previous answer leaves the cat in the dark', () => {
    for (const z of lamps) if (judge(dark, { lampZ: z, markX: dark.target.markX }).keeper) expect(catInShadow({ lampZ: z, markX: dark.target.markX })).toBe(true);
  });

  it('the cat is judged on its body and head, where it really sits', { timeout: 30000 }, () => {
    // Enough points to stand for an area, all on the front surface, well clear of the wall.
    expect(catPoints().length).toBeGreaterThan(60);
    for (const p of catPoints()) expect(p.z).toBeGreaterThan(1.9);
    // Found in review, measured there on the rendered cat: 22.6% shaded here, 56.8% there.
    // The first passes the outline and must not be cut for the cat; the second is truly dark.
    expect(catShade({ lampZ: 61.5, markX: -1.5 })).toBeLessThan(0.4);
    expect(judge(cat, { lampZ: 61.5, markX: -1.5 }).catDark).toBe(false);
    expect(catShade({ lampZ: 58.5, markX: 7.5 })).toBeGreaterThan(0.4);
    expect(catInShadow({ lampZ: 58.5, markX: 7.5 })).toBe(true);
    // Found in review: a shadow that only clips the cat must not be reported as "the cat is in
    // the dark". Such set-ups exist, and none of them may be called dark.
    let clipped = 0;
    for (const z of lamps) for (const x of marks) {
      const shade = catShade({ lampZ: z, markX: x });
      if (shade > 0 && shade < 0.4) { clipped++; expect(judge(cat, { lampZ: z, markX: x }).catDark).toBe(false); }
    }
    expect(clipped).toBeGreaterThan(20);
    // The cat still matters: some set-ups fill the outline well enough and are cut only because of it.
    let cutForCat = 0;
    for (const z of lamps) for (const x of marks) { const v = judge(cat, { lampZ: z, markX: x }); if (v.match >= S.keeper && v.catDark) cutForCat++; }
    expect(cutForCat).toBeGreaterThan(0);
    // The two set-ups the story depends on, at their extremes: fully dark, then fully lit.
    expect(catShade(dark.target)).toBe(1);
    expect(catShade(cat.target)).toBe(0);
    // And every way of passing the lights-out beat leaves the cat wholly in shadow.
    for (const z of lamps) if (judge(dark, { lampZ: z, markX: dark.target.markX }).keeper) expect(catShade({ lampZ: z, markX: dark.target.markX })).toBe(1);
  });

  it('cat beat: solvable with finger room, and not by guessing', { timeout: 30000 }, () => {
    let wins = 0, widest = 0;
    for (const z of lamps) { let run = 0; for (const x of marks) { if (judge(cat, { lampZ: z, markX: x }).keeper) { wins++; widest = Math.max(widest, ++run); } else run = 0; } }
    const share = wins / (lamps.length * marks.length);
    console.log(`beat cat: keeper region ${(share * 100).toFixed(1)}% of set-ups, widest mark window ${widest * 0.5} cm`);
    expect(widest * 0.5).toBeGreaterThanOrEqual(2.5);
    expect(share).toBeGreaterThan(0.01);
    expect(share).toBeLessThan(0.08);
  });
});

describe('press questions', async () => {
  const { QUESTIONS } = await import('../game/questions');
  it('every item has four distinct options in both languages and a reason', () => {
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4);
      for (const l of ['en', 'zh'] as const) {
        expect(new Set(q.options.map(o => o[l])).size).toBe(4);
        expect(q.ask[l].length).toBeGreaterThan(5);
        expect(q.why[l].length).toBeGreaterThan(5);
      }
    }
    for (const b of S.beats) expect(QUESTIONS.filter(q => q.beat === b.id).length).toBeGreaterThanOrEqual(3);
  });
  it('the data-table item quotes heights that really rise as the lamp comes closer', () => {
    const q = QUESTIONS.find(x => x.id === 'L-table')!;
    const nums = q.options.map(o => parseInt(o.en, 10));
    expect(nums[0]).toBeGreaterThan(nums[1]);
    expect(nums[1]).toBeGreaterThan(nums[2]);
    expect(nums[2]).toBeGreaterThan(nums[3]);
  });
});

describe('structured questions', async () => {
  const { OPEN_QUESTIONS } = await import('../game/questions');
  it('every blank named in the sentence exists, in both languages, with three distinct choices', () => {
    for (const q of OPEN_QUESTIONS) for (const part of q.parts) for (const l of ['en', 'zh'] as const) {
      const used = [...part.text[l].matchAll(/\{(\d)\}/g)].map(m => Number(m[1])).sort();
      expect(used).toEqual(part.blanks.map((_, i) => i));
      for (const b of part.blanks) { expect(b).toHaveLength(3); expect(new Set(b.map(o => o[l])).size).toBe(3); }
    }
  });
});
