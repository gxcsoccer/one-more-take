/**
 * Scene 01's props, built from primitives as stand-ins until their art is delivered.
 * A light source here really is one: its bright parts are emissive, so they show with every
 * lamp in the room off, and it carries a small light of its own that falls on whatever is near.
 * Everything else has no light of its own at all, however shiny or white it is.
 */
import * as THREE from 'three';
import { canvasTexture } from './stage';

export interface BuiltProp {
  group: THREE.Group;
  /** Height of its top above where it stands, for placing the chalk mark. */
  top: number;
  /** The light it gives out, if it is a source. */
  light?: THREE.PointLight;
}

const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const glow = (color: number, emissive: number, intensity: number) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.6 });
const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
/** A source's own light: reaches about `reach` cm and fades to nothing there. */
const lightOf = (color: number, y: number, reach = 30, power = 1.5) => { const l = new THREE.PointLight(color, power, reach, 1.3); l.position.set(0, y, 1.5); return l; };
const base = (r = 3.2) => mesh(new THREE.CylinderGeometry(r, r + 0.4, 0.8, 24), std(0x4d3b2f, 1), 0, 0.4, 0);

const builders: Record<string, () => BuiltProp> = {
  exit() {
    const g = new THREE.Group();
    const face = canvasTexture(256, 128, k => { k.fillStyle = '#0c3b22'; k.fillRect(0, 0, 256, 128); k.fillStyle = '#7dffb0'; k.font = '900 84px system-ui, sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('EXIT', 128, 68); });
    const lit = new THREE.MeshStandardMaterial({ map: face, emissiveMap: face, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.6 }), box = std(0x1d2a24, 0.7);
    g.add(mesh(new THREE.BoxGeometry(12, 6, 2), [box, box, box, box, lit, box], 0, 6.5, 0));
    for (const x of [-4.5, 4.5]) g.add(mesh(new THREE.BoxGeometry(0.8, 3.5, 0.8), box, x, 1.75, 0));
    const light = lightOf(0x6dffa8, 6.5);
    g.add(light);
    return { group: g, top: 9.5, light };
  },
  lantern() {
    const g = new THREE.Group(), brass = std(0xc9a44a, 0.4, 0.7);
    const body = mesh(new THREE.SphereGeometry(1, 28, 20), glow(0xff5a36, 0xff7a3a, 1.5), 0, 6.2, 0);
    body.scale.set(4.2, 4.6, 4.2);
    g.add(base(), body, mesh(new THREE.CylinderGeometry(2, 2, 0.8, 20), brass, 0, 10.9, 0), mesh(new THREE.CylinderGeometry(2, 2, 0.8, 20), brass, 0, 1.5, 0));
    const hoop = mesh(new THREE.TorusGeometry(1.6, 0.18, 8, 24), brass, 0, 12.4, 0);
    g.add(hoop);
    const light = lightOf(0xff9a5a, 6.2);
    g.add(light);
    return { group: g, top: 14, light };
  },
  moon() {
    const g = new THREE.Group();
    const paper = canvasTexture(256, 256, k => { k.fillStyle = '#efe6c4'; k.fillRect(0, 0, 256, 256); k.fillStyle = 'rgba(190,178,140,.6)'; for (const [x, y, r] of [[80, 90, 26], [160, 70, 16], [150, 160, 30], [70, 180, 14]]) { k.beginPath(); k.arc(x, y, r, 0, 7); k.fill(); } });
    const disc = mesh(new THREE.CylinderGeometry(5, 5, 0.5, 40), [std(0xd8cfae, 1), new THREE.MeshStandardMaterial({ map: paper, roughness: 1 }), new THREE.MeshStandardMaterial({ map: paper, roughness: 1 })], 0, 8.5, 0);
    disc.rotation.x = Math.PI / 2;
    g.add(base(), mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 10), std(0x8a6a4a, 1), 0, 2.4, -0.4), disc);
    return { group: g, top: 14 };
  },
  mirror() {
    const g = new THREE.Group();
    const glass = mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.3, 40), new THREE.MeshPhysicalMaterial({ color: 0xcfe3ea, roughness: 0.04, metalness: 0.35, clearcoat: 1 }), 0, 8, 0.2);
    glass.rotation.x = Math.PI / 2;
    const frame = mesh(new THREE.TorusGeometry(4.5, 0.55, 12, 40), std(0x9a6b3f, 0.6), 0, 8, 0);
    g.add(base(), mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.4, 10), std(0x9a6b3f, 0.6), 0, 2.2, 0), glass, frame);
    return { group: g, top: 13.5 };
  },
  torch() {
    const g = new THREE.Group(), body = std(0x2d4f8f, 0.5, 0.2);
    // Lying on a little cradle, pointing out at the camera, switched on.
    const barrel = mesh(new THREE.CylinderGeometry(1.5, 1.5, 9, 20), body, 0, 4, -1.5);
    barrel.rotation.x = Math.PI / 2;
    const head = mesh(new THREE.CylinderGeometry(2.6, 1.6, 2.6, 24), body, 0, 4, 4.2);
    head.rotation.x = Math.PI / 2;
    const lens = mesh(new THREE.CircleGeometry(2.3, 28), glow(0xfff6d8, 0xfff0c0, 2.2), 0, 4, 5.55);
    g.add(mesh(new THREE.BoxGeometry(5, 2.4, 6), std(0x4d3b2f, 1), 0, 1.2, -1), barrel, head, lens);
    const light = lightOf(0xfff0c8, 4, 34, 1.7);
    light.position.z = 8;
    g.add(light);
    return { group: g, top: 8 };
  },
  tablet() {
    const g = new THREE.Group();
    const pic = canvasTexture(256, 176, k => {
      const sky = k.createLinearGradient(0, 0, 0, 176); sky.addColorStop(0, '#7fd0ff'); sky.addColorStop(1, '#d8f4ff'); k.fillStyle = sky; k.fillRect(0, 0, 256, 176);
      k.fillStyle = '#ffe36b'; k.beginPath(); k.arc(196, 48, 26, 0, 7); k.fill();
      k.fillStyle = '#69c46a'; k.beginPath(); k.ellipse(128, 190, 190, 60, 0, 0, 7); k.fill();
    });
    const screen = new THREE.MeshStandardMaterial({ map: pic, emissiveMap: pic, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.3 }), shell = std(0x20262b, 0.5);
    const slab = mesh(new THREE.BoxGeometry(11, 7.6, 0.6), [shell, shell, shell, shell, screen, shell], 0, 5, 0);
    slab.rotation.x = -0.22;
    g.add(mesh(new THREE.BoxGeometry(5, 1, 3.4), std(0x4d3b2f, 1), 0, 0.5, -0.6), slab);
    const light = lightOf(0xbfe6ff, 5);
    g.add(light);
    return { group: g, top: 10 };
  },
  candle() {
    const g = new THREE.Group();
    const flame = mesh(new THREE.SphereGeometry(1, 16, 14), glow(0xffd36a, 0xffb347, 2.6), 0, 8.6, 0);
    flame.scale.set(0.75, 1.5, 0.75);
    flame.castShadow = false;
    g.add(mesh(new THREE.CylinderGeometry(2.8, 2.2, 0.7, 24), std(0xc9a44a, 0.4, 0.7), 0, 0.35, 0), mesh(new THREE.CylinderGeometry(1.25, 1.25, 6.4, 20), std(0xf4ecd8, 0.9), 0, 3.9, 0), mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6), std(0x2b2116, 1), 0, 7.4, 0), flame);
    const light = lightOf(0xffb86a, 8.6, 30, 1.6);
    g.add(light);
    return { group: g, top: 11 };
  },
  trophy() {
    const g = new THREE.Group(), gold = new THREE.MeshPhysicalMaterial({ color: 0xe2b23a, roughness: 0.22, metalness: 0.55, clearcoat: 0.8 });
    const cup = mesh(new THREE.LatheGeometry([[0.6, 0], [2.6, 0.6], [3.4, 2.6], [3.7, 5]].map(([x, y]) => new THREE.Vector2(x, y)), 28), gold, 0, 5.4, 0);
    (cup.material as THREE.Material).side = THREE.DoubleSide;
    g.add(mesh(new THREE.BoxGeometry(5, 1.6, 5), std(0x2b2116, 0.7), 0, 0.8, 0), mesh(new THREE.CylinderGeometry(0.6, 1.6, 3.8, 16), gold, 0, 3.5, 0), cup);
    for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(1.5, 0.3, 8, 18, Math.PI), gold, s * 3.6, 8.2, 0); h.rotation.z = (-s * Math.PI) / 2; g.add(h); }
    return { group: g, top: 11.5 };
  },
  ball() {
    const g = new THREE.Group();
    const tiles = new THREE.MeshPhysicalMaterial({ color: 0xcdd8de, roughness: 0.08, metalness: 0.4, clearcoat: 1, flatShading: true });
    g.add(base(2.6), mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 8), std(0x777f84, 0.5, 0.5), 0, 1.6, 0), mesh(new THREE.IcosahedronGeometry(4.3, 2), tiles, 0, 6.6, 0));
    return { group: g, top: 12 };
  },
  sheet() {
    const g = new THREE.Group(), wood = std(0x9a6b3f, 0.8);
    g.add(mesh(new THREE.BoxGeometry(9.4, 9.4, 0.25), std(0xffffff, 1), 0, 6.2, 0));
    for (const x of [-5, 5]) g.add(mesh(new THREE.BoxGeometry(0.6, 11.6, 0.6), wood, x, 5.8, -0.1));
    g.add(mesh(new THREE.BoxGeometry(11, 0.6, 3), wood, 0, 0.3, 0));
    return { group: g, top: 12.5 };
  },
};

