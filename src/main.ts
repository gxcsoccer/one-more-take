/**
 * Entry: which scene to play. `?scene=02` goes straight in; without it the list of scenes is
 * shown. Each scene is its own module and builds its own set, so changing scene is a page load.
 */
import './style.css';
import { lang, rich, setLang, t } from './i18n';
import { inProgress, loadSave, storeSave } from './save';
import { SCENE_BEATS, SCENES } from './scenes';
import { $, card } from './ui';

const want = new URLSearchParams(location.search).get('scene');
if (want === '01') void import('./play01');
else if (want === '02') void import('./play02');
else if (want === 'duo') void import('./play-duo');
else lot();

/** The studio lot: one slate per scene, with how far the child has got in each. */
function lot() {
  const save = loadSave(SCENE_BEATS);
  setLang(save.lang);
  document.body.classList.add('lot');
  const draw = () => {
    $('slate-title').textContent = t('title');
    $('slate-scene').textContent = t('lot');
    $('btn-lang').textContent = lang === 'en' ? '中文' : 'English';
    $('btn-sound').hidden = true;
    const rows = SCENES.map(s => {
      const sv = save.scenes[s.id], state = inProgress(sv) ? t('lot.going', { n: sv.takeNo + 1 }) : sv.completed ? t('lot.done') : t('lot.new');
      return `<button class="slate-card" data-scene="${s.id}"><i>${s.id}</i><b>${rich(`s${s.id}.name`)}</b><span>${state}</span></button>`;
    }).join('') + `<button class="slate-card duo" data-scene="duo"><i>★</i><b>${t('duo.name')}</b><span>${t('duo.state')}</span></button>`;
    const el = card(`<h1>${t('lot.h')}</h1><div class="lot">${rows}</div>`);
    el.querySelectorAll<HTMLButtonElement>('.slate-card').forEach(b => (b.onclick = () => { location.search = `?scene=${b.dataset.scene}`; }));
  };
  $('btn-lang').onclick = () => { setLang(lang === 'en' ? 'zh' : 'en'); save.lang = lang; storeSave(save); draw(); };
  draw();
}
