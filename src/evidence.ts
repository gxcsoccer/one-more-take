/**
 * Learning-evidence log, kept on the device only. Each entry names the
 * curriculum rows it speaks to (ids from docs/curriculum/P4-objectives.csv)
 * and what the child actually did. A level pass alone is never evidence.
 */
export type EvidenceKind = 'take' | 'got-shot' | 'quiz';

export interface Evidence {
  at: string;
  level: string;
  shot: string;
  kind: EvidenceKind;
  objectives: string[];
  data?: Record<string, number | string | boolean>;
}

const KEY = 'omt.evidence.v2';

export function readEvidence(): Evidence[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function record(e: Omit<Evidence, 'at'>) {
  const all = readEvidence();
  all.push({ at: new Date().toISOString(), ...e });
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(-500)));
  } catch {
    /* storage full or blocked: the game carries on */
  }
}
