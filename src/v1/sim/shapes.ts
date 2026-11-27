/**
 * Built-in cutout shapes, described as coloured primitives in centimetres
 * (x from the centre line, y up from the base). One description feeds both
 * the simulation mask and the placeholder drawing, so they cannot disagree.
 * Final art replaces the drawing; the mask then comes from the PNG's alpha.
 */
import type { Mask } from './shadow';

export type Prim =
  | { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number; color: string }
  | { k: 'poly'; pts: number[]; color: string };

export interface ShapeDef {
  id: string;
  widthCm: number;
  heightCm: number;
  prims: Prim[];
  /** Painted on top for looks only; never part of the mask. */
  details?: Prim[];
}

/** Every cutout shares one card size so swapping props changes only the shape. */
export const CARD_W = 20;
export const CARD_H = 16;
/** Mask and placeholder-art resolution, pixels per centimetre. */
export const PPC = 16;

function inPrim(p: Prim, x: number, y: number): boolean {
  if (p.k === 'ellipse') {
    const dx = (x - p.cx) / p.rx, dy = (y - p.cy) / p.ry;
    return dx * dx + dy * dy <= 1;
  }
  let inside = false;
  const q = p.pts;
  for (let i = 0, j = q.length - 2; i < q.length; j = i, i += 2) {
    const xi = q[i], yi = q[i + 1], xj = q[j], yj = q[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function rasterize(def: ShapeDef, ppc = PPC): Mask {
  const w = Math.round(def.widthCm * ppc), h = Math.round(def.heightCm * ppc);
  const alpha = new Uint8Array(w * h);
  for (let v = 0; v < h; v++) {
    const y = (1 - (v + 0.5) / h) * def.heightCm;
    for (let u = 0; u < w; u++) {
      const x = ((u + 0.5) / w - 0.5) * def.widthCm;
      if (def.prims.some(p => inPrim(p, x, y))) alpha[v * w + u] = 255;
    }
  }
  return { w, h, alpha, widthCm: def.widthCm, heightCm: def.heightCm };
}

const BODY = '#e7ae3f', SHADE = '#c98d2c', BEAK = '#e2703a', KEY = '#b9c4b4';

/** Wind-up duck seen from the side, beak pointing right. */
export const DUCK_SIDE: ShapeDef = {
  id: 'duck-side',
  widthCm: CARD_W,
  heightCm: CARD_H,
  prims: [
    { k: 'poly', pts: [-5.2, 9.6, -4.4, 9.6, -4.4, 11.6, -5.2, 11.6], color: KEY },
    { k: 'ellipse', cx: -4.8, cy: 12.7, rx: 1.7, ry: 1.5, color: KEY },
    { k: 'poly', pts: [-8.2, 6.4, -9.6, 10.2, -5.4, 7.8], color: SHADE },
    { k: 'ellipse', cx: -1.4, cy: 4.9, rx: 7.2, ry: 4.4, color: BODY },
    { k: 'ellipse', cx: 2.7, cy: 8.2, rx: 3.1, ry: 3.2, color: BODY },
    { k: 'ellipse', cx: 3.6, cy: 11.6, rx: 4.2, ry: 4.2, color: BODY },
    { k: 'poly', pts: [7.0, 12.9, 10.0, 11.2, 7.0, 10.0], color: BEAK },
    { k: 'poly', pts: [-1.6, 0, 2.6, 0, 1.2, 1.4, -0.4, 1.4], color: BEAK },
  ],
  details: [
    { k: 'ellipse', cx: -2.0, cy: 4.6, rx: 3.8, ry: 2.2, color: SHADE },
    { k: 'ellipse', cx: 5.2, cy: 12.6, rx: 0.62, ry: 0.62, color: '#22302f' },
    { k: 'ellipse', cx: -4.8, cy: 12.7, rx: 0.75, ry: 0.65, color: '#6f7d74' },
  ],
};

/** The same duck facing the lamp, wings spread wide. */
export const DUCK_FRONT: ShapeDef = {
  id: 'duck-front',
  widthCm: CARD_W,
  heightCm: CARD_H,
  prims: [
    { k: 'poly', pts: [-4.6, 7.6, -9.8, 11.0, -9.4, 6.4, -4.8, 4.0], color: SHADE },
    { k: 'poly', pts: [4.6, 7.6, 9.8, 11.0, 9.4, 6.4, 4.8, 4.0], color: SHADE },
    { k: 'ellipse', cx: 0, cy: 5.2, rx: 5.6, ry: 4.8, color: BODY },
    { k: 'ellipse', cx: 0, cy: 11.8, rx: 3.9, ry: 3.9, color: BODY },
    { k: 'poly', pts: [-3.4, 0, -0.6, 0, -1.4, 1.4, -2.6, 1.4], color: BEAK },
    { k: 'poly', pts: [0.6, 0, 3.4, 0, 2.6, 1.4, 1.4, 1.4], color: BEAK },
  ],
  details: [
    { k: 'ellipse', cx: 0, cy: 10.9, rx: 1.5, ry: 0.8, color: BEAK },
    { k: 'ellipse', cx: -1.5, cy: 12.6, rx: 0.55, ry: 0.55, color: '#22302f' },
    { k: 'ellipse', cx: 1.5, cy: 12.6, rx: 0.55, ry: 0.55, color: '#22302f' },
  ],
};
