/**
 * Presentation of the model set: backdrop wall, lamp on its dolly track, the
 * cutout on its cross track, the projected shadow and everyone who reacts to
 * it. Reads the simulation, never decides the outcome.
 *
 * The set is drawn in an oblique projection: the wall faces the audience and
 * depth runs down-left. That projection is affine, so straight light rays stay
 * straight on screen and the wall is shown at true scale (10 px per cm).
 */
import { Application, BlurFilter, Circle, Container, Graphics, Rectangle, Sprite, Text, Texture, type FederatedPointerEvent } from 'pixi.js';
import { projectToWall, maskExtent, type Mask } from '../sim/shadow';
import { PPC } from '../sim/shapes';
import { evaluate, rigOf, type Level, type SetState } from './level02';

export const STAGE_W = 1600, STAGE_H = 1000;
const S = 10, K = 4.5, CA = Math.cos(Math.PI / 6), SA = 0.5, OX = 680, GY = 640;

export const toScreen = (x: number, y: number, d: number) => ({ x: OX + S * x - K * d * CA, y: GY - S * y + K * d * SA });
const wx = (X: number) => OX + S * X, wy = (Y: number) => GY - S * Y;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ease = (cur: number, to: number, dt: number, rate = 10) => cur + (to - cur) * Math.min(1, dt * rate);

export interface CutoutArt {
  id: string;
  canvas: HTMLCanvasElement;
  mask: Mask;
}

export interface Marker {
  axis: 'x' | 'y';
  value: number;
  locked: boolean;
  actual: number | null;
}

interface Jumper { x: number; y: number; vx: number; t: number; hue: number }

export type ArtMap = Record<string, HTMLImageElement | undefined>;

export class Scene {
  readonly world = new Container();
  state!: SetState;
  lampD: number;
  duckX: number;
  cutout: CutoutArt;
  locks = { lamp: true, duck: true };
  catOn = false;
  cinema = false;
  /** 0 = tight on the wall, 1 = pulled back to show the whole set. Used during playback. */
  reveal = 1;
  showRays = false;
  marker: Marker | null = null;
  ghost: { kind: 'lamp' | 'duck'; value: number } | null = null;
  onMove: (what: 'lamp' | 'duck') => void = () => {};
  onGrab: (what: 'lamp' | 'duck' | 'marker') => void = () => {};
  onEvent: (what: 'window' | 'paw' | 'sulk') => void = () => {};

