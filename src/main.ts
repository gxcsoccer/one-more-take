/**
 * Scene 02 flow. Block the set → tap the clapperboard → watch the take play
 * out → keeper or one more take. From the second beat on the lamp is off while
 * blocking, so every set-up is a prediction and every take is its test.
 */
import './style.css';
import { DUCK, inShadow, type Grid } from './sim/light';
import { catInShadow, duckAt, judge, lampAt, maskOf, scene02 as S, type Beat, type Setup, type Verdict } from './game/scene02';
import { Stage, type Pickable } from './game/stage';
import { setSound, sfx, soundOn, unlock } from './game/audio';
import { record } from './evidence';
import { lang, rich, setLang, t, terms } from './i18n';
import { nextOpenQuestion, nextQuestion } from './game/questions';
import { freshScene, inProgress, loadSave, storeSave, type Step } from './save';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pct = (v: number) => Math.round(v * 100);

/** Finer grid than the judge uses, so chalk lines come out smooth. */
const FINE: Grid = { x0: S.wall.x0, y0: 0, cols: (S.wall.x1 - S.wall.x0) * 4, rows: S.wall.height * 4, cell: 0.25 };

type Phase = 'intro' | 'block' | 'take' | 'quiz' | 'cameo' | 'wrap';

const save = loadSave({ [S.id]: S.beats.length });
const saved = () => save.scenes[S.id];
const stage = new Stage($('stage'), S);
void stage.loadArt(import.meta.env.BASE_URL);
let phase: Phase = 'intro';
let beatIx = 0;
const setup: Setup = { lampZ: S.lamp.max, markX: 0 };
let takeNo = 0;
const beatTakes = [0, 0, 0];
let lastSetup: Setup | null = null;
let outline: Uint8Array | null = null;
let trace: Uint8Array | null = null;
let take: { t: number; walk: boolean; judged: boolean; verdict: Verdict | null; roared: boolean; lit: boolean } | null = null;
let cameoT = 0;
let drag: { what: 'lamp' | 'mark'; offset: number } | null = null;
let burstT = 0;
let afterMiss = false;
const covered: boolean[] = [];
let lastVerdict: Verdict | null = null;
const quizScore = { right: 0, asked: 0, marks: 0, outOf: 0 };
let openKey: number[] = [];
/** Seconds since the player last touched the set, and what they have moved since blocking began. */
let idle = 0;
const moved = { lamp: false, mark: false };
/** The point a reload should return to. It moves forward only at moments that must not be repeated. */
const checkpoint: { beat: number; step: Step; entered: boolean } = { beat: 0, step: 'block', entered: false };
let quizAnswer = -1;
const beat = (): Beat => S.beats[beatIx];

/** Write where the child is, so closing the app loses nothing. */
function persist() {
  Object.assign(saved(), { ...checkpoint, lampZ: setup.lampZ, markX: setup.markX, takeNo, beatTakes: [...beatTakes], quiz: { ...quizScore } });
  storeSave(save);
}

// ---------- words ----------
function setHTML(el: HTMLElement, html: string) {
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
}
function renderStatic() {
  $('slate-title').textContent = t('title');
  $('slate-scene').textContent = t('scene');
  $('btn-lang').textContent = lang === 'en' ? '中文' : 'English';
  $('btn-sound').textContent = `${t('sound')} ${soundOn ? '🔊' : '🔇'}`;
}
function caption(): string {
  if (phase === 'cameo') return rich('cat.cameo');
  if (phase !== 'block') return '';
  if (afterMiss) return rich('again');
  if (beat().id === 'play') return rich(stage.clapperReady ? 'play.ready' : 'play.block');
  return rich(`${beat().id}.block`);
}
function burst(big: string, sub: string, keeper: boolean) {
  const el = $('burst');
  el.hidden = true;
  void el.offsetWidth;
  el.classList.toggle('keeper', keeper);
  $('burst-big').textContent = big;
  $('burst-sub').textContent = sub;
  el.hidden = false;
  burstT = 2.6;
}

// ---------- beats ----------
function chalk(good = false) {
  stage.drawChalk(FINE, outline, trace, good);
}

