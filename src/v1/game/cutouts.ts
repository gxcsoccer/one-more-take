/** Cutout props: built-in placeholders, delivered art, and the child's own drawings. */
import type { Mask } from '../sim/shadow';
import { CARD_H, CARD_W, PPC, rasterize, type Prim, type ShapeDef } from '../sim/shapes';
import type { CutoutArt } from './scene';

export const CARD_PX_W = CARD_W * PPC, CARD_PX_H = CARD_H * PPC;

function paint(k: CanvasRenderingContext2D, p: Prim) {
  const X = (x: number) => (x / CARD_W + 0.5) * CARD_PX_W, Y = (y: number) => (1 - y / CARD_H) * CARD_PX_H;
  k.fillStyle = p.color;
  k.beginPath();
  if (p.k === 'ellipse') k.ellipse(X(p.cx), Y(p.cy), p.rx * PPC, p.ry * PPC, 0, 0, Math.PI * 2);
  else p.pts.forEach((_, i) => i % 2 === 0 && (i ? k.lineTo(X(p.pts[i]), Y(p.pts[i + 1])) : k.moveTo(X(p.pts[i]), Y(p.pts[i + 1]))));
  k.fill();
}

export function fromShape(def: ShapeDef): CutoutArt {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_PX_W;
  canvas.height = CARD_PX_H;
  const k = canvas.getContext('2d')!;
  [...def.prims, ...(def.details ?? [])].forEach(p => paint(k, p));
  return { id: def.id, canvas, mask: rasterize(def) };
}

/** Read a mask straight from pixels: used for delivered PNG art and for drawings. */
export function maskFromCanvas(src: CanvasImageSource): Mask {
  const c = document.createElement('canvas');
  c.width = CARD_PX_W;
  c.height = CARD_PX_H;
  const k = c.getContext('2d', { willReadFrequently: true })!;
  k.drawImage(src, 0, 0, CARD_PX_W, CARD_PX_H);
  const data = k.getImageData(0, 0, CARD_PX_W, CARD_PX_H).data;
  const alpha = new Uint8Array(CARD_PX_W * CARD_PX_H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return { w: CARD_PX_W, h: CARD_PX_H, alpha, widthCm: CARD_W, heightCm: CARD_H };
}

export function fromImage(id: string, img: HTMLImageElement): CutoutArt {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return { id, canvas, mask: maskFromCanvas(img) };
}

let drawn = 0;
export function fromDrawing(pad: HTMLCanvasElement): CutoutArt | null {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_PX_W;
  canvas.height = CARD_PX_H;
  canvas.getContext('2d')!.drawImage(pad, 0, 0, CARD_PX_W, CARD_PX_H);
  const mask = maskFromCanvas(canvas);
  let ink = 0;
  for (const a of mask.alpha) if (a > 127) ink++;
  if (ink < 400) return null;
  return { id: `drawn-${++drawn}`, canvas, mask };
}
