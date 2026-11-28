/**
 * "Shadow Monster" — the two-player prototype on Scene 02's set. Data and rules only.
 *
 * One player holds the lamp, the other the duck, and the shadow on the building is live. The
 * shadow is what the two of them play with: it scares the neighbour in the glowing window, and
 * it must not rest on anyone who is asleep, or on the cat. How big it is depends on how far the
 * lamp is from the duck, so neither player can do it alone.
 */
import { DUCK, hidden, type Vec3 } from '../sim/light';
import { catShade, duckAt, lampAt, scene02 } from './scene02';

/** Where the two players have put things: the lamp along its track, the duck along its rail. */
export interface Pair { lampZ: number; duckX: number }
/** A window, as [column, storey]. */
export type Win = readonly [number, number];

export interface Wave {
  id: 'big' | 'hush' | 'cat' | 'dark';
  /** Neighbours to scare, one after another. */
  targets: Win[];
  /** Neighbours asleep for the whole wave. */
  sleepers: Win[];
  cat: boolean;
  /** Lamp off while the players set up; they call the shot and the lamp shows who was right. */
  blind: boolean;
}

/** Share of a window the shadow must cover to scare whoever is in it. */
export const SCARE = 0.7;
/** Share of a window in shadow that disturbs a sleeper. */
export const WAKE = 0.25;
/** Seconds the shadow must stay on a neighbour to scare them, and on a sleeper to wake them. */
export const HOLD = { scare: 0.55, wake: 1.1 };

const waves: Wave[] = [
  { id: 'big', targets: [[3, 0], [4, 1], [2, 2], [4, 3]], sleepers: [], cat: false, blind: false },
  { id: 'hush', targets: [[2, 1], [5, 0], [6, 1], [1, 2]], sleepers: [[3, 0], [4, 1], [1, 3]], cat: false, blind: false },
  { id: 'cat', targets: [[3, 1], [1, 0], [6, 2], [0, 3]], sleepers: [[2, 1]], cat: true, blind: false },
  { id: 'dark', targets: [[3, 0], [5, 1], [2, 2]], sleepers: [], cat: false, blind: true },
];

const key = (w: Win) => `${w[0]}:${w[1]}`;
/**
 * Every window somebody lives behind in this game. The stage builds one neighbour for each, going
 * along the columns and up each one, so the list is kept in that order and an index here is the
 * stage's index.
 */
const homes: Win[] = [...new Map(waves.flatMap(w => [...w.targets, ...w.sleepers]).map(w => [key(w), w])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

/**
 * Scene 02's set, rearranged for play: the lamp can come closer to the duck and its track is
 * shorter, so the building fills the picture; the duck's rail runs the width of the building.
 */
export const duo = {
  ...scene02,
  id: '02',
  lamp: { ...scene02.lamp, min: 52, max: 98 },
  duck: { ...scene02.duck, min: -30, max: 30 },
  residents: homes.map(w => [w[0], w[1]] as [number, number]),
  waves,
};

/** Which of the stage's neighbours lives behind this window. */
export const homeIndex = (w: Win) => homes.findIndex(h => key(h) === key(w));

export function winCentre(w: Win): { x: number; y: number } {
  return { x: duo.windows.cols[w[0]], y: duo.windows.y0 + w[1] * duo.wall.storeyH };
}

/** Share of a window's glass that the duck hides from the lamp. */
export function windowShade(p: Pair, w: Win): number {
  const lamp = lampAt({ lampZ: p.lampZ, markX: p.duckX }), pose = duckAt(p.duckX), c = winCentre(w), W = duo.windows;
  const nx = 6, ny = 7;
  let n = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q: Vec3 = { x: c.x - W.w / 2 + ((i + 0.5) / nx) * W.w, y: c.y - W.h / 2 + ((j + 0.5) / ny) * W.h, z: 0.45 };
    if (hidden(lamp, q, DUCK, pose)) n++;
  }
  return n / (nx * ny);
}

/** Where a point on the duck lands on the wall, and how many times bigger the shadow is than the duck. */
export function project(p: Pair, local: Vec3): { x: number; y: number; scale: number } {
  const L = lampAt({ lampZ: p.lampZ, markX: p.duckX }), q = { x: p.duckX + local.x, y: local.y, z: duo.duck.z + local.z };
  const k = L.z / (L.z - q.z);
  return { x: L.x + (q.x - L.x) * k, y: L.y + (q.y - L.y) * k, scale: k };
}

export interface Reading {
  /** Shade on the neighbour to scare. */
  target: number;
  /** Shade on each sleeper, in the wave's order. */
  sleepers: number[];
  /** Is the shadow on the cat? */
  cat: boolean;
  /** Enough shadow on the neighbour, and nobody disturbed. */
  clean: boolean;
}

export function read(p: Pair, wave: Wave, target: Win): Reading {
  const tgt = windowShade(p, target), sleepers = wave.sleepers.map(s => windowShade(p, s));
  const cat = wave.cat && catShade({ lampZ: p.lampZ, markX: p.duckX }) >= 0.05;
  return { target: tgt, sleepers, cat, clean: tgt >= SCARE && !cat && sleepers.every(s => s < WAKE) };
}

/**
 * Every place the two players could stand to scare this neighbour cleanly, on a grid one
 * centimetre apart. Used to prove a wave can be played, and how forgiving it is.
 */
export function answers(wave: Wave, target: Win, step = 1): Pair[] {
  const out: Pair[] = [];
  for (let lampZ = duo.lamp.min; lampZ <= duo.lamp.max; lampZ += step) for (let duckX = duo.duck.min; duckX <= duo.duck.max; duckX += step) {
    const p = { lampZ, duckX };
    if (read(p, wave, target).clean) out.push(p);
  }
  return out;
}