/** `resumed`: the child was already in this beat, so keep the props where they left them. */
function enterBeat(ix: number, resumed = false) {
  beatIx = ix;
  const b = beat();
  if (b.start && !resumed) Object.assign(setup, b.start);
  setup.lampZ = clamp(setup.lampZ, S.lamp.min, S.lamp.max);
  outline = maskOf(b.target, FINE);
  trace = null;
  lastSetup = null;
  afterMiss = false;
  chalk();
  stage.catVisible = b.cat;
  stage.movable = { lamp: b.movable.includes('lamp'), mark: b.movable.includes('mark') };
  Object.assign(checkpoint, { beat: ix, step: 'block', entered: true });
  persist();
  backToBlocking();
}

function backToBlocking() {
  const b = beat();
  phase = 'block';
  idle = 0;
  moved.lamp = moved.mark = false;
  stage.film = false;
  document.body.classList.remove('film');
  stage.lampOn = b.rehearsalLight;
  stage.houseLights = b.rehearsalLight ? 0.42 : 1;
  stage.walking = false;
  stage.setTake(takeNo + 1);
}

function action() {
  if (phase !== 'block') return;
  const b = beat();
  takeNo++;
  beatTakes[beatIx]++;
  phase = 'take';
  afterMiss = false;
  take = { t: 0, walk: !b.rehearsalLight, judged: false, verdict: null, roared: false, lit: b.rehearsalLight };
  drag = null;
  stage.clap();
  sfx.clap();
  stage.film = true;
  stage.houseLights = 0.1;
  document.body.classList.add('film');
  $('burst').hidden = true;
}

const WALK_FROM = 0.9, WALK_FOR = 2.4;
function runTake(dt: number) {
  const k = take!, b = beat();
  k.t += dt;
  const settle = k.walk ? WALK_FROM + WALK_FOR : 0.5;
  if (!k.lit && k.t > 0.6) { k.lit = true; stage.lampOn = true; sfx.tick(); }
  if (k.walk) {
    const u = clamp((k.t - WALK_FROM) / WALK_FOR, 0, 1), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    stage.duckX = S.duck.enterFrom + (setup.markX - S.duck.enterFrom) * e;
    stage.walking = u > 0 && u < 1;
  }
  if (!k.roared && k.t > settle + 0.25) {
    k.roared = true;
    stage.roar();
    sfx.roar(setup.lampZ / (setup.lampZ - S.duck.z));
  }
  if (!k.judged && k.t > settle + 0.9) {
    k.judged = true;
    const v = (k.verdict = lastVerdict = judge(b, setup));
    trace = null;
    chalk(v.keeper);
    const changed = lastSetup ? Number(Math.abs(lastSetup.lampZ - setup.lampZ) > 0.5) + Number(Math.abs(lastSetup.markX - setup.markX) > 0.25) : 0;
    record({ level: S.id, shot: b.id, kind: 'take', objectives: b.objectives, data: { take: beatTakes[beatIx], lampToDuck: Math.round(setup.lampZ - S.duck.z), markX: setup.markX, match: pct(v.match), keeper: v.keeper, blind: !b.rehearsalLight, changedSinceLast: changed } });
    lastSetup = { ...setup };
    if (v.keeper) {
      // From here a reload goes to this beat's question, never back to re-shoot it.
      saved().keepers.push({ beat: b.id, lampZ: setup.lampZ, markX: setup.markX, match: v.match, takes: beatTakes[beatIx], at: new Date().toISOString() });
      checkpoint.step = 'quiz';
    }
    persist();
    if (v.keeper) {
      burst(t('keeper'), t('keeper.sub', { n: beatTakes[beatIx], p: pct(v.match) }), true);
      stage.celebrate();
      sfx.win();
      record({ level: S.id, shot: b.id, kind: 'got-shot', objectives: b.objectives, data: { takes: beatTakes[beatIx], blind: !b.rehearsalLight } });
    } else {
      burst(t('cut'), v.catDark ? t('cut.cat') : t('cut.sub', { p: pct(v.match) }), false);
      sfx.sulk();
    }
  }
  if (k.t > settle + 3.6) {
    const keeper = k.verdict!.keeper;
    take = null;
    if (!keeper) {
      afterMiss = !b.rehearsalLight;
      if (!b.rehearsalLight) { trace = maskOf(setup, FINE); chalk(); }
      return backToBlocking();
    }
    pressQuestion(afterQuestion);
  }
}

