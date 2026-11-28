/** The scenes that exist, in playing order, and how many beats each has. */
export const SCENES = [
  { id: '01', beats: 3, title: 's01.scene' },
  { id: '02', beats: 3, title: 'scene' },
] as const;

/** Every scene's beat count, so one scene saving its progress keeps the others'. */
export const SCENE_BEATS: Record<string, number> = Object.fromEntries(SCENES.map(s => [s.id, s.beats]));