export const buildProp = (id: string): BuiltProp => builders[id]();

/** A paper tag naming a prop, stood against the front of the bench. It has no light of its own. */
export function buildTag(text: string): THREE.Mesh {
  const tex = canvasTexture(384, 96, k => {
    k.fillStyle = '#f6ecd2'; k.fillRect(0, 0, 384, 96);
    k.fillStyle = '#2b2116'; k.textAlign = 'center'; k.textBaseline = 'middle';
    let size = 54;
    do { k.font = `800 ${size}px system-ui, "PingFang SC", sans-serif`; size -= 3; } while (k.measureText(text).width > 356 && size > 20);
    k.fillText(text, 192, 50);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 2.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  return m;
}

export type MarkState = 'none' | 'ticked' | 'right' | 'wrong' | 'missed';
/** The director's chalk mark above a prop. It is paint on a card, not a lamp: the game hides it in a blackout. */
export function buildMark() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const k = c.getContext('2d')!, tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false, opacity: 0 }));
  sprite.scale.set(5.6, 5.6, 1);
  sprite.renderOrder = 5;
  let state: MarkState = 'none';
  const paint = (s: MarkState) => {
    state = s;
    k.clearRect(0, 0, 128, 128);
    if (s === 'none') { tex.needsUpdate = true; return; }
    const ink = { ticked: '#fff7e2', right: '#63e08a', wrong: '#5aa8ff', missed: '#ffd76b' }[s];
    k.fillStyle = 'rgba(20,24,28,.78)'; k.beginPath(); k.arc(64, 64, 58, 0, 7); k.fill();
    k.strokeStyle = ink; k.lineWidth = 9; k.lineCap = 'round'; k.lineJoin = 'round';
    if (s === 'missed') k.setLineDash([16, 12]);
    k.beginPath(); k.arc(64, 64, 52, 0, 7); k.stroke();
    k.setLineDash([]);
    k.lineWidth = 15;
    k.beginPath();
    if (s === 'wrong') { k.moveTo(40, 40); k.lineTo(88, 88); k.moveTo(88, 40); k.lineTo(40, 88); }
    else if (s === 'missed') { k.moveTo(64, 34); k.lineTo(64, 72); k.moveTo(64, 92); k.lineTo(64, 93); }
    else { k.moveTo(36, 66); k.lineTo(56, 86); k.lineTo(92, 42); }
    k.stroke();
    tex.needsUpdate = true;
  };
  return { sprite, paint, get state() { return state; } };
}

