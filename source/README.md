# 保留地 / Holding Ground.

A browser-based media artwork about keeping a shape while its relationships change. The five original Sculpture Field sculptures remain visible and directly interactive, re-rendered from their original geometry as a black-and-white wire network.

## The score

The sculptures share one slowly migrating ground. Hold one to stop its migration while the others continue. Drag it to another place: its surrounding grid deforms and its previous location remains as a pale wireframe. Release it and its migration resumes without snapping. After 2 minutes 20 seconds, the automatic drift settles; the visitor can still intervene. Nothing resets automatically.

This is a generated, abstract composition, **not a Three Gorges survey or historical simulation**. Its state exists only in memory in the current page. There is no analytics, account, tracking, upload, external font, CDN, cookie, or persistent browser storage.

## Interaction

- Mouse or touch: hold a sculpture, drag, release. The sculpture itself is the control.
- Keyboard: focus the canvas; arrows select a sculpture; Space or Enter holds/releases it. While held, arrows move it. Escape releases it.
- 时间: pause/resume automatic time while preserving interaction.
- 重新开始 or R: clear this session and restart.
- 声音: explicitly enable/disable a quiet generated tone. Audio is never created or played before this action.
- 规则: read the score and provenance. The modal pauses time while open.

Reduced-motion preference starts automatic time paused. Touch and keyboard offer the same persistent relocation rule. Pointer interruption, lost capture, hidden tabs and window blur safely release a sculpture. Animation pauses in hidden tabs and does not jump on return.

## Original sculptures

1. Memory Aperture / 记忆孔径
2. Resonance Garden / 共振花园
3. Data Cloud / 数据云
4. Echo Chamber / 回声室
5. Phase Bloom / 相位花

`public/models/three-gorges.glb` is the preserved original gallery asset. The repository name and GLB filename come from the initial experiment and do not identify a reconstructed dam. `public/models/sculpture-wireframes.json` contains boundary/crease edges extracted from all five actual groups, retaining their relative scales and original placement. It contains 5,789 line segments and is about 285 kB. Tiny bevel clusters in the cloud sculpture are simplified so its geometric form remains readable.

The original Blender project is retained in the repository's `artwork/` directory. Earlier versions of the gallery remain recoverable through Git history.

## Renderer and deployment

The runtime uses Canvas 2D to project the original three-dimensional edges. This deliberately does not require a GPU or WebGL, and the interactive rules remain the same on phones and computers. It is not a static fallback. The camera is fixed: moving the sculpture is the principal gesture.

The app uses vanilla JavaScript and Vite. All production paths are relative for GitHub Pages project URLs. No backend or build-time service is required.

```sh
npm ci
npm run dev
npm run check
npm run preview
```

Use Node.js 22.12+ or 24+. `npm run check` runs state, geometry, renderer and structural tests before a production build. `dist/` is the production output. Serve through HTTP; direct file opening is not supported.

For GitHub Pages, keep production `dist/` contents at the repository root, with `.nojekyll`, and select `main` / `/(root)`. Editable app files are under `source/`. After a change, build from `source/` and replace root production files with `source/dist/` contents, retaining original assets and `artwork/`. Do not publish node_modules or local test output.

## Structure

- `src/simulation.js`: deterministic score, hold/release, movement, session state
- `src/renderer.js`: projection, shared ground deformation, original-edge renderer, hit testing
- `src/main.js`: pointer/keyboard interaction, accessible controls, animation, optional sound
- `src/style.css`: monochrome responsive typography and layout
- `public/models/sculpture-wireframes.json`: optimized original geometry
- `tests/`: pure-state, renderer and packaging tests
- `QA.md`: reproducible browser verification checklist

No license is implied for the original artwork or application code. Build-generated dependency notices are retained separately.
