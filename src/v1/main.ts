/**
 * Scene 02 flow: storyboard (predict) → rehearse → ACTION → screening →
 * compare, once per shot. The DOM carries all words and buttons; the Pixi
 * stage carries the set.
 */
import './style.css';
import { Application } from 'pixi.js';
import { DUCK_FRONT, DUCK_SIDE } from './sim/shapes';
import { isShot, level02 as L, type Shot } from './game/level02';
import { Scene, STAGE_H, STAGE_W, toScreen, type ArtMap, type CutoutArt } from './game/scene';
import { CARD_PX_H, CARD_PX_W, fromDrawing, fromImage, fromShape } from './game/cutouts';
import { setSound, sfx, soundOn, unlock } from './game/audio';
import { record } from './evidence';
import { lang, rich, setLang, t, terms } from './i18n';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const round = (v: number) => Math.round(v);

type Phase = 'intro' | 'predict' | 'rehearse' | 'record' | 'play';
interface Frame { t: number; lampD: number; duckX: number }
interface Take {
  id: number;
  shot: string;
  cutout: CutoutArt;
  frames: Frame[];
  duration: number;
  win: boolean;
  final: { lampD: number; duckX: number };
  gap: number;
  top: number;
  thumb: string;
}

// ---------- boot ----------
const frame = $('frame');
let scale = 1;
function fit() {
  scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  frame.style.transform = `translate(${(window.innerWidth - STAGE_W * scale) / 2}px, ${(window.innerHeight - STAGE_H * scale) / 2}px) scale(${scale})`;
}
fit();
window.addEventListener('resize', fit);

async function loadArt(): Promise<ArtMap> {
  const out: ArtMap = {};
  try {
    const base = import.meta.env.BASE_URL;
    const manifest = (await (await fetch(`${base}assets/manifest.json`)).json()) as { slots?: Record<string, string> };
    await Promise.all(Object.entries(manifest.slots ?? {}).map(([slot, file]) => new Promise<void>(done => {
      const img = new Image();
      img.onload = () => { out[slot] = img; done(); };
      img.onerror = () => done();
      img.src = `${base}assets/${file}`;
    })));
  } catch {
    /* no art delivered yet: placeholders everywhere */
  }
  return out;
}