  private tools = new Container();
  private pool!: Sprite;
  private shadow!: Sprite;
  private blur = new BlurFilter({ strength: 2, quality: 2 });
  private duck!: Sprite;
  private duckGhost!: Sprite;
  private lamp = new Container();
  private lampGhost = new Container();
  private floorShadow = new Graphics();
  private beam = new Graphics();
  private rays = new Graphics();
  private brackets = new Graphics();
  private markerG = new Graphics();
  private markerLabel = new Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontSize: 24, fontWeight: '800', fill: 0xfff3c4, stroke: { color: 0x14262b, width: 6, join: 'round' } } });
  private actualLabel = new Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontSize: 24, fontWeight: '800', fill: 0x9fe6c8, stroke: { color: 0x14262b, width: 6, join: 'round' } } });
  private actors = new Graphics();
  private bars = new Graphics();
  private jumpers: Jumper[] = [];
  private was = { covered: [false, false, false], near: false, blocked: false };
  private scare = [0, 0, 0];
  private pawT = -1;
  private sulk = 0;
  private zoom = 1;
  private props = 1;
  private barH = 0;
  private drag: { what: 'lamp' | 'duck' | 'marker'; sx: number; sy: number; v0: number } | null = null;
  private time = 0;

  constructor(private app: Application, private level: Level, cutout: CutoutArt, private art: ArtMap = {}) {
    this.lampD = level.lamp.start;
    this.duckX = level.duck.start;
    this.cutout = cutout;
    app.stage.addChild(this.world, this.bars);
    this.build();
    this.setCutout(cutout);
    this.refresh();
    this.was.covered = [...this.state.covered];
    app.stage.eventMode = 'static';
    app.stage.hitArea = new Rectangle(0, 0, STAGE_W, STAGE_H);
    app.stage.on('pointermove', e => this.move(e));
    app.stage.on('pointerup', () => (this.drag = null));
    app.stage.on('pointerupoutside', () => (this.drag = null));
    app.stage.on('pointercancel', () => (this.drag = null));
  }

  /** Use final art for a slot when it has been delivered, otherwise draw the placeholder. */
  private slot(name: string, x: number, y: number, w: number, h: number, fallback: () => Container): Container {
    const img = this.art[name];
    if (!img) return fallback();
    const s = new Sprite(Texture.from(img));
    s.position.set(x, y);
    s.setSize(w, h);
    return s;
  }

  private build() {
    const L = this.level, W = L.wall;
    const wallX = wx(W.xMin), wallW = S * (W.xMax - W.xMin), wallTop = wy(W.height), wallH = S * W.height;

    this.world.addChild(this.slot('bg-sky', 0, 0, STAGE_W, GY, () => {
      const c = document.createElement('canvas');
      c.width = 4; c.height = 256;
      const k = c.getContext('2d')!, grad = k.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#132a36'); grad.addColorStop(1, '#4f7f7a');
      k.fillStyle = grad; k.fillRect(0, 0, 4, 256);
      const box = new Container(), sky = new Sprite(Texture.from(c));
      sky.setSize(STAGE_W, GY);
      const g = new Graphics();
      for (let i = 0; i < 46; i++) g.circle((i * 331 + 57) % STAGE_W, (i * 97) % 300, i % 4 ? 1.3 : 2.2).fill({ color: 0xe6e2b8, alpha: 0.8 });
      g.circle(1420, 92, 34).fill(0xf6dc9b);
      for (let i = 0; i < 20; i++) {
        const x = i * 84 - 30, h = 90 + ((i * 53) % 150);
        g.rect(x, GY - h, 72, h).fill(0x2f5458);
        for (let a = 0; a < 3; a++) for (let b = 0; b < 5; b++) if ((i + a * 2 + b) % 4 === 0) g.rect(x + 10 + a * 20, GY - h + 14 + b * 22, 9, 7).fill(0xc9ad73);
      }
      box.addChild(sky, g);
      return box;
    }));

    this.world.addChild(this.slot('floor', 0, GY, STAGE_W, STAGE_H - GY, () => {
      const g = new Graphics();
      g.rect(0, GY, STAGE_W, STAGE_H - GY).fill(0x6d5644);
      for (let i = -8; i < 30; i++) {
        const x = i * 90;
        g.moveTo(x, GY).lineTo(x - (STAGE_H - GY) * (CA / SA), STAGE_H).stroke({ width: 2, color: 0x57443a, alpha: 0.7 });
      }
      g.rect(0, GY, STAGE_W, 10).fill({ color: 0x2a211d, alpha: 0.45 });
      return g;
    }));

    const wall = new Container();
    wall.addChild(this.slot('facade', wallX, wallTop, wallW, wallH, () => {
      const g = new Graphics();
      g.rect(wallX, wallTop, wallW, wallH).fill(0xb89779);
      for (let k = 0; k <= W.storeys; k++) g.rect(wallX, wy(k * W.storeyH) - 5, wallW, 7).fill(0xd2b28d);
      g.rect(wallX - 12, wallTop - 16, wallW + 24, 16).fill(0x86705f);
      g.rect(wallX + 40, wallTop - 40, 70, 24).fill(0x9a9588);
      return g;
    }));

    // Windows are separate pieces so one facade plate works for any layout.
    const win = new Graphics(), cz = L.cat;
    L.windows.cols.forEach((cx, ci) => {
      for (let row = 0; row < W.storeys; row++) {
        const cy = L.windows.y0 + row * W.storeyH;
        if (Math.abs(cx - cz.x) < 9 && Math.abs(cy - (cz.y - 2)) < 9) continue;
        const target = L.targets.some(t => t.x === cx && t.y === cy);
        const lit = target || (ci * 7 + row * 5) % 3 !== 0;
        const x = wx(cx - L.windows.w / 2), y = wy(cy + L.windows.h / 2), w = S * L.windows.w, h = S * L.windows.h;
        win.rect(x - 5, y - 5, w + 10, h + 12).fill(0x735c4c);
        win.rect(x, y, w, h).fill(lit ? [0xf7d283, 0xf2c06c, 0xe9d7a0][(ci + row) % 3] : 0x3f5961);
        win.rect(x + w / 2 - 2, y, 4, h).fill(0x5b4a40);
        win.rect(x, y + h * 0.42, w, 3).fill(0x5b4a40);
        win.rect(x - 8, y + h + 4, w + 16, 6).fill(0xd9bd98);
      }
    });
    wall.addChild(win);

    // The cat's perch: a neon sign bolted to the wall.
    const sign = new Graphics();
    const sx = wx(cz.x - 4.6), sy = wy(cz.y - cz.h / 2), sw = S * 9.2, sh = S * 3.6;
    sign.roundRect(sx, sy, sw, sh, 8).fill(0x1f3a40).stroke({ width: 3, color: 0xff8fa5 });
    sign.rect(sx + 14, sy + sh, 5, 22).fill(0x4a3b33);
    sign.rect(sx + sw - 19, sy + sh, 5, 22).fill(0x4a3b33);
    const neon = new Text({ text: 'MEOW', style: { fontFamily: 'system-ui, sans-serif', fontSize: 24, fontWeight: '800', fill: 0xffb3c1, letterSpacing: 3 } });
    neon.anchor.set(0.5);
    neon.position.set(sx + sw / 2, sy + sh / 2);
    wall.addChild(sign, neon);

    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const k = c.getContext('2d')!, rg = k.createRadialGradient(128, 128, 10, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,226,160,0.55)'); rg.addColorStop(0.6, 'rgba(255,214,140,0.28)'); rg.addColorStop(1, 'rgba(255,200,120,0)');
    k.fillStyle = rg; k.fillRect(0, 0, 256, 256);
    this.pool = new Sprite(Texture.from(c));
    this.pool.anchor.set(0.5);
    this.pool.blendMode = 'add';

    const clip = () => new Graphics().rect(wallX, wallTop, wallW, wallH).fill(0xffffff);
    const lit = new Container(), litClip = clip();
    lit.addChild(this.pool);
    lit.mask = litClip;

    this.shadow = new Sprite();
    this.shadow.anchor.set(0.5, 1);
    this.shadow.tint = 0x0d171c;
    this.shadow.alpha = 0.84;
    this.shadow.filters = [this.blur];
    const dark = new Container(), darkClip = clip();
    dark.addChild(this.shadow);
    dark.mask = darkClip;

    wall.addChild(lit, litClip, dark, darkClip, this.actors);
    this.world.addChild(wall);

    // Tracks, with a ruler along the lamp track measured from the duck.
    const tracks = new Graphics();
    const a = toScreen(0, 0, L.lamp.min - 8), b = toScreen(0, 0, L.lamp.max + 6);
    for (const off of [-9, 9]) tracks.moveTo(a.x + off, a.y + off * 1.6).lineTo(b.x + off, b.y + off * 1.6).stroke({ width: 5, color: 0x2b2420 });
    for (let d = L.lamp.min - 6; d <= L.lamp.max + 4; d += 6) {
      const p = toScreen(0, 0, d);
      tracks.moveTo(p.x - 15, p.y - 22).lineTo(p.x + 15, p.y + 22).stroke({ width: 4, color: 0x4a3d34 });
    }
    const da = toScreen(L.duck.min - 2, 0, L.rig.objD), db = toScreen(L.duck.max + 2, 0, L.rig.objD);
    tracks.moveTo(da.x, da.y).lineTo(db.x, db.y).stroke({ width: 7, color: 0x2b2420 });
    tracks.moveTo(da.x, da.y - 2).lineTo(db.x, db.y - 2).stroke({ width: 2, color: 0xcdb58c });
    this.world.addChild(tracks, this.floorShadow, this.beam);

    const ruler = new Container();
    for (let gap = 20; gap <= 80; gap += 10) {
      const p = toScreen(0, 0, L.rig.objD + gap);
      const t = new Text({ text: `${gap}`, style: { fontFamily: 'system-ui, sans-serif', fontSize: 20, fontWeight: '700', fill: 0xe9d9b4 } });
      t.anchor.set(0.5);
      t.position.set(p.x + 52, p.y + 34);
      ruler.addChild(t);
      tracks.moveTo(p.x + 20, p.y + 22).lineTo(p.x + 34, p.y + 28).stroke({ width: 3, color: 0xe9d9b4 });
    }
    for (let h = 10; h <= 50; h += 10) {
      const t = new Text({ text: h === 50 ? '50 cm' : `${h}`, style: { fontFamily: 'system-ui, sans-serif', fontSize: 20, fontWeight: '700', fill: 0xe9d9b4 } });
      t.anchor.set(1, 0.5);
      t.position.set(wallX - 22, wy(h));
      ruler.addChild(t);
      tracks.moveTo(wallX - 16, wy(h)).lineTo(wallX - 2, wy(h)).stroke({ width: 3, color: 0xe9d9b4 });
    }
    this.duckGhost = new Sprite();
    this.duckGhost.anchor.set(0.5, 1);
    this.duckGhost.alpha = 0.32;
    this.duck = new Sprite();
    this.duck.anchor.set(0.5, 1);
    this.duck.eventMode = 'static';
    this.duck.cursor = 'grab';
    this.duck.on('pointerdown', e => this.grab('duck', e));

    this.drawLamp(this.lamp, 1);
    this.drawLamp(this.lampGhost, 0.35);
    this.lamp.eventMode = 'static';
    this.lamp.cursor = 'grab';
    this.lamp.hitArea = new Circle(0, -30, 85);
    this.lamp.on('pointerdown', e => this.grab('lamp', e));

    this.markerG.eventMode = 'static';
    this.markerG.cursor = 'grab';
    this.markerG.on('pointerdown', e => this.grab('marker', e));
    this.markerLabel.anchor.set(0, 1);
    this.actualLabel.anchor.set(0, 1);
    this.tools.addChild(ruler, this.brackets, this.rays, this.markerG, this.markerLabel, this.actualLabel);
    this.world.addChild(this.tools, this.duckGhost, this.duck, this.lampGhost, this.lamp);
  }

  private drawLamp(box: Container, alpha: number) {
    const img = this.art['lamp'];
    if (img) {
      const s = new Sprite(Texture.from(img));
      s.anchor.set(0.5, 1);
      s.setSize(150, 170);
      s.alpha = alpha;
      box.addChild(s);
      return;
    }
    const g = new Graphics();
    g.ellipse(0, 4, 44, 9).fill({ color: 0x1d1714, alpha: 0.5 });
    g.roundRect(-36, -16, 72, 16, 5).fill(0x3d4f4c);
    g.circle(-24, 0, 8).fill(0x23201d).circle(24, 0, 8).fill(0x23201d);
    g.rect(-4, -40, 8, 26).fill(0x49615c);
    box.addChild(g);
    const head = new Graphics();
    head.roundRect(-34, -26, 56, 52, 10).fill(0x3f6a66).stroke({ width: 3, color: 0xbfd3b3 });
    head.poly([22, -22, 48, -34, 48, 34, 22, 22]).fill(0x355954);
    head.ellipse(48, 0, 8, 34).fill(0xffe9a8);
    head.position.set(0, -46);
    head.scale.set(0.8);
    head.rotation = -Math.PI / 6;
    box.addChild(head);
    box.alpha = alpha;
  }

  setCutout(c: CutoutArt) {
    this.cutout = c;
    const tex = Texture.from(c.canvas);
    for (const s of [this.duck, this.duckGhost, this.shadow]) s.texture = tex;
    const k = (S * c.mask.widthCm) / c.canvas.width;
    this.duck.scale.set(k);
    this.duckGhost.scale.set(k);
    const e = maskExtent(c.mask);
    const hw = e ? Math.max(Math.abs(e.left), Math.abs(e.right)) : 5;
    this.duck.hitArea = new Rectangle(-(hw + 3) * PPC, -c.canvas.height - 2 * PPC, (hw + 3) * 2 * PPC, c.canvas.height + 5 * PPC);
    this.refresh();
  }

  set(lampD: number, duckX: number) {
    this.lampD = clamp(lampD, this.level.lamp.min, this.level.lamp.max);
    this.duckX = clamp(duckX, this.level.duck.min, this.level.duck.max);
    this.refresh();
  }

  private refresh() {
    this.state = evaluate(this.level, this.lampD, this.duckX, this.cutout.mask, this.catOn);
  }

  /** The shadow's tip position if the duck stood at x, everything else as now. */
  stateAt(lampD: number, duckX: number): SetState {
    return evaluate(this.level, lampD, duckX, this.cutout.mask, this.catOn);
  }

  private grab(what: 'lamp' | 'duck' | 'marker', e: FederatedPointerEvent) {
    if (this.cinema) return;
    if (what === 'lamp' && this.locks.lamp) return this.onGrab(what);
    if (what === 'duck' && this.locks.duck) return this.onGrab(what);
    if (what === 'marker' && (!this.marker || this.marker.locked)) return;
    const p = this.world.toLocal(e.global);
    const v0 = what === 'lamp' ? this.lampD : what === 'duck' ? this.duckX : this.marker!.value;
    this.drag = { what, sx: p.x, sy: p.y, v0 };
    this.onGrab(what);
    e.stopPropagation();
  }

  private move(e: FederatedPointerEvent) {
    const d = this.drag;
    if (!d) return;
    const p = this.world.toLocal(e.global), dx = p.x - d.sx, dy = p.y - d.sy;
    if (d.what === 'lamp') {
      // Project the finger's travel onto the track direction.
      const ux = -K * CA, uy = K * SA;
      this.set(d.v0 + (dx * ux + dy * uy) / (ux * ux + uy * uy), this.duckX);
      this.onMove('lamp');
    } else if (d.what === 'duck') {
      this.set(this.lampD, d.v0 + dx / S);
      this.onMove('duck');
    } else if (this.marker) {
      const W = this.level.wall;
      this.marker.value = this.marker.axis === 'y' ? clamp(d.v0 - dy / S, 2, W.height - 1) : clamp(d.v0 + dx / S, W.xMin + 2, W.xMax - 2);
    }
  }

  tick(dt: number) {
    this.time += dt;
    const L = this.level, st = this.state, r = rigOf(L, this.lampD, this.duckX), m = st.m, t = this.time;

    // Camera: playback pushes in on the wall so only the "film" is in frame.
    this.zoom = ease(this.zoom, this.cinema ? 1.45 - 0.45 * this.reveal : 1, dt, 5);
    this.barH = ease(this.barH, this.cinema ? 90 : 0, dt, 7);
    this.world.pivot.set(830, 330);
    this.world.position.set(830, 330);
    this.world.scale.set(this.zoom);
    this.bars.clear();
    if (this.barH > 0.5) this.bars.rect(0, 0, STAGE_W, this.barH).fill(0x0b1418).rect(0, STAGE_H - this.barH, STAGE_W, this.barH).fill(0x0b1418);
    this.tools.visible = !this.cinema;
    // In the tight shot the audience sees only the monster; the props fade in on the pull-back.
    this.props = ease(this.props, this.cinema ? this.reveal : 1, dt, 6);
    this.duck.alpha = this.lamp.alpha = this.floorShadow.alpha = this.props;

    // Light pool: a fixed-angle cone, so it widens as the lamp backs away.
    const aim = projectToWall(r, r.objX, 8);
    this.pool.position.set(wx(aim.x), wy(aim.y));
    this.pool.setSize(S * this.lampD * 1.5);

    // Shadow: the cutout scaled by m about the lamp's foot point on the wall.
    const base = projectToWall(r, r.objX, 0);
    this.shadow.position.set(wx(base.x), wy(base.y));
    this.shadow.scale.set(((S * this.cutout.mask.widthCm) / this.cutout.canvas.width) * m);
    this.blur.strength = 0.6 + (m - 1) * 1.6;

    const lp = toScreen(L.rig.lampX, 0, this.lampD), dp = toScreen(this.duckX, 0, L.rig.objD);
    this.lamp.position.set(lp.x, lp.y);
    this.duck.position.set(dp.x, dp.y + 4);
    const wob = this.drag?.what === 'duck' ? Math.sin(t * 30) * 0.03 : Math.sin(t * 2.2) * 0.012;
    this.duck.rotation = wob;

    const e = maskExtent(this.cutout.mask);
    this.floorShadow.clear();
    this.beam.clear();
    if (e) {
      const l0 = toScreen(this.duckX + e.left * 0.7, 0, L.rig.objD), r0 = toScreen(this.duckX + e.right * 0.7, 0, L.rig.objD);
      const bl = projectToWall(r, this.duckX + e.left * 0.7, 0), br = projectToWall(r, this.duckX + e.right * 0.7, 0);
      this.floorShadow.poly([l0.x, l0.y, r0.x, r0.y, wx(br.x), GY, wx(bl.x), GY]).fill({ color: 0x0d171c, alpha: 0.38 });
    }
    const src = { x: lp.x + 30, y: lp.y - 62 };
    const R = this.lampD * 0.62;
    this.beam.poly([src.x, src.y - 20, wx(aim.x - R * 0.5), wy(Math.min(L.wall.height, aim.y + R)), wx(aim.x + R), wy(Math.max(0, aim.y - R * 0.4)), src.x + 12, src.y + 22])
      .fill({ color: 0xffe2a0, alpha: this.cinema ? 0 : 0.07 });

    this.drawTools(src, r, st);
    this.react(dt, st);
    this.drawActors(dt, st);
  }

  private drawTools(src: { x: number; y: number }, r: ReturnType<typeof rigOf>, st: SetState) {
    const L = this.level, W = L.wall;
    this.brackets.clear();
    L.targets.forEach((z, i) => {
      const x0 = wx(z.x - z.w / 2) - 12, x1 = wx(z.x + z.w / 2) + 12, y0 = wy(z.y + z.h / 2) - 12, y1 = wy(z.y - z.h / 2) + 14, c = st.covered[i] ? 0x9fe6c8 : 0xff9d6b, n = 20;
      for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]])
        this.brackets.moveTo(x + sx * n, y).lineTo(x, y).lineTo(x, y + sy * n).stroke({ width: 5, color: c, cap: 'round', join: 'round' });
    });

    // Light rays: lamp → edge of the cutout → wall, one straight line each.
    this.rays.clear();
    const e = maskExtent(this.cutout.mask);
    if (this.showRays && e) {
      const lampPt = toScreen(L.rig.lampX, L.rig.lampH, this.lampD);
      for (const [lx, y] of [[e.tip.x, e.tip.y], [(e.left + e.right) / 2 + 2, e.top - 0.4], [e.left + 1.5, e.top * 0.55]]) {
        const o = toScreen(this.duckX + lx, y, L.rig.objD), w = projectToWall(r, this.duckX + lx, y);
        this.rays.moveTo(lampPt.x, lampPt.y).lineTo(wx(w.x), wy(w.y)).stroke({ width: 3, color: 0xfff1b8, alpha: 0.85 });
        this.rays.circle(o.x, o.y, 6).fill(0xfff1b8).circle(wx(w.x), wy(w.y), 6).fill(0xfff1b8);
      }
      void src;
    }

    this.markerG.clear();
    this.markerLabel.visible = this.actualLabel.visible = false;
    const mk = this.marker;
    if (mk) {
      const dash = (x0: number, y0: number, x1: number, y1: number, color: number) => {
        const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / 26);
        for (let i = 0; i < n; i++) {
          const a = i / n, b = (i + 0.6) / n;
          this.markerG.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a).lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b).stroke({ width: 6, color, cap: 'round' });
        }
      };
      const x0 = wx(W.xMin), x1 = wx(W.xMax), yT = wy(W.height), yB = GY;
      if (mk.axis === 'y') {
        const y = wy(mk.value);
        dash(x0, y, x1, y, 0xfff3c4);
        if (!mk.locked) this.markerG.circle(x1 - 40, y, 30).fill({ color: 0xfff3c4, alpha: 0.95 }).poly([x1 - 40, y - 16, x1 - 28, y - 4, x1 - 52, y - 4]).fill(0x4a3b2c).poly([x1 - 40, y + 16, x1 - 28, y + 4, x1 - 52, y + 4]).fill(0x4a3b2c);
        this.markerG.hitArea = new Rectangle(x0, y - 44, x1 - x0, 88);
        this.markerLabel.position.set(x0 + 14, y - 8);
        if (mk.actual != null) {
          const ya = wy(mk.actual);
          this.markerG.moveTo(x0, ya).lineTo(x1, ya).stroke({ width: 4, color: 0x9fe6c8 });
          this.actualLabel.position.set(x0 + 240, ya - 8);
        }
      } else {
        const x = wx(mk.value);
        dash(x, yT, x, yB, 0xfff3c4);
        if (!mk.locked) this.markerG.circle(x, yT + 44, 30).fill({ color: 0xfff3c4, alpha: 0.95 }).poly([x - 16, yT + 44, x - 4, yT + 32, x - 4, yT + 56]).fill(0x4a3b2c).poly([x + 16, yT + 44, x + 4, yT + 32, x + 4, yT + 56]).fill(0x4a3b2c);
        this.markerG.hitArea = new Rectangle(x - 44, yT, 88, yB - yT);
        this.markerLabel.position.set(x + 12, yT + 110);
        if (mk.actual != null) {
          const xa = wx(mk.actual);
          this.markerG.moveTo(xa, yT).lineTo(xa, yB).stroke({ width: 4, color: 0x9fe6c8 });
          this.actualLabel.position.set(xa + 12, yT + 150);
        }
      }
      this.markerLabel.visible = true;
      this.actualLabel.visible = mk.actual != null;
    }

    const g = this.ghost;
    this.lampGhost.visible = g?.kind === 'lamp';
    this.duckGhost.visible = g?.kind === 'duck';
    if (g?.kind === 'lamp') {
      const p = toScreen(L.rig.lampX, 0, g.value);
      this.lampGhost.position.set(p.x, p.y);
    } else if (g?.kind === 'duck') {
      const p = toScreen(g.value, 0, L.rig.objD);
      this.duckGhost.position.set(p.x, p.y + 4);
    }
  }

  setMarkerText(mine: string, actual: string) {
    this.markerLabel.text = mine;
    this.actualLabel.text = actual;
  }

  private react(dt: number, st: SetState) {
    const L = this.level;
    st.covered.forEach((c, i) => {
      if (c && !this.was.covered[i]) {
        const z = L.targets[i];
        this.jumpers.push({ x: wx(z.x), y: wy(z.y - z.h / 2), vx: i % 2 ? 46 : -38, t: 0, hue: i });
        this.onEvent('window');
      }
      this.was.covered[i] = c;
      this.scare[i] = ease(this.scare[i], c ? 1 : 0, dt, 9);
    });
    if (st.catNear && !this.was.near) { this.pawT = 0; this.onEvent('paw'); }
    if (st.catBlocked && !this.was.blocked) this.onEvent('sulk');
    this.was.near = st.catNear;
    this.was.blocked = st.catBlocked;
    if (this.pawT >= 0) { this.pawT += dt; if (this.pawT > 0.7) this.pawT = st.catNear ? 0 : -1; }
    this.sulk = ease(this.sulk, st.catBlocked ? 1 : 0, dt, 8);
    for (const j of this.jumpers) { j.t += dt; j.y += (j.y < GY - 6 ? 70 : 0) * dt; j.x += (j.y < GY - 6 ? Math.sin(j.t * 5) * 30 : j.vx * 6) * dt; }
    this.jumpers = this.jumpers.filter(j => j.t < 9 && j.x > wx(L.wall.xMin) - 80 && j.x < 1400);
  }

  private drawActors(_dt: number, st: SetState) {
    const g = this.actors, L = this.level, t = this.time;
    g.clear();
    // Paper residents in the three marked windows duck out of sight when the shadow arrives.
    L.targets.forEach((z, i) => {
      const s = this.scare[i], x = wx(z.x) + (i - 1) * 8, by = wy(z.y - z.h / 2) - 2, drop = s * 46;
      if (s < 0.97) {
        g.roundRect(x - 13, by - 30 + drop, 26, 30 - Math.min(30, drop), 6).fill(0x2f3d3f);
        if (drop < 30) g.circle(x, by - 40 + drop, 11).fill(0x2f3d3f);
      }
      if (s > 0.15 && s < 0.9) {
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k - 2) * 0.5, r0 = 30, r1 = 46;
          g.moveTo(x + Math.cos(a) * r0, by - 52 + Math.sin(a) * r0).lineTo(x + Math.cos(a) * r1, by - 52 + Math.sin(a) * r1).stroke({ width: 4, color: 0xfff3c4, cap: 'round' });
        }
      }
    });
    // Bedsheet parachutists, then a dash for the edge of frame.
    for (const j of this.jumpers) {
      const air = j.y < GY - 6, c = [0xf2e6c9, 0xe9a48f, 0xa9d1c2][j.hue % 3];
      if (air) {
        g.moveTo(j.x - 22, j.y - 36).quadraticCurveTo(j.x, j.y - 62, j.x + 22, j.y - 36).lineTo(j.x - 22, j.y - 36).fill(c);
        g.moveTo(j.x - 20, j.y - 36).lineTo(j.x, j.y - 12).lineTo(j.x + 20, j.y - 36).stroke({ width: 2, color: 0x3a3330 });
      }
      const bob = air ? 0 : Math.abs(Math.sin(j.t * 18)) * 6;
      g.circle(j.x, j.y - 14 - bob, 7).fill(0x2f3d3f).roundRect(j.x - 6, j.y - 8 - bob, 12, 14, 4).fill(0x2f3d3f);
    }

    if (!this.catOn) return;
    const z = L.cat, cx = wx(z.x), cy = wy(z.y - z.h / 2), dark = this.sulk, fur = dark > 0.5 ? 0x141d21 : 0x39443f;
    const paw = this.pawT >= 0 ? Math.sin((Math.PI * this.pawT) / 0.7) : 0;
    const tail = Math.sin(t * (dark > 0.5 ? 11 : 3)) * (dark > 0.5 ? 9 : 5);
    g.moveTo(cx + 16, cy - 8).quadraticCurveTo(cx + 40, cy - 10, cx + 38 + tail, cy - 38).stroke({ width: 8, color: fur, cap: 'round' });
    g.ellipse(cx, cy - 20, 21, 22).fill(fur);
    g.ellipse(cx - 2, cy - 48, 19, 17).fill(fur);
    g.poly([cx - 19, cy - 52, cx - 17, cy - 74, cx - 5, cy - 61]).fill(fur).poly([cx + 3, cy - 62, cx + 13, cy - 74, cx + 16, cy - 52]).fill(fur);
    const eyeH = dark > 0.5 ? 1.6 : 3.4;
    g.ellipse(cx - 10, cy - 49, 3.6, eyeH).fill(0xffdf85).ellipse(cx + 5, cy - 49, 3.6, eyeH).fill(0xffdf85);
    g.moveTo(cx - 10, cy - 22).lineTo(cx - 22 - 30 * paw, cy - 30 - 16 * paw).lineTo(cx - 24 - 62 * paw, cy - 28 - 8 * paw).stroke({ width: 9, color: fur, cap: 'round', join: 'round' });
    if (paw > 0.55) for (const dy of [-12, 0, 12]) g.moveTo(cx - 96, cy - 36 + dy).lineTo(cx - 112, cy - 40 + dy * 1.5).stroke({ width: 3, color: 0xfff3c4, cap: 'round' });
    if (dark > 0.5) {
      const x = cx + 30, y = cy - 78;
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) g.moveTo(x + Math.cos(a + 0.4) * 5, y + Math.sin(a + 0.4) * 5).lineTo(x + Math.cos(a + 0.4) * 14, y + Math.sin(a + 0.4) * 14).stroke({ width: 4, color: 0xff7a6b, cap: 'round' });
    }
    void st;
  }

  /** A small still of the set as it is now, for the notebook and the compare view. */
  snapshot(w = 400): string {
    // Crop to the wall and the props in front of it.
    const full = this.app.renderer.extract.canvas({ target: this.app.stage, frame: new Rectangle(300, 90, 1000, 620), resolution: 1 }) as HTMLCanvasElement;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = Math.round((w * 620) / 1000);
    c.getContext('2d')!.drawImage(full, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  }
}
