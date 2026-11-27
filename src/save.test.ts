import { describe, expect, it } from 'vitest';
import { freshScene, inProgress, loadSave, storeSave, type Store } from './save';

const memory = (initial?: string): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('omt.save.v1', initial);
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const beats = { '02': 3 };

describe('saved game', () => {
  it('starts fresh when there is nothing saved', () => {
    const s = loadSave(beats, memory());
    expect(s.lang).toBe('en');
    expect(s.sound).toBe(true);
    expect(s.scenes['02']).toEqual(freshScene(3));
    expect(inProgress(s.scenes['02'])).toBe(false);
  });

  it('round-trips progress, settings and keepers', () => {
    const store = memory(), s = loadSave(beats, store);
    s.lang = 'zh'; s.sound = false;
    Object.assign(s.scenes['02'], { beat: 2, lampZ: 61, markX: 3, takeNo: 4, beatTakes: [2, 2, 0] });
    s.scenes['02'].quiz.right = 1;
    s.scenes['02'].keepers.push({ beat: 'dark', lampZ: 61, markX: 3, match: 0.99, takes: 2, at: '2026-11-27T00:00:00.000Z' });
    storeSave(s, store);
    const back = loadSave(beats, store);
    expect(back).toEqual(s);
    expect(inProgress(back.scenes['02'])).toBe(true);
  });

  it('survives garbage and out-of-range values', () => {
    for (const bad of ['not json', '[]', 'null', '{"scenes":7}', '{"scenes":{"02":"x"}}']) expect(loadSave(beats, memory(bad)).scenes['02']).toEqual(freshScene(3));
    const s = loadSave(beats, memory(JSON.stringify({ lang: 'fr', sound: 'yes', scenes: { '02': { beat: 99, takeNo: -5, beatTakes: [1, 'x'], quiz: { right: 1e99 }, keepers: [null, { beat: 'dark', match: 7 }, 3], completed: 2.7 } } })));
    expect(s.lang).toBe('en');
    expect(s.sound).toBe(true);
    const sc = s.scenes['02'];
    expect(sc.beat).toBe(2);
    expect(sc.takeNo).toBe(0);
    expect(sc.beatTakes).toEqual([1, 0, 0]);
    expect(sc.quiz.right).toBe(1e6);
    expect(sc.keepers).toHaveLength(1);
    expect(sc.keepers[0].match).toBe(1);
    expect(sc.completed).toBe(2);
  });

  it('does not throw when storage is unavailable or full', () => {
    expect(() => loadSave(beats, null)).not.toThrow();
    expect(() => storeSave(loadSave(beats, null), { getItem: () => null, setItem: () => { throw new Error('full'); } })).not.toThrow();
  });
});
