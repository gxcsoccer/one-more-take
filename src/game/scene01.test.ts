import { describe, expect, it } from 'vitest';
import { candidates, judge01, judgeMarks, judgePlace, PROPS, scene01 as S, slotX } from './scene01';

const [spot, guess, star] = S.beats;
const subsets = <T,>(xs: T[]): T[][] => xs.reduce<T[][]>((acc, x) => acc.concat(acc.map(s => [...s, x])), [[]]);

describe('scene 01: lights out', () => {
  it('every prop on the bench is known, and stands inside the bench', () => {
    for (const b of S.beats) {
      b.props.forEach((id, i) => {
        expect(PROPS[id], id).toBeDefined();
        expect(slotX(i, b.props.length)).toBeGreaterThan(S.bench.x0);
        expect(slotX(i, b.props.length)).toBeLessThan(S.bench.x1);
      });
      expect(new Set(b.props).size).toBe(b.props.length);
    }
  });

  it('marking beats mix sources with things that only look bright, and count the duck', () => {
    for (const b of [spot, guess]) {
      const all = candidates(b);
      expect(all).toContain('duck');
      expect(all.filter(id => PROPS[id].source).length).toBeGreaterThanOrEqual(2);
      expect(all.filter(id => !PROPS[id].source).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('exactly one way of ticking is a keeper, so it cannot be passed by guessing', () => {
    for (const b of [spot, guess]) {
      const all = candidates(b), wins = subsets(all).filter(m => judgeMarks(b, m).keeper);
      expect(wins).toHaveLength(1);
      expect([...wins[0]].sort()).toEqual(all.filter(id => PROPS[id].source).sort());
      // Ticking everything, or nothing, is a cut.
      expect(judgeMarks(b, all).keeper).toBe(false);
      expect(judgeMarks(b, []).keeper).toBe(false);
    }
  });

  it('a cut says what was wrong: ticked by mistake, and left out', () => {
    const v = judgeMarks(spot, ['exit', 'moon']);
    expect(v).toEqual({ right: ['exit'], wrong: ['moon'], missed: ['lantern'], keeper: false });
    // The duck is bright yellow and gives out no light.
    expect(judgeMarks(spot, ['exit', 'lantern', 'duck']).wrong).toEqual(['duck']);
  });

  it('only the first beat lets the child try the switch; the others are predictions', () => {
    expect(S.beats.map(b => b.switch)).toEqual([true, false, false]);
  });

  it('the duck is seen only beside something that gives out light', () => {
    expect(star.props.filter(id => PROPS[id].source)).toEqual(['candle']);
    for (const id of star.props) expect(judgePlace(star, id).keeper).toBe(PROPS[id].source);
    expect(judgePlace(star, null).keeper).toBe(false);
    expect(judgePlace(star, 'torch').keeper).toBe(false); // not on this beat's bench
    expect(judge01(star, [], 'mirror')).toEqual({ right: [], wrong: ['mirror'], missed: [], keeper: false });
  });
});
