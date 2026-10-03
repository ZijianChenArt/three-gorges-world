# 相互成形 / In Formation.

An autonomous, continuously running web artwork. Five original sculptures unfold into one woven line field and then re-form in exchanged positions. The visitor does not need to click, drag or complete a task.

The visual language is black-and-white line drawing, archival typography and open space. There is no floor grid, countdown, required gesture, score or migration narrative.

## The running score

One continuous spatial transformation acts on the same original model vertices. Neighboring edges remain related. The five forms dissolve at different times, enter a common curved ribbon, then become the five original forms again. Long original edges are sampled before transformation so they bend as continuous curves rather than cutting across the flow as straight chords.

A cycle takes 84 seconds. Geometry is continuous across its boundary. Each cycle exchanges the sculptures' positions while they are fully inside the common line field; the underlying weave and breathing motion keep evolving across cycles. The first ten seconds already contain a visible transformation.

The two controls are Pause/Play and About. No interaction is needed to start. Reduced-motion preference opens a fully formed still composition with an explicit Play option. Hidden tabs and the About dialog suspend the score and resume without a time jump.

## Five original sculptures

- Memory Aperture / 记忆孔径
- Resonance Garden / 共振花园
- Data Cloud / 数据云
- Echo Chamber / 回声室
- Phase Bloom / 相位花

All five actual geometry groups are retained. `public/models/sculpture-wireframes.json` contains 5,789 original crease/boundary segments (about 285 kB raw). Coplanar triangulation and microscopic bevel detail are simplified, not replaced with invented models. Reformed phases reproduce each original edge set up to a rigid placement and small uniform breathing scale.

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

- `src/simulation.js`: deterministic choreography, source and weave maps, phase offsets
- `src/renderer.js`: continuous-edge projection, automatic framing and Canvas2D rendering
- `src/main.js`: automatic playback, pause, motion preference and About dialog
- `src/style.css`: responsive monochrome layout
- `scripts/extract-wireframes.py`: reproducible GLB-to-edge conversion
- `scripts/WIREFRAME-ASSETS.md`: asset normalization, schema and tolerances
- `tests/`: state, reformation, continuity, framing and structural checks
- `QA.md`: browser verification checklist

No license is implied for the original artwork or application code. Build-generated dependency notices are retained separately.
