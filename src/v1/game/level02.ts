/**
 * Scene 02 — "Three Storeys, One Cat". Level data only: geometry, what moves,
 * what counts as the shot. All numbers are centimetres on the model set.
 */
import { coverage, magnification, shadowExtent, type Mask, type Rig, type Zone } from '../sim/shadow';

export type Variable = 'lamp' | 'duck' | 'cutout';

export interface Prediction {
  /** Which prop the player is about to move. */
  vary: 'lamp' | 'duck';
  /** Where the ghost prop sits: absolute for the lamp, relative step for the duck. */
  to?: number;
  by?: number;
  /** What the chalk line marks: the shadow's top edge, or the tip's sideways position. */
  measure: 'top' | 'tipX';
}

export interface Shot {
  id: 'A' | 'B';
  movable: Variable[];
  cat: boolean;
  prediction: Prediction;
  /** Curriculum rows this shot produces evidence for (see docs/curriculum). */
  objectives: string[];
}

export const level02 = {
  id: '02',
  wall: { xMin: -28, xMax: 58, height: 52, storeyH: 12, storeys: 4 },
  windows: {
    cols: [-22, -9, 4, 17, 30, 43],
    w: 7,
    h: 8,
    /** Centre height of the window on storey 0. */
    y0: 7,
  },
  rig: { lampX: 0, lampH: 2, objD: 40 },
  lamp: { min: 56, max: 120, start: 116 },
  duck: { min: -9, max: 9, start: 0.5 },
  /** Three windows the monster shadow must swallow, bottom to top. */
  targets: [
    { x: 4, y: 7, w: 7, h: 8 },
    { x: 4, y: 19, w: 7, h: 8 },
    { x: 4, y: 31, w: 7, h: 8 },
  ] as Zone[],
  /** The cat on its sign, and the patch of wall it will swipe at. */
  cat: { x: 27, y: 26, w: 5, h: 6 } as Zone,
  paw: { x: 20.3, y: 26, w: 8, h: 7 } as Zone,
  takeSeconds: 6,
  shots: [
    {
      id: 'A',
      movable: ['lamp'],
      cat: false,
      prediction: { vary: 'lamp', to: 72, measure: 'top' },
      objectives: ['L02', 'L04', 'L05', 'I01'],
    },
    {
      id: 'B',
      movable: ['lamp', 'duck', 'cutout'],
      cat: true,
      prediction: { vary: 'duck', by: -3, measure: 'tipX' },
      objectives: ['L03', 'L04', 'L05', 'I01', 'I04'],
    },
  ] as Shot[],
};

export type Level = typeof level02;

export interface SetState {
  m: number;
  covered: boolean[];
  catBlocked: boolean;
  catNear: boolean;
  /** Height of the shadow's top edge on the wall, cm. */
  top: number;
  /** Sideways position of the shadow's right-most tip, cm. */
  tipX: number;
  tipY: number;
  /** Lamp-to-duck distance, cm. */
  gap: number;
}

export function rigOf(level: Level, lampD: number, duckX: number): Rig {
  return { ...level.rig, lampD, objX: duckX };
}

export function evaluate(level: Level, lampD: number, duckX: number, mask: Mask, cat: boolean): SetState {
  const r = rigOf(level, lampD, duckX);
  const e = shadowExtent(r, mask);
  const catBlocked = cat && coverage(r, mask, level.cat) > 0;
  return {
    m: magnification(r),
    covered: level.targets.map(z => coverage(r, mask, z) === 1),
    catBlocked,
    catNear: cat && !catBlocked && coverage(r, mask, level.paw, 4, 0.9) > 0,
    top: e ? Math.min(e.top, level.wall.height) : 0,
    tipX: e ? e.tip.x : 0,
    tipY: e ? e.tip.y : 0,
    gap: lampD - level.rig.objD,
  };
}

export function isShot(shot: Shot, s: SetState): boolean {
  const all = s.covered.every(Boolean);
  return shot.cat ? all && s.catNear : all;
}
