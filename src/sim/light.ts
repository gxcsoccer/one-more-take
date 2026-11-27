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
  const a = toLocal(lamp, pose), b = toLocal({ x: X, y: Y, z: 0 }, pose);
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
 * The wind-up duck, facing +x, standing on y = 0. Every part is an ellipsoid;
 * the renderer builds the toy from this same list.
 */
export const DUCK: (Ellipsoid & { part: 'body' | 'bill' | 'key' | 'foot' })[] = [
  { part: 'body', c: { x: -1.2, y: 4.9, z: 0 }, r: { x: 6.6, y: 4.3, z: 4.6 } },
  { part: 'body', c: { x: 2.4, y: 8.1, z: 0 }, r: { x: 3.0, y: 3.2, z: 2.8 } },
  { part: 'body', c: { x: 3.4, y: 11.7, z: 0 }, r: { x: 4.0, y: 4.0, z: 3.8 } },
  { part: 'body', c: { x: -7.2, y: 7.3, z: 0 }, r: { x: 2.4, y: 1.7, z: 1.8 } },
  { part: 'body', c: { x: -1.0, y: 5.6, z: 4.3 }, r: { x: 4.2, y: 2.6, z: 1.2 } },
  { part: 'body', c: { x: -1.0, y: 5.6, z: -4.3 }, r: { x: 4.2, y: 2.6, z: 1.2 } },
  { part: 'bill', c: { x: 7.7, y: 11.1, z: 0 }, r: { x: 2.6, y: 1.0, z: 2.1 } },
  { part: 'key', c: { x: -3.4, y: 10.4, z: 0 }, r: { x: 0.5, y: 1.9, z: 0.5 } },
  { part: 'key', c: { x: -3.4, y: 13.2, z: 0 }, r: { x: 1.6, y: 1.6, z: 0.45 } },
  { part: 'foot', c: { x: 1.0, y: 0.5, z: 2.3 }, r: { x: 2.5, y: 0.5, z: 1.6 } },
  { part: 'foot', c: { x: 1.0, y: 0.5, z: -2.3 }, r: { x: 2.5, y: 0.5, z: 1.6 } },
];