/** What follows a beat's press question. */
function afterQuestion() {
  const id = beat().id;
  if (id === 'play') return enterBeat(1);
  if (id === 'dark') { phase = 'cameo'; cameoT = 0; stage.catVisible = true; sfx.paw(); return; }
  interview(wrap);
}

// ---------- cards ----------
function card(html: string) {
  const m = $('modal');
  m.innerHTML = `<div class="sheet">${html}</div>`;
  m.hidden = false;
  return m.firstElementChild as HTMLElement;
}
/** One exam-style question from a reporter, asked while the keeper is still fresh. */
function pressQuestion(then: () => void) {
  phase = 'quiz';
  const b = beat(), q = nextQuestion(b.id), esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  quizAnswer = order.indexOf(0);
  const el = card(`<div class="press">${t('press')}</div><h2>${esc(q.ask[lang])}</h2><div class="opts">${order.map((o, i) => `<button data-i="${i}"><i>${i + 1}</i><span>${esc(q.options[o][lang])}</span></button>`).join('')}</div><p id="why" hidden></p><button class="big" id="go" hidden>${t('next')}</button>`);
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('.opts button')];
  buttons.forEach(btn => (btn.onclick = () => {
    const chosen = Number(btn.dataset.i), right = chosen === quizAnswer;
    buttons.forEach((x, i) => { x.disabled = true; if (i === quizAnswer) x.classList.add('right'); else if (i === chosen) x.classList.add('wrong'); });
    const why = el.querySelector<HTMLElement>('#why')!;
    why.innerHTML = `<b>${t(right ? 'right' : 'wrong')}</b>${esc(q.why[lang])}`;
    why.hidden = false;
    el.querySelector<HTMLElement>('#go')!.hidden = false;
    quizScore.asked++;
    if (right) quizScore.right++;
    right ? sfx.win() : sfx.sulk();
    record({ level: S.id, shot: b.id, kind: 'quiz', objectives: q.objectives, data: { question: q.id, correct: right, chose: q.options[order[chosen]].en } });
    // Answered: a reload now goes on to the next beat (or the closing question), and never asks this one again.
    if (beatIx < S.beats.length - 1) Object.assign(checkpoint, { beat: beatIx + 1, step: 'block', entered: false });
    else checkpoint.step = 'interview';
    persist();
  }));
  el.querySelector<HTMLElement>('#go')!.onclick = () => { $('modal').hidden = true; then(); };
}

/** One structured question in parts, answered by completing sentences; one mark per blank. */
function interview(then: () => void) {
  phase = 'quiz';
  const q = nextOpenQuestion(), esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const blanks: { order: number[]; chosen: number }[] = [];
  const parts = q.parts.map(part => {
    const first = blanks.length;
    const fill = esc(part.text[lang]).replace(/\{(\d)\}/g, (_, d: string) => {
      const b = first + Number(d), order = part.blanks[Number(d)].map((_, i) => i).sort(() => Math.random() - 0.5);
      blanks[b] = { order, chosen: -1 };
      return `<span class="blank" data-b="${b}">${order.map((o, i) => `<button data-o="${i}" aria-pressed="false">${esc(part.blanks[Number(d)][o][lang])}</button>`).join('')}</span>`;
    });
    return `<div class="part"><h3>${esc(part.ask[lang])}<small>[${part.blanks.length}]</small></h3><div class="fill">${fill}</div></div>`;
  }).join('');
  openKey = blanks.map(b => b.order.indexOf(0));
  const total = blanks.length;
  const el = card(`<div class="press">${t('interview', { n: total })}</div><p class="stem">${esc(q.stem[lang])}</p>${parts}<p id="mark" hidden></p><button class="big" id="hand" disabled>${t('hand')}</button><button class="big" id="go" hidden>${t('next')}</button>`);
  const hand = el.querySelector<HTMLButtonElement>('#hand')!;
  el.querySelectorAll<HTMLElement>('.blank').forEach(span => {
    const b = Number(span.dataset.b);
    span.querySelectorAll<HTMLButtonElement>('button').forEach(btn => (btn.onclick = () => {
      blanks[b].chosen = Number(btn.dataset.o);
      span.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
      hand.disabled = blanks.some(x => x.chosen < 0);
      sfx.tick();
    }));
  });
  hand.onclick = () => {
    let got = 0;
    el.querySelectorAll<HTMLElement>('.blank').forEach(span => {
      const b = Number(span.dataset.b), right = blanks[b].chosen === openKey[b];
      if (right) got++;
      span.classList.add(right ? 'right' : 'wrong');
      span.querySelectorAll<HTMLButtonElement>('button').forEach((x, i) => { x.disabled = true; if (i === openKey[b]) x.classList.add('key'); });
    });
    const mark = el.querySelector<HTMLElement>('#mark')!;
    mark.textContent = t('marks', { m: got, n: total });
    mark.hidden = false;
    hand.hidden = true;
    el.querySelector<HTMLElement>('#go')!.hidden = false;
    quizScore.marks += got;
    quizScore.outOf += total;
    got === total ? sfx.win() : sfx.tick();
    record({ level: S.id, shot: beat().id, kind: 'quiz', objectives: q.objectives, data: { question: q.id, marks: got, outOf: total } });
    // Handed in: the scene is complete. It is counted once, keeps its keepers, and the next visit starts fresh.
    const sv = saved();
    Object.assign(sv, { ...freshScene(S.beats.length), keepers: sv.keepers, completed: sv.completed + 1 });
    Object.assign(checkpoint, { beat: 0, step: 'block', entered: false });
    storeSave(save);
    el.scrollTop = el.scrollHeight;
  };
  el.querySelector<HTMLElement>('#go')!.onclick = () => { $('modal').hidden = true; then(); };
}