const app = new Application();
await app.init({ width: STAGE_W, height: STAGE_H, background: '#0b1418', antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
$('stage').appendChild(app.canvas);
const art = await loadArt();
const builtIn: Record<'side' | 'front', CutoutArt> = {
  side: art['duck-side'] ? fromImage('duck-side', art['duck-side']) : fromShape(DUCK_SIDE),
  front: art['duck-front'] ? fromImage('duck-front', art['duck-front']) : fromShape(DUCK_FRONT),
};
const scene = new Scene(app, L, builtIn.side, art);

// ---------- state ----------
let phase: Phase = 'intro';
let shotIx = 0;
let free = false;
let pick: 'side' | 'front' | 'draw' = 'side';
let drawn: CutoutArt | null = null;
const takes: Take[] = [];
const stamps = { shot: false, board: false, fair: false };
let pred: { vary: 'lamp' | 'duck'; target: number; from: number; fromMeasure: number; actual: number | null; prev: number } | null = null;
let rec: { start: number; frames: Frame[]; win: boolean; last: number } | null = null;
let play: { take: Take; t: number; judge: boolean; roared: boolean; revealed: boolean; live: { lampD: number; duckX: number; cutout: CutoutArt } } | null = null;
let toastTimer = 0;
let clock = 0;
const shot = (): Shot => L.shots[shotIx];
const shotName = () => (free ? 'F' : shot().id);

// ---------- words ----------
function setHTML(el: HTMLElement, html: string) {
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
}
function renderStatic() {
  $('slate-title').textContent = t('title');
  $('slate-scene').innerHTML = t('scene').replace(' · ', '<br>');
  $('btn-lang').textContent = lang === 'en' ? '中文' : 'English';
  $('btn-sound').textContent = `${t('sound')} ${soundOn ? '🔊' : '🔇'}`;
  $('btn-sound').setAttribute('aria-pressed', String(soundOn));
  $('nb-title').textContent = t('notebook');
  $('th-take').textContent = t('col.take');
  $('th-gap').innerHTML = `${t('col.gap')}<br>(cm)`;
  $('th-top').innerHTML = `${t('col.top')}<br>(cm)`;
  $('nb-empty').textContent = t('empty');
  $('cutouts-label').textContent = t('cutout');
  $('btn-rays').textContent = t('rays');
  $('btn-compare').textContent = t('compare');
  $('btn-replay').textContent = t('replay');
  $('btn-next').textContent = `${t('next')} ▶`;
  $('btn-lock').textContent = t('lock');
  document.querySelectorAll<HTMLElement>('.pick').forEach(b => {
    const label = b.querySelector('span') ?? b.appendChild(document.createElement('span'));
    label.textContent = t(b.dataset.cutout!);
  });
  renderStamps($('stamps'));
  renderNotebook();
  $('cine-left').textContent = t('title').toUpperCase();
}
const STAMPS: [keyof typeof stamps, string, string][] = [['shot', '🎬', 's.shot'], ['board', '✏️', 's.board'], ['fair', '⚖️', 's.fair']];
function renderStamps(el: HTMLElement) {
  el.innerHTML = STAMPS.map(([k, icon, key]) => `<div class="stamp${stamps[k] ? ' on' : ''}"><b>${icon}</b>${t(key)}</div>`).join('');
}
function renderNotebook() {
  $('nb-empty').hidden = takes.length > 0;
  $('nb-rows').innerHTML = takes.slice(-9).map(k => `<tr class="${k.win ? 'keeper' : ''}"><td>${k.id}${k.win ? ' ★' : ''}</td><td>${round(k.gap)}</td><td>${round(k.top)}</td></tr>`).join('');
  $<HTMLButtonElement>('btn-compare').disabled = takes.length < 2;
  $<HTMLButtonElement>('btn-replay').disabled = takes.length < 1;
}
function toast(html: string, seconds = 6) {
  const el = $('toast');
  el.innerHTML = html;
  el.hidden = false;
  toastTimer = seconds;
}

function missionHTML(): string {
  const s = scene.state, sh = shot();
  if (phase === 'predict') return rich(sh.id === 'A' ? 'a.predict' : 'b.predict');
  if (phase === 'record') return rich('rolling');
  if (phase !== 'rehearse') return '';
  const all = s.covered.every(Boolean);
  if (!sh.cat) return rich(all ? 'a.ready' : 'a.do');
  if (s.catBlocked) return rich('b.sulk');
  if (all && s.catNear) return rich('b.ready');
  if (s.catNear) return rich('b.windows');
  if (all) return rich('b.cat');
  return rich('b.do');
}

// ---------- shots ----------
function applyLocks() {
  const m = shot().movable, waiting = pred != null && pred.actual == null;
  if (phase === 'predict' || phase === 'intro' || phase === 'play') scene.locks = { lamp: true, duck: true };
  // Until the storyboard has been checked, only the prop it is about may move.
  else if (waiting) scene.locks = { lamp: pred!.vary !== 'lamp', duck: pred!.vary !== 'duck' };
  else scene.locks = { lamp: !m.includes('lamp'), duck: !m.includes('duck') };
  $('cutouts').hidden = !(m.includes('cutout') && phase !== 'predict' && !waiting);
}

function startShot(ix: number) {
  shotIx = ix;
  const sh = shot(), p = sh.prediction;
  scene.catOn = sh.cat;
  scene.set(scene.lampD, scene.duckX);
  const s = scene.state;
  const target = p.vary === 'lamp' ? p.to! : scene.duckX + p.by!;
  const from = p.vary === 'lamp' ? scene.lampD : scene.duckX;
  const fromMeasure = p.measure === 'top' ? s.top : s.tipX;
  pred = { vary: p.vary, target, from, fromMeasure, actual: null, prev: from };
  scene.ghost = { kind: p.vary, value: target };
  scene.marker = { axis: p.measure === 'top' ? 'y' : 'x', value: fromMeasure, locked: false, actual: null };
  phase = 'predict';
  $('btn-lock').hidden = false;
  $('btn-action').hidden = true;
  $('btn-next').hidden = true;
  applyLocks();
}

function lockStoryboard() {
  if (!pred || !scene.marker) return;
  scene.marker.locked = true;
  phase = 'rehearse';
  $('btn-lock').hidden = true;
  $('btn-action').hidden = false;
  sfx.chalk();
  record({ level: L.id, shot: shotName(), kind: 'predicted', objectives: ['L05', 'I04'], data: { vary: pred.vary, predicted: round(scene.marker.value), startedAt: round(pred.fromMeasure) } });
  applyLocks();
}

function checkStoryboard() {
  if (!pred || pred.actual != null || !scene.marker?.locked) return;
  const v = pred.vary === 'lamp' ? scene.lampD : scene.duckX;
  const crossed = (pred.prev - pred.target) * (v - pred.target) <= 0;
  pred.prev = v;
  if (!crossed) return;
  // Measure at the exact ghost position, so a fast swipe gives the same answer as a slow one.
  const at = pred.vary === 'lamp' ? scene.stateAt(pred.target, scene.duckX) : scene.stateAt(scene.lampD, pred.target);
  const mine = scene.marker.value;
  let close: boolean;
  if (pred.vary === 'lamp') {
    pred.actual = at.top;
    close = Math.abs(mine - at.top) <= 3;
    toast(`${rich('pa.result', { p: round(mine), a: round(at.top) })} ${rich(close ? 'p.close' : 'pa.far')}`, 8);
  } else {
    pred.actual = at.tipX;
    close = Math.abs(mine - at.tipX) <= 3;
    toast(`${rich('pb.result', { a: round(Math.abs(at.tipX - pred.fromMeasure)) })} ${rich(close ? 'p.close' : 'pb.far')}`, 8);
  }
  scene.marker.actual = pred.actual;
  scene.ghost = null;
  stamps.board = true;
  renderStamps($('stamps'));
  sfx.tick();
  record({ level: L.id, shot: shotName(), kind: 'observed', objectives: shot().objectives, data: { vary: pred.vary, predicted: round(mine), actual: round(pred.actual), close } });
  applyLocks();
}

// ---------- takes ----------
function startRecording() {
  rec = { start: clock, frames: [{ t: 0, lampD: scene.lampD, duckX: scene.duckX }], win: false, last: 0 };
  phase = 'record';
  sfx.clap();
  $('toast').hidden = true;
}

function stopRecording() {
  if (!rec) return;
  const duration = Math.min(clock - rec.start, L.takeSeconds);
  rec.frames.push({ t: duration, lampD: scene.lampD, duckX: scene.duckX });
  const s = scene.state;
  const take: Take = {
    id: takes.length + 1, shot: shotName(), cutout: scene.cutout, frames: rec.frames, duration,
    win: rec.win || isShot(shot(), s), final: { lampD: scene.lampD, duckX: scene.duckX }, gap: s.gap, top: s.top, thumb: scene.snapshot(),
  };
  if (takes.some(k => k.shot === take.shot)) record({ level: L.id, shot: take.shot, kind: 'retake', objectives: ['V01'], data: { take: take.id } });
  takes.push(take);
  rec = null;
  sfx.clap();
  renderNotebook();
  screen(take, true);
}

function sample(frames: Frame[], time: number): Frame {
  let k = 1;
  while (k < frames.length && frames[k].t < time) k++;
  if (k >= frames.length) return frames[frames.length - 1];
  const a = frames[k - 1], b = frames[k], u = Math.max(0, Math.min(1, (time - a.t) / (b.t - a.t || 1)));
  return { t: time, lampD: a.lampD + (b.lampD - a.lampD) * u, duckX: a.duckX + (b.duckX - a.duckX) * u };
}

const LEAD = 0.7, HOLD = 0.8, REVEAL = 1.8;
function screen(take: Take, judge: boolean) {
  play = { take, t: 0, judge, roared: false, revealed: false, live: { lampD: scene.lampD, duckX: scene.duckX, cutout: scene.cutout } };
  phase = 'play';
  document.body.classList.add('cinema');
  $('cine').hidden = false;
  $('cine-right').textContent = t('screening', { n: take.id });
  scene.cinema = true;
  scene.reveal = 0;
  if (scene.cutout !== take.cutout) scene.setCutout(take.cutout);
  scene.set(take.frames[0].lampD, take.frames[0].duckX);
  applyLocks();
}

function endScreening() {
  if (!play) return;
  const { take, judge, live } = play;
  play = null;
  scene.cinema = false;
  scene.reveal = 1;
  document.body.classList.remove('cinema');
  $('cine').hidden = true;
  if (scene.cutout !== live.cutout) scene.setCutout(live.cutout);
  scene.set(live.lampD, live.duckX);
  phase = 'rehearse';
  applyLocks();
  if (!judge) return;
  toast(rich(take.win ? 'keeper' : 'blooper', { n: take.id }));
  if (!take.win) return;
  sfx.win();
  record({ level: L.id, shot: take.shot, kind: 'got-shot', objectives: shot().objectives, data: { take: take.id, gap: round(take.gap), top: round(take.top), cutout: take.cutout.id } });
  if (free) return;
  if (shotIx === 0) $('btn-next').hidden = false;
  else {
    stamps.shot = true;
    renderStamps($('stamps'));
    free = true;
    wrapCard();
  }
}

// ---------- cards ----------
function card(html: string, wide = false) {
  const m = $('modal');
  m.innerHTML = `<div class="sheet${wide ? ' wide' : ''}">${html}</div>`;
  m.hidden = false;
  return m.firstElementChild as HTMLElement;
}
const closeCard = () => ($('modal').hidden = true);

function introCard() {
  const el = card(`<h1>${t('intro.h')}</h1><p>${rich('intro.p')}</p><button class="big" id="go">${t('intro.go')}</button>`);
  el.querySelector<HTMLElement>('#go')!.onclick = () => { closeCard(); startShot(0); };
}
function shotBCard() {
  const el = card(`<h1>${t('b.h')}</h1><p>${rich('b.p')}</p><button class="big" id="go">${t('b.go')}</button>`);
  el.querySelector<HTMLElement>('#go')!.onclick = () => { closeCard(); startShot(1); };
}
function wrapCard() {
  const el = card(`<h1>${t('wrap.h')}</h1><p>${rich('wrap.p')}</p><div id="stamps-big"></div><button class="big" id="go">${t('wrap.go')}</button>`);
  renderStamps(el.querySelector<HTMLElement>('#stamps-big')!);
  el.querySelector<HTMLElement>('#go')!.onclick = closeCard;
}

function compareCard() {
  let chosen = takes.slice(-2).map(k => k.id);
  const el = card(`<h1>${t('cmp.h')}</h1><div class="strip"></div><div class="pair"></div><div id="verdict"></div><button class="big ghost" id="x">${t('close')}</button>`, true);
  const strip = el.querySelector<HTMLElement>('.strip')!, pair = el.querySelector<HTMLElement>('.pair')!, verdict = el.querySelector<HTMLElement>('#verdict')!;
  let logged = '';
  const draw = () => {
    strip.innerHTML = takes.map(k => `<button data-id="${k.id}" aria-pressed="${chosen.includes(k.id)}"><img src="${k.thumb}" alt="">${t('col.take')} ${k.id}${k.win ? ' ★' : ''}</button>`).join('');
    const [a, b] = chosen.map(id => takes.find(k => k.id === id)!);
    if (!a || !b) { pair.innerHTML = ''; verdict.textContent = t('cmp.pick'); return; }
    const diff = { lamp: Math.abs(a.final.lampD - b.final.lampD) > 1, duck: Math.abs(a.final.duckX - b.final.duckX) > 0.4, cutout: a.cutout.id !== b.cutout.id };
    const changed = (Object.keys(diff) as (keyof typeof diff)[]).filter(k => diff[k]);
    const cap = (k: Take) => `${t('col.take')} ${k.id}<br><span class="${diff.lamp ? 'diff' : ''}">${t('col.gap')}: ${round(k.gap)} ${t('cm')}</span> · ${t('col.top')}: ${round(k.top)} ${t('cm')}`;
    pair.innerHTML = [a, b].map(k => `<figure><img src="${k.thumb}" alt=""><figcaption>${cap(k)}</figcaption></figure>`).join('');
    verdict.innerHTML = changed.length === 1 ? rich('cmp.fair', { v: t(`v.${changed[0]}`) }) : changed.length === 0 ? rich('cmp.same') : rich('cmp.unfair', { n: changed.length });
    const key = `${a.id}-${b.id}`;
    if (changed.length && logged !== key) {
      logged = key;
      const fair = changed.length === 1;
      record({ level: L.id, shot: shotName(), kind: fair ? 'fair-pair' : 'unfair-pair', objectives: ['I01'], data: { a: a.id, b: b.id, changed: changed.join('+') } });
      if (fair && !stamps.fair) { stamps.fair = true; renderStamps($('stamps')); sfx.win(); }
    }
  };
  strip.onclick = e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    const id = Number(b.dataset.id);
    chosen = chosen.includes(id) ? chosen.filter(x => x !== id) : [...chosen, id].slice(-2);
    draw();
  };
  el.querySelector<HTMLElement>('#x')!.onclick = closeCard;
  draw();
}

function drawCard() {
  const el = card(`<h1>${t('draw.h')}</h1><p id="draw-p">${t('draw.p')}</p><canvas id="pad" width="${CARD_PX_W * 2}" height="${CARD_PX_H * 2}"></canvas><div class="row"><button class="big ghost" id="clr">${t('clear')}</button><button class="big ghost" id="x">${t('close')}</button><button class="big" id="ok">${t('use')}</button></div>`);
  const pad = el.querySelector<HTMLCanvasElement>('#pad')!, k = pad.getContext('2d')!;
  k.lineWidth = 34; k.lineCap = k.lineJoin = 'round'; k.strokeStyle = k.fillStyle = '#6b4a2f';
  if (drawn) k.drawImage(drawn.canvas, 0, 0, pad.width, pad.height);
  let last: { x: number; y: number } | null = null;
  const at = (e: PointerEvent) => { const r = pad.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * pad.width, y: ((e.clientY - r.top) / r.height) * pad.height }; };
  pad.onpointerdown = e => { pad.setPointerCapture(e.pointerId); last = at(e); k.beginPath(); k.arc(last.x, last.y, 17, 0, Math.PI * 2); k.fill(); };
  pad.onpointermove = e => { if (!last) return; const p = at(e); k.beginPath(); k.moveTo(last.x, last.y); k.lineTo(p.x, p.y); k.stroke(); last = p; };
  pad.onpointerup = pad.onpointercancel = () => (last = null);
  el.querySelector<HTMLElement>('#clr')!.onclick = () => k.clearRect(0, 0, pad.width, pad.height);
  el.querySelector<HTMLElement>('#x')!.onclick = closeCard;
  el.querySelector<HTMLElement>('#ok')!.onclick = () => {
    const made = fromDrawing(pad);
    if (!made) { el.querySelector('#draw-p')!.textContent = t('draw.small'); return; }
    drawn = made;
    pick = 'draw';
    scene.setCutout(made);
    renderPicks();
    record({ level: L.id, shot: shotName(), kind: 'own-cutout', objectives: ['L03'], data: { cutout: made.id } });
    closeCard();
  };
}

