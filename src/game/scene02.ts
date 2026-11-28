/**
 * Scene 02 — "Three Storeys, One Cat". Data only.
 *
 * Each beat chalks a storyboard outline on the building: the shadow the
 * director wants. The player blocks the set (lamp on its dolly, the duck's
 * floor mark), calls ACTION, and the take either fills the outline or not.
 * From beat 2 on the lamp is off while blocking, so the set-up is a prediction.
 */
import { DUCK, hidden, overlap, shadowMask, type Grid, type Pose, type Vec3 } from '../sim/light';

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
  /** Centre of the cat. x is midway between two window columns. */
  cat: { x: 18, y: 28.6 },
  /** How much of the outline a take must match to be a keeper. */
  keeper: 0.72,
  beats: [
    { id: 'play', keeper: 0.88, rehearsalLight: true, movable: ['lamp'], target: { lampZ: 72, markX: 3 }, start: { lampZ: 118, markX: 3 }, cat: false, objectives: ['L02', 'L04'] },
    { id: 'dark', rehearsalLight: false, movable: ['lamp'], target: { lampZ: 61, markX: 3 }, start: { lampZ: 118 }, cat: false, objectives: ['L02', 'L04', 'L05', 'I04'] },
    { id: 'cat', rehearsalLight: false, movable: ['lamp', 'mark'], target: { lampZ: 66, markX: -0.5 }, start: null, cat: true, objectives: ['L03', 'L04', 'L05', 'I01', 'I04'] },
  ] as Beat[],
};

export type Scene02 = typeof scene02;

/** Judging grid: the whole wall in 1 cm cells. */
export const GRID: Grid = { x0: scene02.wall.x0, y0: 0, cols: scene02.wall.x1 - scene02.wall.x0, rows: scene02.wall.height, cell: 1 };

export const lampAt = (s: Setup): Vec3 => ({ x: scene02.lamp.x, y: scene02.lamp.y, z: s.lampZ });
export const duckAt = (x: number): Pose => ({ x, z: scene02.duck.z, yaw: 0 });
export const maskOf = (s: Setup, g: Grid = GRID) => shadowMask(lampAt(s), DUCK, duckAt(s.markX), g);

/**
 * The cat as the stage draws it at rest, facing front: where it sits on its ledge, and its
 * body and head relative to that. It stands out from the wall, so it is judged where it
 * really is, not on the wall behind it. The stage builds the cat from these numbers.
 */
export const CAT = {
  seat: { x: scene02.cat.x, y: scene02.cat.y - 3.6, z: 1.9 },
  body: { c: { x: 0, y: 2.6, z: 0 }, r: { x: 2.3, y: 2.7, z: 1.9 } },
  head: { c: { x: -0.2, y: 5.9, z: 0.5 }, r: 1.9 },
};

/**
 * Points on the cat's front surface, the side that faces the lamp and the audience, spread
 * evenly over what can be seen of its body and head. Evenly by area, so the share of points
 * in shadow is the share of the visible cat in shadow. The tail and the animation are left
 * out on purpose.
 */
export function catPoints(step = 0.55): Vec3[] {
  const { seat, body, head } = CAT, out: Vec3[] = [];
  const front = (c: Vec3, rx: number, ry: number, rz: number, skip?: (x: number, y: number) => boolean) => {
    for (let y = -ry + step / 2; y < ry; y += step) for (let x = -rx + step / 2; x < rx; x += step) {
      const u = x / rx, v = y / ry, d = 1 - u * u - v * v;
      if (d <= 0) continue;
      const p = { x: seat.x + c.x + x, y: seat.y + c.y + y, z: seat.z + c.z + rz * Math.sqrt(d) };
      if (!skip?.(p.x, p.y)) out.push(p);
    }
  };
  front(head.c, head.r, head.r, head.r);
  // The part of the body that the head stands in front of is not seen.
  front(body.c, body.r.x, body.r.y, body.r.z, (x, y) => Math.hypot(x - seat.x - head.c.x, y - seat.y - head.c.y) < head.r);
  return out;
}
const CAT_POINTS = catPoints();

/** Share of the visible cat (body and head) that the duck hides from the lamp. */
export function catShade(s: Setup): number {
  const lamp = lampAt(s), pose = duckAt(s.markX);
  let n = 0;
  for (const p of CAT_POINTS) if (hidden(lamp, p, DUCK, pose)) n++;
  return n / CAT_POINTS.length;
}

/** Is the cat in the duck's shadow? A clipped ear or flank does not count: at least 40% of what can be seen of it must be dark. */
export const catInShadow = (s: Setup): boolean => catShade(s) >= 0.4;

export interface Verdict { match: number; catDark: boolean; keeper: boolean }

const targetMasks = new Map<string, Uint8Array>();
function targetMask(t: Setup): Uint8Array {
  const key = `${t.lampZ}:${t.markX}`;
  let m = targetMasks.get(key);
  if (!m) targetMasks.set(key, (m = maskOf(t)));
  return m;
}

export function judge(beat: Beat, s: Setup): Verdict {
  const match = overlap(maskOf(s), targetMask(beat.target));
  const catDark = beat.cat && catInShadow(s);
  return { match, catDark, keeper: match >= (beat.keeper ?? scene02.keeper) && !catDark };
}
