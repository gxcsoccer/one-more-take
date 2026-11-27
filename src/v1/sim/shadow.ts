/**
 * Point-light shadow projection. Pure maths, no rendering.
 *
 * World units are centimetres on the model set.
 *   x  – left/right along the backdrop wall
 *   y  – height above the stage floor
 *   d  – depth: distance in front of the wall (the wall is d = 0)
 *
 * A flat cutout stands at depth objD, a point lamp sits further out at lampD.
 * Light travels in straight lines, so every wall point maps back to exactly
 * one point on the cutout plane (similar triangles).
 */

export interface Rig {
  lampX: number;
  lampH: number;
  lampD: number;
  objX: number;
  objD: number;
}

/** An opacity bitmap for a cutout. Row 0 is the top. Anchored bottom-centre. */
export interface Mask {
  w: number;
  h: number;
  alpha: Uint8Array | Uint8ClampedArray;
  widthCm: number;
  heightCm: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Extent {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Right-most opaque point: the "beak tip" of whatever shape this is. */
  tip: Pt;
}

/** How many times bigger the shadow is than the cutout. */
export function magnification(r: Rig): number {
  const gap = r.lampD - r.objD;
  if (!(gap > 0)) throw new RangeError('lamp must be further from the wall than the object');
  return r.lampD / gap;
}

/** Where light grazing the cutout-plane point (x, y) lands on the wall. */
export function projectToWall(r: Rig, x: number, y: number): Pt {
  const m = magnification(r);
  return { x: r.lampX + (x - r.lampX) * m, y: r.lampH + (y - r.lampH) * m };
}

/** Inverse of projectToWall. */
export function wallToObject(r: Rig, X: number, Y: number): Pt {
  const m = magnification(r);
  return { x: r.lampX + (X - r.lampX) / m, y: r.lampH + (Y - r.lampH) / m };
}

/** Is the cutout opaque at (lx, y)? lx is measured from its centre, y from its base. */
export function maskHit(mask: Mask, lx: number, y: number): boolean {
  const u = Math.floor((lx / mask.widthCm + 0.5) * mask.w);
  const v = Math.floor((1 - y / mask.heightCm) * mask.h);
  if (u < 0 || v < 0 || u >= mask.w || v >= mask.h) return false;
  return mask.alpha[v * mask.w + u] > 127;
}

/** Is the wall point (X, Y) in shadow? */
export function inShadow(r: Rig, mask: Mask, X: number, Y: number): boolean {
  if (Y < 0) return false;
  const p = wallToObject(r, X, Y);
  return maskHit(mask, p.x - r.objX, p.y);
}

const extents = new WeakMap<Mask, Extent | null>();

/** Tight bounds of the opaque part of a cutout, in cm relative to its anchor. */
export function maskExtent(mask: Mask): Extent | null {
  if (extents.has(mask)) return extents.get(mask)!;
  let minU = mask.w, maxU = -1, minV = mask.h, maxV = -1, tipV = 0, tipN = 0;
  for (let v = 0; v < mask.h; v++) {
    for (let u = 0; u < mask.w; u++) {
      if (mask.alpha[v * mask.w + u] <= 127) continue;
      if (u < minU) minU = u;
      if (u > maxU) { maxU = u; tipV = v; tipN = 1; }
      else if (u === maxU) { tipV += v; tipN++; }
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  let out: Extent | null = null;
  if (maxU >= 0) {
    const cmX = (u: number) => (u / mask.w - 0.5) * mask.widthCm;
    const cmY = (v: number) => (1 - v / mask.h) * mask.heightCm;
    out = {
      left: cmX(minU),
      right: cmX(maxU + 1),
      top: cmY(minV),
      bottom: cmY(maxV + 1),
      tip: { x: cmX(maxU + 1), y: cmY(tipV / tipN + 0.5) },
    };
  }
  extents.set(mask, out);
  return out;
}

/** Bounds of the shadow on the wall. */
export function shadowExtent(r: Rig, mask: Mask): Extent | null {
  const e = maskExtent(mask);
  if (!e) return null;
  const a = projectToWall(r, r.objX + e.left, e.bottom);
  const b = projectToWall(r, r.objX + e.right, e.top);
  return { left: a.x, right: b.x, top: b.y, bottom: a.y, tip: projectToWall(r, r.objX + e.tip.x, e.tip.y) };
}

/** A rectangle on the wall, given by its centre and size. */
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fraction of an n×n grid of sample points inside the zone that are in shadow. */
export function coverage(r: Rig, mask: Mask, z: Zone, n = 3, inset = 0.7): number {
  let hit = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const fx = n === 1 ? 0 : (i / (n - 1) - 0.5) * inset;
      const fy = n === 1 ? 0 : (j / (n - 1) - 0.5) * inset;
      if (inShadow(r, mask, z.x + fx * z.w, z.y + fy * z.h)) hit++;
    }
  }
  return hit / (n * n);
}
