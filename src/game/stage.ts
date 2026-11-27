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
import { DUCK, type Grid } from '../sim/light';
import type { Scene02 } from './scene02';

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
  private residents: { group: THREE.Group; x: number; y: number; t: number; down: number }[] = [];
  private confetti!: { points: THREE.Points; vel: Float32Array; life: number };
  private squash = 0;
  private flicker = 0;
  private probe = { pr: 0, bloom: true, sm: 0 };
  private frames = 0;
  private slow = 0;
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
    tex.repeat.set(5, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), (this.skins.floor = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0 })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 150);
    floor.receiveShadow = true;
    this.scene.add(floor);
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
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1100, 275), (this.skins.sky = new THREE.MeshBasicMaterial({ map: sky, toneMapped: false, color: 0x9aa7a8 })));
    back.position.set(0, 122, -110);
    // Twice as wide as the painting: mirror it rather than stretch it, so nothing gets magnified.
    sky.wrapS = THREE.MirroredRepeatWrapping;
    sky.repeat.set(2, 1);
    sky.offset.set(0.5, 0);
    this.scene.add(back);
    // Neighbouring cardboard blocks give the street some depth.
    const mat = new THREE.MeshStandardMaterial({ color: 0x5f8a80, roughness: 1 });
    for (const [x, w, h, z] of [[-80, 44, 36, -16], [-124, 40, 50, -30], [80, 46, 30, -14], [126, 40, 46, -32]] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 14), mat);
      b.position.set(x, h / 2, z);
      b.receiveShadow = true;
      this.scene.add(b);
      const lit = new THREE.MeshBasicMaterial({ color: 0xf2c97a, toneMapped: false });
      for (let i = 0; i < 4; i++) for (let j = 0; j < Math.floor(h / 12); j++) if ((i + j * 3 + Math.round(x)) % 3 === 0) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), lit);
        win.position.set(x - w / 2 + 7 + i * 9, 7 + j * 12, z + 7.05);
        this.scene.add(win);
      }
    }
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
        if (Math.abs(cx - L.cat.x) < 9 && Math.abs(cy - L.cat.y) < 8) continue;
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
    const mats = {
      body: new THREE.MeshPhysicalMaterial({ color: 0xf2b632, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
      bill: new THREE.MeshPhysicalMaterial({ color: 0xee6f35, roughness: 0.35, clearcoat: 0.6 }),
      foot: new THREE.MeshPhysicalMaterial({ color: 0xee6f35, roughness: 0.35, clearcoat: 0.6 }),
      key: new THREE.MeshStandardMaterial({ color: 0xc9ccc0, roughness: 0.45, metalness: 0.7 }),
    };
    const ball = new THREE.SphereGeometry(1, 40, 28);
    for (const p of DUCK) {
      const m = new THREE.Mesh(ball, mats[p.part]);
      m.castShadow = true;
      if (p.part === 'key') {
        // Key parts are placed relative to the key's own spin axis.
        m.position.set(p.c.x + 3.4, p.c.y, p.c.z);
        m.scale.set(p.r.x, p.r.y, p.r.z);
        this.key.add(m);
      } else {
        m.position.set(p.c.x, p.c.y, p.c.z);
        m.scale.set(p.r.x, p.r.y, p.r.z);
        this.duckBody.add(m);
      }
    }
    this.key.position.x = -3.4;
    const eye = new THREE.MeshPhysicalMaterial({ color: 0x1b2322, roughness: 0.1, clearcoat: 1 });
    for (const z of [-2.75, 2.75]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), eye);
      e.position.set(5.5, 12.8, z);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(5.9, 13.1, z * 1.16);
      this.duckBody.add(e, glint);
    }
    this.duckBody.add(this.key);
    this.duck.add(this.duckBody);
    this.scene.add(this.duck);
  }

  private buildCat() {
    const fur = new THREE.MeshStandardMaterial({ color: 0x2d3836, roughness: 0.85 });
    const L = this.L;
    const sign = canvasTexture(400, 144, k => {
      k.fillStyle = '#16333a'; k.fillRect(0, 0, 400, 144);
      k.strokeStyle = '#ff9db0'; k.lineWidth = 10; k.strokeRect(10, 10, 380, 124);
      k.fillStyle = '#ffc2cf'; k.font = '800 82px system-ui, sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle';
      k.fillText('MEOW', 200, 78);
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(10, 3.6, 1.2), new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.6 }));
    board.position.set(L.cat.x, L.cat.y - 5.4, 1.2);
    this.scene.add(board);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), fur); body.scale.set(2.3, 2.7, 1.9); body.position.y = 2.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.9, 24, 18), fur); head.position.set(-0.2, 5.9, 0.5);
    this.cat.add(body, head);
    for (const x of [-1.3, 0.9]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 12), fur); ear.position.set(x, 7.9, 0.4); this.cat.add(ear); }
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x3a2f10, emissive: 0xffd95e, emissiveIntensity: 1.6 });
    for (const x of [-0.95, 0.55]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), eyeMat); e.position.set(x, 6.1, 2.25); this.cat.add(e); this.catEyes.push(e); }
    this.catTail = new THREE.Group();
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.55 - i * 0.03, 10, 8), fur); s.position.set(i * 0.45, i * 0.78, 0); this.catTail.add(s); }
    this.catTail.position.set(2.1, 0.9, 0.2);
    this.cat.add(this.catTail);
    this.cat.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true; });
    this.cat.position.set(L.cat.x, L.cat.y - 3.6, 1.9);
    this.cat.scale.setScalar(0.001);
    this.scene.add(this.cat);
  }

  private buildClapper() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 384;
    const k = c.getContext('2d')!, tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const paint = (take: number) => {
      k.fillStyle = '#1b2224'; k.fillRect(0, 0, 512, 384);
      k.strokeStyle = '#f3e7c9'; k.lineWidth = 6; k.strokeRect(14, 14, 484, 356);
      k.beginPath(); k.moveTo(14, 190); k.lineTo(498, 190); k.moveTo(256, 14); k.lineTo(256, 190); k.stroke();
      k.fillStyle = '#9fb3ad'; k.font = '700 34px system-ui, sans-serif'; k.textAlign = 'left';
      k.fillText('SCENE', 34, 62); k.fillText('TAKE', 276, 62);
      k.fillStyle = '#f3e7c9'; k.font = '900 100px system-ui, sans-serif';
      k.fillText(this.L.id, 34, 160); k.fillText(String(take), 276, 160);
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
    try {
      const manifest = (await (await fetch(`${base}assets/manifest.json`)).json()) as { slots?: Record<string, string> };
      for (const [slot, file] of Object.entries(manifest.slots ?? {})) {
        const mat = this.skins[slot];
        if (!mat) continue;
        const tex = await new THREE.TextureLoader().loadAsync(`${base}assets/${file}`);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        if (slot === 'floor') { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 5); }
        if (slot === 'sky') { tex.wrapS = THREE.MirroredRepeatWrapping; tex.repeat.set(2, 1); tex.offset.set(0.5, 0); }
        mat.map = tex;
        mat.needsUpdate = true;
      }
    } catch {
      /* no art delivered yet */
    }
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
      r.group.position.y = r.y + up * 1.6 - r.down * 4.2;
      r.group.scale.setScalar(1 - r.down * 0.7);
      for (const side of ['armL', 'armR']) { const arm = r.group.getObjectByName(side)!; arm.position.y = -1.9 + up * 2.4; arm.rotation.z = (side === 'armL' ? 1 : -1) * up * 0.5; }
    }

    // Cat.
    this.catPop = ease(this.catPop, this.catVisible ? 1 : 0, dt, 7);
    this.cat.scale.setScalar(Math.max(0.001, this.catPop));
    this.cat.rotation.y = ease(this.cat.rotation.y, this.catSulking ? Math.PI * 0.86 : 0, dt, 6);
    this.catTail.rotation.z = Math.sin(t * (this.catSulking ? 13 : 2.6)) * (this.catSulking ? 0.35 : 0.2) - 0.2;
    for (const e of this.catEyes) e.scale.y = ease(e.scale.y, this.catSulking ? 0.25 : 1, dt, 10);
    this.catHop = Math.max(0, this.catHop - dt * 1.3);
    this.cat.position.y = L.cat.y - 3.6 + Math.abs(Math.sin(this.catHop * Math.PI * 3)) * this.catHop * 2.4;

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

    // If frames are slow, render fewer pixels. Never goes back up, so it settles quickly.
    if (!this.probe.pr && this.renderer.getPixelRatio() > 1) {
      this.frames++;
      if (this.frames > 45) this.slow += dt;
      if (this.frames >= 105) {
        if (this.slow / 60 > 1 / 42) {
          this.renderer.setPixelRatio(Math.max(1, this.renderer.getPixelRatio() - 0.5));
          this.composer.setPixelRatio(this.renderer.getPixelRatio());
          this.resize();
        }
        this.frames = 45;
        this.slow = 0;
      }
    }
  }

  /** Pixel ratio the game is currently rendering at. */
  get pixelRatio() { return this.renderer.getPixelRatio(); }
}
