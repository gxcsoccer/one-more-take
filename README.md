# One More Take! · 再拍一条！

A science game for iPad. The player directs a monster film starring a wind-up duck on a tabletop film set; the science of Singapore Primary 4 decides whether the shot works.

This repository currently holds one sample level in real 3D: **Scene 02 — Three Storeys, One Cat** (Light: shadows).

## Run it

```sh
npm install
npm run dev        # prints a Network URL; open it in Safari on an iPad on the same Wi-Fi
```

On the iPad, use Share → Add to Home Screen to run it full screen in landscape.

```sh
npm test           # physics facts and level solvability
npm run smoke      # plays the whole level in Chrome, screenshots land in qa-out/
npm run build      # production build in dist/
```

## How the level plays

Each beat chalks a storyboard outline on the building: the shadow the director wants.

1. **Lights on**: drag the lamp along its track and watch the duck's shadow grow until it fills the outline.
2. **Lights out**: the lamp is off while you set up. Place the lamp where you think it must go, tap the clapperboard, and watch the take. A miss leaves a blue chalk trace of where the shadow really fell.
3. **Save the cat**: two things to set (the lamp and the duck's floor mark), and a cat that must stay in the light.

There is no separate "predict" step: with the lamp off, every set-up is a prediction and every take tests it.

## Layout

| Path | What lives there |
|---|---|
| `src/sim/light.ts` | Pure maths: straight-line light against ellipsoid objects, shadow masks, tests |
| `src/game/scene02.ts` | Level data and the keeper rule |
| `src/game/stage.ts` | The 3D set: models, lights, camera, reactions |
| `src/main.ts` | Flow, input, captions |
| `src/i18n.ts` | Every word, English first, Chinese alternative, tappable science terms |
| `src/evidence.ts` | On-device log of every take, keyed to curriculum rows |
| `public/assets/` | Delivered textures and `manifest.json`; missing slots keep their placeholders |
| `docs/art-brief.md` | Art requirements for the image-generation agent |
| `docs/curriculum/` | Primary 4 objectives table the evidence log refers to |
| `src/v1/`, `v1.html` | The earlier 2D prototype, kept for comparison at `/v1.html` |
