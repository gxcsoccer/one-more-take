/**
 * "Shadow Monster" — the two-player prototype, on Scene 02's set.
 *
 * Nothing is set up and then watched. One player holds the lamp, the other the duck, and the
 * shadow on the building answers at once. It scares the neighbour in the glowing window; it must
 * not rest on a sleeper or on the cat. In the last wave the lamp is off: the two agree where to
 * stand, call ACTION, and the lamp shows whether they were right.
 */
import * as THREE from 'three';
import { answers, duo as S, HOLD, homeIndex, project, read, SCARE, WAKE, winCentre, type Pair, type Reading, type Wave, type Win } from './game/duo';
import { CAT } from './game/scene02';
import { canvasTexture, Stage } from './game/stage';
import { sfx, unlock } from './game/audio';
import { record } from './evidence';
import { rich, t } from './i18n';
import { nextQuestion } from './game/questions';
import { SCENE_BEATS } from './scenes';
import { loadSave } from './save';
import { $, burst, card, chrome, clamp, closeCard, pressCard, setHTML, tickBurst } from './ui';

type Phase = 'intro' | 'live' | 'cheer' | 'blind' | 'shot' | 'wrap' | 'quiz';
type Hand = 'lamp' | 'duck';

const save = loadSave(SCENE_BEATS);
const W = S.wall;
// Closer and more square-on than Scene 02's wide view: the wall is where everything happens.
const stage = new Stage($('stage'), S, {
  id: '02',
  frame: {
    wide: [[W.x0 - 6, 0, 0], [W.x0 - 6, W.height + 6, -5], [W.x1 + 3, W.height + 6, -5], [W.x1 + 3, 0, 0], [S.lamp.x - 8, 0, S.lamp.max + 9], [S.lamp.x + 8, 0, S.lamp.max + 9], [S.duck.min - 9, 0, S.duck.z + 6], [S.duck.max + 9, 0, S.duck.z + 6]],
    wideLook: [0, 20, 30], dir: [-66, 46, 170], low: -0.9, high: 0.56,
    film: [[W.x0 - 5, -1, 0], [W.x1 + 3, -1, 0], [W.x0 - 5, W.height + 4, 0], [W.x1 + 3, W.height + 4, 0]], look: [2, 25, 0], height: 50,
  },
});
void stage.loadArt(import.meta.env.BASE_URL);
stage.showMark = false;

let phase: Phase = 'intro';
let waveIx = 0, targetIx = 0;
/** Where the players' hands want things, and where the toys have got to. */
const want: Pair = { lampZ: 94, duckX: -24 }, pair: Pair = { ...want };
let scare = 0;
let sleep: { meter: number; calm: number }[] = [];
const catMeter = { meter: 0, calm: 0 };
let now: Reading = { target: 0, sleepers: [], cat: false, clean: false };
let cheerT = 0, shotT = 0, shotJudged = false, shotHit = false;
const stats = { scared: 0, woke: 0, time: 0, shots: 0, right: 0, asked: 0 };
const moved = { lamp: 0, duck: 0 };
let duckSpeed = 0;
let answer = -1;

const wave = (): Wave => S.waves[waveIx];
const target = (): Win => wave().targets[targetIx];
const total = S.waves.reduce((n, w) => n + w.targets.length, 0);

// ---------- things added to the set ----------
/** The glow in the window of the neighbour to scare. */
const glow = new THREE.Group();
{
  const W = S.windows, gold = new THREE.MeshBasicMaterial({ color: 0xffd76b, toneMapped: false });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(W.w, W.h), new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  pane.name = 'pane';
  glow.add(pane);
  for (const [w, h, x, y] of [[W.w + 2.6, 0.5, 0, W.h / 2 + 1.05], [W.w + 2.6, 0.5, 0, -W.h / 2 - 1.05], [0.5, W.h + 2.6, W.w / 2 + 1.05, 0], [0.5, W.h + 2.6, -W.w / 2 - 1.05, 0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), gold);
    bar.position.set(x, y, 0.3);
    glow.add(bar);
  }
  glow.visible = false;
  stage.scene.add(glow);
}
/** The shadow's eye: it is a monster, after all. It sits where the duck's own eye falls on the wall. */
const eye = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false, toneMapped: false, opacity: 0,
  map: canvasTexture(128, 128, k => {
    k.fillStyle = '#fff3c4'; k.beginPath(); k.moveTo(8, 70); k.quadraticCurveTo(64, 4, 120, 56); k.quadraticCurveTo(64, 112, 8, 70); k.fill();
    k.fillStyle = '#1a1206'; k.beginPath(); k.ellipse(70, 62, 13, 24, 0, 0, Math.PI * 2); k.fill();
  }),
}));
eye.renderOrder = 3;
stage.scene.add(eye);
let eyeOpen = 0, blink = 3;

