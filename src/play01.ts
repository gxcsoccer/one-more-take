/**
 * Scene 01 flow. Tick what gives out its own light (or stand a prop beside the duck) → tap the
 * clapperboard → every lamp in the studio goes off and the camera shows what can still be seen
 * → keeper or one more take. From the second beat on the switch is taped over, so the set-up is
 * a prediction and the blackout is its test.
 */
import * as THREE from 'three';
import { candidates, judge01, PROPS, scene01 as S, slotX, type Beat01, type Verdict01 } from './game/scene01';
import { scene02 } from './game/scene02';
import { Stage } from './game/stage';
import { buildMark, buildProp, buildSwitch, buildTag, type BuiltProp } from './game/props01';
import { sfx, unlock } from './game/audio';
import { record } from './evidence';
import { rich, t } from './i18n';
import { nextOpenQuestion, nextQuestion } from './game/questions';
import { freshScene, inProgress, loadSave, storeSave, type Step } from './save';
import { SCENE_BEATS } from './scenes';
import { $, burst, card, chrome, closeCard, openCard, pressCard, setHTML, tickBurst } from './ui';

type Phase = 'intro' | 'block' | 'take' | 'quiz' | 'wrap';
const ease = (cur: number, to: number, dt: number, rate: number) => cur + (to - cur) * Math.min(1, dt * rate);

const CLAPPER = { x: 44, z: 92 }, SWITCH = { x: -46, z: 84 };
const save = loadSave(SCENE_BEATS);
const saved = () => save.scenes[S.id];
const B = S.bench;
// The shared stage takes its measurements from Scene 02's data; here only the duck's line differs.
const stage = new Stage($('stage'), { ...scene02, duck: { ...scene02.duck, z: S.duck.z } }, {
  id: S.id,
  set: 'studio',
  frame: {
    wide: [[B.x0 - 6, 0, B.z - 6], [B.x1 + 6, 0, B.z - 6], [B.x0 - 6, 24, B.z], [B.x1 + 6, 24, B.z], [CLAPPER.x + 10, 18, CLAPPER.z], [CLAPPER.x + 10, 0, CLAPPER.z + 7], [SWITCH.x - 8, 14, SWITCH.z], [SWITCH.x - 8, 0, SWITCH.z + 6]],
    wideLook: [2, 6, 50],
    film: [[B.x0 - 4, -1, B.z], [B.x1 + 4, -1, B.z], [B.x0 - 4, 23, B.z], [B.x1 + 4, 23, B.z], [B.x0 - 4, -1, 88], [B.x1 + 4, -1, 88]],
    look: [0, 8, 34],
    height: 34,
  },
});
void stage.loadArt(import.meta.env.BASE_URL);
stage.duckX = S.duck.x;

// ---------- the set ----------
const set = new THREE.Group();
stage.scene.add(set);
{
  const card = new THREE.MeshStandardMaterial({ color: 0xcdb692, roughness: 1 });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(B.x1 - B.x0 + 6, B.top, 12), card);
  bench.position.set(0, B.top / 2, B.z);
  bench.receiveShadow = true;
  bench.castShadow = true;
  const lip = new THREE.Mesh(new THREE.BoxGeometry(B.x1 - B.x0 + 7, 0.7, 13), new THREE.MeshStandardMaterial({ color: 0x8a7663, roughness: 1 }));
  lip.position.set(0, B.top + 0.05, B.z);
  // A plain dark flat behind the bench, so nothing painted on the backdrop is mistaken for a prop.
  const flat = new THREE.Mesh(new THREE.BoxGeometry(B.x1 - B.x0 + 30, 34, 1), new THREE.MeshStandardMaterial({ color: 0x3c4f55, roughness: 1 }));
  flat.position.set(0, 17, B.z - 9);
  flat.receiveShadow = true;
  set.add(bench, lip, flat);
}
const lever = buildSwitch();
lever.group.position.set(SWITCH.x, 0, SWITCH.z);
lever.group.rotation.y = 0.35;
set.add(lever.group);
const standRing = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.6, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
standRing.rotation.x = -Math.PI / 2;
standRing.position.set(S.stand.x, 0.25, S.stand.z);
set.add(standRing);

interface Item { id: string; built?: BuiltProp; home: THREE.Vector3; pos: THREE.Vector3; mark: ReturnType<typeof buildMark>; top: number; hop: number }
let items: Item[] = [];
const beatSet = new THREE.Group();
set.add(beatSet);