function startOver() {
  takeNo = 0;
  beatTakes.fill(0);
  quizScore.right = quizScore.asked = quizScore.marks = quizScore.outOf = 0;
  stage.catSulking = false;
  enterBeat(0);
}

function intro() {
  phase = 'intro';
  const sv = saved(), resume = inProgress(sv);
  const el = card(`<h1>${t('intro.h')}</h1><p>${rich('intro.p')}</p><button class="big" id="go">${resume ? t('resume', { n: sv.takeNo + 1 }) : t('go')}</button>${resume ? `<button class="big ghost" id="over">${t('restart')}</button>` : ''}`);
  el.querySelector<HTMLElement>('#go')!.onclick = () => {
    $('modal').hidden = true;
    if (!resume) return startOver();
    takeNo = sv.takeNo;
    sv.beatTakes.forEach((n, i) => (beatTakes[i] = n));
    Object.assign(quizScore, sv.quiz);
    if (Number.isFinite(sv.lampZ)) setup.lampZ = sv.lampZ;
    if (Number.isFinite(sv.markX)) setup.markX = sv.markX;
    const step = sv.step;
    enterBeat(sv.beat, sv.entered || step !== 'block');
    if (step === 'block') return;
    // The shot was already in the can: go straight to its question instead of re-shooting.
    checkpoint.step = step;
    persist();
    if (step === 'quiz') pressQuestion(afterQuestion);
    else interview(wrap);
  };
  const over = el.querySelector<HTMLElement>('#over');
  if (over) over.onclick = () => { $('modal').hidden = true; startOver(); };
}
function wrap() {
  phase = 'wrap';
  stage.film = false;
  stage.houseLights = 0.5;
  document.body.classList.remove('film');
  const rows = S.beats.map((b, i) => `<tr><td>${t(`wrap.${b.id}`)}</td><td>${t('takes', { n: beatTakes[i] })}</td></tr>`).join('');
  const el = card(`<h1>${t('wrap.h')}</h1><p>${rich('wrap.p')}</p><table>${rows}<tr><td colspan="2">${t('score', { r: quizScore.right, n: quizScore.asked })}</td></tr><tr><td colspan="2">${t('score.open', { m: quizScore.marks, n: quizScore.outOf })}</td></tr></table><button class="big" id="go">${t('replay')}</button>`);
  el.querySelector<HTMLElement>('#go')!.onclick = () => { $('modal').hidden = true; startOver(); };
}