// ---------- things drawn over the picture ----------
const hud = $('hud');
const make = (cls: string, parent: HTMLElement = hud) => { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; };
const bar = make('duo-hud');
const ring = make('duo-ring target', document.body);
const tags: Record<Hand, HTMLElement> = { lamp: make('duo-tag', document.body), duck: make('duo-tag', document.body) };
const actionBtn = document.createElement('button');
actionBtn.className = 'duo-action';
actionBtn.hidden = true;
hud.appendChild(actionBtn);
let sleeperEls: { z: HTMLElement; ring: HTMLElement }[] = [];
const catRing = make('duo-ring sleeper', document.body);

function place(el: HTMLElement, x: number, y: number, z: number, size?: number) {
  const c = stage.toClient(x, y, z);
  if (size !== undefined) el.style.width = el.style.height = `${size}px`;
  el.style.transform = `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)`;
}
/** Height of a window on screen, in pixels. */
const winPx = (w: Win) => { const c = winCentre(w), a = stage.toClient(c.x, c.y - S.windows.h / 2, 0), b = stage.toClient(c.x, c.y + S.windows.h / 2, 0); return Math.hypot(a.x - b.x, a.y - b.y); };

function pop(text: string, x: number, y: number, z: number, cls = '') {
  const el = make(`duo-pop ${cls}`, document.body), c = stage.toClient(x, y, z);
  el.textContent = text;
  el.style.left = `${c.x}px`; el.style.top = `${c.y}px`;
  setTimeout(() => el.remove(), 1300);
}

// ---------- waves ----------
function startWave(ix: number) {
  waveIx = ix;
  targetIx = 0;
  const w = wave();
  S.residents.forEach((_, i) => stage.setHome(i, false));
  w.sleepers.forEach(s => stage.setHome(homeIndex(s), true));
  sleeperEls.forEach(e => { e.z.remove(); e.ring.remove(); });
  sleeperEls = w.sleepers.map(() => ({ z: make('duo-z', document.body), ring: make('duo-ring sleeper', document.body) }));
  sleeperEls.forEach(e => (e.z.textContent = '💤'));
  sleep = w.sleepers.map(() => ({ meter: 0, calm: 0 }));
  Object.assign(catMeter, { meter: 0, calm: 0 });
  stage.catVisible = w.cat;
  stage.drawChalk({ x0: S.wall.x0, y0: 0, cols: 1, rows: 1, cell: 1 }, null, null);
  burst(t(`duo.${w.id}`), t(`duo.${w.id}.sub`), true);
  sfx.clap();
  stage.clap();
  nextTarget();
}

function nextTarget() {
  const w = wave(), tg = target(), c = winCentre(tg);
  stage.setHome(homeIndex(tg), true);
  glow.position.set(c.x, c.y, 0.5);
  glow.visible = true;
  scare = 0;
  phase = w.blind ? 'blind' : 'live';
  stage.lampOn = !w.blind;
  stage.houseLights = w.blind ? 0.5 : 0.16;
  stage.setTake(stats.scared + 1);
}

function scared() {
  const tg = target(), c = winCentre(tg), k = project(pair, { x: 0, y: 8, z: 0 }).scale;
  stats.scared++;
  stage.scare(homeIndex(tg));
  stage.roar();
  sfx.roar(k);
  sfx.eek();
  pop(t('duo.eek'), c.x, c.y + 7, 1);
  glow.visible = false;
  phase = 'cheer';
  cheerT = 0;
  record({ level: S.id, shot: `duo-${wave().id}`, kind: 'take', objectives: wave().blind ? ['L04', 'L05', 'I04'] : ['L03', 'L04'], data: { lampToDuck: Math.round(pair.lampZ - S.duck.z), duckX: Math.round(pair.duckX), storey: tg[1], blind: wave().blind, twoHands: true } });
}

