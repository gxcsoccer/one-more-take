import { describe, expect, it } from 'vitest';
import { answers, duo, homeIndex, project, read, SCARE, WAKE, windowShade } from './duo';

describe('Shadow Monster: the two-player waves', () => {
  it('every neighbour can be scared without disturbing a sleeper or the cat, with room to spare', () => {
    for (const wave of duo.waves) for (const target of wave.targets) {
      // At least 40 places a centimetre apart: a child does not need to find the one right spot.
      expect(answers(wave, target).length, `${wave.id} ${target.join(':')}`).toBeGreaterThanOrEqual(40);
    }
  });

  it('neither player can do it alone: for a high window no duck position works with the lamp far away', () => {
    const wave = duo.waves[0], top = wave.targets[3];
    for (let duckX = duo.duck.min; duckX <= duo.duck.max; duckX++) expect(windowShade({ lampZ: duo.lamp.max, duckX }, top)).toBeLessThan(SCARE);
    expect(answers(wave, top).every(p => p.lampZ < 62)).toBe(true);
  });

  it('the lamp nearer the duck makes the shadow bigger', () => {
    const far = project({ lampZ: 120, duckX: 0 }, { x: 0, y: 16, z: 0 }), near = project({ lampZ: 56, duckX: 0 }, { x: 0, y: 16, z: 0 });
    expect(near.scale).toBeGreaterThan(far.scale * 2);
    expect(near.y).toBeGreaterThan(far.y + 20);
  });

  it('sleepers and the cat really are in the way: some clean answers stop being clean', () => {
    const [, hush, cat] = duo.waves;
    const free = { ...hush, sleepers: [] };
    expect(answers(free, hush.targets[0]).length).toBeGreaterThan(answers(hush, hush.targets[0]).length);
    expect(answers({ ...cat, cat: false }, cat.targets[0]).length).toBeGreaterThan(answers(cat, cat.targets[0]).length);
    const p = answers(free, hush.targets[0]).find(q => !read(q, hush, hush.targets[0]).clean)!;
    expect(read(p, hush, hush.targets[0]).sleepers.some(s => s >= WAKE)).toBe(true);
  });

  it('every neighbour in every wave has a home on the stage', () => {
    for (const wave of duo.waves) for (const w of [...wave.targets, ...wave.sleepers]) expect(homeIndex(w)).toBeGreaterThanOrEqual(0);
    expect(new Set(duo.residents.map(r => r.join(':'))).size).toBe(duo.residents.length);
  });
});
