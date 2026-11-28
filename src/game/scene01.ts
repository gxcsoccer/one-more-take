/**
 * Scene 01 — Lights Out. Level data and its rules; no rendering.
 *
 * The idea being taught (syllabus: Light, P4): a light source gives out its own light. Everything
 * else is seen only when light from a source bounces off it into our eyes. So when every lamp in
 * the studio goes off, the camera still sees the sources, and nothing else, unless a source is
 * near enough to light it.
 */

export interface Prop {
  id: string;
  /** Does it give out light of its own? */
  source: boolean;
}

/** Every prop that can stand on the bench. */
export const PROPS: Record<string, Prop> = Object.fromEntries(([
  ['exit', true], ['lantern', true], ['moon', false], ['mirror', false], ['duck', false],
  ['torch', true], ['tablet', true], ['candle', true], ['trophy', false], ['ball', false], ['sheet', false],
] as [string, boolean][]).map(([id, source]) => [id, { id, source }]));

export interface Beat01 {
  id: 'spot' | 'guess' | 'star';
  /** mark: tick every light source. place: stand one prop beside the duck so the camera can see it. */
  kind: 'mark' | 'place';
  /** Props on the bench, left to right. */
  props: string[];
  /** May the child work the studio's light switch while setting up? If not, the set-up is a prediction. */
  switch: boolean;
  /** Curriculum rows a keeper in this beat is evidence for. */
  objectives: string[];
}

export const scene01 = {
  id: '01',
  /** Where the props stand: a bench across the set, and the duck in front of it. */
  bench: { z: 8, top: 5, x0: -44, x1: 44 },
  duck: { x: 14, z: 68 },
  /** The light stand beside the duck, for the third beat. */
  stand: { x: 28, z: 80 },
  beats: [
    { id: 'spot', kind: 'mark', props: ['exit', 'moon', 'lantern', 'mirror'], switch: true, objectives: ['L01'] },
    { id: 'guess', kind: 'mark', props: ['trophy', 'torch', 'ball', 'tablet', 'sheet', 'candle'], switch: false, objectives: ['L01', 'I04'] },
    { id: 'star', kind: 'place', props: ['mirror', 'candle', 'moon', 'trophy'], switch: false, objectives: ['L01', 'I04'] },
  ] as Beat01[],
};
export type Scene01 = typeof scene01;

/** Where prop number `i` of `n` stands along the bench, in centimetres. */
export function slotX(i: number, n: number): number {
  const { x0, x1 } = scene01.bench, step = (x1 - x0) / n;
  return x0 + step * (i + 0.5);
}

/** In a marking beat the duck itself is a candidate too: it is bright yellow, and it gives out no light. */
export const candidates = (b: Beat01): string[] => (b.kind === 'mark' ? [...b.props, 'duck'] : b.props);

export interface Verdict01 {
  /** Ticked, and a light source. */
  right: string[];
  /** Ticked, but not a light source. */
  wrong: string[];
  /** A light source that was not ticked. */
  missed: string[];
  keeper: boolean;
}

/** Marking beats: a keeper ticks every light source and nothing else. */
export function judgeMarks(b: Beat01, marked: string[]): Verdict01 {
  const all = candidates(b), on = new Set(marked.filter(id => all.includes(id)));
  const right = all.filter(id => on.has(id) && PROPS[id].source), wrong = all.filter(id => on.has(id) && !PROPS[id].source), missed = all.filter(id => !on.has(id) && PROPS[id].source);
  return { right, wrong, missed, keeper: wrong.length === 0 && missed.length === 0 };
}

/** Placing beat: the duck is seen only if what stands beside it gives out light for the duck to reflect. */
export function judgePlace(b: Beat01, placed: string | null): Verdict01 {
  const ok = placed !== null && b.props.includes(placed) && PROPS[placed].source;
  return { right: ok ? [placed!] : [], wrong: placed !== null && !ok ? [placed] : [], missed: [], keeper: ok };
}

export const judge01 = (b: Beat01, marked: string[], placed: string | null): Verdict01 => (b.kind === 'mark' ? judgeMarks(b, marked) : judgePlace(b, placed));