function afterCheer() {
  stage.setHome(homeIndex(target()), false);
  if (++targetIx < wave().targets.length) return nextTarget();
  record({ level: S.id, shot: `duo-${wave().id}`, kind: 'got-shot', objectives: ['L04'], data: { woke: stats.woke, seconds: Math.round(stats.time) } });
  if (waveIx + 1 < S.waves.length) return startWave(waveIx + 1);
  wrap();
}

/** The last wave: the lamp comes on only when the players say they are ready. */
function action() {
  if (phase !== 'blind') return;
  phase = 'shot';
  shotT = 0;
  shotJudged = false;
  stats.shots++;
  hands.clear();
  stage.clap();
  sfx.clap();
  stage.lampOn = true;
  stage.houseLights = 0.2;
}

function runShot(dt: number) {
  shotT += dt;
  if (!shotJudged && shotT > 0.8) {
    shotJudged = true;
    shotHit = now.clean;
    if (shotHit) return scared();
    burst(t('duo.miss'), t(now.target >= SCARE ? 'duo.miss.woke' : pair.lampZ > mid().lampZ + 4 ? 'duo.miss.small' : pair.lampZ < mid().lampZ - 4 ? 'duo.miss.big' : 'duo.miss.side'), false);
    sfx.sulk();
  }
  if (shotJudged && !shotHit && shotT > 3) { phase = 'blind'; stage.lampOn = false; stage.houseLights = 0.5; }
}

/** A place in the middle of everything that works, for the hint after a miss and for tests. */
function mid(w: Wave = wave(), tg: Win = target()): Pair {
  const a = answers(w, tg, 2), has = new Set(a.map(p => `${p.lampZ}:${p.duckX}`));
  // The answer with the most answers around it: the one furthest from any edge.
  const room = (p: Pair) => { let n = 0; for (let dz = -8; dz <= 8; dz += 2) for (let dx = -4; dx <= 4; dx += 2) if (has.has(`${p.lampZ + dz}:${p.duckX + dx}`)) n++; return n; };
  return a.reduce((best, p) => (room(p) > room(best) ? p : best), a[0]);
}

// ---------- every frame ----------
function live(dt: number) {
  const w = wave();
  stats.time += dt;
  // A sleeper stirs while the shadow rests on them, and settles when it moves on.
  const stir = (m: { meter: number; calm: number }, on: boolean, hold: number, woke: () => void) => {
    m.calm = Math.max(0, m.calm - dt);
    if (m.calm > 0) { m.meter = 0; return; }
    m.meter = clamp(m.meter + (on ? dt / hold : -dt / hold * 1.6), 0, 1);
    if (m.meter >= 1) { m.meter = 0; m.calm = 2.4; stats.woke++; scare = 0; sfx.sulk(); woke(); }
  };
  w.sleepers.forEach((s, i) => stir(sleep[i], now.sleepers[i] >= WAKE, HOLD.wake, () => { const c = winCentre(s); stage.scare(homeIndex(s)); pop(t('duo.woke'), c.x, c.y + 7, 1, 'bad'); }));
  if (w.cat) stir(catMeter, now.cat, HOLD.wake * 0.8, () => pop(t('duo.hiss'), CAT.seat.x, CAT.seat.y + 11, CAT.seat.z, 'bad'));
  scare = clamp(scare + (now.clean ? dt / HOLD.scare : -dt / HOLD.scare * 2), 0, 1);
  if (scare >= 1) scared();
}

function caption(): string {
  if (phase === 'blind') return rich('duo.cap.blind');
  if (phase === 'shot' || phase === 'cheer') return '';
  if (phase !== 'live') return '';
  if (now.cat) return rich('duo.warn.cat');
  if (now.sleepers.some(s => s >= WAKE)) return rich('duo.warn.sleeper');
  if (!moved.lamp || !moved.duck) return rich('duo.cap.start');
  return rich(`duo.cap.${wave().id}`);
}