function dress(b: Beat01) {
  beatSet.clear();
  items = candidates(b).map(id => {
    const mark = buildMark();
    beatSet.add(mark.sprite);
    if (id === 'duck') return { id, home: new THREE.Vector3(S.duck.x + 1, 0, S.duck.z), pos: new THREE.Vector3(S.duck.x + 1, 0, S.duck.z), mark, top: 17, hop: 0 };
    const i = b.props.indexOf(id), home = new THREE.Vector3(slotX(i, b.props.length), B.top + 0.4, B.z);
    const built = buildProp(id);
    beatSet.add(built.group);
    const tag = buildTag(t(`prop.${id}`));
    tag.position.set(home.x, B.top / 2, B.z + 6.05);
    beatSet.add(tag);
    return { id, built, home, pos: home.clone(), mark, top: built.top, hop: 0 };
  });
}

// ---------- state ----------
let phase: Phase = 'intro';
let beatIx = 0;
let takeNo = 0;
const beatTakes = [0, 0, 0];
let marked: string[] = [];
let placed: string | null = null;
let lastVerdict: Verdict01 | null = null;
let shown: Verdict01 | null = null;
let take: { t: number; judged: boolean; verdict: Verdict01 | null } | null = null;
let peek = 0;
let peeked = false;
let drag: { item: Item; moved: boolean; from: { x: number; y: number } } | null = null;
let idle = 0;
let quizAnswer = -1;
let openKey: number[] = [];
const quizScore = { right: 0, asked: 0, marks: 0, outOf: 0 };
const checkpoint: { beat: number; step: Step; entered: boolean; touched: boolean } = { beat: 0, step: 'block', entered: false, touched: false };
const beat = (): Beat01 => S.beats[beatIx];
const item = (id: string) => items.find(i => i.id === id)!;

function persist() {
  Object.assign(saved(), { ...checkpoint, takeNo, beatTakes: [...beatTakes], quiz: { ...quizScore } });
  storeSave(save);
}

function caption(): string {
  if (phase !== 'block') return '';
  if (shown && !shown.keeper) return rich(beat().kind === 'mark' ? 's01.again.mark' : 's01.again.place');
  return rich(`s01.${beat().id}.block`);
}

function enterBeat(ix: number) {
  beatIx = ix;
  const b = beat();
  marked = [];
  placed = null;
  shown = null;
  peeked = false;
  dress(b);
  lever.tape.visible = !b.switch;
  Object.assign(checkpoint, { beat: ix, step: 'block', entered: true, touched: false });
  persist();
  backToBlocking();
}

function backToBlocking() {
  phase = 'block';
  idle = 0;
  peek = 0;
  stage.film = false;
  stage.blackout = 0;
  stage.houseLights = 1;
  document.body.classList.remove('film');
  stage.setTake(takeNo + 1);
}

const ready = () => (beat().kind === 'mark' ? marked.length > 0 : placed !== null);

function action() {
  if (phase !== 'block' || !ready()) return;
  takeNo++;
  beatTakes[beatIx]++;
  phase = 'take';
  shown = null;
  take = { t: 0, judged: false, verdict: null };
  drag = null;
  peek = 0;
  stage.clap();
  sfx.clap();
  stage.film = true;
  document.body.classList.add('film');
  $('burst').hidden = true;
}

const DARK_AT = 1.1, REVEAL_AT = 4.3;
function runTake(dt: number) {
  const k = take!, b = beat();
  k.t += dt;
  // The camera rolls, then every lamp in the room goes off. What can still be seen is the answer.
  if (k.t > DARK_AT && k.t < REVEAL_AT && stage.blackout === 0) { stage.blackout = 1; sfx.tick(); }
  if (!k.judged && k.t > REVEAL_AT) {
    k.judged = true;
    stage.blackout = 0;
    stage.houseLights = 0.6;
    const v = (k.verdict = lastVerdict = shown = judge01(b, marked, placed));
    const sources = candidates(b).filter(id => PROPS[id].source).length;
    record({ level: S.id, shot: b.id, kind: 'take', objectives: b.objectives, data: { take: beatTakes[beatIx], chose: b.kind === 'mark' ? [...marked].sort().join(' ') : placed ?? '', right: v.right.length, wrong: v.wrong.join(' '), missed: v.missed.join(' '), keeper: v.keeper, blind: !b.switch, peeked } });
    if (v.keeper) {
      saved().keepers.push({ beat: b.id, lampZ: 0, markX: 0, match: 1, takes: beatTakes[beatIx], at: new Date().toISOString() });
      checkpoint.step = 'quiz';
    }
    persist();
    if (v.keeper) {
      burst(t('keeper'), t(`s01.keeper.${b.kind}`, { n: beatTakes[beatIx] }), true);
      stage.celebrate();
      stage.roar();
      sfx.win();
      record({ level: S.id, shot: b.id, kind: 'got-shot', objectives: b.objectives, data: { takes: beatTakes[beatIx], blind: !b.switch } });
    } else {
      burst(t('cut'), b.kind === 'mark' ? t('s01.cut.mark', { r: v.right.length, n: sources, w: v.wrong.length }) : t('s01.cut.place'), false);
      sfx.sulk();
    }
  }
  if (k.t > REVEAL_AT + 3.4) {
    const keeper = k.verdict!.keeper;
    take = null;
    if (!keeper) return backToBlocking();
    pressQuestion(afterQuestion);
  }
}

