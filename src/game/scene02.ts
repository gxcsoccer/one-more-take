/**
 * Scene 02 — "Three Storeys, One Cat". Data only.
 *
 * Each beat chalks a storyboard outline on the building: the shadow the
 * director wants. The player blocks the set (lamp on its dolly, the duck's
 * floor mark), calls ACTION, and the take either fills the outline or not.
 * From beat 2 on the lamp is off while blocking, so the set-up is a prediction.
 */
import { DUCK, inShadow, overlap, shadowMask, type Grid, type Pose, type Vec3 } from '../sim/light';

export interface Setup { lampZ: number; markX: number }

export interface Beat {
  /** Share of the outline a take must match here, when stricter than the scene's default. */
  keeper?: number;
  id: 'play' | 'dark' | 'cat';
  /** Is the lamp lit while the player blocks the scene? */
  rehearsalLight: boolean;
  movable: ('lamp' | 'mark')[];
  /** The set-up that draws the storyboard outline. */
  target: Setup;
  /** Where the props sit when the beat opens. null keeps them where the last beat left them. */
  start: Partial<Setup> | null;
  cat: boolean;
  /** Curriculum rows a keeper in this beat is evidence for. */
  objectives: string[];
}

export const scene02 = {
  id: '02',
  wall: { x0: -45, x1: 45, height: 52, storeyH: 12, storeys: 4 },
  windows: { cols: [-36, -24, -12, 0, 12, 24, 36], w: 7, h: 8, y0: 7 },
  /** Windows with someone home, as [column index, storey]. */
  residents: [[1, 0], [2, 1], [3, 2], [4, 0], [3, 0], [4, 2], [5, 1], [2, 3], [4, 3]] as [number, number][],
  lamp: { x: 0, y: 4, min: 58, max: 124 },
  duck: { z: 40, min: -14, max: 14, enterFrom: -52 },
  cat: { x: 31.5, y: 21 },
  /** How much of the outline a take must match to be a keeper. */
  keeper: 0.72,
  beats: [
    { id: 'play', keeper: 0.88, rehearsalLight: true, movable: ['lamp'], target: { lampZ: 72, markX: 3 }, start: { lampZ: 118, markX: 3 }, cat: false, objectives: ['L02', 'L04'] },
    { id: 'dark', rehearsalLight: false, movable: ['lamp'], target: { lampZ: 61, markX: 3 }, start: { lampZ: 118 }, cat: false, objectives: ['L02', 'L04', 'L05', 'I04'] },
    { id: 'cat', rehearsalLight: false, movable: ['lamp', 'mark'], target: { lampZ: 66, markX: -2 }, start: null, cat: true, objectives: ['L03', 'L04', 'L05', 'I01', 'I04'] },
  ] as Beat[],
};

export type Scene02 = typeof scene02;

/** Judging grid: the whole wall in 1 cm cells. */
export const GRID: Grid = { x0: scene02.wall.x0, y0: 0, cols: scene02.wall.x1 - scene02.wall.x0, rows: scene02.wall.height, cell: 1 };

export const lampAt = (s: Setup): Vec3 => ({ x: scene02.lamp.x, y: scene02.lamp.y, z: s.lampZ });
export const duckAt = (x: number): Pose => ({ x, z: scene02.duck.z, yaw: 0 });
export const maskOf = (s: Setup, g: Grid = GRID) => shadowMask(lampAt(s), DUCK, duckAt(s.markX), g);

/** Is the cat sitting in the duck's shadow? */
export function catInShadow(s: Setup): boolean {
  const { x, y } = scene02.cat;
  for (const [dx, dy] of [[0, 0], [-2, 2], [2, 2], [-2, -2], [2, -2]]) if (inShadow(lampAt(s), x + dx, y + dy, DUCK, duckAt(s.markX))) return true;
  return false;
}

export interface Verdict { match: number; catDark: boolean; keeper: boolean }

export function judge(beat: Beat, s: Setup): Verdict {
  const match = overlap(maskOf(s), maskOf(beat.target));
  const catDark = beat.cat && catInShadow(s);
  return { match, catDark, keeper: match >= (beat.keeper ?? scene02.keeper) && !catDark };
}