const keys = new Set<string>();
let last = performance.now();
function frame(time: number) {
  const dt = Math.min(0.05, (time - last) / 1000);
  last = time;

  // Keys: W/S or up/down for the lamp, left/right or A/D for the duck.
  if (phase === 'live' || phase === 'blind') {
    const lamp = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    const duck = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    if (lamp) { want.lampZ = clamp(want.lampZ + lamp * 34 * dt, S.lamp.min, S.lamp.max); moved.lamp += dt * 34; }
    if (duck) { want.duckX = clamp(want.duckX + duck * 20 * dt, S.duck.min, S.duck.max); moved.duck += dt * 20; }
  }
  // The toys follow the hands closely, with just enough weight to feel like toys.
  const f = 1 - Math.exp(-dt * 22), before = pair.duckX;
  pair.lampZ += (want.lampZ - pair.lampZ) * f;
  pair.duckX += (want.duckX - pair.duckX) * f;
  duckSpeed += (Math.abs(pair.duckX - before) / Math.max(dt, 1e-3) - duckSpeed) * Math.min(1, dt * 12);
  stage.lampZ = pair.lampZ;
  stage.duckX = stage.markX = pair.duckX;
  stage.walking = duckSpeed > 1.5;

  const playing = phase === 'live' || phase === 'blind' || phase === 'shot' || phase === 'cheer';
  if (playing) now = read(pair, wave(), target());
  if (phase === 'live') live(dt);
  if (phase === 'blind') stats.time += dt;
  if (phase === 'shot') runShot(dt);
  if (phase === 'cheer' && (cheerT += dt) > 1.15) afterCheer();
  stage.catSulking = playing && stage.lampOn && now.cat;
  stage.movable = { lamp: playing && phase !== 'shot' && moved.lamp < 3, mark: playing && phase !== 'shot' && moved.duck < 3 };
  stage.clapperReady = phase === 'blind';

  // The monster's eye, on the shadow of the duck's head.
  const e = project(pair, { x: 5.3, y: 13.2, z: 0 }), lit = stage.lampOn && playing ? 1 : 0;
  blink -= dt;
  if (blink < -0.12) blink = 2 + Math.random() * 3;
  eyeOpen += ((blink < 0 ? 0.1 : 1) - eyeOpen) * Math.min(1, dt * 30);
  eye.position.set(e.x, e.y, 0.62);
  eye.scale.set(e.scale * (1.5 + scare * 0.6), e.scale * (1.5 + scare * 0.6) * eyeOpen, 1);
  const em = eye.material as THREE.MeshBasicMaterial;
  em.opacity += (lit * (e.x > S.wall.x0 && e.x < S.wall.x1 && e.y < S.wall.height ? 0.92 : 0) - em.opacity) * Math.min(1, dt * 8);
  em.color.setRGB(1, 1 - scare * 0.45, 1 - scare * 0.7);

  // Glow, rings and tags.
  const pulse = 0.5 + 0.5 * Math.sin(time / 160);
  (glow.getObjectByName('pane') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.3 + 0.3 * pulse;
  glow.scale.setScalar(1 + 0.04 * pulse);
  const showMarks = phase === 'live' || phase === 'blind' || phase === 'shot';
  ring.hidden = !showMarks;
  if (showMarks) {
    const c = winCentre(target());
    place(ring, c.x, c.y, 0.5, winPx(target()) * 2.1);
    ring.style.setProperty('--p', String(scare));
    ring.classList.toggle('held', now.target >= SCARE && !now.clean && stage.lampOn);
  }
  wave().sleepers.forEach((s, i) => {
    const c = winCentre(s), el = sleeperEls[i], px = winPx(s);
    if (!el) return;
    el.z.hidden = el.ring.hidden = !playing;
    place(el.z, c.x + 2.5, c.y + 6.5, 1);
    el.z.style.fontSize = `${px * 0.62}px`;
    el.z.classList.toggle('stir', sleep[i].meter > 0.05);
    place(el.ring, c.x, c.y, 0.5, px * 2.1);
    el.ring.style.setProperty('--p', String(sleep[i].meter));
    el.ring.style.opacity = sleep[i].meter > 0.02 ? '1' : '0';
  });
  catRing.hidden = !(playing && wave().cat);
  if (!catRing.hidden) {
    place(catRing, CAT.seat.x, CAT.seat.y + 4.2, CAT.seat.z, winPx(target()) * 2.3);
    catRing.style.setProperty('--p', String(catMeter.meter));
    catRing.style.opacity = catMeter.meter > 0.02 ? '1' : '0';
  }
  for (const h of ['lamp', 'duck'] as Hand[]) {
    const show = playing && moved[h] < 3;
    tags[h].hidden = !show;
    if (show) h === 'lamp' ? place(tags.lamp, S.lamp.x, 17, pair.lampZ + 3) : place(tags.duck, pair.duckX, 25, S.duck.z);
  }
  actionBtn.hidden = phase !== 'blind';
  bar.hidden = !playing;
  if (playing) setHTML(bar, `<span class="pips">${S.waves.map((_, i) => `<i class="${i < waveIx ? 'done' : i === waveIx ? 'on' : ''}"></i>`).join('')}</span><span>😱 ${stats.scared}/${total}</span><span>💤 ${stats.woke}</span><span>⏱ ${Math.floor(stats.time / 60)}:${String(Math.floor(stats.time % 60)).padStart(2, '0')}</span>`);

  tickBurst(dt);
  setHTML($('caption'), caption());
  stage.update(dt);
  requestAnimationFrame(frame);
}

// ---------- input: two hands at once ----------
const canvas = stage.renderer.domElement;
const hands = new Map<number, { what: Hand; offset: number }>();
const grip = (h: Hand) => (h === 'lamp' ? stage.toClient(S.lamp.x, 5, pair.lampZ + 3) : stage.toClient(pair.duckX, 7, S.duck.z));
window.addEventListener('pointerdown', unlock, { capture: true });
canvas.addEventListener('pointerdown', e => {
  $('pop').hidden = true;
  if (phase !== 'live' && phase !== 'blind') return;
  if (phase === 'blind' && stage.pick(e.clientX, e.clientY) === 'clapper') return action();
  // A finger takes whichever toy is nearer and not already in the other hand.
  const held = new Set([...hands.values()].map(h => h.what));
  const free = (['lamp', 'duck'] as Hand[]).filter(h => !held.has(h)).sort((a, b) => Math.hypot(grip(a).x - e.clientX, grip(a).y - e.clientY) - Math.hypot(grip(b).x - e.clientX, grip(b).y - e.clientY));
  const p = stage.tablePoint(e.clientX, e.clientY);
  if (!free.length || !p) return;
  canvas.setPointerCapture(e.pointerId);
  hands.set(e.pointerId, { what: free[0], offset: free[0] === 'lamp' ? want.lampZ - p.z : want.duckX - p.x });
  sfx.tick();
});
canvas.addEventListener('pointermove', e => {
  const h = hands.get(e.pointerId);
  if (!h || (phase !== 'live' && phase !== 'blind')) return;
  const p = stage.tablePoint(e.clientX, e.clientY);
  if (!p) return;
  if (h.what === 'lamp') { const z = clamp(p.z + h.offset, S.lamp.min, S.lamp.max); moved.lamp += Math.abs(z - want.lampZ); want.lampZ = z; }
  else { const x = clamp(p.x + h.offset, S.duck.min, S.duck.max); moved.duck += Math.abs(x - want.duckX); want.duckX = x; }
});
for (const type of ['pointerup', 'pointercancel'] as const) canvas.addEventListener(type, e => hands.delete(e.pointerId));
window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Enter') { if (phase === 'blind') { e.preventDefault(); action(); } return; }
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
actionBtn.onclick = action;

// ---------- cards ----------
function intro() {
  phase = 'intro';
  const el = card(`<h1>${t('duo.h')}</h1><p>${rich('duo.p')}</p><div class="duo-roles"><div><b>🔦</b>${t('duo.role.lamp')}</div><div><b>🦆</b>${t('duo.role.duck')}</div></div><button class="big" id="go">${t('go')}</button>`);
  el.querySelector<HTMLElement>('#go')!.onclick = () => { closeCard(); begin(); };
}

function begin() {
  Object.assign(stats, { scared: 0, woke: 0, time: 0, shots: 0, right: 0, asked: 0 });
  Object.assign(want, { lampZ: 94, duckX: -24 });
  moved.lamp = moved.duck = 0;
  startWave(0);
}

function wrap() {
  phase = 'wrap';
  stage.lampOn = false;
  stage.houseLights = 1;
  stage.catVisible = false;
  glow.visible = false;
  stage.celebrate();
  sfx.win();
  const stars = stats.woke === 0 ? 3 : stats.woke <= 3 ? 2 : 1, blind = S.waves[S.waves.length - 1].targets.length;
  const el = card(`<h1>${t('wrap.h')} ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</h1><p>${rich('duo.wrap.p')}</p><table>
    <tr><td>${t('duo.wrap.scared')}</td><td>${stats.scared}</td></tr>
    <tr><td>${t('duo.wrap.woke')}</td><td>${stats.woke}</td></tr>
    <tr><td>${t('duo.wrap.blind')}</td><td>${blind} / ${stats.shots}</td></tr>
    <tr><td>${t('duo.wrap.time')}</td><td>${Math.floor(stats.time / 60)}:${String(Math.floor(stats.time % 60)).padStart(2, '0')}</td></tr>
    ${stats.asked ? `<tr><td>${t('duo.wrap.press')}</td><td>${stats.right} / ${stats.asked}</td></tr>` : ''}
  </table>${stats.asked ? '' : `<button class="big" id="press">${t('duo.wrap.ask')}</button>`}<button class="big ghost" id="again">${t('duo.again')}</button>`);
  el.querySelector<HTMLElement>('#again')!.onclick = () => { closeCard(); begin(); };
  const press = el.querySelector<HTMLElement>('#press');
  if (press) press.onclick = () => ask(0);
}

/** The questions come after the playing, all together, as reporters at the premiere. */
function ask(n: number) {
  phase = 'quiz';
  const q = nextQuestion((['play', 'dark', 'cat'] as const)[n]);
  answer = pressCard(q, {
    answered: (right, chose) => { stats.asked++; if (right) stats.right++; record({ level: S.id, shot: 'duo-press', kind: 'quiz', objectives: q.objectives, data: { question: q.id, right, chose } }); },
    next: () => (n < 2 ? ask(n + 1) : wrap()),
  });
}

// Hooks for the automated playthrough; harmless in play.
Object.assign(window, {
  __omt: {
    get phase() { return phase; },
    get wave() { return wave().id; },
    get target() { const g = target(); return g ? [...g] : null; },
    get pair() { return { ...pair }; },
    get reading() { return now; },
    get scare() { return scare; },
    get stats() { return { ...stats }; },
    get answer() { return mid(); },
    /** Where the shadow lies full on the wave's first sleeper. */
    get wakeSpot() { const w = wave(); return w.sleepers.length ? mid({ ...w, sleepers: [], cat: false }, w.sleepers[0]) : null; },
    get quizAnswer() { return answer; },
    get fitted() { return stage.fitted; },
    get art() { return { ready: stage.artReady, loaded: [...stage.artLoaded] }; },
    get handles() { return { lamp: grip('lamp'), duck: grip('duck') }; },
    /** Where the stage has put the neighbour for the window being aimed at, to check it against the window. */
    get targetHome() { const g = target(); return g ? { spot: stage.residentSpots[homeIndex(g)], window: winCentre(g) } : null; },
    lampAt: (z: number) => stage.toClient(S.lamp.x, 5, z + 3),
    duckAt: (x: number) => stage.toClient(x, 7, S.duck.z),
  },
});

actionBtn.textContent = t('duo.action');
tags.lamp.textContent = t('duo.tag.lamp');
tags.duck.textContent = t('duo.tag.duck');
document.body.classList.add('duo');
chrome(save, 'duo.scene', () => {
  actionBtn.textContent = t('duo.action');
  tags.lamp.textContent = t('duo.tag.lamp');
  tags.duck.textContent = t('duo.tag.duck');
  if (phase === 'intro') intro();
  if (phase === 'wrap') wrap();
});
intro();
requestAnimationFrame(frame);