// ---------- input ----------
const canvas = stage.renderer.domElement;
window.addEventListener('pointerdown', unlock, { capture: true });
canvas.addEventListener('pointerdown', e => {
  $('pop').hidden = true;
  idle = 0;
  if (phase !== 'block') return;
  const what: Pickable | null = stage.pick(e.clientX, e.clientY);
  if (what === 'clapper') return action();
  if (!what || !stage.movable[what]) return;
  const p = stage.tablePoint(e.clientX, e.clientY);
  if (!p) return;
  canvas.setPointerCapture(e.pointerId);
  drag = { what, offset: what === 'lamp' ? setup.lampZ - p.z : setup.markX - p.x };
  afterMiss = false;
  sfx.tick();
});
canvas.addEventListener('pointermove', e => {
  if (!drag || phase !== 'block') return;
  const p = stage.tablePoint(e.clientX, e.clientY);
  if (!p) return;
  idle = 0;
  moved[drag.what] = true;
  if (drag.what === 'lamp') setup.lampZ = clamp(p.z + drag.offset, S.lamp.min, S.lamp.max);
  else setup.markX = clamp(Math.round((p.x + drag.offset) * 4) / 4, S.duck.min, S.duck.max);
});
// Letting go of a prop saves where it was put; so does leaving the page mid-drag.
const drop = () => { if (drag) { drag = null; if (phase === 'block') persist(); } };
for (const type of ['pointerup', 'pointercancel'] as const) canvas.addEventListener(type, drop);
window.addEventListener('pagehide', drop);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && drop());
$('btn-lang').onclick = () => { setLang(lang === 'en' ? 'zh' : 'en'); save.lang = lang; storeSave(save); renderStatic(); if (phase === 'intro') intro(); if (phase === 'wrap') wrap(); };
$('btn-sound').onclick = () => { setSound(!soundOn); save.sound = soundOn; storeSave(save); renderStatic(); sfx.tick(); };
document.addEventListener('click', e => {
  const pop = $('pop'), el = (e.target as HTMLElement).closest<HTMLElement>('.term');
  if (!el) { if (!(e.target as HTMLElement).closest('#pop')) pop.hidden = true; return; }
  const term = terms[el.dataset.term!];
  pop.innerHTML = `<b>${term.en}</b> · ${term.zh}<button class="say">🔊</button><br>${lang === 'en' ? term.defEn : term.defZh}`;
  pop.hidden = false;
  const r = el.getBoundingClientRect();
  pop.style.left = `${clamp(r.left - 30, 12, window.innerWidth - 380)}px`;
  pop.style.top = r.top > window.innerHeight / 2 ? `${r.top - 130}px` : `${r.bottom + 10}px`;
  pop.querySelector<HTMLElement>('.say')!.onclick = () => {
    try { const u = new SpeechSynthesisUtterance(term.en); u.lang = 'en-GB'; speechSynthesis.speak(u); } catch { /* no speech here */ }
  };
});

// ---------- the demonstrating hand ----------
type Pt = { x: number; y: number };
/**
 * What the hand should show right now, or null to hide it.
 *   to    – drag from `from` to `to` (lit beats, where the shadow is visible anyway)
 *   sway  – rock between two points either side of `from`: "this can be dragged", no direction implied
 *   neither – tap
 */