function afterQuestion() {
  if (beatIx < S.beats.length - 1) return enterBeat(beatIx + 1);
  interview(wrap);
}

function pressQuestion(then: () => void) {
  phase = 'quiz';
  const b = beat(), q = nextQuestion(b.id);
  quizAnswer = pressCard(q, {
    answered: (right, chose) => {
      quizScore.asked++;
      if (right) quizScore.right++;
      record({ level: S.id, shot: b.id, kind: 'quiz', objectives: q.objectives, data: { question: q.id, correct: right, chose } });
      if (beatIx < S.beats.length - 1) Object.assign(checkpoint, { beat: beatIx + 1, step: 'block', entered: false, touched: false });
      else checkpoint.step = 'interview';
      persist();
    },
    next: then,
  });
}

function interview(then: () => void) {
  phase = 'quiz';
  const q = nextOpenQuestion(S.id);
  openKey = openCard(q, {
    handed: (got, total) => {
      quizScore.marks += got;
      quizScore.outOf += total;
      record({ level: S.id, shot: beat().id, kind: 'quiz', objectives: q.objectives, data: { question: q.id, marks: got, outOf: total } });
      const sv = saved();
      Object.assign(sv, { ...freshScene(S.beats.length), keepers: sv.keepers, completed: sv.completed + 1 });
      Object.assign(checkpoint, { beat: 0, step: 'block', entered: false, touched: false });
      storeSave(save);
    },
    next: then,
  });
}

function startOver() {
  takeNo = 0;
  beatTakes.fill(0);
  quizScore.right = quizScore.asked = quizScore.marks = quizScore.outOf = 0;
  enterBeat(0);
}

function intro() {
  phase = 'intro';
  const sv = saved(), resume = inProgress(sv);
  const el = card(`<h1>${t('s01.name')}</h1><p>${rich('s01.intro.p')}</p><button class="big" id="go">${resume ? t('resume', { n: sv.takeNo + 1 }) : t('go')}</button>${resume ? `<button class="big ghost" id="over">${t('restart')}</button>` : ''}`);
  el.querySelector<HTMLElement>('#go')!.onclick = () => {
    closeCard();
    if (!resume) return startOver();
    takeNo = sv.takeNo;
    sv.beatTakes.forEach((n, i) => (beatTakes[i] = n));
    Object.assign(quizScore, sv.quiz);
    const step = sv.step;
    enterBeat(sv.beat);
    if (step === 'block') return;
    // The shot was already in the can: go straight to its question instead of re-shooting.
    checkpoint.step = step;
    persist();
    if (step === 'quiz') pressQuestion(afterQuestion);
    else interview(wrap);
  };
  const over = el.querySelector<HTMLElement>('#over');
  if (over) over.onclick = () => { closeCard(); startOver(); };
}

function wrap() {
  phase = 'wrap';
  stage.film = false;
  stage.houseLights = 0.5;
  document.body.classList.remove('film');
  const rows = S.beats.map((b, i) => `<tr><td>${t(`wrap.${b.id}`)}</td><td>${t(beatTakes[i] === 1 ? 'take1' : 'takes', { n: beatTakes[i] })}</td></tr>`).join('');
  const el = card(`<h1>${t('wrap.h')}</h1><p>${rich('s01.wrap.p')}</p><table>${rows}<tr><td colspan="2">${t('score', { r: quizScore.right, n: quizScore.asked })}</td></tr><tr><td colspan="2">${t('score.open', { m: quizScore.marks, n: quizScore.outOf })}</td></tr></table><button class="big" id="next">${t('s02.name')} →</button><button class="big ghost" id="go">${t('replay')}</button>`);
  el.querySelector<HTMLElement>('#go')!.onclick = () => { closeCard(); startOver(); };
  el.querySelector<HTMLElement>('#next')!.onclick = () => { location.search = '?scene=02'; };
}

