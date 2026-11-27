/**
 * Saved game, kept on the device only: settings, where the child is in each
 * scene, and the keepers they have shot. Anything unreadable or out of range
 * is replaced by a default rather than trusted.
 */
import type { Lang } from './i18n';

export interface Keeper {
  beat: string;
  lampZ: number;
  markX: number;
  match: number;
  takes: number;
  at: string;
}

export interface SceneSave {
  /** Index of the beat to resume at. 0 with no takes means "not started". */
  beat: number;
  lampZ: number;
  markX: number;
  takeNo: number;
  beatTakes: number[];
  quiz: { right: number; asked: number; marks: number; outOf: number };
  keepers: Keeper[];
  /** How many times the scene has been wrapped. */
  completed: number;
}

export interface Save {
  v: 1;
  lang: Lang;
  sound: boolean;
  scenes: Record<string, SceneSave>;
}

export type Store = Pick<Storage, 'getItem' | 'setItem'>;

const KEY = 'omt.save.v1';
const num = (v: unknown, fallback: number, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback);
const count = (v: unknown) => Math.floor(num(v, 0, 0, 1e6));

export function freshScene(beats: number): SceneSave {
  return { beat: 0, lampZ: NaN, markX: NaN, takeNo: 0, beatTakes: new Array(beats).fill(0), quiz: { right: 0, asked: 0, marks: 0, outOf: 0 }, keepers: [], completed: 0 };
}

function readScene(raw: unknown, beats: number): SceneSave {
  const s = freshScene(beats);
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  s.beat = Math.floor(num(r.beat, 0, 0, beats - 1));
  s.lampZ = num(r.lampZ, NaN);
  s.markX = num(r.markX, NaN);
  s.takeNo = count(r.takeNo);
  if (Array.isArray(r.beatTakes)) s.beatTakes = s.beatTakes.map((_, i) => count((r.beatTakes as unknown[])[i]));
  const q = (r.quiz ?? {}) as Record<string, unknown>;
  s.quiz = { right: count(q.right), asked: count(q.asked), marks: count(q.marks), outOf: count(q.outOf) };
  if (Array.isArray(r.keepers)) {
    s.keepers = (r.keepers as Record<string, unknown>[]).filter(k => k && typeof k === 'object' && typeof k.beat === 'string').slice(-50)
      .map(k => ({ beat: String(k.beat), lampZ: num(k.lampZ, 0), markX: num(k.markX, 0), match: num(k.match, 0, 0, 1), takes: count(k.takes), at: typeof k.at === 'string' ? k.at : '' }));
  }
  s.completed = count(r.completed);
  return s;
}

/** `sceneBeats` maps each scene id to its number of beats, so progress can be range-checked. */
export function loadSave(sceneBeats: Record<string, number>, store: Store | null = safeStore()): Save {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(store?.getItem(KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') raw = parsed;
  } catch {
    /* unreadable save: start fresh */
  }
  const scenes: Record<string, SceneSave> = {}, rs = (raw.scenes && typeof raw.scenes === 'object' ? raw.scenes : {}) as Record<string, unknown>;
  for (const [id, beats] of Object.entries(sceneBeats)) scenes[id] = readScene(rs[id], beats);
  return { v: 1, lang: raw.lang === 'zh' ? 'zh' : 'en', sound: raw.sound !== false, scenes };
}

export function storeSave(save: Save, store: Store | null = safeStore()) {
  try {
    store?.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage full or blocked: the game carries on unsaved */
  }
}

/** Has the child got somewhere worth resuming? */
export const inProgress = (s: SceneSave) => s.beat > 0 || s.takeNo > 0;

function safeStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
