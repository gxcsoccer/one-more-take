/**
 * Straight-line light in three dimensions. Pure maths, no rendering.
 *
 * World units are centimetres on the tabletop set:
 *   x – left/right along the backdrop wall
 *   y – height above the table
 *   z – distance in front of the wall (the wall is the plane z = 0)
 *
 * A wall point is in shadow when the straight segment from it to the lamp
 * passes through any part of an object. Objects are unions of ellipsoids, the
 * same ones the renderer draws, so what is judged is what is seen.
 */

export interface Vec3 { x: number; y: number; z: number }
export interface Ellipsoid { c: Vec3; r: Vec3 }
/** Where an object stands and which way it faces (yaw about the vertical, radians). */
export interface Pose { x: number; z: number; yaw: number }

/** Does the segment a→b pass through the ellipsoid? */
export function segmentHits(a: Vec3, b: Vec3, e: Ellipsoid): boolean {
  // Squash space so the ellipsoid becomes a unit sphere at the origin.
  const ax = (a.x - e.c.x) / e.r.x, ay = (a.y - e.c.y) / e.r.y, az = (a.z - e.c.z) / e.r.z;
  const dx = (b.x - e.c.x) / e.r.x - ax, dy = (b.y - e.c.y) / e.r.y - ay, dz = (b.z - e.c.z) / e.r.z - az;
  const A = dx * dx + dy * dy + dz * dz, B = 2 * (ax * dx + ay * dy + az * dz), C = ax * ax + ay * ay + az * az - 1;
  if (C <= 0) return true;
  const disc = B * B - 4 * A * C;
  if (disc < 0 || A === 0) return false;
  const s = Math.sqrt(disc), t0 = (-B - s) / (2 * A), t1 = (-B + s) / (2 * A);
  return t1 >= 0 && t0 <= 1;
}

/** World point → the object's own frame. */
function toLocal(p: Vec3, pose: Pose): Vec3 {
  const x = p.x - pose.x, z = p.z - pose.z, c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  return { x: c * x - s * z, y: p.y, z: s * x + c * z };
}

/** Is the wall point (X, Y) hidden from the lamp by the object? */
export function inShadow(lamp: Vec3, X: number, Y: number, parts: Ellipsoid[], pose: Pose): boolean {
  return hidden(lamp, { x: X, y: Y, z: 0 }, parts, pose);
}

/** Is any point in space hidden from the lamp by the object? Used for things that stand out from the wall. */
export function hidden(lamp: Vec3, p: Vec3, parts: Ellipsoid[], pose: Pose): boolean {
  const a = toLocal(lamp, pose), b = toLocal(p, pose);
  for (const e of parts) if (segmentHits(a, b, e)) return true;
  return false;
}

/** A rectangle of wall sampled on a regular grid. Row 0 is the bottom. */
export interface Grid { x0: number; y0: number; cols: number; rows: number; cell: number }

export function shadowMask(lamp: Vec3, parts: Ellipsoid[], pose: Pose, g: Grid): Uint8Array {
  const out = new Uint8Array(g.cols * g.rows);
  for (let j = 0; j < g.rows; j++) {
    const Y = g.y0 + (j + 0.5) * g.cell;
    for (let i = 0; i < g.cols; i++) if (inShadow(lamp, g.x0 + (i + 0.5) * g.cell, Y, parts, pose)) out[j * g.cols + i] = 1;
  }
  return out;
}

/** Overlap of two shadows: 1 = identical, 0 = no overlap. */
export function overlap(a: Uint8Array, b: Uint8Array): number {
  let both = 0, either = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) both++; if (a[i] || b[i]) either++; }
  return either ? both / either : 0;
}

export function maskArea(m: Uint8Array, g: Grid): number {
  let n = 0;
  for (const v of m) n += v;
  return n * g.cell * g.cell;
}

/** Highest shadowed point on the wall, cm. */
export function maskTop(m: Uint8Array, g: Grid): number {
  for (let j = g.rows - 1; j >= 0; j--) for (let i = 0; i < g.cols; i++) if (m[j * g.cols + i]) return g.y0 + (j + 1) * g.cell;
  return 0;
}

/**
 * The wind-up duck, facing +x, standing on y = 0, 16 cm tall. Proportions are
 * taken from the approved concept sheet (docs/concept/wind-up-duck.png): a
 * round head about as wide as the body is tall, a low two-loop key behind it,
 * a short flat bill. Every part is an ellipsoid; the renderer builds the toy
 * from this same list, so the shadow that is drawn is the shadow that is judged.
 * The key is two solid lobes: the concept's holes would let light through.
 */
export const DUCK: (Ellipsoid & { part: 'body' | 'bill' | 'key' | 'foot' })[] = [
  { part: 'body', c: { x: -1.5, y: 5.0, z: 0 }, r: { x: 7.4, y: 4.0, z: 5.0 } },
  { part: 'body', c: { x: 2.6, y: 12.3, z: 0 }, r: { x: 4.0, y: 3.9, z: 4.1 } },
  { part: 'body', c: { x: -8.0, y: 7.9, z: 0 }, r: { x: 1.3, y: 1.5, z: 1.2 } },
  { part: 'body', c: { x: -8.75, y: 9.0, z: 0 }, r: { x: 0.75, y: 1.0, z: 0.7 } },
  { part: 'body', c: { x: -2.2, y: 5.4, z: 4.7 }, r: { x: 4.2, y: 2.3, z: 0.8 } },
  { part: 'body', c: { x: -2.2, y: 5.4, z: -4.7 }, r: { x: 4.2, y: 2.3, z: 0.8 } },
  { part: 'bill', c: { x: 7.4, y: 11.4, z: 0 }, r: { x: 2.0, y: 0.95, z: 1.9 } },
  { part: 'key', c: { x: -3.6, y: 9.5, z: 0 }, r: { x: 0.45, y: 1.1, z: 0.45 } },
  { part: 'key', c: { x: -4.5, y: 11.2, z: 0 }, r: { x: 1.05, y: 0.95, z: 0.35 } },
  { part: 'key', c: { x: -2.7, y: 11.2, z: 0 }, r: { x: 1.05, y: 0.95, z: 0.35 } },
  { part: 'foot', c: { x: -4.4, y: 0.85, z: 2.2 }, r: { x: 1.5, y: 0.85, z: 1.3 } },
  { part: 'foot', c: { x: 2.2, y: 0.85, z: 2.2 }, r: { x: 1.5, y: 0.85, z: 1.3 } },
  { part: 'foot', c: { x: -4.4, y: 0.85, z: -2.2 }, r: { x: 1.5, y: 0.85, z: 1.3 } },
  { part: 'foot', c: { x: 2.2, y: 0.85, z: -2.2 }, r: { x: 1.5, y: 0.85, z: 1.3 } },
];