// ---------- input ----------
/** Where things are on screen, for fingers and for the automated playthrough. */
const at = (i: Item) => stage.toClient(i.pos.x, i.pos.y + i.top * 0.5, i.pos.z);
const switchAt = () => stage.toClient(SWITCH.x, 8, SWITCH.z + 2);
const clapperAt = () => stage.toClient(CLAPPER.x, 8, CLAPPER.z);
const standAt = () => stage.toClient(S.stand.x, 2, S.stand.z);
/** How many pixels 7 cm is at the bench: the reach of a fingertip around a prop. */
const reach = () => { const a = stage.toClient(0, B.top, B.z), b = stage.toClient(7, B.top, B.z); return Math.max(34, Math.hypot(a.x - b.x, a.y - b.y)); };
const near = (p: { x: number; y: number }, x: number, y: number) => Math.hypot(p.x - x, p.y - y);

function toggleMark(i: Item) {
  marked = marked.includes(i.id) ? marked.filter(m => m !== i.id) : [...marked, i.id];
  i.hop = 1;
  shown = null;
  checkpoint.touched = true;
  sfx.chalk();
}
function place(i: Item | null) {
  placed = i ? i.id : null;
  shown = null;
  checkpoint.touched = true;
  if (i) { i.hop = 1; sfx.tick(); }
}

const canvas = stage.renderer.domElement;
window.addEventListener('pointerdown', unlock, { capture: true });
canvas.addEventListener('pointerdown', e => {
  $('pop').hidden = true;
  idle = 0;
  if (phase !== 'block') return;
  const x = e.clientX, y = e.clientY, r = reach();
  // A blackout the child asked for ends at the next touch, wherever it lands.
  if (peek > 0) { peek = 0; return; }
  if (near(clapperAt(), x, y) < r * 1.5) return action();
  const b = beat();
  if (b.switch && near(switchAt(), x, y) < r * 1.4) { peek = 4.5; peeked = true; sfx.tick(); return; }
  const hit = items.map(i => ({ i, d: near(at(i), x, y) })).filter(h => h.d < r).sort((p, q) => p.d - q.d)[0]?.i;
  if (!hit) return;
  if (b.kind === 'mark') return toggleMark(hit);
  canvas.setPointerCapture(e.pointerId);
  drag = { item: hit, moved: false, from: { x, y } };
});
canvas.addEventListener('pointermove', e => {
  if (!drag || phase !== 'block') return;
  if (!drag.moved && near(drag.from, e.clientX, e.clientY) < 8) return;
  const p = stage.tablePoint(e.clientX, e.clientY);
  if (!p) return;
  idle = 0;
  if (!drag.moved && placed === drag.item.id) place(null);
  drag.moved = true;
  drag.item.pos.set(Math.max(-70, Math.min(70, p.x)), 0, Math.max(B.z + 8, Math.min(96, p.z)));
});
const drop = () => {
  if (!drag) return;
  const { item: i, moved } = drag;
  drag = null;
  if (phase !== 'block') return;
  // A tap sends the prop to the stand (or back to the bench); a drag must end near the stand.
  const onStand = moved ? Math.hypot(i.pos.x - S.stand.x, i.pos.z - S.stand.z) < 13 : placed !== i.id;
  place(onStand ? i : placed === i.id ? null : placed ? item(placed) : null);
};
for (const type of ['pointerup', 'pointercancel'] as const) canvas.addEventListener(type, drop);

// ---------- the demonstrating hand ----------
function hintNow(): { x: number; y: number } | null {
  if (phase !== 'block' || drag || idle < 3 || !$('modal').hidden || peek > 0) return null;
  const b = beat();
  if (shown && !shown.keeper && idle < 9) return null;
  if (b.switch && !peeked) return switchAt();
  // Never point at a prop: which ones to choose is the whole question.
  if (!ready()) return null;
  return idle > 6 ? clapperAt() : null;
}
let hintClock = 0;
function drawHint(dt: number) {
  const el = $('hint'), h = hintNow();
  if (!h) { el.hidden = true; hintClock = 0; return; }
  hintClock += dt;
  el.hidden = false;
  el.style.opacity = '1';
  el.style.transform = `translate(${h.x}px, ${h.y}px) translate(-50%, -8%) scale(${1 + 0.16 * Math.sin(hintClock * 5.2)})`;
}