function renderPicks() {
  document.querySelectorAll<HTMLButtonElement>('.pick').forEach(b => {
    const id = b.dataset.cutout as typeof pick;
    b.setAttribute('aria-pressed', String(id === pick));
    const c = b.querySelector('canvas') ?? b.insertBefore(document.createElement('canvas'), b.firstChild);
    c.width = 124; c.height = 100;
    const k = c.getContext('2d')!, src = id === 'draw' ? drawn?.canvas : builtIn[id].canvas;
    k.clearRect(0, 0, 124, 100);
    if (src) k.drawImage(src, 0, 0, 124, 100);
    else { k.font = '700 64px system-ui'; k.textAlign = 'center'; k.fillStyle = '#f6c46b'; k.fillText('+', 62, 74); }
  });
}

// ---------- input ----------
window.addEventListener('pointerdown', unlock, { capture: true });
$('btn-lang').onclick = () => { setLang(lang === 'en' ? 'zh' : 'en'); renderStatic(); renderPicks(); };
$('btn-sound').onclick = () => { setSound(!soundOn); renderStatic(); sfx.tick(); };
$('btn-lock').onclick = lockStoryboard;
$('btn-action').onclick = () => (phase === 'record' ? stopRecording() : phase === 'rehearse' && startRecording());
$('btn-next').onclick = () => { $('btn-next').hidden = true; shotBCard(); };
$('btn-replay').onclick = () => { if (phase === 'rehearse' && takes.length) screen(takes[takes.length - 1], false); };
$('btn-compare').onclick = () => phase === 'rehearse' && compareCard();
$('btn-rays').onclick = () => { scene.showRays = !scene.showRays; $('btn-rays').setAttribute('aria-pressed', String(scene.showRays)); };
document.querySelectorAll<HTMLButtonElement>('.pick').forEach(b => (b.onclick = () => {
  const id = b.dataset.cutout as typeof pick;
  if (id === 'draw') return drawCard();
  pick = id;
  scene.setCutout(builtIn[id]);
  renderPicks();
}));
scene.onGrab = what => {
  $('pop').hidden = true;
  if (what === 'lamp' && scene.locks.lamp && phase === 'rehearse') toast(t('locked.lamp'), 2.5);
  if (what === 'duck' && scene.locks.duck && phase === 'rehearse') toast(t('locked.duck'), 2.5);
  if (what === 'duck' && !scene.locks.duck) sfx.squeak();
};
scene.onEvent = what => (what === 'window' ? sfx.eek() : what === 'paw' ? sfx.paw() : sfx.sulk());

