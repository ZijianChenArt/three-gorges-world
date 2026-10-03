# 相互成形 / In Formation.

An autonomous, continuously running web artwork. Five original sculptures have independent, seeded lifecycles: they rest, shed individual edges into strokes and endpoint dots, drift through different quiet fields, and occasionally re-form. No click or gesture is needed.

The visual language is black-and-white line drawing, archival typography and open space. There is no common ribbon, synchronized loop, floor grid, countdown, score or required gesture.

## Independent, continuously changing processes

A fresh random seed is generated once per page visit. Each sculpture then receives its own reproducible sequence of rest, release, drift, return and re-formation intervals. Different fields spread fragments upward, outward, around an open center, across a plane, or softly downward. These choices vary across lifecycles and visits.

Each original edge has a separate release delay, destination, orientation, fading curve and tendency to dissolve into endpoint dots. Only a sparse selection remains visible during full dispersal, leaving room around the marks. Slow continuous oscillations move the fragments; there is no per-frame random noise or jitter. New random choices are introduced only while the relevant sculpture has fully re-formed, so boundaries remain continuous.

The original forms reappear at their own times. There is no shared period, countdown, abrupt reset or demand to interact. The first ten seconds already include a visible release.

The two controls are Pause/Play and About. Reduced-motion preference opens a fully formed still composition with an explicit Play option. Hidden tabs and the About dialog suspend the process and resume without a time jump.

## Five original sculptures

- Memory Aperture / 记忆孔径
- Resonance Garden / 共振花园
- Data Cloud / 数据云
- Echo Chamber / 回声室
- Phase Bloom / 相位花

All five actual geometry groups are retained. `public/models/sculpture-wireframes.json` contains 5,789 original crease/boundary segments (about 285 kB raw). Coplanar triangulation and microscopic bevel detail are simplified, not replaced with invented models. Each sculpture’s reformed interval reproduces its original edge set up to a rigid placement and small uniform breathing scale.

`public/models/three-gorges.glb` is the unchanged original five-sculpture asset. The inherited repository and GLB names come from an earlier experiment; this is not a dam reconstruction, survey or historical simulation. The original Blender project remains in the repository's `artwork/` directory. Previous versions remain in Git history.

## Runtime

Canvas 2D projects real three-dimensional geometry. It works without WebGL or a GPU-specific rendering path. Responsive framing recomputes the complete visible geometry bounds so every phase stays inside the artwork area on portrait phones and desktop screens.

There is no backend, analytics, account, data collection, upload, browser storage, external font, runtime CDN or audio. State exists only in memory in the current page.

## Develop and publish

Use Node.js 22.12+ or 24+.

```sh
npm ci
npm run dev
npm run check
npm run preview
```

`npm run check` runs the state/geometry/renderer/packaging tests and produces `dist/`. Serve over HTTP rather than opening a local file directly.

For GitHub Pages, production files are at the repository root and editable source is under `source/`. Configure Pages to deploy `main` / `/(root)`. To update: build inside `source/`, replace root production files with the new `source/dist/` contents, retain `.nojekyll`, original models and `artwork/`. Do not publish node_modules or local test output.

## Files

- `src/simulation.js`: seeded independent lifecycles, edge release and dispersal fields
- `src/renderer.js`: sparse stroke/dot rendering, trait caching and automatic framing
- `src/main.js`: automatic playback, pause, motion preference and About dialog
- `src/style.css`: responsive monochrome layout
- `scripts/extract-wireframes.py`: reproducible GLB-to-edge conversion
- `scripts/WIREFRAME-ASSETS.md`: asset normalization, schema and tolerances
- `tests/`: random-seed repeatability, independent phases, reformation, continuity, sparsity and framing checks
- `QA.md`: browser verification checklist

No license is implied for the original artwork or application code. Build-generated dependency notices are retained separately.