// ---------- loop ----------
let prev = performance.now(), clock = 0, markShow = 0;
function frame(now: number) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;
  clock += dt;
  const b = beat();

  if (phase === 'take') runTake(dt);
  else if (phase === 'block') {
    // The switch: off for a few seconds, then back on by itself, so nobody is left in the dark.
    if (peek > 0) peek = Math.max(0, peek - dt);
    stage.blackout = peek > 0 ? 1 : 0;
    stage.clapperReady = ready();
  }
  lever.lever.rotation.x = ease(lever.lever.rotation.x, stage.blackout ? 0.9 : -0.5, dt, 12);

  // Props sit in their slots, or on the stand, or follow the finger.
  for (const i of items) {
    if (!i.built) continue;
    if (!(drag && drag.item === i && drag.moved)) {
      const to = placed === i.id ? new THREE.Vector3(S.stand.x, 0, S.stand.z) : i.home;
      i.pos.lerp(to, Math.min(1, dt * 10));
    }
    i.hop = Math.max(0, i.hop - dt * 2.6);
    i.built.group.position.set(i.pos.x, i.pos.y + Math.sin(i.hop * Math.PI) * 1.6, i.pos.z);
    // On the bench a source's light is kept short, so it does not show up its neighbours and muddle
    // the question. Stood beside the duck it is given room to reach it.
    if (i.built.light) { const near = placed === i.id; i.built.light.distance = ease(i.built.light.distance, near ? 70 : 30, dt, 6); i.built.light.intensity = ease(i.built.light.intensity, near ? 14 : 1.6, dt, 6); }
  }
  for (const i of items) if (!i.built) i.hop = Math.max(0, i.hop - dt * 2.6);

  // Chalk marks are paint, not lamps: they are taken away for the blackout and come back with the light.
  markShow = ease(markShow, stage.blackout || (phase === 'take' && !take?.judged) ? 0 : 1, dt, 9);
  for (const i of items) {
    const v = shown, state = v ? (v.right.includes(i.id) ? 'right' : v.wrong.includes(i.id) ? 'wrong' : v.missed.includes(i.id) ? 'missed' : 'none') : (b.kind === 'mark' ? marked.includes(i.id) : placed === i.id) ? 'ticked' : 'none';
    if (i.mark.state !== state) i.mark.paint(state);
    i.mark.sprite.position.set(i.pos.x, i.pos.y + i.top + 3.4 + Math.sin(clock * 3 + i.pos.x) * 0.25, i.pos.z + 0.5);
    i.mark.sprite.material.opacity = markShow * (state === 'none' ? 0 : 1);
  }
  const pulse = 0.4 + 0.3 * Math.sin(clock * 4);
  standRing.material.opacity = ease(standRing.material.opacity, phase === 'block' && b.kind === 'place' && !stage.blackout ? pulse : 0, dt, 8);

  tickBurst(dt);
  idle += dt;
  setHTML($('caption'), caption());
  stage.update(dt);
  drawHint(dt);
  requestAnimationFrame(frame);
}

// Hooks for the automated playthrough; harmless in play.
Object.assign(window, {
  __omt: {
    get scene() { return S.id; },
    get phase() { return phase; },
    get beat() { return beat().id; },
    get takeNo() { return takeNo; },
    get verdict() { return lastVerdict; },
    get marked() { return [...marked]; },
    get placed() { return placed; },
    get blackout() { return stage.blackout; },
    get quizAnswer() { return quizAnswer; },
    get openKey() { return [...openKey]; },
    get saved() { return JSON.parse(JSON.stringify(saved())); },
    get art() { return { ready: stage.artReady, loaded: [...stage.artLoaded] }; },
    get fitted() { return stage.fitted; },
    get hint() { const h = $('hint'); return h.hidden ? null : h.getBoundingClientRect().toJSON(); },
    /** Screen positions of everything that can be touched. */
    get handles() { return { props: Object.fromEntries(items.map(i => [i.id, at(i)])), switch: switchAt(), clapper: clapperAt(), stand: standAt() }; },
    /** Which of this beat's candidates give out their own light. For the playthrough's "right answer" run only. */
    get sources() { return candidates(beat()).filter(id => PROPS[id].source); },
    get candidates() { return candidates(beat()); },
  },
});

chrome(save, 's01.scene', () => { if (phase === 'intro') intro(); if (phase === 'wrap') wrap(); if (phase === 'block') { const m = marked, p = placed; dress(beat()); marked = m; placed = p; } });
dress(S.beats[0]);
intro();
requestAnimationFrame(frame);