document.addEventListener('click', e => {
  const pop = $('pop'), el = (e.target as HTMLElement).closest<HTMLElement>('.term');
  if (!el) { if (!(e.target as HTMLElement).closest('#pop')) pop.hidden = true; return; }
  const term = terms[el.dataset.term!];
  pop.innerHTML = `<b>${term.en}</b> · ${term.zh}<button class="say">🔊</button><br>${lang === 'en' ? term.defEn : term.defZh}`;
  pop.hidden = false;
  const r = el.getBoundingClientRect(), f = frame.getBoundingClientRect();
  const x = (r.left - f.left) / scale, y = (r.bottom - f.top) / scale;
  pop.style.left = `${Math.max(16, Math.min(STAGE_W - 376, x - 40))}px`;
  pop.style.top = y > 700 ? `${(r.top - f.top) / scale - 150}px` : `${y + 12}px`;
  pop.querySelector<HTMLElement>('.say')!.onclick = () => {
    try {
      const u = new SpeechSynthesisUtterance(term.en);
      u.lang = 'en-GB';
      speechSynthesis.speak(u);
    } catch { /* no speech on this device */ }
  };
});

// ---------- loop ----------
app.ticker.add(tk => {
  const dt = Math.min(tk.deltaMS / 1000, 0.05);
  clock += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').hidden = true;

  if (phase === 'rehearse' || phase === 'record') checkStoryboard();

  if (rec) {
    const el = clock - rec.start;
    if (el - rec.last >= 0.033) { rec.frames.push({ t: el, lampD: scene.lampD, duckX: scene.duckX }); rec.last = el; }
    rec.win ||= isShot(shot(), scene.state);
    if (el >= L.takeSeconds) stopRecording();
  }

  if (play) {
    play.t += dt;
    const { take } = play, f = sample(take.frames, Math.max(0, play.t - LEAD));
    scene.set(f.lampD, f.duckX);
    if (!play.roared && play.t > LEAD) { play.roared = true; sfx.roar(scene.state.m); }
    if (!play.revealed && play.t > LEAD + take.duration + HOLD) { play.revealed = true; scene.reveal = 1; sfx.squeak(); }
    if (play.t > LEAD + take.duration + HOLD + REVEAL) endScreening();
  }

  const m = scene.marker;
  if (m) {
    const y = m.axis === 'y';
    scene.setMarkerText(y ? t('mine', { p: round(m.value) }) : t('mineB'), m.actual == null ? '' : y ? t('real', { a: round(m.actual) }) : t('realB'));
  }
  scene.tick(dt);

  setHTML($('mission'), `<div>${missionHTML()}</div>`);
  const action = $('btn-action');
  action.textContent = phase === 'record' ? `■ ${t('cut')}  ${Math.max(0, L.takeSeconds - (clock - (rec?.start ?? clock))).toFixed(1)}` : `● ${t('action')}`;
  action.classList.toggle('rolling', phase === 'record');
  action.classList.toggle('ready', phase === 'rehearse' && isShot(shot(), scene.state));
});

// Hooks for the automated smoke test; harmless in play.
Object.assign(window, {
  __omt: {
    get phase() { return phase; },
    get shot() { return shotName(); },
    get state() { return scene.state; },
    get lampD() { return scene.lampD; },
    get duckX() { return scene.duckX; },
    get takes() { return takes.map(k => ({ id: k.id, win: k.win, shot: k.shot })); },
    get stamps() { return { ...stamps }; },
    get marker() { return scene.marker && { ...scene.marker }; },
    /** Client coordinates of a point on the set, for driving real pointer events. */
    at(x: number, y: number, d: number) {
      const p = toScreen(x, y, d), f = frame.getBoundingClientRect();
      return { x: f.left + p.x * scale, y: f.top + p.y * scale };
    },
    level: L,
    /** Placeholder cutouts as PNG data URLs: the silhouette reference for the art brief. */
    get refs() { return { 'duck-side': builtIn.side.canvas.toDataURL(), 'duck-front': builtIn.front.canvas.toDataURL() }; },
  },
});

setLang('en');
renderStatic();
renderPicks();
introCard();
