/**
 * The tabletop film set in real 3D. One spotlight casts the real shadow; the
 * simulation in src/sim judges with the same geometry, so the picture and the
 * verdict cannot disagree. This file only shows things: it never decides.
 *
 * All models here are built from primitives as stand-ins. Each builder is one
 * function so delivered models can replace it without touching the rest.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DUCK, type Grid } from '../sim/light';
import { CAT, type Scene02 } from './scene02';
import { AdaptiveResolution } from './quality';

const ease = (cur: number, to: number, dt: number, rate: number) => cur + (to - cur) * Math.min(1, dt * rate);
const smooth = (t: number) => t * t * (3 - 2 * t);

function canvasTexture(w: number, h: number, paint: (k: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** The table top: width along x, depth along z starting at z0 (behind the building). Top surface is y = 0. */
const TABLE = { w: 330, d: 200, z0: -48 };
/** The two neighbouring-block designs, in centimetres. Their textures are drawn to these proportions. */
const BLOCK = { a: { w: 44, h: 30 }, b: { w: 39, h: 42 }, d: 16 };
/** How far below the table top the room's floor lies. */
const ROOM_FLOOR = 82;

export type Pickable = 'lamp' | 'mark' | 'clapper';

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 5, 1200);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private raycaster = new THREE.Raycaster();
  private clock = 0;

  // What the game sets.
  lampZ: number;
  markX: number;
  duckX: number;
  walking = false;
  lampOn = false;
  houseLights = 1;
  film = false;
  catVisible = false;
  catSulking = false;
  movable = { lamp: false, mark: false };
  clapperReady = false;

  private lampOnLevel = 0;
  private house = 1;
  private filmT = 0;
  private spot!: THREE.SpotLight;
  private hemi!: THREE.HemisphereLight;
  private work!: THREE.DirectionalLight;
  private lampRig = new THREE.Group();
  private lens!: THREE.Mesh;
  private cone!: THREE.Mesh;
  private duck = new THREE.Group();
  private duckBody = new THREE.Group();
  private key = new THREE.Group();
  private mark = new THREE.Group();
  private cat = new THREE.Group();
  private catEyes: THREE.Mesh[] = [];
  private catTail!: THREE.Group;
  private catPop = 0;
  private catHop = 0;
  private clapper = new THREE.Group();
  private clapArm!: THREE.Mesh;
  private clapT = 1;
  private slate!: { tex: THREE.CanvasTexture; paint: (take: number) => void };
  private rings: { lamp: THREE.Mesh; mark: THREE.Mesh };
  private handles: Record<Pickable, THREE.Object3D>;
  private chalk!: { tex: THREE.CanvasTexture; k: CanvasRenderingContext2D };
  private residents: { group: THREE.Group; x: number; y: number; t: number; down: number; card?: { mat: THREE.MeshStandardMaterial; idle: THREE.Texture; raised: THREE.Texture } }[] = [];
  private blocks: { box: THREE.Mesh; detail: THREE.Group; kind: 'a' | 'b' }[] = [];
  private clapBoard: HTMLImageElement | null = null;
  /** Names of the delivered art that actually loaded, and whether loading has finished. For tests. */
  artLoaded: string[] = [];
  artReady = false;
  /** Which end of the lamp model was taken to be the lens, e.g. "-x". For tests. */
  lampLens = '';
  /** Measurements of the delivered models as placed on the set, in centimetres. For tests. */
  models: Record<string, { height: number; width: number; depth: number; lensHeight?: number; triangles: number }> = {};
  private take = 1;
  private confetti!: { points: THREE.Points; vel: Float32Array; life: number };
  private squash = 0;
  private flicker = 0;
  private probe = { pr: 0, bloom: true, sm: 0 };
  private quality = new AdaptiveResolution(1);
  /** Lowest pixel ratio used since this page loaded. */
  lowestRatio = 1;
  private filmCam = { pos: new THREE.Vector3(2, 50, 150), look: new THREE.Vector3(2, 25, 0) };
  /** "WxH" of the window the wide camera was last fitted to. */
  fitted = '';
  private wide = { pos: new THREE.Vector3(-74, 62, 206), look: new THREE.Vector3(10, 15, 36) };
  private skins: Record<string, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial> = {};

  constructor(private host: HTMLElement, private L: Scene02) {
    this.lampZ = L.lamp.max;
    this.markX = 0;
    this.duckX = 0;
    // Probe knobs for scripts/perf.mjs: ?pr=<pixel ratio cap>&bloom=0&sm=<shadow map size>
    const knob = new URLSearchParams(location.search);
    this.probe = { pr: Number(knob.get('pr')) || 0, bloom: knob.get('bloom') !== '0', sm: Number(knob.get('sm')) || 0 };
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(this.probe.pr || Math.min(window.devicePixelRatio || 1, 2));
    this.quality = new AdaptiveResolution(r.getPixelRatio());
    this.lowestRatio = r.getPixelRatio();
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    host.appendChild(r.domElement);
    this.scene.background = new THREE.Color(0x0f2d31);
    this.scene.fog = new THREE.Fog(0x0a1519, 420, 900);

    this.buildLights();
    this.buildTable();
    this.buildBackdrop();
    this.buildBuilding();
    this.buildTracks();
    this.buildLamp();
    this.buildDuck();
    this.buildCat();
    this.buildClapper();
    this.buildConfetti();
    this.rings = { lamp: this.ring(9), mark: this.ring(6) };
    this.handles = { lamp: this.handle(10), mark: this.handle(8), clapper: this.handle(13) };

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.6, 0.9);
    if (this.probe.bloom) this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------- building the set ----------
  private buildLights() {
    this.hemi = new THREE.HemisphereLight(0xa9c4d6, 0x3a2c24, 1);
    this.work = new THREE.DirectionalLight(0xffe9cf, 1);
    this.work.position.set(-90, 160, 140);
    const s = (this.spot = new THREE.SpotLight(0xffdfa6, 0, 0, 0.72, 0.45, 0));
    s.castShadow = true;
    s.shadow.mapSize.set(this.probe.sm || 2048, this.probe.sm || 2048);
    s.shadow.camera.near = 2;
    s.shadow.camera.far = 260;
    s.shadow.bias = -0.0004;
    s.shadow.radius = 2.5;
    s.target.position.set(this.L.lamp.x, 17, 0);
    this.scene.add(this.hemi, this.work, s, s.target);
  }

  private buildTable() {
    const tex = canvasTexture(1024, 1024, k => {
      k.fillStyle = '#7a5c44'; k.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 8; i++) {
        k.fillStyle = ['#7f6149', '#73553f', '#86664c', '#6d503b'][i % 4];
        k.fillRect(i * 128, 0, 126, 1024);
        k.strokeStyle = 'rgba(40,26,18,.35)'; k.lineWidth = 1.2;
        for (let j = 0; j < 9; j++) { k.beginPath(); const x = i * 128 + 10 + j * 13; k.moveTo(x, 0); k.bezierCurveTo(x + 8, 300, x - 8, 700, x + 3, 1024); k.stroke(); }
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(TABLE.w / 180, TABLE.d / 180);
    // The set stands on a wooden table, as in the concept art: a top with an edge, an apron,
    // four legs, and the room's floor far below.
    const top = (this.skins.floor = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0 }));
    const side = new THREE.MeshStandardMaterial({ color: 0x6a3f24, roughness: 0.7 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, 5, TABLE.d), [side, side, top, side, side, side]);
    slab.position.set(0, -2.5, TABLE.z0 + TABLE.d / 2);
    slab.receiveShadow = true;
    const apron = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w - 14, 9, TABLE.d - 14), new THREE.MeshStandardMaterial({ color: 0x55321c, roughness: 0.8 }));
    apron.position.set(0, -9.5, TABLE.z0 + TABLE.d / 2);
    this.scene.add(slab, apron);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: 0.8 });
    for (const x of [-1, 1]) for (const z of [0, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(10, ROOM_FLOOR - 14, 10), legMat);
      leg.position.set(x * (TABLE.w / 2 - 14), -14 - (ROOM_FLOOR - 14) / 2, z ? TABLE.z0 + TABLE.d - 14 : TABLE.z0 + 14);
      this.scene.add(leg);
    }
    const room = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: 0x23160f, roughness: 0.95 }));
    room.rotation.x = -Math.PI / 2;
    room.position.set(0, -ROOM_FLOOR, 200);
    this.scene.add(room);
  }

  private buildBackdrop() {
    const sky = canvasTexture(1024, 512, k => {
      const g = k.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#0d2029'); g.addColorStop(0.7, '#2c5a5e'); g.addColorStop(1, '#5b8d84');
      k.fillStyle = g; k.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 90; i++) { k.fillStyle = `rgba(240,235,200,${0.3 + (i % 5) * 0.14})`; k.beginPath(); k.arc((i * 331 + 57) % 1024, (i * 97) % 300, i % 4 ? 1 : 1.8, 0, 7); k.fill(); }
      k.fillStyle = '#f6dc9b'; k.beginPath(); k.arc(820, 110, 34, 0, 7); k.fill();
      for (let i = 0; i < 26; i++) {
        const x = i * 42 - 10, h = 70 + ((i * 53) % 130);
        k.fillStyle = '#1f4247'; k.fillRect(x, 512 - h, 36, h);
        k.fillStyle = '#d4b877';
        for (let a = 0; a < 3; a++) for (let b = 0; b < 6; b++) if ((i + a * 2 + b) % 4 === 0) k.fillRect(x + 5 + a * 10, 512 - h + 8 + b * 16, 5, 4);
      }
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1560, 260), (this.skins.sky = new THREE.MeshBasicMaterial({ map: sky, toneMapped: false, color: 0x9aa7a8 })));
    back.position.set(0, 96, -70);
    // Three paintings wide. The middle one is the painting exactly as painted and where it always
    // was; the two outer ones are its mirror images, so the joins are seamless.
    sky.wrapS = THREE.MirroredRepeatWrapping;
    sky.repeat.set(3, 1);
    sky.offset.set(-1, 0);
    this.scene.add(back);
    // The backdrop carries on below the painting, down past the table's back edge.
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(1560, 60), new THREE.MeshBasicMaterial({ color: 0x1b4f43, toneMapped: false }));
    skirt.position.set(0, -64, -70);
    this.scene.add(skirt);
    // Neighbouring blocks: plain cardboard boxes with a painted band, lower than the star building.
    const card = new THREE.MeshStandardMaterial({ color: 0xcdb692, roughness: 1 }), roofMat = new THREE.MeshStandardMaterial({ color: 0x8a7663, roughness: 1 });
    const bands = [0x7fb5a6, 0xe8b85a, 0xd98a5f, 0x7fb5a6].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    const lit = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xffd98a, emissiveIntensity: 0.8 }), unlit = new THREE.MeshStandardMaterial({ color: 0x3f5a60, roughness: 0.4 });
    // Two designs, each used twice: A is three storeys (44 × 30 × 16 cm), B is four (39 × 42 × 16 cm).
    ([[-82, 'a', -18], [-126, 'b', -30], [82, 'a', -16], [128, 'b', -30]] as const).forEach(([x, kind, z], n) => {
      const { w, h } = BLOCK[kind];
      // One material per face, so the front and the two sides can take their own textures later.
      const faces = [0, 1, 2, 3, 4, 5].map(i => (i === 2 ? roofMat : card.clone()));
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, BLOCK.d), faces);
      b.position.set(x, h / 2, z);
      b.receiveShadow = true;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 1.4, BLOCK.d + 2), roofMat);
      roof.position.set(x, h + 0.7, z);
      const detail = new THREE.Group();
      for (let j = 0; j < Math.floor(h / 11); j++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, 0.2), bands[(n + j) % bands.length]);
        band.position.set(x, 1.4 + j * 11, z + BLOCK.d / 2 + 0.05);
        detail.add(band);
        for (let i = 0; i < 4; i++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.4), (i + j * 3 + n) % 3 === 0 ? lit : unlit);
          win.position.set(x - w / 2 + 7 + i * ((w - 14) / 3), 6.4 + j * 11, z + BLOCK.d / 2 + 0.06);
          detail.add(win);
        }
      }
      this.scene.add(b, roof, detail);
      this.blocks.push({ box: b, detail, kind });
    });
  }

  private buildBuilding() {
    const L = this.L, W = L.wall, width = W.x1 - W.x0;
    const paint = canvasTexture(1800, 1040, k => {
      k.fillStyle = '#e6d2b3'; k.fillRect(0, 0, 1800, 1040);
      const band = ['#d98a5f', '#e8b85a', '#7fb5a6', '#d98a5f'];
      for (let s = 0; s < W.storeys; s++) {
        const y = 1040 - (s + 1) * W.storeyH * 20;
        k.fillStyle = band[s]; k.fillRect(0, y + 196, 1800, 30);
        k.fillStyle = 'rgba(255,255,255,.35)'; k.fillRect(0, y + 226, 1800, 8);
        k.fillStyle = 'rgba(70,50,35,.18)'; k.fillRect(0, y + 234, 1800, 6);
      }
      k.fillStyle = '#b9a58a'; k.fillRect(0, 0, 1800, 1040 - W.storeys * W.storeyH * 20);
      for (let i = 0; i < 2600; i++) { k.fillStyle = `rgba(${i % 2 ? 255 : 60},${i % 2 ? 250 : 45},${i % 2 ? 235 : 30},.05)`; k.fillRect((i * 7919) % 1800, (i * 104729) % 1040, 3, 2); }
    });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, W.height, 10), [
      new THREE.MeshStandardMaterial({ color: 0xbfa98c, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0xbfa98c, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x8c7867, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x8c7867, roughness: 1 }),
      (this.skins.facade = new THREE.MeshStandardMaterial({ map: paint, roughness: 0.95 })), new THREE.MeshStandardMaterial({ color: 0xbfa98c, roughness: 1 }),
    ]);
    wall.position.set((W.x0 + W.x1) / 2, W.height / 2, -5);
    wall.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 3, 2, 12), new THREE.MeshStandardMaterial({ color: 0x7d6a5b, roughness: 1 }));
    roof.position.set(0, W.height + 1, -5);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 6), new THREE.MeshStandardMaterial({ color: 0x9a9588, roughness: 1 }));
    tank.position.set(-24, W.height + 4.5, -6);
    this.scene.add(wall, roof, tank);

    const frame = new THREE.MeshStandardMaterial({ color: 0x6b5446, roughness: 0.9 });
    const sill = new THREE.MeshStandardMaterial({ color: 0xf1e3c8, roughness: 0.9 });
    const glassLit = [0xffd98a, 0xffc66e, 0xffe6ae].map(c => new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: c, emissiveIntensity: 0.95, roughness: 0.4 }));
    const glassDark = new THREE.MeshStandardMaterial({ color: 0x33505a, roughness: 0.25, metalness: 0.2 });
    const home = new Set(L.residents.map(([c, s]) => `${c}:${s}`));
    L.windows.cols.forEach((cx, ci) => {
      for (let s = 0; s < W.storeys; s++) {
        const cy = L.windows.y0 + s * W.storeyH;
        const lit = home.has(`${ci}:${s}`) || (ci * 7 + s * 5) % 3 !== 0;
        const f = new THREE.Mesh(new THREE.BoxGeometry(L.windows.w + 1, L.windows.h + 1, 0.5), frame);
        f.position.set(cx, cy, 0.2);
        const g = new THREE.Mesh(new THREE.PlaneGeometry(L.windows.w, L.windows.h), lit ? glassLit[(ci + s) % 3] : glassDark);
        g.position.set(cx, cy, 0.47);
        const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, L.windows.h, 0.2), frame), bar2 = new THREE.Mesh(new THREE.BoxGeometry(L.windows.w, 0.35, 0.2), frame);
        bar1.position.set(cx, cy, 0.55); bar2.position.set(cx, cy + 0.6, 0.55);
        const led = new THREE.Mesh(new THREE.BoxGeometry(L.windows.w + 2, 0.5, 1.4), sill);
        led.position.set(cx, cy - L.windows.h / 2 - 0.6, 0.7);
        this.scene.add(f, g, bar1, bar2, led);
        if (home.has(`${ci}:${s}`)) this.addResident(cx, cy);
      }
    });

    // Measuring pole beside the building: shadow height in centimetres.
    const pole = canvasTexture(64, 1040, k => {
      k.fillStyle = '#f3e7c9'; k.fillRect(0, 0, 64, 1040);
      k.fillStyle = '#2b2116'; k.font = '700 24px system-ui, sans-serif'; k.textAlign = 'center';
      for (let h = 0; h <= 52; h += 2) { const y = 1040 - h * 20; k.fillRect(0, y - 1, h % 10 === 0 ? 30 : 14, h % 10 === 0 ? 4 : 2); if (h % 10 === 0 && h) k.fillText(String(h), 44, y + 9); }
    });
    const stick = new THREE.Mesh(new THREE.PlaneGeometry(3.2, W.height), new THREE.MeshStandardMaterial({ map: pole, roughness: 1 }));
    stick.position.set(W.x0 - 3.2, W.height / 2, 0.3);
    this.scene.add(stick);

    // Chalk layer for the storyboard outline and the trace of the last take.
    const c = document.createElement('canvas');
    c.width = 900; c.height = 520;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.chalk = { tex, k: c.getContext('2d')! };
    const layer = new THREE.Mesh(new THREE.PlaneGeometry(width, W.height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    layer.position.set(0, W.height / 2, 0.08);
    layer.renderOrder = 2;
    this.scene.add(layer);
  }

  private addResident(x: number, y: number) {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x2b3a3d, roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 1.6, 4, 12), m), head = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), m);
    body.position.y = -2.6; head.position.y = -0.4;
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.7, 3, 8), m), armR = armL.clone();
    armL.position.set(-1.5, -1.9, 0); armR.position.set(1.5, -1.9, 0);
    armL.name = 'armL'; armR.name = 'armR';
    g.add(body, head, armL, armR);
    g.position.set(x + ((this.residents.length % 3) - 1) * 1.2, y, 0.9);
    this.scene.add(g);
    this.residents.push({ group: g, x, y, t: 9, down: 0 });
  }

  private buildTracks() {
    const L = this.L, steel = new THREE.MeshStandardMaterial({ color: 0x2c2724, roughness: 0.5, metalness: 0.6 }), wood = new THREE.MeshStandardMaterial({ color: 0x4d3b2f, roughness: 1 });
    const len = L.lamp.max - L.lamp.min + 16, mid = (L.lamp.max + L.lamp.min) / 2;
    for (const x of [-2.8, 2.8]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, len), steel); r.position.set(L.lamp.x + x, 0.45, mid); this.scene.add(r); }
    for (let z = L.lamp.min - 6; z <= L.lamp.max + 6; z += 5) { const s = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.3, 1.1), wood); s.position.set(L.lamp.x, 0.16, z); s.receiveShadow = true; this.scene.add(s); }
    const dl = L.duck.max - L.duck.enterFrom + 6, dm = (L.duck.max + L.duck.enterFrom) / 2;
    for (const z of [-2.3, 2.3]) { const r = new THREE.Mesh(new THREE.BoxGeometry(dl, 0.25, 0.4), steel); r.position.set(dm, 0.13, L.duck.z + z); this.scene.add(r); }

    // Tape measure along the lamp track: distance from lamp to duck.
    const tape = canvasTexture(128, 1440, k => {
      k.fillStyle = '#f0c95a'; k.fillRect(0, 0, 128, 1440);
      k.fillStyle = '#2b2116'; k.font = '800 44px system-ui, sans-serif'; k.textAlign = 'center';
      for (let gap = 10; gap <= 90; gap += 2) {
        const y = (gap - 10) * 18 + 0;
        k.fillRect(0, y - 2, gap % 10 === 0 ? 46 : 22, gap % 10 === 0 ? 5 : 3);
        if (gap % 10 === 0 && gap >= 20) { k.save(); k.translate(86, y + 16); k.fillText(String(gap), 0, 0); k.restore(); }
      }
    });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 80), new THREE.MeshStandardMaterial({ map: tape, roughness: 0.8 }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(L.lamp.x + 7.6, 0.08, L.duck.z + 10 + 40);
    strip.receiveShadow = true;
    this.scene.add(strip);

    // The duck's floor mark: a tape cross with a pin to grab.
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0xff7a59, roughness: 0.7 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, 1.1), tapeMat), b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 9), tapeMat);
    b.position.z = 3.6;
    const pin = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 10, 10), new THREE.MeshStandardMaterial({ color: 0xf3e7c9, roughness: 0.6 }));
    pole.position.y = 5;
    const flagShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(5.4, -1.7), new THREE.Vector2(0, -3.4)]);
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshStandardMaterial({ color: 0xff7a59, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x7a2a16, emissiveIntensity: 0.5 }));
    flag.position.set(0.2, 10, 0);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.6, 20), new THREE.MeshPhysicalMaterial({ color: 0xff7a59, roughness: 0.3, clearcoat: 1 }));
    foot.position.y = 0.3;
    pin.add(pole, flag, foot);
    pin.position.set(0, 0, 8.6);
    pin.castShadow = false;
    this.mark.add(a, b, pin);
    this.mark.position.set(0, 0.07, L.duck.z);
    this.scene.add(this.mark);
  }

  private buildLamp() {
    const dark = new THREE.MeshPhysicalMaterial({ color: 0xc8432f, roughness: 0.4, clearcoat: 0.6, emissive: 0x7a1d10, emissiveIntensity: 0.55 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xc9b98f, roughness: 0.35, metalness: 0.8 });
    const dolly = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1.2, 9), dark);
    dolly.position.set(0, 1.5, 4.5);
    this.lampRig.add(dolly);
    for (const [x, z] of [[-2.8, 1.5], [2.8, 1.5], [-2.8, 7.5], [2.8, 7.5]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 16), trim);
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.9, z);
      this.lampRig.add(w);
    }
    for (const x of [-3, 3]) { const y = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 0.9), trim); y.position.set(x, 3.9, 3.4); this.lampRig.add(y); }
    const head = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.1, 6, 28), dark);
    head.rotation.x = Math.PI / 2; head.position.set(0, this.L.lamp.y, 3.1);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.28, 10, 32), trim);
    rim.position.set(0, this.L.lamp.y, 0.15);
    this.lens = new THREE.Mesh(new THREE.CircleGeometry(2.5, 28), new THREE.MeshStandardMaterial({ color: 0x1b1b18, emissive: 0xffe2a8, emissiveIntensity: 0 }));
    this.lens.rotation.y = Math.PI; this.lens.position.set(0, this.L.lamp.y, 0.08);
    this.lampRig.add(head, rim, this.lens);
    this.scene.add(this.lampRig);

    const g = new THREE.ConeGeometry(1, 1, 48, 1, true);
    g.translate(0, -0.5, 0);
    g.rotateX(-Math.PI / 2);
    this.cone = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.scene.add(this.cone);
  }

  private buildDuck() {
    // Painted tin, as on the concept sheet: glossy yellow enamel, orange bill and feet, brass key.
    const mats = {
      body: new THREE.MeshPhysicalMaterial({ color: 0xf4bc22, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.22 }),
      bill: new THREE.MeshPhysicalMaterial({ color: 0xf07a3c, roughness: 0.34, clearcoat: 0.6 }),
      foot: new THREE.MeshPhysicalMaterial({ color: 0xf07a3c, roughness: 0.34, clearcoat: 0.6 }),
      key: new THREE.MeshStandardMaterial({ color: 0xb8973f, roughness: 0.42, metalness: 0.75 }),
    };
    // The judge uses the exact ellipsoids; the meshes only have to look round at toy size.
    const big = new THREE.SphereGeometry(1, 32, 20), small = new THREE.SphereGeometry(1, 16, 10);
    // The key turns about its own stem.
    const keyAxis = DUCK.find(p => p.part === 'key')!.c.x;
    for (const p of DUCK) {
      const m = new THREE.Mesh(Math.max(p.r.x, p.r.y, p.r.z) > 3 ? big : small, mats[p.part]);
      m.castShadow = true;
      m.scale.set(p.r.x, p.r.y, p.r.z);
      if (p.part === 'key') { m.position.set(p.c.x - keyAxis, p.c.y, p.c.z); this.key.add(m); }
      else { m.position.set(p.c.x, p.c.y, p.c.z); this.duckBody.add(m); }
    }
    this.key.position.x = keyAxis;
    // Details that sit inside the silhouette and cast no shadow of their own: the seam where
    // head meets body, the raised wing rims, the eyes.
    const head = DUCK[1], seam = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.24, 10, 40), new THREE.MeshStandardMaterial({ color: 0xc99414, roughness: 0.5, metalness: 0.3 }));
    seam.rotation.x = Math.PI / 2;
    seam.position.set(head.c.x - 0.5, 8.75, 0);
    this.duckBody.add(seam);
    for (const z of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 40), new THREE.MeshStandardMaterial({ color: 0xc99414, roughness: 0.5, metalness: 0.3 }));
      rim.scale.set(3.9, 2.05, 1);
      rim.position.set(-2.2, 5.4, z * 5.42);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), new THREE.MeshPhysicalMaterial({ color: 0x15191a, roughness: 0.08, clearcoat: 1 }));
      eye.position.set(head.c.x + 2.55, head.c.y + 0.75, z * 3.05);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(head.c.x + 2.95, head.c.y + 1.02, z * 3.38);
      this.duckBody.add(rim, eye, glint);
    }
    this.duckBody.add(this.key);
    this.duck.add(this.duckBody);
    this.scene.add(this.duck);
  }

  private buildCat() {
    const fur = new THREE.MeshStandardMaterial({ color: 0x2d3836, roughness: 0.85 });
    const L = this.L;
    // The cat sits on a small ledge in the strip of wall between two window columns, so it never
    // hides a window and no window has to be left out for it.
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.6, 2.6), new THREE.MeshStandardMaterial({ color: 0xf1e3c8, roughness: 0.9 }));
    ledge.position.set(L.cat.x, L.cat.y - 3.9, 1.3);
    ledge.receiveShadow = true;
    this.scene.add(ledge);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), fur); body.scale.set(CAT.body.r.x, CAT.body.r.y, CAT.body.r.z); body.position.set(CAT.body.c.x, CAT.body.c.y, CAT.body.c.z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(CAT.head.r, 24, 18), fur); head.position.set(CAT.head.c.x, CAT.head.c.y, CAT.head.c.z);
    this.cat.add(body, head);
    for (const x of [-1.3, 0.9]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 12), fur); ear.position.set(x, 7.9, 0.4); this.cat.add(ear); }
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x3a2f10, emissive: 0xffd95e, emissiveIntensity: 1.6 });
    for (const x of [-0.95, 0.55]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), eyeMat); e.position.set(x, 6.1, 2.25); this.cat.add(e); this.catEyes.push(e); }
    this.catTail = new THREE.Group();
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.55 - i * 0.03, 10, 8), fur); s.position.set(i * 0.45, i * 0.78, 0); this.catTail.add(s); }
    this.catTail.position.set(2.1, 0.9, 0.2);
    this.cat.add(this.catTail);
    this.cat.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true; });
    this.cat.position.set(CAT.seat.x, CAT.seat.y, CAT.seat.z);
    this.cat.scale.setScalar(0.001);
    this.scene.add(this.cat);
  }

  private buildClapper() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 384;
    const k = c.getContext('2d')!, tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const paint = (take: number) => {
      this.take = take;
      k.fillStyle = '#1b2224'; k.fillRect(0, 0, 512, 384);
      if (this.clapBoard) k.drawImage(this.clapBoard, 0, 0, 512, 384);
      k.strokeStyle = '#f3e7c9'; k.lineWidth = 6; k.strokeRect(14, 14, 484, 356);
      k.beginPath(); k.moveTo(14, 190); k.lineTo(498, 190); k.moveTo(256, 14); k.lineTo(256, 190); k.stroke();
      k.fillStyle = '#9fb3ad'; k.font = '800 46px system-ui, sans-serif'; k.textAlign = 'left';
      k.fillText('SCENE', 30, 66); k.fillText('TAKE', 272, 66);
      k.fillStyle = '#f3e7c9'; k.font = '900 96px system-ui, sans-serif';
      k.fillText(this.L.id, 30, 170); k.fillText(String(take), 272, 170);
      k.fillStyle = '#ffcf6b'; k.font = '900 96px system-ui, sans-serif'; k.textAlign = 'center';
      k.fillText('ACTION!', 256, 318);
      tex.needsUpdate = true;
    };
    this.slate = { tex, paint };
    paint(1);
    const board = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 0.9), [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: 0x1b2224, roughness: 0.6 })).concat([new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25 }), new THREE.MeshStandardMaterial({ color: 0x1b2224 })]));
    board.position.y = 7;
    const stripes = canvasTexture(512, 64, s => { s.fillStyle = '#f3e7c9'; s.fillRect(0, 0, 512, 64); s.fillStyle = '#1b2224'; for (let i = -1; i < 9; i++) { s.beginPath(); s.moveTo(i * 64, 64); s.lineTo(i * 64 + 32, 64); s.lineTo(i * 64 + 64, 0); s.lineTo(i * 64 + 32, 0); s.fill(); } });
    const armMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(16, 1.8, 1), armMat);
    base.position.y = 13.9;
    const armGeo = new THREE.BoxGeometry(16, 1.8, 1);
    armGeo.translate(8, 0.9, 0);
    this.clapArm = new THREE.Mesh(armGeo, armMat);
    this.clapArm.position.set(-8, 14.8, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 6), new THREE.MeshStandardMaterial({ color: 0x4d3b2f, roughness: 1 }));
    foot.position.y = 0.5;
    this.clapper.add(board, base, this.clapArm, foot);
    this.clapper.traverse(o => { (o as THREE.Mesh).castShadow = false; });
    this.clapper.position.set(44, 0, 92);
    this.clapper.rotation.y = -0.5;
    this.scene.add(this.clapper);
  }

  private buildConfetti() {
    const n = 160, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), palette = [0xffcf6b, 0xff7a59, 0x9fe6c8, 0xf3e7c9, 0xff9db0].map(c => new THREE.Color(c));
    for (let i = 0; i < n; i++) { const c = palette[i % palette.length]; col.set([c.r, c.g, c.b], i * 3); pos[i * 3 + 1] = -99; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, vertexColors: true, toneMapped: false }));
    points.frustumCulled = false;
    this.scene.add(points);
    this.confetti = { points, vel: new Float32Array(n * 3), life: 0 };
  }

  private ring(r: number) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 1.1, 48), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.2;
    this.scene.add(m);
    return m;
  }

  private handle(r: number) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.scene.add(m);
    return m;
  }

  /**
   * Swap placeholder surfaces for delivered textures. Slots: facade, floor, sky.
   * Anything missing from public/assets/manifest.json keeps its placeholder.
   */
  async loadArt(base: string) {
    let manifest: { slots?: Record<string, string>; props?: Record<string, string>; models?: Record<string, string> };
    try {
      manifest = await (await fetch(`${base}assets/manifest.json`)).json();
    } catch {
      this.artReady = true; // no art delivered: loading is over, placeholders everywhere
      return;
    }
    // Every file is on its own: one that fails to load leaves its placeholder and nothing else.
    const surfaces = Object.entries(manifest.slots ?? {}).map(async ([slot, file]) => {
      const mat = this.skins[slot];
      if (!mat) return;
      try {
        const tex = await new THREE.TextureLoader().loadAsync(`${base}assets/${file}`);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        if (slot === 'floor') { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(TABLE.w / 180, TABLE.d / 180); }
        if (slot === 'sky') { tex.wrapS = THREE.MirroredRepeatWrapping; tex.repeat.set(3, 1); tex.offset.set(-1, 0); }
        mat.map = tex;
        mat.needsUpdate = true;
        this.artLoaded.push(slot);
      } catch {
        /* keep the placeholder */
      }
    });
    await Promise.all([...surfaces, this.loadProps(base, manifest.props ?? {}).catch(() => {}), this.loadModels(base, manifest.models ?? {}).catch(() => {})]);
    this.artReady = true;
  }

  /** Generated 3D models. Each is optional; a missing or broken one keeps its placeholder. */
  private async loadModels(base: string, models: Record<string, string>) {
    if (!models.lamp) return;
    const gltf = await new GLTFLoader().loadAsync(`${base}assets/${models.lamp}`);
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    // Gather every vertex in the model's own space.
    const pts: THREE.Vector3[] = [];
    let triangles = 0;
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false; // the lamp must not block its own light
      // A faint glow of its own colours, so it still reads as the thing to grab when the set is dark.
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.map) { mat.emissiveMap = mat.map; mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = 0.3; }
      const pos = m.geometry.getAttribute('position');
      triangles += (m.geometry.index ? m.geometry.index.count : pos.count) / 3;
      for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
    });
    const box = new THREE.Box3().setFromPoints(pts), size = box.getSize(new THREE.Vector3());
    // The barrel runs along the longer horizontal axis. The lens end is the one that is still
    // full-width at its tip; the back of the barrel is a dome that tapers.
    const axis: 'x' | 'z' = size.x >= size.z ? 'x' : 'z', len = size[axis];
    // Look only at the barrel: the wheels below it can stick out further than either end.
    const barrel = pts.filter(p => p.y > box.min.y + size.y * 0.4 && p.y < box.min.y + size.y * 0.85);
    const ends = { max: Math.max(...barrel.map(p => p[axis])), min: Math.min(...barrel.map(p => p[axis])) };
    const tip = (sign: 1 | -1) => barrel.filter(p => (sign > 0 ? ends.max - p[axis] : p[axis] - ends.min) < len * 0.04);
    const spread = (ps: THREE.Vector3[]) => Math.max(...ps.map(p => p.y)) - Math.min(...ps.map(p => p.y));
    const front = spread(tip(1)) >= spread(tip(-1)) ? 1 : -1;
    const other: 'x' | 'z' = axis === 'x' ? 'z' : 'x';
    // The lens rim is a circle. Its upper half is clear of the wheels, so measure there: the rim's
    // top, and its radius from how wide it is. The centre is one radius below the top.
    const face = front > 0 ? ends.max : ends.min;
    const lensPts = pts.filter(p => Math.abs(p[axis] - face) < len * 0.04 && p.y > box.min.y + size.y * 0.4);
    const sideMax = Math.max(...lensPts.map(p => p[other])), sideMin = Math.min(...lensPts.map(p => p[other]));
    const lensRadius = (sideMax - sideMin) / 2, lensSide = (sideMax + sideMin) / 2;
    const lensY = Math.max(...lensPts.map(p => p.y)) - lensRadius;
    // Scale so the lens centre sits at the height of the simulated light source. That height
    // decides where shadows fall, so it is the one measurement that must be exact.
    const k = this.L.lamp.y / (lensY - box.min.y);
    // Move the lens centre's foot to the origin, then turn the lens towards the wall (−z) and scale.
    const lensTip = front > 0 ? ends.max : ends.min;
    model.position.set(axis === 'x' ? -lensTip : -lensSide, -box.min.y, axis === 'z' ? -lensTip : -lensSide);
    const holder = new THREE.Group();
    holder.add(model);
    holder.rotation.y = axis === 'x' ? (front > 0 ? Math.PI / 2 : -Math.PI / 2) : front > 0 ? Math.PI : 0;
    holder.scale.setScalar(k);
    for (const old of [...this.lampRig.children]) if (old !== this.lens) this.lampRig.remove(old);
    this.lampRig.add(holder);
    // Keep the glowing disc just in front of the model's lens.
    this.lens.position.set(0, this.L.lamp.y, -0.08);
    this.lens.scale.setScalar(((lensRadius * k) / 2.5) * 0.78);
    this.lampLens = `${front > 0 ? '+' : '-'}${axis}`;
    this.models.lamp = { height: size.y * k, width: size[other] * k, depth: len * k, lensHeight: (lensY - box.min.y) * k, triangles };
    this.artLoaded.push('model:lamp');
  }

  /**
   * Flat props delivered as images: paper residents, the faces of the neighbouring blocks and
   * the clapperboard's slate. Each is optional; whatever is missing keeps its placeholder.
   */
  private async loadProps(base: string, props: Record<string, string>) {
    const loader = new THREE.TextureLoader();
    const load = async (name: string) => {
      if (!props[name]) return null;
      try {
        const t = await loader.loadAsync(`${base}assets/${props[name]}`);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        this.artLoaded.push(name);
        return t;
      } catch {
        return null;
      }
    };

    // Residents: three people, used in turn. The cut-out is 384 px square; the bust's bottom
    // edge is at row 364 and it is centred on column 192.
    const people = await Promise.all([1, 2, 3].map(async n => ({ idle: await load(`resident-${n}-idle`), raised: await load(`resident-${n}-raised`) })));
    const SIZE = 6.2, FOOT = (384 - 364) / 384;
    this.residents.forEach((r, i) => {
      const p = people[i % 3];
      if (!p.idle || !p.raised) return;
      const mat = new THREE.MeshStandardMaterial({ map: p.idle, transparent: true, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide });
      const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), mat);
      // Stand the bust's bottom edge on the window's lower frame.
      cardMesh.position.y = -this.L.windows.h / 2 + SIZE / 2 - FOOT * SIZE;
      for (const old of [...r.group.children]) r.group.remove(old);
      // Keep raised hands inside the window frame.
      r.group.position.x = r.x + ((i % 3) - 1) * 0.6;
      r.group.add(cardMesh);
      r.card = { mat, idle: p.idle, raised: p.raised };
    });

    // Neighbouring blocks: a front and a side elevation per design. Box faces are +x, -x, +y, -y, +z, -z.
    for (const kind of ['a', 'b'] as const) {
      const front = await load(`block-${kind}-front`), side = await load(`block-${kind}-side`);
      if (!front || !side) continue;
      for (const b of this.blocks.filter(x => x.kind === kind)) {
        const faces = b.box.material as THREE.MeshStandardMaterial[];
        for (const [i, tex] of [[0, side], [1, side], [4, front]] as const) { faces[i].map = tex; faces[i].color.set(0xffffff); faces[i].needsUpdate = true; }
        b.detail.visible = false;
      }
    }

    const board = await load('clapper-board');
    if (board) { this.clapBoard = board.image as HTMLImageElement; this.slate.paint(this.take); }
  }

  // ---------- what the game calls ----------
  setTake(n: number) { this.slate.paint(n); }
  clap() { this.clapT = 0; }
  roar() { this.squash = 1; }
  celebrate() {
    const { points, vel } = this.confetti, pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, this.duckX + (Math.random() - 0.5) * 30, 34 + Math.random() * 14, 20 + Math.random() * 30);
      vel.set([(Math.random() - 0.5) * 30, Math.random() * 24, (Math.random() - 0.5) * 30], i * 3);
    }
    pos.needsUpdate = true;
    this.confetti.life = 3.2;
    this.catHop = 1;
  }
  scare(i: number) { this.residents[i].t = 0; }
  get residentSpots() { return this.residents.map(r => ({ x: r.x, y: r.y })); }

  /**
   * Redraw the chalk layer. Masks use `grid`; `outline` is the storyboard,
   * `trace` is where the last take's shadow actually fell.
   */
  drawChalk(grid: Grid, outline: Uint8Array | null, trace: Uint8Array | null, good = false) {
    const { k, tex } = this.chalk, W = 900, H = 520;
    k.clearRect(0, 0, W, H);
    const stamp = (m: Uint8Array) => {
      const c = document.createElement('canvas');
      c.width = grid.cols; c.height = grid.rows;
      const ck = c.getContext('2d')!, img = ck.createImageData(grid.cols, grid.rows);
      for (let j = 0; j < grid.rows; j++) for (let i = 0; i < grid.cols; i++) if (m[j * grid.cols + i]) { const o = ((grid.rows - 1 - j) * grid.cols + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = img.data[o + 3] = 255; }
      ck.putImageData(img, 0, 0);
      return c;
    };
    const layer = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const ck = c.getContext('2d')!; ck.imageSmoothingQuality = 'high'; return [c, ck] as const; };
    const stripes = (ck: CanvasRenderingContext2D, on: number, off: number) => {
      ck.globalCompositeOperation = 'destination-in';
      ck.lineWidth = on; ck.strokeStyle = '#fff'; ck.beginPath();
      for (let x = -H; x < W + H; x += on + off) { ck.moveTo(x, H); ck.lineTo(x + H, 0); }
      ck.stroke();
      ck.globalCompositeOperation = 'source-over';
    };
    if (trace) {
      const [c, ck] = layer();
      ck.drawImage(stamp(trace), 0, 0, W, H);
      ck.globalCompositeOperation = 'source-in'; ck.fillStyle = 'rgba(70,150,255,.72)'; ck.fillRect(0, 0, W, H);
      stripes(ck, 7, 5);
      k.drawImage(c, 0, 0);
    }
    if (outline) {
      const src = stamp(outline), [c, ck] = layer();
      for (let a = 0; a < 16; a++) ck.drawImage(src, Math.cos((a / 16) * Math.PI * 2) * 7, Math.sin((a / 16) * Math.PI * 2) * 7, W, H);
      ck.globalCompositeOperation = 'destination-out';
      ck.drawImage(src, 0, 0, W, H);
      ck.globalCompositeOperation = 'source-in'; ck.fillStyle = good ? '#ffd76b' : '#fffbe6'; ck.fillRect(0, 0, W, H);
      if (!good) stripes(ck, 20, 11);
      k.drawImage(c, 0, 0);
    }
    tex.needsUpdate = true;
  }

  // ---------- input helpers ----------
  private ndc(cx: number, cy: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  }
  pick(cx: number, cy: number): Pickable | null {
    this.raycaster.setFromCamera(this.ndc(cx, cy), this.camera);
    let best: Pickable | null = null, dist = Infinity;
    for (const k of Object.keys(this.handles) as Pickable[]) {
      if (!this.raycaster.intersectObject(this.handles[k]).length) continue;
      const p = this.handles[k].position, c = this.toClient(p.x, p.y, p.z), d = Math.hypot(c.x - cx, c.y - cy);
      if (d < dist) { dist = d; best = k; }
    }
    return best;
  }
  /** Where a finger points on the table top. */
  tablePoint(cx: number, cy: number): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.ndc(cx, cy), this.camera);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), out) ? out : null;
  }
  /** Screen position of a point on the set, for hints and automated tests. */
  toClient(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera), r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.fitWide();
    this.placeCamera();
    this.fitted = `${w}x${h}`;
  }

  /**
   * Wide view: pull the camera back until everything the player must reach is
   * on screen and clear of the HUD (title and buttons on top, caption below),
   * whatever the shape of the window.
   */
  private fitWide() {
    const L = this.L, W = L.wall;
    const must = [
      [L.lamp.x - 7, 0, L.lamp.max + 13], [L.lamp.x + 11, 0, L.lamp.max + 13], [L.lamp.x, 9, L.lamp.max],
      [W.x0 - 6, 0, 0], [W.x0 - 6, W.height + 7, -5], [W.x1 + 2, W.height + 7, -5], [W.x1 + 2, 0, 0],
      [54, 18, 92], [54, 0, 99],
      [L.duck.enterFrom - 10, 0, L.duck.z + 5], [L.duck.enterFrom - 10, 17, L.duck.z],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const look = new THREE.Vector3(8, 10, 56), dir = new THREE.Vector3(-84, 47, 170).normalize(), pos = new THREE.Vector3(), v = new THREE.Vector3();
    this.camera.fov = 30;
    for (let d = 150; d <= 560; d += 4) {
      pos.copy(look).addScaledVector(dir, d);
      this.camera.position.copy(pos);
      this.camera.lookAt(look);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
      if (must.every(p => { v.copy(p).project(this.camera); return Math.abs(v.x) < 0.95 && v.y > -0.6 && v.y < 0.78; })) break;
    }
    this.wide = { pos: pos.clone(), look };

    // Film view: square-on to the wall from above the lamp, far enough back that the whole
    // building sits between the letterbox bars.
    const corners = [[W.x0 - 5, -1, 0], [W.x1 + 3, -1, 0], [W.x0 - 5, W.height + 4, 0], [W.x1 + 3, W.height + 4, 0]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const flook = new THREE.Vector3(2, 25, 0), fpos = new THREE.Vector3();
    this.camera.fov = 34;
    for (let d = 100; d <= 420; d += 4) {
      fpos.set(2, 50, d);
      this.camera.position.copy(fpos);
      this.camera.lookAt(flook);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
      if (corners.every(p => { v.copy(p).project(this.camera); return Math.abs(v.x) < 0.96 && Math.abs(v.y) < 0.8; })) break;
    }
    this.filmCam = { pos: fpos.clone(), look: flook };
  }

  private placeCamera() {
    const t = smooth(this.filmT), a = this.camera.aspect;
    // Wide: three-quarter view of the whole table. Film: square-on to the wall, like the movie camera.
    const pos = this.wide.pos.clone().lerp(this.filmCam.pos, t);
    const look = this.wide.look.clone().lerp(this.filmCam.look, t);
    void a;
    this.camera.fov = THREE.MathUtils.lerp(30, 34, t);
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  // ---------- every frame ----------
  update(dt: number) {
    const L = this.L, t = (this.clock += dt);
    this.filmT = ease(this.filmT, this.film ? 1 : 0, dt, 3.2);
    this.placeCamera();

    // Lights. The lamp flickers for a moment when it is switched on.
    const was = this.lampOnLevel;
    this.lampOnLevel = ease(this.lampOnLevel, this.lampOn ? 1 : 0, dt, this.lampOn ? 9 : 14);
    if (this.lampOn && was < 0.05) this.flicker = 0.35;
    this.flicker = Math.max(0, this.flicker - dt);
    const flick = this.flicker > 0 ? 0.55 + 0.45 * Math.sin(t * 90) : 1;
    this.house = ease(this.house, this.houseLights, dt, 4);
    this.hemi.intensity = 0.16 + 1.05 * this.house;
    this.work.intensity = 0.05 + 1.25 * this.house;
    this.spot.intensity = 2.6 * this.lampOnLevel * flick;
    this.spot.position.set(L.lamp.x, L.lamp.y, this.lampZ);
    (this.lens.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 * this.lampOnLevel * flick;
    this.lampRig.position.set(L.lamp.x, 0, this.lampZ);
    this.cone.position.copy(this.spot.position);
    this.cone.lookAt(this.spot.target.position);
    const len = this.spot.position.distanceTo(this.spot.target.position), rad = Math.tan(this.spot.angle) * len;
    this.cone.scale.set(rad, rad, len);
    this.cone.visible = false;
    this.bloom.strength = 0.22 + 0.16 * (1 - this.house);

    // Duck: a rigid toy, so it rocks and bobs instead of bending.
    this.duck.position.set(this.duckX, 0, L.duck.z);
    const walk = this.walking ? 1 : 0;
    this.duckBody.rotation.x = Math.sin(t * 13) * 0.11 * walk;
    this.duckBody.position.y = Math.abs(Math.sin(t * 13)) * 0.7 * walk;
    this.key.rotation.y += dt * 9 * walk;
    if (!this.walking) this.key.rotation.y = ease(this.key.rotation.y % Math.PI, 0, dt, 8);
    this.squash = Math.max(0, this.squash - dt * 1.6);
    const q = Math.sin(this.squash * Math.PI * 3) * this.squash * 0.16;
    this.duckBody.scale.set(1 + q, 1 - q, 1 + q);

    this.mark.position.x = this.markX;

    // Handles and the rings that show what can be dragged.
    this.handles.lamp.position.set(L.lamp.x, 5, this.lampZ + 3);
    this.handles.mark.position.set(this.markX, 3, L.duck.z + 8);
    this.handles.clapper.position.copy(this.clapper.position).add(new THREE.Vector3(0, 8, 0));
    const pulse = 0.35 + 0.3 * Math.sin(t * 4);
    this.rings.lamp.position.set(L.lamp.x, 0.22, this.lampZ + 4);
    this.rings.mark.position.set(this.markX, 0.22, L.duck.z + 8.6);
    (this.rings.lamp.material as THREE.MeshBasicMaterial).opacity = ease((this.rings.lamp.material as THREE.MeshBasicMaterial).opacity, this.movable.lamp && !this.film ? pulse : 0, dt, 8);
    (this.rings.mark.material as THREE.MeshBasicMaterial).opacity = ease((this.rings.mark.material as THREE.MeshBasicMaterial).opacity, this.movable.mark && !this.film ? pulse : 0, dt, 8);

    // Clapperboard: bobs when it wants to be tapped, snaps when it is.
    this.clapT = Math.min(1, this.clapT + dt * 3.5);
    this.clapArm.rotation.z = this.clapT < 0.35 ? 0.55 * (1 - this.clapT / 0.35) : this.clapT < 1 ? 0 : this.clapperReady ? 0.3 + Math.sin(t * 6) * 0.08 : 0.3;
    this.clapper.position.y = this.clapperReady && !this.film ? Math.abs(Math.sin(t * 4)) * 0.9 : 0;

    // Residents throw their arms up and drop out of sight when the shadow reaches them.
    for (const r of this.residents) {
      r.t += dt;
      const up = r.t < 0.9 ? Math.sin((r.t / 0.9) * Math.PI) : 0;
      r.down = ease(r.down, r.t < 3.5 && r.t > 0.5 ? 1 : 0, dt, 6);
      // A paper bust would show its cut bottom edge if it hopped, so only the modelled ones do.
      r.group.position.y = r.y + (r.card ? 0 : up * 1.6) - r.down * 4.2;
      r.group.scale.setScalar(1 - r.down * 0.7);
      // Once ducked below the sill a resident is out of sight, not a speck on the ledge.
      r.group.visible = r.down < 0.9;
      if (r.card) {
        // Paper resident: same rise and drop, and the pose is a second cut-out rather than moving arms.
        const want = up > 0.12 ? r.card.raised : r.card.idle;
        if (r.card.mat.map !== want) { r.card.mat.map = want; r.card.mat.needsUpdate = true; }
      } else for (const side of ['armL', 'armR']) { const arm = r.group.getObjectByName(side)!; arm.position.y = -1.9 + up * 2.4; arm.rotation.z = (side === 'armL' ? 1 : -1) * up * 0.5; }
    }

    // Cat.
    this.catPop = ease(this.catPop, this.catVisible ? 1 : 0, dt, 7);
    this.cat.scale.setScalar(Math.max(0.001, this.catPop));
    this.cat.rotation.y = ease(this.cat.rotation.y, this.catSulking ? Math.PI * 0.86 : 0, dt, 6);
    this.catTail.rotation.z = Math.sin(t * (this.catSulking ? 13 : 2.6)) * (this.catSulking ? 0.35 : 0.2) - 0.2;
    for (const e of this.catEyes) e.scale.y = ease(e.scale.y, this.catSulking ? 0.25 : 1, dt, 10);
    this.catHop = Math.max(0, this.catHop - dt * 1.3);
    this.cat.position.y = CAT.seat.y + Math.abs(Math.sin(this.catHop * Math.PI * 3)) * this.catHop * 2.4;

    // Confetti.
    this.confetti.points.visible = this.confetti.life > 0;
    if (this.confetti.life > 0) {
      this.confetti.life -= dt;
      const pos = this.confetti.points.geometry.getAttribute('position') as THREE.BufferAttribute, v = this.confetti.vel;
      for (let i = 0; i < pos.count; i++) {
        v[i * 3 + 1] -= 38 * dt;
        pos.setXYZ(i, pos.getX(i) + v[i * 3] * dt, Math.max(0.3, pos.getY(i) + v[i * 3 + 1] * dt), pos.getZ(i) + v[i * 3 + 2] * dt);
      }
      pos.needsUpdate = true;
      (this.confetti.points.material as THREE.PointsMaterial).opacity = Math.min(1, this.confetti.life);
      (this.confetti.points.material as THREE.PointsMaterial).transparent = true;
    }

    this.composer.render();

    // If frames are slow, render fewer pixels.
    if (!this.probe.pr) {
      const next = this.quality.step(dt);
      if (next !== null) {
        this.renderer.setPixelRatio(next);
        this.composer.setPixelRatio(next);
        this.resize();
        this.lowestRatio = Math.min(this.lowestRatio, next);
      }
    }
  }

  /** Pixel ratio the game is currently rendering at. */
  get pixelRatio() { return this.renderer.getPixelRatio(); }
}
