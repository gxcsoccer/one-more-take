/**
 * The parts of the screen every scene shares: the card that holds the intro, the questions and
 * the wrap; the KEEPER / CUT banner; the buttons in the corner; the pop-up for science words.
 * A scene says what happens when a question is answered; this file only shows and collects.
 */
import { setSound, sfx, soundOn } from './game/audio';
import { lang, setLang, t, terms } from './i18n';
import type { OpenQuestion, Question } from './game/questions';
import { storeSave, type Save } from './save';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function setHTML(el: HTMLElement, html: string) {
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
}

export function card(html: string) {
  const m = $('modal');
  m.innerHTML = `<div class="sheet">${html}</div>`;
  m.hidden = false;
  return m.firstElementChild as HTMLElement;
}
export const closeCard = () => { $('modal').hidden = true; };

let burstT = 0;
export function burst(big: string, sub: string, keeper: boolean) {
  const el = $('burst');
  el.hidden = true;
  void el.offsetWidth;
  el.classList.toggle('keeper', keeper);
  $('burst-big').textContent = big;
  $('burst-sub').textContent = sub;
  el.hidden = false;
  burstT = 2.6;
}
/** Call every frame: takes the banner down when its time is up. */
export function tickBurst(dt: number) {
  if (burstT > 0 && (burstT -= dt) <= 0) $('burst').hidden = true;
}

/**
 * One exam-style question from a reporter. Returns which button holds the right answer.
 * `answered` runs once, when the child chooses; `next` when they press on.
 */
export function pressCard(q: Question, on: { answered: (right: boolean, choseEn: string) => void; next: () => void }): number {
  const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5), answer = order.indexOf(0);
  const el = card(`<div class="press">${t('press')}</div><h2>${esc(q.ask[lang])}</h2><div class="opts">${order.map((o, i) => `<button data-i="${i}"><i>${i + 1}</i><span>${esc(q.options[o][lang])}</span></button>`).join('')}</div><p id="why" hidden></p><button class="big" id="go" hidden>${t('next')}</button>`);
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('.opts button')];
  buttons.forEach(btn => (btn.onclick = () => {
    const chosen = Number(btn.dataset.i), right = chosen === answer;
    buttons.forEach((x, i) => { x.disabled = true; if (i === answer) x.classList.add('right'); else if (i === chosen) x.classList.add('wrong'); });
    const why = el.querySelector<HTMLElement>('#why')!;
    why.innerHTML = `<b>${t(right ? 'right' : 'wrong')}</b>${esc(q.why[lang])}`;
    why.hidden = false;
    el.querySelector<HTMLElement>('#go')!.hidden = false;
    right ? sfx.win() : sfx.sulk();
    on.answered(right, q.options[order[chosen]].en);
  }));
  el.querySelector<HTMLElement>('#go')!.onclick = () => { closeCard(); on.next(); };
  return answer;
}

/**
 * One structured question in parts, answered by completing sentences; one mark per blank.
 * Returns the key: for each blank, which button is right.
 */
export function openCard(q: OpenQuestion, on: { handed: (got: number, total: number) => void; next: () => void }): number[] {
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
  const key = blanks.map(b => b.order.indexOf(0)), total = blanks.length;
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
      const b = Number(span.dataset.b), right = blanks[b].chosen === key[b];
      if (right) got++;
      span.classList.add(right ? 'right' : 'wrong');
      span.querySelectorAll<HTMLButtonElement>('button').forEach((x, i) => { x.disabled = true; if (i === key[b]) x.classList.add('key'); });
    });
    const mark = el.querySelector<HTMLElement>('#mark')!;
    mark.textContent = t('marks', { m: got, n: total });
    mark.hidden = false;
    hand.hidden = true;
    el.querySelector<HTMLElement>('#go')!.hidden = false;
    got === total ? sfx.win() : sfx.tick();
    on.handed(got, total);
    el.scrollTop = el.scrollHeight;
  };
  el.querySelector<HTMLElement>('#go')!.onclick = () => { closeCard(); on.next(); };
  return key;
}

/**
 * The title, the language and sound buttons, and the pop-up for science words.
 * `sceneKey` is the i18n key of the line under the title; `redraw` re-renders whatever card is up
 * after the language changes. Tapping the title goes back to the list of scenes.
 */
export function chrome(save: Save, sceneKey: string, redraw: () => void) {
  const render = () => {
    $('slate-title').textContent = t('title');
    $('slate-scene').textContent = t(sceneKey);
    $('btn-lang').textContent = lang === 'en' ? '中文' : 'English';
    $('btn-sound').textContent = `${t('sound')} ${soundOn ? '🔊' : '🔇'}`;
  };
  $('btn-lang').onclick = () => { setLang(lang === 'en' ? 'zh' : 'en'); save.lang = lang; storeSave(save); render(); redraw(); };
  $('btn-sound').onclick = () => { setSound(!soundOn); save.sound = soundOn; storeSave(save); render(); sfx.tick(); };
  $('slate').onclick = () => { location.search = ''; };
  document.addEventListener('click', e => {
    const pop = $('pop'), el = (e.target as HTMLElement).closest<HTMLElement>('.term');
    if (!el) { if (!(e.target as HTMLElement).closest('#pop')) pop.hidden = true; return; }
    const term = terms[el.dataset.term!];
    pop.innerHTML = `<b>${term.en}</b> · ${term.zh}<button class="say">🔊</button><br>${lang === 'en' ? term.defEn : term.defZh}`;
    pop.hidden = false;
    const r = el.getBoundingClientRect();
    pop.style.left = `${clamp(r.left - 30, 12, window.innerWidth - 380)}px`;
    // Above the word when there is room, so the box never covers the button under the text.
    const ph = pop.offsetHeight || 120;
    pop.style.top = r.top > ph + 20 ? `${r.top - ph - 10}px` : `${r.bottom + 10}px`;
    pop.querySelector<HTMLElement>('.say')!.onclick = () => {
      try { const u = new SpeechSynthesisUtterance(term.en); u.lang = 'en-GB'; speechSynthesis.speak(u); } catch { /* no speech here */ }
    };
  });
  setLang(save.lang);
  setSound(save.sound);
  render();
}