/** The studio's master switch: a lever on a box. `taped` crosses it out with hazard tape. */
export function buildSwitch() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(9, 12, 4), std(0x8b9aa0, 0.6, 0.3), 0, 6, 0), mesh(new THREE.BoxGeometry(6, 8, 0.6), std(0x2b3236, 0.7), 0, 6.4, 2.1));
  const lever = new THREE.Group();
  lever.add(mesh(new THREE.BoxGeometry(1.2, 5.4, 1.2), std(0xd9d2c2, 0.4, 0.5), 0, 2.7, 0), mesh(new THREE.SphereGeometry(1.5, 16, 12), std(0xe9523f, 0.4), 0, 5.6, 0));
  lever.position.set(0, 5.2, 2.6);
  lever.scale.setScalar(1.5);
  g.add(lever);
  const tapeTex = canvasTexture(256, 32, k => { k.fillStyle = '#f2c230'; k.fillRect(0, 0, 256, 32); k.fillStyle = '#1b1b1b'; for (let i = -1; i < 9; i++) { k.beginPath(); k.moveTo(i * 32, 32); k.lineTo(i * 32 + 16, 32); k.lineTo(i * 32 + 32, 0); k.lineTo(i * 32 + 16, 0); k.fill(); } });
  const tape = new THREE.Group();
  for (const r of [0.6, -0.6]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.7), new THREE.MeshStandardMaterial({ map: tapeTex, roughness: 0.9 })); t.rotation.z = r; t.position.set(0, 6.6, 4.6); tape.add(t); }
  g.add(tape);
  return { group: g, lever, tape };
}