function hintNow(): { from: Pt; to?: Pt; sway?: [Pt, Pt] } | null {
  if (phase !== 'block' || drag || idle < 2.5 || !$('modal').hidden) return null;
  const b = beat(), lampAt = (z: number) => stage.toClient(S.lamp.x, 5, clamp(z, S.lamp.min, S.lamp.max) + 3), markAt = (x: number) => stage.toClient(clamp(x, S.duck.min, S.duck.max), 3, S.duck.z + 8);
  const tap = { from: stage.toClient(44, 9, 92) };
  if (b.rehearsalLight) {
    if (stage.clapperReady) return tap;
    // Lights on: the child can see the shadow, so showing which way to go gives nothing away.
    return { from: lampAt(setup.lampZ), to: lampAt(setup.lampZ + (b.target.lampZ < setup.lampZ ? -26 : 26)) };
  }
  // Lights out: the set-up is the prediction. Never read the target here.
  if (!moved.lamp) return { from: lampAt(setup.lampZ), sway: [lampAt(setup.lampZ - 14), lampAt(setup.lampZ + 14)] };
  if (b.movable.includes('mark') && !moved.mark) return { from: markAt(setup.markX), sway: [markAt(setup.markX - 4), markAt(setup.markX + 4)] };
  return idle > 5 ? tap : null;
}
let hintClock = 0;
function drawHint(dt: number) {
  const el = $('hint'), h = hintNow();
  if (!h) { el.hidden = true; hintClock = 0; return; }
  hintClock += dt;
  const u = (hintClock % 2.4) / 2.4;
  let x = h.from.x, y = h.from.y, scale = 1, alpha = 1;
  if (h.to) {
    // Press, drag, lift, pause.
    const k = clamp((u - 0.15) / 0.55, 0, 1), e = k * k * (3 - 2 * k);
    x += (h.to.x - h.from.x) * e; y += (h.to.y - h.from.y) * e;
    scale = u < 0.15 ? 1.15 - u : 1;
    alpha = u > 0.8 ? 1 - (u - 0.8) / 0.2 : Math.min(1, u / 0.08);
  } else if (h.sway) {
    // Rock from one side to the other and back.
    const k = (Math.sin(u * Math.PI * 2) + 1) / 2;
    x = h.sway[0].x + (h.sway[1].x - h.sway[0].x) * k; y = h.sway[0].y + (h.sway[1].y - h.sway[0].y) * k;
  } else {
    scale = 1 + 0.16 * Math.sin(u * Math.PI * 4);
  }
  el.hidden = false;
  el.style.opacity = String(alpha);
  // The fingertip of the emoji sits at its top centre.
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -8%) scale(${scale})`;
}

// ---------- loop ----------
let prev = performance.now();
function frame(now: number) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;
  const b = beat();

  if (phase === 'take') runTake(dt);
  else if (phase === 'cameo') {
    cameoT += dt;
    if (cameoT > 3.2) enterBeat(2);
  } else if (phase === 'block') {
    // Lit rehearsal: the duck stands on its mark. Dark blocking: it waits in the wings.
    const home = b.rehearsalLight ? setup.markX : S.duck.enterFrom;
    const step = 150 * dt, d = home - stage.duckX;
    stage.duckX = Math.abs(d) <= step ? home : stage.duckX + Math.sign(d) * step;
    stage.walking = Math.abs(d) > step;
    stage.clapperReady = b.rehearsalLight ? judge(b, setup).keeper : true;
  }
  stage.lampZ = setup.lampZ;
  stage.markX = setup.markX;

  // Whoever the shadow reaches reacts to it, whenever the lamp is lit.
  const live: Setup = { lampZ: setup.lampZ, markX: stage.duckX };
  if (stage.lampOn) {
    stage.residentSpots.forEach((w, i) => {
      const now = inShadow(lampAt(live), w.x, w.y, DUCK, duckAt(stage.duckX));
      if (now && !covered[i]) { stage.scare(i); sfx.eek(); }
      covered[i] = now;
    });
    const sulk = stage.catVisible && catInShadow(live);
    if (sulk && !stage.catSulking) sfx.sulk();
    stage.catSulking = sulk;
  } else covered.fill(false);

  if (burstT > 0 && (burstT -= dt) <= 0) $('burst').hidden = true;
  idle += dt;
  setHTML($('caption'), caption());
  stage.update(dt);
  drawHint(dt);
  requestAnimationFrame(frame);
}

// Hooks for the automated playthrough; harmless in play.
Object.assign(window, {
  __omt: {
    get phase() { return phase; },
    get beat() { return beat().id; },
    get setup() { return { ...setup }; },
    get takeNo() { return takeNo; },
    get verdict() { return lastVerdict; },
    get target() { return { ...beat().target }; },
    get quizAnswer() { return quizAnswer; },
    get openKey() { return [...openKey]; },
    get saved() { return JSON.parse(JSON.stringify(saved())); },
    get hint() { const h = $('hint'); return h.hidden ? null : h.getBoundingClientRect().toJSON(); },
    /** Window size the camera was last fitted to, so a test can wait for a resize to be applied. */
    get fitted() { return stage.fitted; },
    get handles() {
      return { lamp: stage.toClient(S.lamp.x, 5, setup.lampZ + 3), mark: stage.toClient(setup.markX, 3, S.duck.z + 8), clapper: stage.toClient(44, 8, 92) };
    },
    lampAt: (z: number) => stage.toClient(S.lamp.x, 5, z + 3),
    markAt: (x: number) => stage.toClient(x, 3, S.duck.z + 8),
  },
});

setLang(save.lang);
setSound(save.sound);
renderStatic();
intro();
requestAnimationFrame(frame);
